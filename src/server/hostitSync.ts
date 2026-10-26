/**
 * Pull-based sync from the hostit "salescelly" control plane.
 *
 * People edit the team + walk-up songs in their browser at HOSTIT_SYNC_URL. This module polls
 * that app (outbound HTTPS only — the Pi needs no inbound port / tunnel), mirrors the team into
 * the local `reps` table, and downloads trimmed walk-up clips into public/sounds/walkups/.
 *
 * Disabled unless HOSTIT_SYNC_URL and HOSTIT_SYNC_TOKEN are set.
 */
import { existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync, renameSync, readFileSync, rmSync, mkdtempSync } from "fs";
import { execFile, spawn } from "child_process";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import {
  getAllReps,
  createRep,
  updateRep,
  deleteRep,
  getSetting,
  setSetting,
} from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const walkupsDir = path.join(__dirname, "../../public/sounds/walkups");
/** v2: clip walk-ups are stored as "/sounds/walkups/<file>" (v1 stored the bare filename, which never played). */
const APPLY_FORMAT = 2;

interface ManifestRep {
  id: number;
  name: string;
  avatarColor: string;
  spiritAnimal: string;
  walkup:
    | { type: "clip"; sha: string; file: string; label: string }
    | { type: "jingle"; id: string; label: string }
    | { type: "keep" }
    | null;
}
interface Manifest {
  rev: number;
  reps: ManifestRep[];
}

const baseUrl = (process.env.HOSTIT_SYNC_URL || "").replace(/\/+$/, "");
const token = process.env.HOSTIT_SYNC_TOKEN || "";
const intervalMs = Math.max(
  5_000,
  parseInt(process.env.HOSTIT_SYNC_INTERVAL_MS || "20000", 10) || 20_000,
);

let lastError = "";
let running = false;

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, {
    ...init,
    headers: { ...authHeaders(), ...((init?.headers as Record<string, string>) || {}) },
    signal: AbortSignal.timeout(30_000),
  });
  if (!r.ok) {
    throw new Error(`${init?.method || "GET"} ${new URL(url).pathname} → HTTP ${r.status}`);
  }
  return (await r.json()) as T;
}

async function ensureClip(sha: string, file: string): Promise<void> {
  const dest = path.join(walkupsDir, file);
  if (existsSync(dest)) return;
  mkdirSync(walkupsDir, { recursive: true });
  const r = await fetch(`${baseUrl}/api/sync/media/${sha}.mp3`, {
    headers: authHeaders(),
    signal: AbortSignal.timeout(60_000),
  });
  if (!r.ok) throw new Error(`clip ${sha} → HTTP ${r.status}`);
  const tmp = dest + ".part";
  writeFileSync(tmp, Buffer.from(await r.arrayBuffer()));
  renameSync(tmp, dest);
  console.log(`[hostit-sync] Downloaded walk-up ${file}`);
}

