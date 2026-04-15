import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import { WebClient } from "@slack/web-api";
import { config, isBigQueryAccountOwnerConfigured } from "./config.js";
import {
  probeBigQueryAccountOwner,
} from "./bigqueryAccountOwner.js";
import { enqueueSlideOrder } from "./slideOrderBatcher.js";
import {
  initSlack,
  setSaleCallback,
  setHistorySaleHandler,
  setBackfillCompleteHandler,
} from "./slack.js";
import { initPlugs } from "./plugs.js";
import {
  shouldCelebrate,
  shouldCelebrateSlidePack,
  triggerCelebration,
  setCelebrationCallback,
  buildWalkupCelebration,
} from "./celebration.js";
import {
  insertSaleIfNew,
  getDashboardData,
  getSalesStats,
  getAllReps,
  createRep,
  updateRep,
  deleteRep,
  getAllSongMappings,
  createSongMapping,
  deleteSongMapping,
  getAllSettings,
  getSetting,
  setSetting,
} from "./db.js";
import type { CelebrationEvent, Sale } from "../shared/types.js";
import { readdirSync, mkdirSync, writeFileSync } from "fs";
import multer from "multer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin:
      process.env.NODE_ENV !== "production"
        ? "http://localhost:5173"
        : undefined,
  },
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

/** BigQuery DWH probe (auth + table readable). 503 only when configured but the probe fails. */
app.get("/api/health/bigquery", async (_req, res) => {
  const configured = isBigQueryAccountOwnerConfigured();
  const r = await probeBigQueryAccountOwner();
  if (!configured) {
    res.json({ configured: false, ...r });
    return;
  }
  res.status(r.ok ? 200 : 503).json({ configured: true, ...r });
});

app.get("/api/stats", (_req, res) => {
  const stats = getSalesStats();
  res.json({
    ...stats,
    slackChannelConfigured: Boolean(config.slack.salesChannelId),
    backfillOnStart: config.slack.backfillOnStart,
  });
});

/**
 * Verify `.env` channel id + bot membership (curl from the Pi).
 * Expect: ok:true, name:"dev-orders", isMember:true
 */
app.get("/api/slack/channel", async (_req, res) => {
  const id = config.slack.salesChannelId;
  if (!id) {
    res.status(400).json({
      ok: false,
      error: "SLACK_SALES_CHANNEL_ID is empty",
      hint: "In Slack: open #dev-orders → channel name → View channel details → copy Channel ID at the bottom (C… or G…).",
    });
    return;
  }
  if (!config.slack.botToken) {
    res.status(400).json({ ok: false, error: "SLACK_BOT_TOKEN missing" });
    return;
  }
  if (!/^[CG][A-Z0-9]{8,}$/i.test(id)) {
    res.status(400).json({
      ok: false,
      error: "invalid_channel_id_format",
      configured: id,
      hint: "Must look like C01234ABCDE or G01234ABCDE — not the channel display name.",
    });
    return;
  }
  try {
    const client = new WebClient(config.slack.botToken);
    const r = await client.conversations.info({ channel: id });
    if (!r.ok) {
      res.json({
        ok: false,
        slackError: r.error,
        hint:
          r.error === "channel_not_found"
            ? "Wrong ID, or bot lacks access — invite @SalesDisplay to #dev-orders and add channels:read / groups:read (private)."
            : undefined,
      });
      return;
    }
    const ch = r.channel;
    res.json({
      ok: true,
      id: ch?.id,
      name: ch?.name,
      isPrivate: ch?.is_private,
      isMember: ch?.is_member,
    });
  } catch (e) {
    res.status(500).json({
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }
});

/** Same payload as `dashboard:update` — lets the Pi UI load even if Socket.IO is flaky. */
app.get("/api/dashboard", (_req, res) => {
  res.json(getDashboardData());
});

// ── JSON body parser ──────────────────────────────────────
app.use(express.json());

// ── Reps CRUD ─────────────────────────────────────────────

app.get("/api/reps", (_req, res) => {
  const rows = getAllReps();
  res.json(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      walkupSong: r.walkup_song,
      avatarColor: r.avatar_color,
    })),
  );
});

app.post("/api/reps", (req, res) => {
  const { name, walkupSong, avatarColor } = req.body as {
    name?: string;
    walkupSong?: string;
    avatarColor?: string;
  };
  if (!name?.trim()) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  try {
    const r = createRep(name.trim(), walkupSong, avatarColor);
    res.json({
      id: r.id,
      name: r.name,
      walkupSong: r.walkup_song,
      avatarColor: r.avatar_color,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("UNIQUE")) {
      res.status(409).json({ error: "rep_already_exists" });
      return;
    }
    throw e;
  }
});

app.put("/api/reps/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { name, walkupSong, avatarColor } = req.body as {
    name?: string;
    walkupSong?: string | null;
    avatarColor?: string;
  };
  const r = updateRep(id, { name, walkupSong, avatarColor });
  if (!r) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.json({
    id: r.id,
    name: r.name,
    walkupSong: r.walkup_song,
    avatarColor: r.avatar_color,
  });
});

