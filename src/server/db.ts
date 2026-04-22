import Database from "better-sqlite3";
import path from "path";
import { mkdirSync } from "fs";
import { fileURLToPath } from "url";
import type {
  Sale,
  DashboardData,
  LeaderboardEntry,
  DailyTotal,
  HunterLeaderboardEntry,
} from "../shared/types.js";
import { UNKNOWN_REP } from "../shared/rep.js";

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
  CREATE TABLE IF NOT EXISTS demo_bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slack_ts TEXT UNIQUE NOT NULL,
    bdr TEXT NOT NULL,
    company TEXT NOT NULL,
    ae TEXT,
    territory TEXT,
    demo_scheduled_date TEXT,
    raw_message TEXT,
    timestamp TEXT NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS reps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    walkup_song TEXT,
    avatar_color TEXT DEFAULT '#e2a336'
  )
`);

const repsCols = db.pragma("table_info(reps)") as { name: string }[];
if (!repsCols.some((c) => c.name === "spirit_animal")) {
  db.exec(`ALTER TABLE reps ADD COLUMN spirit_animal TEXT DEFAULT ''`);
}

const repsCols2 = db.pragma("table_info(reps)") as { name: string }[];
if (!repsCols2.some((c) => c.name === "walkup_song_label")) {
  db.exec(`ALTER TABLE reps ADD COLUMN walkup_song_label TEXT`);
}

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

const smCols = db.pragma("table_info(song_mappings)") as { name: string }[];
if (!smCols.some((c) => c.name === "song_label")) {
  db.exec(`ALTER TABLE song_mappings ADD COLUMN song_label TEXT DEFAULT ''`);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )
`);

// ── Runtime settings (DB overrides .env defaults) ───────────

export function getSetting(key: string): string | null {
  const row = db.prepare(`SELECT value FROM app_settings WHERE key = ?`).get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  db.prepare(
    `INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(key, value);
}

export function getAllSettings(): Record<string, string> {
  const rows = db.prepare(`SELECT key, value FROM app_settings`).all() as {
    key: string;
    value: string;
  }[];
  const obj: Record<string, string> = {};
  for (const r of rows) obj[r.key] = r.value;
  return obj;
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
export interface DemoBookingRow {
  id: number;
  slack_ts: string;
  bdr: string;
  company: string;
  ae: string | null;
  territory: string | null;
  demo_scheduled_date: string | null;
  raw_message: string | null;
  timestamp: string;
}

export function insertDemoBookingIfNew(row: {
  slackTs: string;
  bdr: string;
  company: string;
  ae?: string;
  territory?: string;
  demoScheduledDate?: string;
  rawMessage?: string;
  timestamp: string;
}): DemoBookingRow | null {
  const exists = db
    .prepare(`SELECT 1 FROM demo_bookings WHERE slack_ts = ?`)
    .get(row.slackTs);
  if (exists) return null;
  try {
    const stmt = db.prepare(`
      INSERT INTO demo_bookings (
        slack_ts, bdr, company, ae, territory, demo_scheduled_date, raw_message, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      row.slackTs,
      row.bdr,
      row.company,
      row.ae?.trim() || null,
      row.territory?.trim() || null,
      row.demoScheduledDate?.trim() || null,
      row.rawMessage ?? null,
      row.timestamp,
    );
    const id = result.lastInsertRowid as number;
    return {
      id,
      slack_ts: row.slackTs,
      bdr: row.bdr,
      company: row.company,
      ae: row.ae?.trim() || null,
      territory: row.territory?.trim() || null,
      demo_scheduled_date: row.demoScheduledDate?.trim() || null,
      raw_message: row.rawMessage ?? null,
      timestamp: row.timestamp,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("UNIQUE") || msg.includes("unique")) return null;
    throw e;
  }
}

/** Top BDRs by demo count in the current calendar month. */
export function getDemoBdrLeaderboardTop3(): LeaderboardEntry[] {
  const start = monthStart();
  return db
    .prepare(
      `SELECT bdr AS name, COUNT(*) AS count
       FROM demo_bookings
       WHERE timestamp >= ?
       GROUP BY bdr
       ORDER BY count DESC, name ASC
       LIMIT 3`,
    )
    .all(start) as LeaderboardEntry[];
}

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

/**
 * Delete every row in `sales` (all orders, Slack `slack_ts` dedupe keys, walk-up `claimed_by`).
 * Does not touch `reps`, `song_mappings`, or `app_settings`.
 */
export function deleteAllSales(): number {
  const result = db.prepare(`DELETE FROM sales`).run();
  return result.changes;
}

