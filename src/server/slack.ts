import { App, LogLevel } from "@slack/bolt";
import type { WebClient } from "@slack/web-api";
import { config } from "./config.js";
import { parseMessageToSales } from "./parseSlackMessage.js";
import { slackMessageHasStructuredContent } from "./parseSlideOrder.js";
import {
  parseDemoBookingFromSlackMessage,
  type ParsedDemoBooking,
} from "./parseDemoBooking.js";
import { runSlackHistoryBackfill } from "./slackHistoryBackfill.js";
import { enrichSaleWithAccountOwnerFromDwh } from "./bigqueryAccountOwner.js";
import { isSlideOrderMeta, type Sale } from "../shared/types.js";

/** Socket events for other apps’ messages often omit `blocks`; history has the full layout. */
function shouldRefetchMessageForParse(msg: Record<string, unknown>): boolean {
  if (msg.bot_id || msg.subtype === "bot_message") return true;
  const t = typeof msg.text === "string" ? msg.text : "";
  if (/o_[a-z0-9]+/i.test(t)) return true;
  return false;
}

/**
 * Skip only noisy / non-content subtypes. (Allowlist failed us: some app posts use uncommon subtypes.)
 */
const SKIP_MESSAGE_SUBTYPES = new Set([
  "message_changed",
  "message_deleted",
  "channel_join",
  "channel_leave",
  "channel_topic",
  "channel_purpose",
  "channel_name",
  "channel_archive",
  "channel_unarchive",
  "pinned_message",
  "unpinned_message",
]);

