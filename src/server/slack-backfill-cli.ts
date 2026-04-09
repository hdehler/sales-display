/**
 * One-shot: import parsed orders from Slack channel history (no Socket Mode).
 * Run on the Pi: npx tsx src/server/slack-backfill-cli.ts
 */
import { WebClient } from "@slack/web-api";
import { config } from "./config.js";
import { insertSaleIfNew } from "./db.js";
import { runSlackHistoryBackfill } from "./slackHistoryBackfill.js";

async function main(): Promise<void> {
  if (!config.slack.botToken.startsWith("xoxb-")) {
    console.error("Set SLACK_BOT_TOKEN in .env");
    process.exit(1);
  }
  if (!config.slack.salesChannelId) {
    console.error("Set SLACK_SALES_CHANNEL_ID in .env");
    process.exit(1);
  }

  const max = parseInt(process.argv[2] || "500", 10);
  const client = new WebClient(config.slack.botToken);

  console.log(`Backfilling up to ${max} messages from channel…`);
  const result = await runSlackHistoryBackfill(
    client,
    config.slack.salesChannelId,
    { maxMessages: max, pageDelayMs: config.slack.backfillPageDelayMs },
    (sale) => insertSaleIfNew(sale) !== null,
  );
  console.log("Result:", result);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