/** Slide orders with no resolved rep — candidates for BigQuery reconciliation. */
export interface SlideUnknownRepRow {
  id: number;
  customer: string;
  /** json_extract returns 1 / 0 / NULL — true = first order ever (credit hunter / AE). */
  newBuyingPartner: boolean | null;
}

/**
 * Slide sales where `rep` is still empty/Unknown and the sale was not manually claimed.
 * When HubSpot owner appears late in the DWH, reconciliation can set `rep` to the owner name.
 *
 * Returns the parser-derived `newBuyingPartner` flag so the reconciler can credit the right
 * column (hunter / AE on first order, farmer / AM on every later order).
 */
export function listSlideSalesWithUnknownRep(): SlideUnknownRepRow[] {
  const rows = db
    .prepare(
      `SELECT id,
              customer,
              json_extract(meta_json, '$.newBuyingPartner') AS nbp_flag
       FROM sales
       WHERE meta_json IS NOT NULL
         AND json_extract(meta_json, '$.source') = 'slide_cloud'
         AND claimed_by IS NULL
         AND (TRIM(rep) = '' OR LOWER(TRIM(rep)) = LOWER(?))`,
    )
    .all(UNKNOWN_REP) as { id: number; customer: string; nbp_flag: number | null }[];
  return rows.map((r) => ({
    id: r.id,
    customer: r.customer,
    newBuyingPartner:
      r.nbp_flag === null || r.nbp_flag === undefined ? null : r.nbp_flag === 1,
  }));
}

const SQLITE_MAX_VARS = 450;

