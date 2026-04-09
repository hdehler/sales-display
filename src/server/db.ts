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

const columns = db
  .prepare(`PRAGMA table_info(sales)`)
  .all() as { name: string }[];
if (!columns.some((c) => c.name === "meta_json")) {
  db.exec(`ALTER TABLE sales ADD COLUMN meta_json TEXT`);
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

export function getLeaderboard(): LeaderboardEntry[] {
  const start = monthStart();
  return db
    .prepare(
      `SELECT rep, SUM(amount) as total, COUNT(*) as count
       FROM sales WHERE timestamp >= ?
       GROUP BY rep ORDER BY total DESC LIMIT 10`,
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

export function getDashboardData(): DashboardData {
  const today = getPeriodTotal("day");
  const week = getPeriodTotal("week");
  const month = getPeriodTotal("month");

  return {
    recentSales: getRecentSales(),
    leaderboard: getLeaderboard(),
    todayTotal: today.total,
    weekTotal: week.total,
    monthTotal: month.total,
    todayCount: today.count,
    dailyTotals: getDailyTotals(),
  };
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