app.delete("/api/reps/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (deleteRep(id)) {
    res.json({ ok: true });
  } else {
    res.status(404).json({ error: "not_found" });
  }
});

// ── Deezer song search proxy (avoids CORS) ───────────────

app.get("/api/songs/search", async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) {
    res.json({ data: [] });
    return;
  }
  try {
    const url = `https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=12`;
    const r = await fetch(url);
    const json = (await r.json()) as {
      data?: {
        id: number;
        title: string;
        artist: { name: string };
        album: { title: string; cover_small: string };
        preview: string;
        duration: number;
      }[];
    };
    const results = (json.data || []).map((t) => ({
      id: t.id,
      title: t.title,
      artist: t.artist.name,
      album: t.album.title,
      cover: t.album.cover_small,
      previewUrl: t.preview,
      duration: t.duration,
    }));
    res.json({ data: results });
  } catch (e) {
    console.error("[Deezer] Search failed:", e);
    res.status(502).json({ error: "deezer_search_failed" });
  }
});

// ── App settings (runtime config) ─────────────────────────

const SETTINGS_DEFAULTS: Record<string, string> = {
  celebrationDuration: String(config.celebration.defaultDuration),
  milestoneInterval: String(config.celebration.milestoneInterval),
  celebrateSlideOrders: config.celebration.celebrateSlideOrders ? "true" : "false",
  bigOrderThreshold: "0",
  bigOrderSong: "",
  bigOrderSongLabel: "",
};

function getEffectiveSettings(): Record<string, string> {
  const stored = getAllSettings();
  return { ...SETTINGS_DEFAULTS, ...stored };
}

{
  const s = getEffectiveSettings();
  config.celebration.defaultDuration = parseInt(s.celebrationDuration, 10) || 30;
  config.celebration.milestoneInterval = parseInt(s.milestoneInterval, 10) || 0;
  config.celebration.celebrateSlideOrders = s.celebrateSlideOrders === "true";
}

app.get("/api/settings", (_req, res) => {
  res.json(getEffectiveSettings());
});

app.put("/api/settings", (req, res) => {
  const body = req.body as Record<string, string>;
  for (const [key, val] of Object.entries(body)) {
    if (key in SETTINGS_DEFAULTS) {
      setSetting(key, String(val));
    }
  }
  const updated = getEffectiveSettings();

  config.celebration.defaultDuration = parseInt(updated.celebrationDuration, 10) || 30;
  config.celebration.milestoneInterval = parseInt(updated.milestoneInterval, 10) || 0;
  config.celebration.celebrateSlideOrders = updated.celebrateSlideOrders === "true";

  res.json(updated);
});

// ── Song files & mappings ─────────────────────────────────

const soundsRoot = path.join(__dirname, "../../public/sounds");

function listSoundFiles(): {
  walkups: string[];
  models: string[];
  root: string[];
} {
  const readDir = (sub: string) => {
    try {
      return readdirSync(path.join(soundsRoot, sub)).filter((f) =>
        /\.(mp3|wav|ogg|m4a|webm)$/i.test(f),
      );
    } catch {
      return [];
    }
  };
  let root: string[] = [];
  try {
    root = readdirSync(soundsRoot).filter(
      (f) => /\.(mp3|wav|ogg|m4a|webm)$/i.test(f),
    );
  } catch {
    /* no root files */
  }
  return { walkups: readDir("walkups"), models: readDir("models"), root };
}

app.get("/api/songs", (_req, res) => {
  res.json(listSoundFiles());
});

const upload = multer({ limits: { fileSize: 20 * 1024 * 1024 } });

app.post("/api/songs/upload", upload.single("file"), (req, res) => {
  const folder = (req.body?.folder as string) || "walkups";
  if (!["walkups", "models", "root"].includes(folder)) {
    res.status(400).json({ error: "invalid_folder" });
    return;
  }
  if (!req.file) {
    res.status(400).json({ error: "no_file" });
    return;
  }
  const dest =
    folder === "root" ? soundsRoot : path.join(soundsRoot, folder);
  mkdirSync(dest, { recursive: true });
  const filename = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
  writeFileSync(path.join(dest, filename), req.file.buffer);
  res.json({ ok: true, filename, folder });
});

app.delete("/api/songs/:folder/:filename", (req, res) => {
  const { folder, filename } = req.params;
  if (!["walkups", "models"].includes(folder)) {
    res.status(400).json({ error: "invalid_folder" });
    return;
  }
  const filePath = path.join(soundsRoot, folder, filename);
  try {
    const { unlinkSync } = require("fs");
    unlinkSync(filePath);
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: "not_found" });
  }
});