function shouldSkipSlackMessageSubtype(msg: Record<string, unknown>): boolean {
  const sub = typeof msg.subtype === "string" ? msg.subtype : "";
  if (!sub) return false;
  return SKIP_MESSAGE_SUBTYPES.has(sub);
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

let rateLimitedUntil = 0;

/**
 * Re-fetch a single message via conversations.history.
 * Socket payloads for other bots often arrive with blocks=0, text="".
 * Waits 3s so Slack materializes the full message; respects rate limits globally.
 */
async function refetchAndParse(
  client: WebClient,
  channel: string,
  ts: string,
  attempt = 1,
): Promise<Sale[] | null> {
  const MAX_ATTEMPTS = 3;
  const INITIAL_DELAY_MS = 3000;

  if (attempt === 1) await sleep(INITIAL_DELAY_MS);

  const now = Date.now();
  if (now < rateLimitedUntil) {
    const wait = rateLimitedUntil - now + 1000;
    console.log(`[Slack] Waiting ${Math.round(wait / 1000)}s for rate limit to clear before re-fetch…`);
    await sleep(wait);
  }

  try {
    console.log(`[Slack] Re-fetch: calling conversations.history for ts=${ts}…`);
    const hist = await client.conversations.history({
      channel,
      oldest: ts,
      latest: ts,
      inclusive: true,
      limit: 1,
    });
    console.log(`[Slack] Re-fetch: API returned ok=${hist.ok} messages=${hist.messages?.length ?? 0}`);
    const full = hist.messages?.[0] as unknown as
      | Record<string, unknown>
      | undefined;
    if (!full) {
      console.warn("[Slack] Re-fetch: no message returned for that ts.");
      return null;
    }
    const fullBlocks = Array.isArray(full.blocks) ? full.blocks.length : 0;
    const fullTextLen = typeof full.text === "string" ? full.text.length : 0;
    const fullAtts = Array.isArray(full.attachments) ? full.attachments.length : 0;
    const fullFiles = Array.isArray(full.files) ? full.files.length : 0;
    const topKeys = Object.keys(full).join(",");
    console.log(
      `[Slack] Re-fetched message: blocks=${fullBlocks} textLen=${fullTextLen} attachments=${fullAtts} files=${fullFiles} keys=[${topKeys}]`,
    );
    if (fullTextLen > 0) {
      console.log(`[Slack] Re-fetched text: ${JSON.stringify((full.text as string).slice(0, 300))}`);
    }
    if (fullAtts > 0) {
      console.log(`[Slack] Re-fetched attachments: ${JSON.stringify(full.attachments).slice(0, 500)}`);
    }
    if (fullBlocks === 0 && fullTextLen === 0 && fullAtts === 0) {
      console.log(`[Slack] Re-fetched message raw dump: ${JSON.stringify(full).slice(0, 800)}`);
    }
    const sales = parseMessageToSales(full);
    if (sales && sales.length > 0) {
      const head = sales[0];
      const slideMeta = isSlideOrderMeta(head.meta) ? head.meta : undefined;
      const big = slideMeta?.bigOrder;
      const suffix = big ? ` — BIG order, ${big.totalUnits} units` : "";
      console.log(
        `[Slack] Parsed after re-fetch: ${slideMeta ? `Slide order ${slideMeta.orderId} — ${head.customer}${suffix}` : `${head.rep} $${head.amount} ${head.customer}`}`,
      );
    } else {
      console.warn("[Slack] Re-fetch returned a message but parser still couldn't match it.");
    }
    return sales;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const retryMatch = msg.match(/retry.after[:\s]*(\d+)/i);
    const retryAfterSec = retryMatch ? parseInt(retryMatch[1], 10) : 15;

    if (
      (msg.toLowerCase().includes("rate") || msg.includes("429")) &&
      attempt < MAX_ATTEMPTS
    ) {
      const waitMs = (retryAfterSec + 2) * 1000;
      rateLimitedUntil = Date.now() + waitMs;
      console.warn(
        `[Slack] Re-fetch rate-limited (retry-after ${retryAfterSec}s); waiting ${Math.round(waitMs / 1000)}s then retrying (attempt ${attempt + 1}/${MAX_ATTEMPTS})…`,
      );
      await sleep(waitMs);
      return refetchAndParse(client, channel, ts, attempt + 1);
    }
    console.warn("[Slack] conversations.history re-fetch failed:", msg);
    return null;
  }
}

/**
 * Re-fetch a single message and parse as a HubSpot demo booking (blocks often missing in Socket).
 */
async function refetchAndParseDemo(
  client: WebClient,
  channel: string,
  ts: string,
  attempt = 1,
): Promise<ParsedDemoBooking | null> {
  const MAX_ATTEMPTS = 3;
  const INITIAL_DELAY_MS = 3000;

  if (attempt === 1) await sleep(INITIAL_DELAY_MS);

  const now = Date.now();
  if (now < rateLimitedUntil) {
    const wait = rateLimitedUntil - now + 1000;
    console.log(`[Slack] Demo re-fetch waiting ${Math.round(wait / 1000)}s for rate limit…`);
    await sleep(wait);
  }

  try {
    const hist = await client.conversations.history({
      channel,
      oldest: ts,
      latest: ts,
      inclusive: true,
      limit: 1,
    });
    const full = hist.messages?.[0] as unknown as Record<string, unknown> | undefined;
    if (!full) return null;
    const demo = parseDemoBookingFromSlackMessage(full);
    if (!demo && config.slack.debugParse) {
      console.warn("[Slack] Demo re-fetch: message still did not parse as demo booking.");
    }
    return demo;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const retryMatch = msg.match(/retry.after[:\s]*(\d+)/i);
    const retryAfterSec = retryMatch ? parseInt(retryMatch[1], 10) : 15;
    if (
      (msg.toLowerCase().includes("rate") || msg.includes("429")) &&
      attempt < MAX_ATTEMPTS
    ) {
      const waitMs = (retryAfterSec + 2) * 1000;
      rateLimitedUntil = Date.now() + waitMs;
      await sleep(waitMs);
      return refetchAndParseDemo(client, channel, ts, attempt + 1);
    }
    console.warn("[Slack] Demo conversations.history re-fetch failed:", msg);
    return null;
  }
}

type SaleCallback = (sale: Sale) => void;
let onSale: SaleCallback | null = null;

type DemoBookingCallback = (payload: ParsedDemoBooking & { slackTs: string }) => void;
let onDemoBooking: DemoBookingCallback | null = null;

/** Inserts historical rows only (no celebrations); return true if inserted */
let onHistorySale: ((sale: Sale) => boolean) | null = null;
let onBackfillComplete: (() => void) | null = null;

export function setSaleCallback(cb: SaleCallback): void {
  onSale = cb;
}

export function setDemoBookingCallback(cb: DemoBookingCallback): void {
  onDemoBooking = cb;
}

export function setHistorySaleHandler(cb: (sale: Sale) => boolean): void {
  onHistorySale = cb;
}

export function setBackfillCompleteHandler(cb: () => void): void {
  onBackfillComplete = cb;
}

/** Demo channel vs sales channel vs ignore (wrong channel when IDs are configured). */
function routeIncomingSlackChannel(channelId: string): "demo" | "sales_or_legacy" | "ignore" {
  const inc = channelId.toUpperCase();
  const demoId = config.slack.demoBookingsChannelId;
  const salesId = config.slack.salesChannelId;
  if (demoId && inc === demoId) return "demo";
  if (salesId && inc !== salesId) return "ignore";
  return "sales_or_legacy";
}

export async function initSlack(): Promise<void> {
  const hasBot =
    config.slack.botToken && config.slack.botToken.startsWith("xoxb-");
  const hasApp =
    config.slack.appToken && config.slack.appToken.startsWith("xapp-");

  if (!hasBot || !hasApp) {
    console.warn(
      "[Slack] Missing or invalid SLACK_BOT_TOKEN / SLACK_APP_TOKEN — Slack integration disabled.",
    );
    console.warn("[Slack] Set these in .env to enable Slack listening.");
    return;
  }

  const slackApp = new App({
    token: config.slack.botToken,
    socketMode: true,
    appToken: config.slack.appToken,
    logLevel: LogLevel.WARN,
  });

  async function handleDemoChannelMessage(
    message: Record<string, unknown>,
    client: WebClient,
    opts?: { fromPoll?: boolean },
  ): Promise<void> {
    if (!("channel" in message) || typeof message.channel !== "string") return;
    if (typeof message.ts !== "string") return;

    const msg = message;
    const nBlocks = Array.isArray(msg.blocks) ? msg.blocks.length : 0;
    const tLen = typeof msg.text === "string" ? msg.text.length : 0;
    const hasBot = Boolean(msg.bot_id);
    const subtype = typeof msg.subtype === "string" ? msg.subtype : "";

    console.log(
      `[Slack][demo] Incoming ts=${msg.ts} subtype=${subtype || "(none)"} bot_id=${msg.bot_id ?? "none"} blocks=${nBlocks} textLen=${tLen}`,
    );

    let demo = parseDemoBookingFromSlackMessage(msg);

    if (
      !demo &&
      (hasBot || subtype === "bot_message" || nBlocks === 0) &&
      typeof message.ts === "string"
    ) {
      console.log(`[Slack][demo] First parse failed, re-fetch ts=${message.ts}…`);
      demo = await refetchAndParseDemo(client, message.channel, message.ts);
    }

    if (!demo) {
      if (
        config.slack.debugParse &&
        (hasBot || subtype === "bot_message") &&
        slackMessageHasStructuredContent(msg)
      ) {
        console.warn(
          "[Slack][demo] Structured message did not parse as demo booking. Check BDR/Company fields.",
        );
      }
      return;
    }

    console.log(`[Slack][demo] Parsed demo: BDR=${demo.bdr} — ${demo.company}`);

    onDemoBooking?.({ ...demo, slackTs: message.ts });
  }

  async function handleSalesChannelMessage(
    message: Record<string, unknown>,
    client: WebClient,
    opts?: { fromPoll?: boolean },
  ): Promise<void> {
    if (!("channel" in message) || typeof message.channel !== "string") return;

    const configuredCh = config.slack.salesChannelId;
    const msg = message;
    const nBlocks = Array.isArray(msg.blocks) ? msg.blocks.length : 0;
    const tLen = typeof msg.text === "string" ? msg.text.length : 0;
    const hasBot = Boolean(msg.bot_id);
    const subtype = typeof msg.subtype === "string" ? msg.subtype : "";

    console.log(
      `[Slack] Incoming message ts=${msg.ts} subtype=${subtype || "(none)"} bot_id=${msg.bot_id ?? "none"} blocks=${nBlocks} textLen=${tLen}`,
    );

    let sales = parseMessageToSales(msg);

    if (!sales && (hasBot || subtype === "bot_message" || nBlocks === 0) && typeof message.ts === "string") {
      console.log(`[Slack] First parse failed, attempting re-fetch for ts=${message.ts}…`);
      sales = await refetchAndParse(
        client,
        message.channel,
        message.ts as string,
      );
    }

    if (!sales || sales.length === 0) {
      if ((hasBot || subtype === "bot_message") && Boolean(configuredCh) && !opts?.fromPoll) {
        console.warn(
          `[Slack] Unparsed app/bot message in sales channel (ts=${msg.ts}) blocks=${nBlocks} textLen=${tLen}.`,
        );
      }
      if (
        config.slack.debugParse &&
        config.slack.salesChannelId &&
        slackMessageHasStructuredContent(msg)
      ) {
        const blockTypes = Array.isArray(msg.blocks)
          ? (msg.blocks as { type?: string }[]).map((b) => b?.type).filter(Boolean)
          : [];
        console.warn(
          "[Slack] Structured message in sales channel did not parse as a sale. " +
            "Check Block Kit shape or Event Subscriptions (e.g. message.groups for private channels). " +
            JSON.stringify({
              subtype: msg.subtype,
              bot_id: msg.bot_id,
              textPreview:
                typeof msg.text === "string" ? msg.text.slice(0, 100) : "",
              blockTypes,
            }),
        );
      }
      return;
    }

    const head = sales[0];
    const slideMeta = isSlideOrderMeta(head.meta) ? head.meta : undefined;
    const big = slideMeta?.bigOrder;
    if (slideMeta) {
      console.log(
        big
          ? `[Slack] Parsed Slide BIG order: ${head.customer} — ${big.totalUnits} units across ${new Set(sales.map((s) => (isSlideOrderMeta(s.meta) ? s.meta.bigOrder?.skuLineIndex : undefined))).size} SKUs`
          : `[Slack] Parsed Slide order: ${slideMeta.orderId} — ${head.customer}`,
      );
    } else {
      console.log(
        `[Slack] Parsed sale: ${head.rep} — $${head.amount} — ${head.customer}`,
      );
    }

    for (let i = 0; i < sales.length; i++) {
      const enriched = await enrichSaleWithAccountOwnerFromDwh(sales[i]);
      if (
        i === 0 &&
        enriched.meta?.source === "slide_cloud" &&
        enriched.rep.trim()
      ) {
        console.log(`[Slack] DWH owner: ${enriched.rep} — ${enriched.customer}`);
      }
      onSale?.(enriched);
    }
  }

  async function handleIncomingSlackMessage(
    ev: Record<string, unknown>,
    client: WebClient,
    opts?: { fromPoll?: boolean },
  ): Promise<void> {
    if (!("channel" in ev) || typeof ev.channel !== "string") return;
    const route = routeIncomingSlackChannel(ev.channel);
    if (route === "ignore") return;
    if (route === "demo") {
      await handleDemoChannelMessage(ev, client, opts);
      return;
    }
    await handleSalesChannelMessage(ev, client, opts);
  }

  // Use raw `message` events so other apps’ `bot_message` payloads are not skipped (more reliable than `app.message()`).
  slackApp.event("message", async ({ event, client }) => {
    const ev = event as unknown as Record<string, unknown>;
    if (config.slack.logMessageEvents) {
      console.log(
        `[Slack] socket message event ch=${ev.channel} subtype=${ev.subtype === undefined ? "(none)" : String(ev.subtype)} bot=${ev.bot_id ? "yes" : "no"} blocks=${Array.isArray(ev.blocks) ? ev.blocks.length : 0}`,
      );
    }
    if (shouldSkipSlackMessageSubtype(ev)) return;
    await handleIncomingSlackMessage(ev, client as WebClient);
  });

  console.log(
    `[Slack] Effective config: SLACK_SALES_CHANNEL_ID=${config.slack.salesChannelId || "(empty = all channels)"} SLACK_DEMO_BOOKINGS_CHANNEL_ID=${config.slack.demoBookingsChannelId || "(unset)"} SLACK_POLL_HISTORY_MS=${config.slack.pollHistoryMs}`,
  );

  await slackApp.start();
  console.log("[Slack] Connected via Socket Mode");
  console.log(
    "[Slack] Use the SAME channel ID where Slide posts AND where you test. If manual works only in another channel, .env still points at that other channel.",
  );
  console.log(
    "[Slack] If other bots’ posts never log anything, add Event Subscriptions → message.channels and reinstall the app.",
  );

  const slackClient = slackApp.client as WebClient;
  void verifySalesChannel(slackClient);
  void verifyDemoBookingsChannel(slackClient);
  startSalesChannelHistoryPoll(
    slackClient,
    config.slack.pollHistoryMs,
    config.slack.salesChannelId,
    handleIncomingSlackMessage,
    "sales",
  );
  startSalesChannelHistoryPoll(
    slackClient,
    config.slack.pollHistoryMs,
    config.slack.demoBookingsChannelId,
    handleIncomingSlackMessage,
    "demo",
  );

  if (
    config.slack.backfillOnStart &&
    config.slack.salesChannelId &&
    onHistorySale
  ) {
    void runBackfillJob(slackClient);
  }
}

function startSalesChannelHistoryPoll(
  client: WebClient,
  intervalMs: number,
  channel: string,
  handleMessage: (
    m: Record<string, unknown>,
    c: WebClient,
    o?: { fromPoll?: boolean },
  ) => Promise<void>,
  label: "sales" | "demo",
): void {
  if (intervalMs <= 0 || !channel) {
    if (intervalMs > 0 && !channel) {
      const hint =
        label === "sales"
          ? "SLACK_SALES_CHANNEL_ID is empty"
          : "SLACK_DEMO_BOOKINGS_CHANNEL_ID is empty";
      console.warn(`[Slack] SLACK_POLL_HISTORY_MS is set but ${hint} — ${label} poll disabled.`);
    }
    if (intervalMs <= 0 && label === "sales") {
      console.warn(
        "[Slack] History poll DISABLED (SLACK_POLL_HISTORY_MS=0). Slide may be missed if Socket events don’t fire — unset or set e.g. 30000.",
      );
    }
    return;
  }

  let busy = false;
  const tick = async (): Promise<void> => {
    if (busy) return;
    busy = true;
    try {
      const r = await client.conversations.history({
        channel,
        limit: 10,
      });
      if (!r.ok) {
        if (config.slack.logPoll) {
          console.warn(`[Slack][${label}] Poll conversations.history not ok:`, r.error);
        }
        return;
      }
      const list = r.messages ?? [];
      if (config.slack.logPoll) {
        console.log(`[Slack][${label}] Poll tick: ${list.length} message(s) from history`);
      }
      if (!list.length) return;
      const ordered = [...list].reverse();
      for (const raw of ordered) {
        const rec = {
          ...(raw as object),
          channel,
        } as Record<string, unknown>;
        if (shouldSkipSlackMessageSubtype(rec)) continue;
        await handleMessage(rec, client, { fromPoll: true });
      }
    } catch (e) {
      console.warn(
        `[Slack][${label}] Poll conversations.history failed:`,
        e instanceof Error ? e.message : e,
      );
    } finally {
      busy = false;
    }
  };

  console.log(
    `[Slack][${label}] Polling #${channel.slice(0, 4)}… every ${intervalMs}ms. Set SLACK_POLL_HISTORY_MS=0 to disable.`,
  );
  void tick();
  setInterval(() => void tick(), intervalMs);
}

async function verifyDemoBookingsChannel(client: WebClient): Promise<void> {
  const id = config.slack.demoBookingsChannelId;
  if (!id) return;
  if (!/^[CG][A-Z0-9]{8,}$/i.test(id)) {
    console.warn(
      `[Slack] SLACK_DEMO_BOOKINGS_CHANNEL_ID looks wrong (${JSON.stringify(id.slice(0, 16))}…).`,
    );
    return;
  }
  try {
    const r = await client.conversations.info({ channel: id });
    if (!r.ok) {
      console.warn(
        `[Slack] Cannot read demo bookings channel (${r.error}). Invite the bot and check channels:read / groups:read.`,
      );
      return;
    }
    const ch = r.channel;
    const name = ch?.name ?? "?";
    if (ch?.is_member === false) {
      console.warn(
        `[Slack] Bot is not a member of demo channel #${name} (${id}). Run /invite there.`,
      );
      return;
    }
    console.log(`[Slack] Demo bookings channel #${name} (${id})`);
  } catch (e) {
    console.warn(
      "[Slack] Demo channel conversations.info failed:",
      e instanceof Error ? e.message : e,
    );
  }
}

async function verifySalesChannel(client: WebClient): Promise<void> {
  const id = config.slack.salesChannelId;
  if (!id) {
    console.warn(
      "[Slack] SLACK_SALES_CHANNEL_ID is empty — processing messages from every channel the bot is in (except SLACK_DEMO_BOOKINGS_CHANNEL_ID when set).",
    );
    return;
  }
  if (!/^[CG][A-Z0-9]{8,}$/i.test(id)) {
    console.warn(
      `[Slack] SLACK_SALES_CHANNEL_ID looks wrong (${JSON.stringify(id.slice(0, 16))}…). It must be the ID from Slack (Copy link → …/archives/C01…), not #dev-orders.`,
    );
    return;
  }
  try {
    const r = await client.conversations.info({ channel: id });
    if (!r.ok) {
      console.warn(
        `[Slack] Cannot read sales channel (${r.error}). Fix SLACK_SALES_CHANNEL_ID, invite the bot, add channels:read + groups:read (private), reinstall app.`,
      );
      return;
    }
    const ch = r.channel;
    const name = ch?.name ?? "?";
    if (ch?.is_member === false) {
      console.warn(
        `[Slack] Bot is not a member of #${name} (${id}). Run /invite @SalesDisplay in that channel.`,
      );
      return;
    }
    console.log(`[Slack] Listening for #${name} (${id})`);
  } catch (e) {
    console.warn(
      "[Slack] conversations.info failed:",
      e instanceof Error ? e.message : e,
    );
  }
}

async function runBackfillJob(client: WebClient): Promise<void> {
  try {
    console.log(
      `[Backfill] Starting (max ${config.slack.backfillMaxMessages} messages, no celebrations)…`,
    );
    const result = await runSlackHistoryBackfill(
      client,
      config.slack.salesChannelId,
      {
        maxMessages: config.slack.backfillMaxMessages,
        pageDelayMs: config.slack.backfillPageDelayMs,
      },
      (sale) => onHistorySale?.(sale) ?? false,
    );
    console.log(
      `[Backfill] Done: scanned=${result.scanned} (channel=${result.channelMessagesScanned} thread=${result.threadMessagesScanned}) inserted=${result.inserted} pages=${result.pages}`,
    );
    onBackfillComplete?.();
  } catch (err) {
    console.error("[Backfill] Failed:", err);
  }
}
