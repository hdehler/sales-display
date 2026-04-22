/**
 * One-shot: import HubSpot demo booking messages from SLACK_DEMO_BOOKINGS_CHANNEL_ID history.
 * Inserts into SQLite table `demo_bookings` (same DB as orders: data/sales.db). No celebrations.
 *
 * Usage (same date rules as `npm run slack-backfill`):
 *   npx tsx src/server/demo-bookings-backfill-cli.ts [maxMessages]
 *   npx tsx src/server/demo-bookings-backfill-cli.ts <from-YYYY-MM-DD> <to-YYYY-MM-DD>
 *   npx tsx src/server/demo-bookings-backfill-cli.ts [maxMessages] <from> <to>
 *
 * Calendar days use BACKFILL_TIMEZONE (default UTC). Example for April 2026 in US Eastern:
 *   BACKFILL_TIMEZONE=America/New_York npx tsx src/server/demo-bookings-backfill-cli.ts 2026-04-01 2026-04-30
 */
import { DateTime } from "luxon";
import { WebClient } from "@slack/web-api";
import { config } from "./config.js";
import { runDemoBookingsHistoryBackfill } from "./demoBookingsHistoryBackfill.js";

function backfillTimezone(): string {
  const z = config.slack.backfillTimezone?.trim();
  return z && z.length > 0 ? z : "UTC";
}

function startOfDayInZone(isoDate: string, zone: string): DateTime {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!m) {
    throw new Error(`Invalid date "${isoDate}" — use YYYY-MM-DD`);
  }
  const dt = DateTime.fromObject(
    {
      year: Number(m[1]),
      month: Number(m[2]),
      day: Number(m[3]),
    },
    { zone },
  ).startOf("day");
  if (!dt.isValid) {
    throw new Error(`Invalid date "${isoDate}" for timezone "${zone}": ${dt.invalidReason}`);
  }
  return dt;
}

function instantToSlackTs(dt: DateTime): string {
  return (dt.toMillis() / 1000).toFixed(6);
}

function dateRangeToSlackTs(fromStr: string, toStr: string): {
  oldest: string;
  latest: string;
} {
  const zone = backfillTimezone();
  const fromStart = startOfDayInZone(fromStr, zone);
  const toStart = startOfDayInZone(toStr, zone);
  if (fromStart > toStart) {
    throw new Error("`from` date must be on or before `to` date");
  }
  const latestExclusive = toStart.plus({ days: 1 });
  return {
    oldest: instantToSlackTs(fromStart),
    latest: instantToSlackTs(latestExclusive),
  };
}

function parseCliArgs(): {
  maxMessages: number;
  oldest?: string;
  latest?: string;
  label: string;
} {
  const args = process.argv.slice(2);
  const iso = /^\d{4}-\d{2}-\d{2}$/;

  if (args.length === 0) {
    return { maxMessages: 500, label: "up to 500 messages (newest first)" };
  }

  if (args.length === 1) {
    const n = parseInt(args[0], 10);
    if (Number.isNaN(n) || n < 1) {
      throw new Error("First argument must be a positive number (max messages)");
    }
    return { maxMessages: n, label: `up to ${n} messages (newest first)` };
  }

  if (args.length === 2) {
    if (!iso.test(args[0]) || !iso.test(args[1])) {
      throw new Error(
        "With two arguments, use YYYY-MM-DD YYYY-MM-DD for the date range, or pass a single number for max messages.",
      );
    }
    const z = backfillTimezone();
    const { oldest, latest } = dateRangeToSlackTs(args[0], args[1]);
    return {
      maxMessages: 15000,
      oldest,
      latest,
      label: `${args[0]} … ${args[1]} (${z} calendar days, inclusive), up to 15000 messages`,
    };
  }

  const maxMessages = parseInt(args[0], 10);
  if (Number.isNaN(maxMessages) || maxMessages < 1) {
    throw new Error("First argument must be a positive number (max messages)");
  }
  if (!iso.test(args[1]) || !iso.test(args[2])) {
    throw new Error("Second and third arguments must be YYYY-MM-DD");
  }
  const z = backfillTimezone();
  const { oldest, latest } = dateRangeToSlackTs(args[1], args[2]);
  return {
    maxMessages,
    oldest,
    latest,
    label: `${args[1]} … ${args[2]} (${z} calendar days, inclusive), up to ${maxMessages} messages`,
  };
}

async function main(): Promise<void> {
  if (!config.slack.botToken.startsWith("xoxb-")) {
    console.error("Set SLACK_BOT_TOKEN in .env");
    process.exit(1);
  }
  if (!config.slack.demoBookingsChannelId) {
    console.error(
      "Set SLACK_DEMO_BOOKINGS_CHANNEL_ID in .env (demo bookings channel — same as live ingest).",
    );
    process.exit(1);
  }

  const { maxMessages, oldest, latest, label } = parseCliArgs();
  const dateBounded =
    oldest != null &&
    oldest !== "" &&
    latest != null &&
    latest !== "";
  const client = new WebClient(config.slack.botToken);

  console.log(`Demo bookings backfill: ${label}`);
  if (oldest && latest) {
    const z = backfillTimezone();
    console.log(`  Calendar timezone: ${z} (BACKFILL_TIMEZONE)`);
    console.log(`  API range: oldest=${oldest} latest=${latest} (exclusive)`);
  }
  console.log(`  Channel: ${config.slack.demoBookingsChannelId}`);
  console.log(`  SQLite: data/sales.db → table demo_bookings`);

  const result = await runDemoBookingsHistoryBackfill(
    client,
    config.slack.demoBookingsChannelId,
    {
      maxMessages,
      pageDelayMs: config.slack.backfillPageDelayMs,
      oldest,
      latest,
      collectStats: true,
    },
  );

  console.log("Result:", {
    ...result,
    note: dateBounded
      ? "Date range: full pagination in window + thread fetch per parent."
      : "Capped by maxMessages.",
  });
  if (result.stats) {
    const s = result.stats;
    console.log(
      `Parse: ${s.parsedAsDemo} demo(s) inserted from ${s.parseCandidates} message(s); ${s.parseMisses} unparsed; ${s.duplicateSkipped} duplicate slack_ts`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