/** Set `rep` for many sale ids (batched for SQLite parameter limits). */
export function updateSalesRepForIds(ids: number[], rep: string): number {
  if (ids.length === 0) return 0;
  let total = 0;
  for (let i = 0; i < ids.length; i += SQLITE_MAX_VARS - 1) {
    const chunk = ids.slice(i, i + SQLITE_MAX_VARS - 1);
    const ph = chunk.map(() => "?").join(",");
    const stmt = db.prepare(
      `UPDATE sales SET rep = ? WHERE id IN (${ph})`,
    );
    const r = stmt.run(rep, ...chunk);
    total += r.changes;
  }
  return total;
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

/** All sales in the current calendar month (same window as leaderboards), newest first. */
export function getSalesThisMonth(): Sale[] {
  const start = monthStart();
  const rows = db
    .prepare(
      `SELECT id, rep, customer, product, amount, timestamp,
              slack_ts as slackTs, raw_message as rawMessage, meta_json
       FROM sales
       WHERE timestamp >= ?
       ORDER BY timestamp DESC`,
    )
    .all(start) as Record<string, unknown>[];
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

/** Rep names from stored sales (BigQuery-enriched Slide + manual Slack formats). */
export function getRepLeaderboard(): LeaderboardEntry[] {
  const start = monthStart();
  return db
    .prepare(
      `SELECT rep_key AS name, COUNT(*) AS count
       FROM (
         SELECT
           CASE
             WHEN TRIM(COALESCE(rep, '')) = '' THEN 'Unknown'
             WHEN LOWER(TRIM(rep)) = 'unknown' THEN 'Unknown'
             ELSE TRIM(rep)
           END AS rep_key
         FROM sales
         WHERE timestamp >= ?
       ) x
       GROUP BY rep_key
       ORDER BY count DESC
       LIMIT 100`,
    )
    .all(start) as LeaderboardEntry[];
}

/**
 * Hunters: Slide orders where Order History shows Total Orders = 0 mark NBP on each row; multiple
 * lines for the same account (same quote) should count as **one** new buying partner per rep.
 */
export function getHunterLeaderboard(): HunterLeaderboardEntry[] {
  const start = monthStart();
  const rows = db
    .prepare(
      `WITH per_sale AS (
         SELECT
           TRIM(customer) AS customer,
           COALESCE(
             CASE
               WHEN TRIM(COALESCE(rep, '')) = '' OR LOWER(TRIM(rep)) = 'unknown' THEN NULL
               ELSE TRIM(rep)
             END,
             NULLIF(TRIM(COALESCE((SELECT r.name FROM reps r WHERE r.id = sales.claimed_by), '')), ''),
             'Unknown'
           ) AS rep_name,
           json_extract(meta_json, '$.newBuyingPartner') AS nbp_flag
         FROM sales
         WHERE timestamp >= ?
       )
       SELECT rep_name AS name,
              COUNT(*) AS sales,
              COUNT(
                DISTINCT CASE
                  WHEN nbp_flag = 1 AND TRIM(COALESCE(customer, '')) != '' THEN customer
                END
              ) AS newBuyingPartners
       FROM per_sale
       WHERE rep_name IS NOT NULL AND TRIM(rep_name) != ''
       GROUP BY rep_name
       ORDER BY newBuyingPartners DESC, sales DESC
       LIMIT 50`,
    )
    .all(start) as {
      name: string;
      sales: number;
      newBuyingPartners: number;
    }[];
  return rows.map((r) => ({
    name: r.name,
    sales: Number(r.sales),
    newBuyingPartners: Number(r.newBuyingPartners),
  }));
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
    recentSales: getSalesThisMonth(),
    leaderboard: getLeaderboard(),
    repLeaderboard: getRepLeaderboard(),
    hunterLeaderboard: getHunterLeaderboard(),
    todayCount: today.count,
    weekCount: week.count,
    monthCount: month.count,
    dailyTotals: getDailyTotals(),
    demoBookingsLeaderboard: getDemoBdrLeaderboardTop3(),
  };
}

// ── Reps ────────────────────────────────────────────────────

export interface RepRow {
  id: number;
  name: string;
  walkup_song: string | null;
  /** Human-readable title for Deezer URLs (e.g. Artist — Song) */
  walkup_song_label: string | null;
  avatar_color: string;
  spirit_animal: string;
}

export function getAllReps(): RepRow[] {
  return db.prepare(`SELECT * FROM reps ORDER BY name`).all() as RepRow[];
}

export function getRepById(id: number): RepRow | undefined {
  return db.prepare(`SELECT * FROM reps WHERE id = ?`).get(id) as
    | RepRow
    | undefined;
}

/** Match HubSpot / DWH owner name to a Team row (case-insensitive). */
export function getRepByDisplayName(displayName: string): RepRow | undefined {
  const q = displayName.trim();
  if (!q) return undefined;
  const rows = db
    .prepare(
      `SELECT * FROM reps WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) ORDER BY id ASC LIMIT 2`,
    )
    .all(q) as RepRow[];
  if (rows.length > 1) {
    console.warn(
      `[reps] Multiple Team rows for display name ${JSON.stringify(q)}; using lowest id`,
    );
  }
  return rows[0];
}

export function createRep(
  name: string,
  walkupSong?: string,
  avatarColor?: string,
  spiritAnimal?: string,
  walkupSongLabel?: string | null,
): RepRow {
  const result = db
    .prepare(
      `INSERT INTO reps (name, walkup_song, walkup_song_label, avatar_color, spirit_animal) VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      name,
      walkupSong || null,
      walkupSongLabel?.trim() || null,
      avatarColor || "#e2a336",
      spiritAnimal?.trim() || "",
    );
  return getRepById(result.lastInsertRowid as number)!;
}

export function updateRep(
  id: number,
  data: {
    name?: string;
    walkupSong?: string | null;
    walkupSongLabel?: string | null;
    avatarColor?: string;
    spiritAnimal?: string | null;
  },
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
  if (data.walkupSongLabel !== undefined) {
    sets.push("walkup_song_label = ?");
    vals.push(data.walkupSongLabel?.trim() || null);
  }
  if (data.avatarColor !== undefined) {
    sets.push("avatar_color = ?");
    vals.push(data.avatarColor);
  }
  if (data.spiritAnimal !== undefined) {
    sets.push("spirit_animal = ?");
    vals.push(data.spiritAnimal?.trim() ?? "");
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
  song_label: string;
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
  songLabel?: string,
): SongMappingRow {
  if (matchType === "default") {
    db.prepare(
      `DELETE FROM song_mappings WHERE match_type = 'default'`,
    ).run();
  }
  const result = db
    .prepare(
      `INSERT INTO song_mappings (match_type, match_value, song_file, song_label) VALUES (?, ?, ?, ?)`,
    )
    .run(matchType, matchValue, songFile, songLabel || "");
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
  const rep = getRepById(repId);
  if (!rep) return null;
  const result = db
    .prepare(`UPDATE sales SET claimed_by = ?, rep = ? WHERE id = ?`)
    .run(repId, rep.name, saleId);
  if (result.changes === 0) return null;
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

/** Set `claimed_by` and `rep` name for multiple sales (manual attribution from the dashboard). */
export function assignRepToSaleIds(saleIds: number[], repId: number): number {
  const rep = getRepById(repId);
  if (!rep || saleIds.length === 0) return 0;
  const upd = db.prepare(
    `UPDATE sales SET claimed_by = ?, rep = ? WHERE id = ?`,
  );
  const run = db.transaction((ids: number[]) => {
    let n = 0;
    for (const id of ids) {
      n += upd.run(repId, rep.name, id).changes;
    }
    return n;
  });
  return run(saleIds);
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
