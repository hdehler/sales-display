import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "../../.env");
dotenv.config({ path: envPath });

/** Slack channel IDs are C… (public) or G… (private). Strip accidental `#`, normalize case. */
export function normalizeSlackChannelId(raw: string): string {
  return raw.trim().replace(/^#/, "").toUpperCase();
}

export const config = {
  port: parseInt(process.env.PORT || "3000", 10),

  slack: {
    botToken: process.env.SLACK_BOT_TOKEN || "",
    appToken: process.env.SLACK_APP_TOKEN || "",
    salesChannelId: normalizeSlackChannelId(
      process.env.SLACK_SALES_CHANNEL_ID || "",
    ),
    /** Log messages in the sales channel that have blocks/attachments but don’t parse as a sale */
    debugParse:
      process.env.SLACK_DEBUG_PARSE === "1" ||
      process.env.SLACK_DEBUG_PARSE === "true",
    /** After connecting, fetch channel history and import parsed orders (no celebrations) */
    backfillOnStart:
      process.env.SLACK_BACKFILL_ON_START === "true" ||
      process.env.SLACK_BACKFILL_ON_START === "1",
    backfillMaxMessages: parseInt(
      process.env.SLACK_BACKFILL_MAX_MESSAGES || "500",
      10,
    ),
    backfillPageDelayMs: parseInt(
      process.env.SLACK_BACKFILL_PAGE_DELAY_MS || "1200",
      10,
    ),
    /**
     * Poll conversations.history on the sales channel (ms). Socket Mode often does NOT deliver
     * `message` events for other apps’ bots unless `message.channels` is subscribed — polling
     * still picks up Slide. Set to 0 to disable.
     */
    pollHistoryMs: parseInt(process.env.SLACK_POLL_HISTORY_MS || "30000", 10),
    /** Log every incoming message event (channel, subtype) — proves whether Socket delivers events */
    logMessageEvents:
      process.env.SLACK_LOG_MESSAGE_EVENTS === "1" ||
      process.env.SLACK_LOG_MESSAGE_EVENTS === "true",
  },

  plugs: {
    hosts: (process.env.KASA_PLUG_HOSTS || "")
      .split(",")
      .filter(Boolean),
    autoDiscover: process.env.KASA_AUTO_DISCOVER !== "false",
  },

  celebration: {
    defaultDuration: parseInt(process.env.CELEBRATION_DURATION || "30", 10),
    triggerProducts: (process.env.CELEBRATION_TRIGGER_PRODUCTS || "")
      .split(",")
      .filter(Boolean),
    milestoneInterval: parseInt(process.env.MILESTONE_INTERVAL || "10", 10),
    /** Every Slide order shows the full-screen celebration (set false to only use keywords/milestone below). */
    celebrateSlideOrders:
      process.env.CELEBRATE_SLIDE_ORDERS !== "false" &&
      process.env.CELEBRATE_SLIDE_ORDERS !== "0",
  },

  /** Quiet time (ms) after the last Slide order before flushing a batch for the same account */
  slideBatchDebounceMs: parseInt(
    process.env.SLIDE_BATCH_DEBOUNCE_MS || "1500",
    10,
  ),

  messagePatterns: [
    {
      regex: /^(.+?)\s+sold\s+\$([0-9,.]+)\s+to\s+(.+)$/i,
      groups: { rep: 1, amount: 2, customer: 3, product: 4 },
    },
    {
      regex: /^(.+?)\s+sold\s+\$([0-9,.]+)\s+for\s+(.+)$/i,
      groups: { rep: 1, amount: 2, customer: 3, product: 4 },
    },
    {
      regex: /\$([0-9,.]+)\s+(?:sale\s+)?(?:to|from)\s+(.+?)\s+(?:by|-)\s+(.+?)(?:\s*[-–—]\s*(.+))?$/i,
      groups: { amount: 1, customer: 2, rep: 3, product: 4 },
    },
    {
      regex: /(.+?)\s+closed\s+\$([0-9,.]+)\s+(?:with|from)\s+(.+?)(?:\s*\((.+?)\))?$/i,
      groups: { rep: 1, amount: 2, customer: 3, product: 4 },
    },
    {
      regex: /(?:new\s+)?sale[:\s]+\$([0-9,.]+)\s*[-–—]\s*(.+?)\s*\((.+?)\)(?:\s*[-–—]\s*(.+))?$/i,
      groups: { amount: 1, customer: 2, rep: 3, product: 4 },
    },
  ] as const,
};
