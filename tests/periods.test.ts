/**
 * "Today / this week / this month" use the team's zone (America/New_York), not UTC or the Pi's
 * system zone, and work for both timestamp formats stored in `sales.timestamp`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { Settings } from "luxon";

process.env.SALES_DB_PATH = path.join(
  mkdtempSync(path.join(tmpdir(), "sales-display-periods-")),
  "test.db",
);
process.env.DISPLAY_TIMEZONE = "America/New_York";

// Monday 2026-10-26, noon Eastern.
Settings.now = () => Date.parse("2026-10-26T16:00:00Z");

const { insertSale, getPeriodTotal, getRepLeaderboard, getDailyTotals, getTodaySaleCount } =
  await import("../src/server/db.ts");

function sale(rep: string, timestamp: string) {
  insertSale({ rep, customer: "Acme", product: "Slide Z2", amount: 0, timestamp });
}

// Sept 30, 10pm Eastern — September, even though it's already Oct 1 in UTC.
sale("Ada", "2026-10-01T02:00:00.000Z");
// Oct 1, 1am Eastern — first October order.
sale("Ada", "2026-10-01T05:00:00.000Z");
// Sunday Oct 25, 9pm Eastern — this week (weeks start Sunday), not today.
sale("Max", "2026-10-26T01:00:00.000Z");
// Today, stored in SQLite's datetime('now') format rather than ISO.
sale("Max", "2026-10-26 15:00:00");

test("month starts at midnight Eastern, not UTC", () => {
  assert.equal(getPeriodTotal("month").count, 3);
  assert.deepEqual(
    getRepLeaderboard().map((r) => [r.name, r.count]),
    [["Max", 2], ["Ada", 1]],
  );
});

test("week starts Sunday Eastern and today excludes last night", () => {
  assert.equal(getPeriodTotal("week").count, 2);
  assert.equal(getPeriodTotal("day").count, 1);
  assert.equal(getTodaySaleCount(), 1);
});

test("daily chart buckets by Eastern calendar day", () => {
  const days = Object.fromEntries(getDailyTotals(30).map((d) => [d.date, d.count]));
  assert.deepEqual(days, {
    "2026-09-30": 1,
    "2026-10-01": 1,
    "2026-10-25": 1,
    "2026-10-26": 1,
  });
});
