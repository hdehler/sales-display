/**
 * One-shot: import parsed orders from Slack channel history (no Socket Mode).
 *
 * Usage:
 *   npx tsx src/server/slack-backfill-cli.ts [maxMessages]
 *   npx tsx src/server/slack-backfill-cli.ts [maxMessages] <from-YYYY-MM-DD> <to-YYYY-MM-DD>
 *   npx tsx src/server/slack-backfill-cli.ts <from-YYYY-MM-DD> <to-YYYY-MM-DD>
 *
 * Date range is UTC midnight boundaries: `from` inclusive, `to` inclusive (end of that day).
 * Within that window, **all** channel messages are paginated (no 15k cap) and **thread replies**
 * are fetched so orders posted only in threads are not skipped.
 * Example (April 1–16, 2026):
 *   npx tsx src/server/slack-backfill-cli.ts 2026-04-01 2026-04-16
 */
import { WebClient } from "@slack/web-api";
import { config } from "./config.js";
import { insertSaleIfNew } from "./db.js";
import { runSlackHistoryBackfill } from "./slackHistoryBackfill.js";

function parseUtcDay(isoDate: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!m) {
    throw new Error(`Invalid date "${isoDate}" — use YYYY-MM-DD (UTC)`);
  }
  return new Date(
    Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0),
  );
}

function toSlackTs(d: Date): string {
  return (d.getTime() / 1000).toFixed(6);
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
        "With two arguments, use YYYY-MM-DD YYYY-MM-DD for the date range (UTC), or pass a single number for max messages.",
      );
    }
    const fromD = parseUtcDay(args[0]);
    const toD = parseUtcDay(args[1]);
    if (fromD > toD) {
      throw new Error("`from` date must be on or before `to` date");
    }
    const oldest = toSlackTs(fromD);
    const dayAfterTo = new Date(toD.getTime() + 24 * 60 * 60 * 1000);
    const latest = toSlackTs(dayAfterTo);
    return {
      maxMessages: 15000,
      oldest,
      latest,
      label: `${args[0]} … ${args[1]} UTC (inclusive days), up to 15000 messages`,
    };
  }

  const maxMessages = parseInt(args[0], 10);
  if (Number.isNaN(maxMessages) || maxMessages < 1) {
    throw new Error("First argument must be a positive number (max messages)");
  }
  if (!iso.test(args[1]) || !iso.test(args[2])) {
    throw new Error("Second and third arguments must be YYYY-MM-DD (UTC)");
  }
  const fromD = parseUtcDay(args[1]);
  const toD = parseUtcDay(args[2]);
  if (fromD > toD) {
    throw new Error("`from` date must be on or before `to` date");
  }
  const oldest = toSlackTs(fromD);
  const dayAfterTo = new Date(toD.getTime() + 24 * 60 * 60 * 1000);
  const latest = toSlackTs(dayAfterTo);
  return {
    maxMessages,
    oldest,
    latest,
    label: `${args[1]} … ${args[2]} UTC (inclusive days), up to ${maxMessages} messages`,
  };
}

async function main(): Promise<void> {
  if (!config.slack.botToken.startsWith("xoxb-")) {
    console.error("Set SLACK_BOT_TOKEN in .env");
    process.exit(1);
  }
  if (!config.slack.salesChannelId) {
    console.error("Set SLACK_SALES_CHANNEL_ID in .env");
    process.exit(1);
  }

  const { maxMessages, oldest, latest, label } = parseCliArgs();
  const dateBounded =
    oldest != null &&
    oldest !== "" &&
    latest != null &&
    latest !== "";
  const client = new WebClient(config.slack.botToken);

  console.log(`Backfilling: ${label}`);
  if (oldest && latest) {
    console.log(`  API range: oldest=${oldest} latest=${latest} (latest is exclusive end instant)`);
  }

  const result = await runSlackHistoryBackfill(
    client,
    config.slack.salesChannelId,
    {
      maxMessages,
      pageDelayMs: config.slack.backfillPageDelayMs,
      oldest,
      latest,
    },
    (sale) => insertSaleIfNew(sale) !== null,
  );
  console.log("Result:", {
    ...result,
    note: dateBounded
      ? "Date range: all pages in window + thread replies (no message cap)."
      : "No date range: capped by maxMessages (thread replies count toward cap).",
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