/** First contact: send the Pi's existing Team so hostit starts from it (no-op if hostit already has reps). */
async function seedIfNeeded(): Promise<void> {
  if (getSetting("hostitSeeded") === "true") return;
  const reps = getAllReps().map((r) => ({
    name: r.name,
    avatarColor: r.avatar_color,
    spiritAnimal: r.spirit_animal ?? "",
    walkupSong: r.walkup_song,
    walkupSongLabel: r.walkup_song_label ?? null,
  }));
  const res = await fetchJson<{ seeded: number }>(`${baseUrl}/api/sync/seed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reps }),
  });
  setSetting("hostitSeeded", "true");
  console.log(`[hostit-sync] Seeded hostit with ${res.seeded} existing rep(s)`);
}

function applyManifest(m: Manifest): boolean {
  /** hostit rep id → local reps.id, so renames on the web keep the same local row (and its claims). */
  const map: Record<string, number> = JSON.parse(getSetting("hostitRepMap") || "{}");
  const local = getAllReps();
  const byId = new Map(local.map((r) => [r.id, r]));
  const byName = new Map(local.map((r) => [r.name.trim().toLowerCase(), r]));
  const keep = new Set<number>();
  const newMap: Record<string, number> = {};
  let changed = false;

  for (const mr of m.reps) {
    let row = byId.get(map[String(mr.id)]) ?? byName.get(mr.name.trim().toLowerCase());
    if (row && keep.has(row.id)) row = undefined;

    let walkupSong: string | null | undefined;
    let walkupSongLabel: string | null | undefined;
    if (mr.walkup?.type === "clip") {
      // playSong() only plays URLs/paths ("/sounds/walkups/x.mp3"); a bare filename is silently ignored
      walkupSong = `/sounds/walkups/${mr.walkup.file}`;
      walkupSongLabel = mr.walkup.label;
    } else if (mr.walkup?.type === "jingle") {
      walkupSong = mr.walkup.id;
      walkupSongLabel = mr.walkup.label;
    } else if (mr.walkup?.type === "keep") {
      walkupSong = undefined; // song was set on the Pi before hostit existed — leave it alone
    } else {
      walkupSong = null;
      walkupSongLabel = null;
    }

    if (!row) {
      row = createRep(
        mr.name,
        walkupSong ?? undefined,
        mr.avatarColor,
        mr.spiritAnimal,
        walkupSongLabel,
      );
      changed = true;
    } else {
      const patch: Parameters<typeof updateRep>[1] = {};
      if (row.name !== mr.name) patch.name = mr.name;
      if (row.avatar_color !== mr.avatarColor) patch.avatarColor = mr.avatarColor;
      if ((row.spirit_animal ?? "") !== mr.spiritAnimal) patch.spiritAnimal = mr.spiritAnimal;
      if (walkupSong !== undefined && row.walkup_song !== walkupSong) {
        patch.walkupSong = walkupSong;
        patch.walkupSongLabel = walkupSongLabel ?? null;
      }
      if (Object.keys(patch).length) {
        updateRep(row.id, patch);
        changed = true;
      }
    }
    keep.add(row.id);
    newMap[String(mr.id)] = row.id;
  }

  for (const r of local) {
    if (!keep.has(r.id)) {
      deleteRep(r.id);
      changed = true;
    }
  }
  setSetting("hostitRepMap", JSON.stringify(newMap));
  return changed;
}

/** Delete hostit-managed clips no rep points to any more. Never touches manually uploaded files. */
function pruneClips(m: Manifest): void {
  const wanted = new Set(
    m.reps.flatMap((r) => (r.walkup?.type === "clip" ? [r.walkup.file] : [])),
  );
  let files: string[] = [];
  try {
    files = readdirSync(walkupsDir);
  } catch {
    return;
  }
  for (const f of files) {
    if (/^hostit-[0-9a-f]{16}\.mp3(\.part)?$/.test(f) && !wanted.has(f)) {
      try {
        unlinkSync(path.join(walkupsDir, f));
      } catch {
        /* ignore */
      }
    }
  }
}

async function tick(onChange: () => void): Promise<void> {
  if (running) return;
  running = true;
  try {
    await seedIfNeeded();
    // bump APPLY_FORMAT when applyManifest's output changes so existing rows get rewritten once
    const applied = getSetting(`hostitAppliedRev${APPLY_FORMAT}`) || "0";
    const qs = new URLSearchParams({ applied, error: lastError });
    const m = await fetchJson<Manifest>(`${baseUrl}/api/sync/manifest?${qs}`);
    if (String(m.rev) !== applied) {
      // download every clip before touching the DB so a rep never points at a missing file
      for (const r of m.reps) {
        if (r.walkup?.type === "clip") await ensureClip(r.walkup.sha, r.walkup.file);
      }
      const changed = applyManifest(m);
      pruneClips(m);
      setSetting(`hostitAppliedRev${APPLY_FORMAT}`, String(m.rev));
      console.log(
        `[hostit-sync] Applied rev ${m.rev} (${m.reps.length} reps${changed ? ", changed" : ""})`,
      );
      if (changed) onChange();
      // report right away so the web UI flips to "up to date"
      await fetchJson(`${baseUrl}/api/sync/manifest?applied=${m.rev}`).catch(() => {});
    }
    lastError = "";
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg !== lastError) console.warn("[hostit-sync]", msg);
    lastError = msg;
  } finally {
    running = false;
  }
}

// ── YouTube downloads on behalf of hostit ───────────────────────────────────
// YouTube blocks datacenter IPs ("Sign in to confirm you're not a bot"), so hostit asks the Pi —
// which sits on a normal office connection — to fetch the audio. We download the raw audio stream
// (no ffmpeg needed on the Pi) and upload it; hostit converts and trims.

const ytdlpBin = process.env.YTDLP_BIN || "yt-dlp";
const jobIntervalMs = 4_000;
let jobBusy = false;
let ytdlpMissingLogged = false;

function report(id: string, stage: string, pct?: number): void {
  void fetch(`${baseUrl}/api/sync/jobs/${id}/progress`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ stage, pct }),
    signal: AbortSignal.timeout(5_000),
  }).catch(() => {});
}

/** yt-dlp with progress → hostit (throttled). Resolves with the final stdout line. */
function ytdlpWithProgress(id: string, args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(ytdlpBin, [...args, "--newline", "--progress", "--no-colors", "--progress-template",
      "download:PROG %(progress.downloaded_bytes)s %(progress.total_bytes)s %(progress.total_bytes_estimate)s"]);
    let last = "", err = "", sent = 0;
    const timer = setTimeout(() => p.kill("SIGKILL"), timeoutMs);
    let buf = "";
    p.stdout.on("data", (d: Buffer) => {
      buf += d.toString();
      const lines = buf.split("\n");
      buf = lines.pop()!;
      for (const line of lines) {
        const m = line.match(/^PROG (\S+) (\S+) (\S+)/);
        if (m) {
          const done = Number(m[1]), total = Number(m[2]) || Number(m[3]);
          if (Date.now() - sent > 1000 && total) { sent = Date.now(); report(id, "download", (done / total) * 100); }
        } else if (line.trim()) last = line.trim();
      }
    });
    p.stderr.on("data", (d: Buffer) => { err += d.toString(); });
    p.on("error", (e) => { clearTimeout(timer); reject(e); });
    p.on("close", (code) => {
      clearTimeout(timer);
      if (buf.trim() && !buf.startsWith("PROG")) last = buf.trim();
      if (code === 0) resolve(last);
      else reject(new Error(err.trim().split("\n").pop() || `yt-dlp exited ${code}`));
    });
  });
}

async function doJob(job: { id: string; url: string }): Promise<void> {
  const dir = mkdtempSync(path.join(os.tmpdir(), "hostit-yt-"));
  try {
    console.log(`[hostit-sync] Downloading for hostit: ${job.url}`);
    report(job.id, "lookup");
    const lastLine = await ytdlpWithProgress(
      job.id,
      ["--no-playlist", "--no-warnings", "-f", "bestaudio[ext=m4a]/bestaudio/best",
       "-o", path.join(dir, "a.%(ext)s"), "--print", "after_move:%(title)s\t%(duration)s\t%(filepath)s", job.url],
      10 * 60_000,
    );
    const [title = "", duration = "0", filepath = ""] = lastLine.split("\t");
    if (!filepath || !existsSync(filepath)) throw new Error("yt-dlp produced no file");
    report(job.id, "upload", 0);
    const r = await fetch(`${baseUrl}/api/sync/jobs/${job.id}/upload`, {
      method: "POST",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/octet-stream",
        "X-Title": encodeURIComponent(title),
        "X-Duration": duration,
      },
      body: readFileSync(filepath),
      signal: AbortSignal.timeout(5 * 60_000),
    });
    if (!r.ok) throw new Error(`upload → HTTP ${r.status}`);
    console.log(`[hostit-sync] Uploaded "${title}"`);
  } catch (e) {
    const err = e as Error & { code?: string };
    const msg = err.code === "ENOENT" ? "yt-dlp is not installed on the display" : err.message;
    console.warn("[hostit-sync] Job failed:", msg);
    await fetch(`${baseUrl}/api/sync/jobs/${job.id}/fail`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ error: msg.slice(0, 240) }),
      signal: AbortSignal.timeout(15_000),
    }).catch(() => {});
    if (err.code === "ENOENT" && !ytdlpMissingLogged) {
      ytdlpMissingLogged = true;
      console.warn("[hostit-sync] Install yt-dlp: python3 -m pip install --user -U --break-system-packages yt-dlp");
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function jobTick(): Promise<void> {
  if (jobBusy) return;
  jobBusy = true;
  try {
    const { jobs } = await fetchJson<{ jobs: { id: string; url: string }[] }>(`${baseUrl}/api/sync/jobs`);
    for (const j of jobs) await doJob(j);
  } catch {
    /* manifest tick reports connectivity errors */
  } finally {
    jobBusy = false;
  }
}

/** `onChange` runs after the local Team changed (broadcast so the kiosk reloads reps). */
export function startHostitSync(onChange: () => void): void {
  if (!baseUrl || !token) {
    console.log("[hostit-sync] Disabled (set HOSTIT_SYNC_URL and HOSTIT_SYNC_TOKEN to enable)");
    return;
  }
  console.log(`[hostit-sync] Polling ${baseUrl} every ${intervalMs / 1000}s`);
  void tick(onChange);
  setInterval(() => void tick(onChange), intervalMs);
  setInterval(() => void jobTick(), jobIntervalMs);
}
