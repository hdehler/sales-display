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
     * `slack-backfill-cli.ts` date range (`YYYY-MM-DD`): calendar days in this IANA zone (e.g.
     * America/New_York). Empty = UTC (backward compatible).
     */
    backfillTimezone: process.env.BACKFILL_TIMEZONE ?? "",
    /**
     * Poll conversations.history on the sales channel (ms). Socket Mode often does NOT deliver
     * `message` events for other apps’ bots unless `message.channels` is subscribed — polling
     * still picks up Slide. Set to 0 to disable.
     */
    pollHistoryMs: (() => {
      const n = parseInt(process.env.SLACK_POLL_HISTORY_MS || "0", 10);
      return Number.isFinite(n) && n >= 0 ? n : 0;
    })(),
    /** Log every incoming message event (channel, subtype) — proves whether Socket delivers events */
    logMessageEvents:
      process.env.SLACK_LOG_MESSAGE_EVENTS === "1" ||
      process.env.SLACK_LOG_MESSAGE_EVENTS === "true",
    /** Log each history poll (message count) */
    logPoll:
      process.env.SLACK_LOG_POLL === "1" ||
      process.env.SLACK_LOG_POLL === "true",
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

  /**
   * BigQuery: map Slide `customer` (account) → HubSpot owner name.
   * Auth: set GOOGLE_APPLICATION_CREDENTIALS to a service account JSON path on the Pi
   * (BigQuery Job User + dataViewer on the DWH project).
   */
  bigqueryAccountOwner: {
    projectId: process.env.BIGQUERY_PROJECT_ID || "",
    /** Full id: project.dataset.table (no backticks), e.g. dwh-prod-484216.marts.rpt_console_account_hubspot_owner */
    tableRef: process.env.BIGQUERY_ACCOUNT_OWNER_TABLE || "",
    accountColumn:
      process.env.BIGQUERY_ACCOUNT_NAME_COLUMN || "account_name",
    /**
     * Hunter column = AE credited on FIRST order ever (parser: `meta.newBuyingPartner`).
     * Mart column is typically `account_executive_name`; older deployments used `account_executive`.
     */
    hunterColumn:
      process.env.BIGQUERY_HUNTER_COLUMN || "account_executive_name",
    /**
     * Farmer column = AM credited on every later order.
     * Mart column is typically `account_manager_name`; older deployments used `account_manager`.
     */
    farmerColumn:
      process.env.BIGQUERY_FARMER_COLUMN || "account_manager_name",
    /**
     * Legacy fallback when hunter + farmer cells are empty for an account row.
     * Typical mart: `hubspot_company_owner_name`; older mart: `hubspot_owner_resolved_name`.
     * Set to empty string to disable selecting this column entirely.
     */
    repColumn:
      process.env.BIGQUERY_OWNER_NAME_COLUMN || "hubspot_company_owner_name",
    /** Tie-break when multiple rows match the same account_name */
    orderByColumn:
      process.env.BIGQUERY_ACCOUNT_OWNER_ORDER_BY || "account_id",
    /** Query job location, e.g. US or EU — leave empty for default */
    location: process.env.BIGQUERY_LOCATION || "",
    /** Max cached account → rep mappings (reduces repeated BQ queries) */
    lookupCacheMax: parseInt(
      process.env.BIGQUERY_LOOKUP_CACHE_MAX || "512",
      10,
    ),
    /**
     * When exact normalized name match returns 0 rows, run a second query using substring
     * containment (handles "Acme" vs "Acme, Inc." and minor spelling gaps). Set to 0/false to disable.
     */
    fuzzyAccountMatch:
      process.env.BIGQUERY_ACCOUNT_FUZZY_MATCH !== "false" &&
      process.env.BIGQUERY_ACCOUNT_FUZZY_MATCH !== "0",
    /** Min normalized length (chars) before fuzzy match is attempted (avoid false positives). */
    fuzzyAccountMatchMinLen: parseInt(
      process.env.BIGQUERY_ACCOUNT_FUZZY_MIN_LEN || "5",
      10,
    ),
    /**
     * Re-fetch HubSpot owner for Slide rows still stored as Unknown (late DWH assignment).
     * 0 = disabled. Example: 900000 = every 15 minutes.
     */
    reconcileUnknownRepMs: parseInt(
      process.env.BIGQUERY_RECONCILE_UNKNOWN_MS || "0",
      10,
    ),
  },

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

/** True when project + table ref are set (BigQuery client can run lookups). */
export function isBigQueryAccountOwnerConfigured(): boolean {
  const b = config.bigqueryAccountOwner;
  return (
    b.projectId.trim().length > 0 && b.tableRef.trim().length > 0
  );
}