app.get("/api/song-mappings", (_req, res) => {
  const rows = getAllSongMappings();
  res.json(
    rows.map((r) => ({
      id: r.id,
      matchType: r.match_type,
      matchValue: r.match_value,
      songFile: r.song_file,
      songLabel: r.song_label || "",
    })),
  );
});

app.post("/api/song-mappings", (req, res) => {
  const { matchType, matchValue, songFile, songLabel } = req.body as {
    matchType?: string;
    matchValue?: string | null;
    songFile?: string;
    songLabel?: string;
  };
  if (!matchType || !songFile) {
    res.status(400).json({ error: "matchType and songFile required" });
    return;
  }
  const m = createSongMapping(matchType, matchValue ?? null, songFile, songLabel);
  res.json({
    id: m.id,
    matchType: m.match_type,
    matchValue: m.match_value,
    songFile: m.song_file,
    songLabel: m.song_label || "",
  });
});

app.delete("/api/song-mappings/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (deleteSongMapping(id)) {
    res.json({ ok: true });
  } else {
    res.status(404).json({ error: "not_found" });
  }
});

// ── Sale claim (walk-up trigger) ──────────────────────────

app.post("/api/sales/:id/claim", (req, res) => {
  const saleId = parseInt(req.params.id, 10);
  const { repId } = req.body as { repId?: number };
  if (!repId) {
    res.status(400).json({ error: "repId is required" });
    return;
  }
  const ev = buildWalkupCelebration(saleId, repId);
  if (!ev) {
    res.status(404).json({ error: "sale or rep not found" });
    return;
  }
  triggerCelebration(ev);
  res.json({ ok: true, celebration: ev });
});

if (process.env.NODE_ENV === "production") {
  const clientDir = path.join(__dirname, "../../dist/client");
  app.use("/sounds", express.static(soundsRoot));
  app.use("/images", express.static(path.join(__dirname, "../../public/images")));
  app.use(express.static(clientDir));
  app.get("/{*splat}", (req, res) => {
    if (req.path.startsWith("/api")) {
      res.status(404).json({ error: "unknown_api_route", path: req.path });
      return;
    }
    res.sendFile(path.join(clientDir, "index.html"));
  });
}

io.on("connection", (socket) => {
  console.log("[Socket] Client connected");
  socket.emit("dashboard:update", getDashboardData());
  socket.on("disconnect", () => console.log("[Socket] Client disconnected"));
});

function broadcastDashboard(): void {
  io.emit("dashboard:update", getDashboardData());
}

setCelebrationCallback((event: CelebrationEvent) => {
  const eventName =
    event.type === "walkup" ? "celebration:walkup" : "celebration:start";
  io.emit(eventName, event);
  setTimeout(() => io.emit("celebration:end"), event.duration * 1000);
});

function ingestSlackSale(
  sale: Sale,
  opts: { celebrate: boolean; notifySocket: boolean },
): boolean {
  const saved = insertSaleIfNew(sale);
  if (!saved) return false;
  if (opts.notifySocket) {
    io.emit("sale:new", saved);
    broadcastDashboard();
    if (opts.celebrate) {
      const celebration = shouldCelebrate(saved);
      if (celebration) triggerCelebration(celebration);
    }
  }
  return true;
}

setSaleCallback((sale) => {
  if (sale.meta?.source === "slide_cloud") {
    const saved = insertSaleIfNew(sale);
    if (!saved) return;
    io.emit("sale:new", saved);
    broadcastDashboard();
    enqueueSlideOrder(saved, config.slideBatchDebounceMs, (batch) => {
      broadcastDashboard();
      const ev = shouldCelebrateSlidePack(batch);
      if (ev) triggerCelebration(ev);
    });
    return;
  }
  ingestSlackSale(sale, { celebrate: true, notifySocket: true });
});

setHistorySaleHandler((sale) =>
  ingestSlackSale(sale, { celebrate: false, notifySocket: false }),
);

setBackfillCompleteHandler(() => {
  broadcastDashboard();
});

async function start(): Promise<void> {
  server.listen(config.port, () => {
    console.log(`[Server] Running on http://localhost:${config.port}`);
  });

  await initPlugs();

  try {
    await initSlack();
  } catch (err) {
    console.error("[Slack] Failed to connect:", err);
    console.warn("[Slack] Server will continue without Slack integration.");
  }

  if (isBigQueryAccountOwnerConfigured()) {
    const bq = await probeBigQueryAccountOwner();
    if (bq.ok) {
      console.log(
        `[BigQuery] Account owner lookup ready (probe ${bq.elapsedMs ?? "?"}ms)`,
      );
    } else {
      console.warn(`[BigQuery] Probe failed — Slide rep enrichment disabled: ${bq.error}`);
    }
  }

  console.log("[Server] All systems initialized");
}

start().catch((err) => {
  console.error("[Server] Failed to start:", err);
  process.exit(1);
});
