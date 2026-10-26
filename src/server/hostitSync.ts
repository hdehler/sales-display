/**
 * Pull-based sync from the hostit "salescelly" control plane.
 *
 * People edit the team + walk-up songs in their browser at HOSTIT_SYNC_URL. This module polls
 * that app (outbound HTTPS only — the Pi needs no inbound port / tunnel), mirrors the team into
 * the local `reps` table, and downloads trimmed walk-up clips into public/sounds/walkups/.
 *
 * Disabled unless HOSTIT_SYNC_URL and HOSTIT_SYNC_TOKEN are set.
 */
import { existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync, renameSync } from "fs";
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
      walkupSong = mr.walkup.file;
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
    const applied = getSetting("hostitAppliedRev") || "0";
    const qs = new URLSearchParams({ applied, error: lastError });
    const m = await fetchJson<Manifest>(`${baseUrl}/api/sync/manifest?${qs}`);
    if (String(m.rev) !== applied) {
      // download every clip before touching the DB so a rep never points at a missing file
      for (const r of m.reps) {
        if (r.walkup?.type === "clip") await ensureClip(r.walkup.sha, r.walkup.file);
      }
      const changed = applyManifest(m);
      pruneClips(m);
      setSetting("hostitAppliedRev", String(m.rev));
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

/** `onChange` runs after the local Team changed (broadcast so the kiosk reloads reps). */
export function startHostitSync(onChange: () => void): void {
  if (!baseUrl || !token) {
    console.log("[hostit-sync] Disabled (set HOSTIT_SYNC_URL and HOSTIT_SYNC_TOKEN to enable)");
    return;
  }
  console.log(`[hostit-sync] Polling ${baseUrl} every ${intervalMs / 1000}s`);
  void tick(onChange);
  setInterval(() => void tick(onChange), intervalMs);
}
