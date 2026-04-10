import Database from "better-sqlite3";
import path from "path";
import { mkdirSync } from "fs";
import { fileURLToPath } from "url";
import type {
  Sale,
  DashboardData,
  LeaderboardEntry,
  DailyTotal,
} from "../shared/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "../../data/sales.db");

mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rep TEXT NOT NULL,
    customer TEXT NOT NULL,
    product TEXT DEFAULT '',
    amount REAL NOT NULL,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    slack_ts TEXT,
    raw_message TEXT,
    meta_json TEXT
  )
`);

const salesCols = db
  .prepare(`PRAGMA table_info(sales)`)
  .all() as { name: string }[];
if (!salesCols.some((c) => c.name === "meta_json")) {
  db.exec(`ALTER TABLE sales ADD COLUMN meta_json TEXT`);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS reps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    walkup_song TEXT,
    avatar_color TEXT DEFAULT '#e2a336'
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS song_mappings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_type TEXT NOT NULL,
    match_value TEXT,
    song_file TEXT NOT NULL
  )
`);

if (!salesCols.some((c) => c.name === "claimed_by")) {
  db.exec(`ALTER TABLE sales ADD COLUMN claimed_by INTEGER REFERENCES reps(id)`);
}

export function insertSale(sale: Sale): Sale {
  const metaJson = sale.meta ? JSON.stringify(sale.meta) : null;
  const stmt = db.prepare(`
    INSERT INTO sales (rep, customer, product, amount, timestamp, slack_ts, raw_message, meta_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    sale.rep,
    sale.customer,
    sale.product || "",
    sale.amount,
    sale.timestamp || new Date().toISOString(),
    sale.slackTs || null,
    sale.rawMessage || null,
    metaJson,
  );
  return { ...sale, id: result.lastInsertRowid as number };
}

/** Skip insert if this Slack message was already stored (live + backfill dedupe). */
export function insertSaleIfNew(sale: Sale): Sale | null {
  if (sale.slackTs) {
    const exists = db
      .prepare(`SELECT 1 FROM sales WHERE slack_ts = ?`)
      .get(sale.slackTs);
    if (exists) return null;
  }
  try {
    return insertSale(sale);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("UNIQUE") || msg.includes("unique")) return null;
    throw e;
  }
}

function rowToSale(row: Record<string, unknown>): Sale {
  let meta: Sale["meta"];
  const mj = row.meta_json;
  if (typeof mj === "string" && mj.length > 0) {
    try {
      meta = JSON.parse(mj) as Sale["meta"];
    } catch {
      meta = undefined;
    }
  }
  return {
    id: row.id as number,
    rep: row.rep as string,
    customer: row.customer as string,
    product: row.product as string,
    amount: row.amount as number,
    timestamp: row.timestamp as string,
    slackTs: (row.slackTs as string) || undefined,
    rawMessage: (row.rawMessage as string) || undefined,
    meta,
  };
}

export function getRecentSales(limit = 20): Sale[] {
  const rows = db
    .prepare(
      `SELECT id, rep, customer, product, amount, timestamp,
              slack_ts as slackTs, raw_message as rawMessage, meta_json
       FROM sales ORDER BY timestamp DESC LIMIT ?`,
    )
    .all(limit) as Record<string, unknown>[];
  return rows.map(rowToSale);
}

/** Slide Cloud orders don’t include a salesperson — we rank by account (customer). */
export function getLeaderboard(): LeaderboardEntry[] {
  const start = monthStart();
  return db
    .prepare(
      `SELECT customer as name, COUNT(*) as count
       FROM sales WHERE timestamp >= ?
       GROUP BY customer
       ORDER BY count DESC
       LIMIT 10`,
    )
    .all(start) as LeaderboardEntry[];
}

export function getPeriodTotal(period: "day" | "week" | "month"): {
  total: number;
  count: number;
} {
  const start = periodStart(period);
  return db
    .prepare(
      `SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count
       FROM sales WHERE timestamp >= ?`,
    )
    .get(start) as { total: number; count: number };
}

export function getDailyTotals(days = 14): DailyTotal[] {
  return db
    .prepare(
      `SELECT date(timestamp) as date, SUM(amount) as total, COUNT(*) as count
       FROM sales WHERE timestamp >= datetime('now', ?)
       GROUP BY date(timestamp) ORDER BY date ASC`,
    )
    .all(`-${days} days`) as DailyTotal[];
}

export function getTodaySaleCount(): number {
  const result = db
    .prepare(
      `SELECT COUNT(*) as count FROM sales
       WHERE date(timestamp) = date('now')`,
    )
    .get() as { count: number };
  return result.count;
}

export function getSalesStats(): {
  totalSales: number;
  lastSaleAt: string | null;
} {
  const total = db
    .prepare(`SELECT COUNT(*) as c FROM sales`)
    .get() as { c: number };
  const last = db
    .prepare(
      `SELECT timestamp FROM sales ORDER BY datetime(timestamp) DESC LIMIT 1`,
    )
    .get() as { timestamp: string } | undefined;
  return {
    totalSales: total.c,
    lastSaleAt: last?.timestamp ?? null,
  };
}

export function getDashboardData(): DashboardData {
  const today = getPeriodTotal("day");
  const week = getPeriodTotal("week");
  const month = getPeriodTotal("month");

  return {
    recentSales: getRecentSales(),
    leaderboard: getLeaderboard(),
    todayCount: today.count,
    weekCount: week.count,
    monthCount: month.count,
    dailyTotals: getDailyTotals(),
  };
}

// ── Reps ────────────────────────────────────────────────────

export interface RepRow {
  id: number;
  name: string;
  walkup_song: string | null;
  avatar_color: string;
}

export function getAllReps(): RepRow[] {
  return db.prepare(`SELECT * FROM reps ORDER BY name`).all() as RepRow[];
}

export function getRepById(id: number): RepRow | undefined {
  return db.prepare(`SELECT * FROM reps WHERE id = ?`).get(id) as
    | RepRow
    | undefined;
}

export function createRep(
  name: string,
  walkupSong?: string,
  avatarColor?: string,
): RepRow {
  const result = db
    .prepare(
      `INSERT INTO reps (name, walkup_song, avatar_color) VALUES (?, ?, ?)`,
    )
    .run(name, walkupSong || null, avatarColor || "#e2a336");
  return getRepById(result.lastInsertRowid as number)!;
}

export function updateRep(
  id: number,
  data: { name?: string; walkupSong?: string | null; avatarColor?: string },
): RepRow | undefined {
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (data.name !== undefined) {
    sets.push("name = ?");
    vals.push(data.name);
  }
  if (data.walkupSong !== undefined) {
    sets.push("walkup_song = ?");
    vals.push(data.walkupSong);
  }
  if (data.avatarColor !== undefined) {
    sets.push("avatar_color = ?");
    vals.push(data.avatarColor);
  }
  if (sets.length === 0) return getRepById(id);
  vals.push(id);
  db.prepare(`UPDATE reps SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  return getRepById(id);
}

export function deleteRep(id: number): boolean {
  const r = db.prepare(`DELETE FROM reps WHERE id = ?`).run(id);
  return r.changes > 0;
}

// ── Song mappings ───────────────────────────────────────────

export interface SongMappingRow {
  id: number;
  match_type: string;
  match_value: string | null;
  song_file: string;
}

export function getAllSongMappings(): SongMappingRow[] {
  return db
    .prepare(`SELECT * FROM song_mappings ORDER BY match_type, match_value`)
    .all() as SongMappingRow[];
}

export function createSongMapping(
  matchType: string,
  matchValue: string | null,
  songFile: string,
): SongMappingRow {
  if (matchType === "default") {
    db.prepare(
      `DELETE FROM song_mappings WHERE match_type = 'default'`,
    ).run();
  }
  const result = db
    .prepare(
      `INSERT INTO song_mappings (match_type, match_value, song_file) VALUES (?, ?, ?)`,
    )
    .run(matchType, matchValue, songFile);
  return db
    .prepare(`SELECT * FROM song_mappings WHERE id = ?`)
    .get(result.lastInsertRowid as number) as SongMappingRow;
}

export function deleteSongMapping(id: number): boolean {
  const r = db.prepare(`DELETE FROM song_mappings WHERE id = ?`).run(id);
  return r.changes > 0;
}

export function getSongForModel(model: string): string | null {
  const row = db
    .prepare(
      `SELECT song_file FROM song_mappings WHERE match_type = 'model' AND ? LIKE '%' || match_value || '%' LIMIT 1`,
    )
    .get(model) as { song_file: string } | undefined;
  return row?.song_file ?? null;
}

export function getDefaultSong(): string | null {
  const row = db
    .prepare(
      `SELECT song_file FROM song_mappings WHERE match_type = 'default' LIMIT 1`,
    )
    .get() as { song_file: string } | undefined;
  return row?.song_file ?? null;
}

// ── Sale claiming ───────────────────────────────────────────

export function claimSale(
  saleId: number,
  repId: number,
): Sale | null {
  db.prepare(`UPDATE sales SET claimed_by = ? WHERE id = ?`).run(repId, saleId);
  const row = db
    .prepare(
      `SELECT id, rep, customer, product, amount, timestamp,
              slack_ts as slackTs, raw_message as rawMessage, meta_json
       FROM sales WHERE id = ?`,
    )
    .get(saleId) as Record<string, unknown> | undefined;
  if (!row) return null;
  return rowToSale(row);
}

function periodStart(period: "day" | "week" | "month"): string {
  const now = new Date();
  switch (period) {
    case "day":
      return new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      ).toISOString();
    case "week": {
      const d = new Date(now);
      d.setDate(d.getDate() - d.getDay());
      d.setHours(0, 0, 0, 0);
      return d.toISOString();
    }
    case "month":
      return monthStart();
  }
}

function monthStart(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}
