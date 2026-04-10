import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import { WebClient } from "@slack/web-api";
import { config } from "./config.js";
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
} from "./celebration.js";
import { insertSaleIfNew, getDashboardData, getSalesStats } from "./db.js";
import type { CelebrationEvent, Sale } from "../shared/types.js";

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

if (process.env.NODE_ENV === "production") {
  const clientDir = path.join(__dirname, "../../dist/client");
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
  io.emit("celebration:start", event);
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

  console.log("[Server] All systems initialized");
}

start().catch((err) => {
  console.error("[Server] Failed to start:", err);
  process.exit(1);
});
