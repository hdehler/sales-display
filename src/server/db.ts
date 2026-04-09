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
    raw_message TEXT
  )
`);

export function insertSale(sale: Sale): Sale {
  const stmt = db.prepare(`
    INSERT INTO sales (rep, customer, product, amount, timestamp, slack_ts, raw_message)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    sale.rep,
    sale.customer,
    sale.product || "",
    sale.amount,
    sale.timestamp || new Date().toISOString(),
    sale.slackTs || null,
    sale.rawMessage || null,
  );
  return { ...sale, id: result.lastInsertRowid as number };
}

export function getRecentSales(limit = 20): Sale[] {
  return db
    .prepare(
      `SELECT id, rep, customer, product, amount, timestamp,
              slack_ts as slackTs
       FROM sales ORDER BY timestamp DESC LIMIT ?`,
    )
    .all(limit) as Sale[];
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
