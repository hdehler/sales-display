import { App, LogLevel } from "@slack/bolt";
import type { WebClient } from "@slack/web-api";
import { config } from "./config.js";
import { parseMessageToSale } from "./parseSlackMessage.js";
import { slackMessageHasStructuredContent } from "./parseSlideOrder.js";
import { runSlackHistoryBackfill } from "./slackHistoryBackfill.js";
import type { Sale } from "../shared/types.js";

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
): Promise<Sale | null> {
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
    console.log(
      `[Slack] Re-fetched message: blocks=${fullBlocks} textLen=${fullTextLen} text=${typeof full.text === "string" ? JSON.stringify(full.text.slice(0, 200)) : "null"}`,
    );
    const sale = parseMessageToSale(full);
    if (sale) {
      console.log(
        `[Slack] Parsed after re-fetch: ${sale.meta?.source === "slide_cloud" ? `Slide order ${sale.meta.orderId} — ${sale.customer}` : `${sale.rep} $${sale.amount} ${sale.customer}`}`,
      );
    } else {
      console.warn("[Slack] Re-fetch returned a message but parser still couldn't match it.");
    }
    return sale;
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

type SaleCallback = (sale: Sale) => void;
let onSale: SaleCallback | null = null;

/** Inserts historical rows only (no celebrations); return true if inserted */
let onHistorySale: ((sale: Sale) => boolean) | null = null;
let onBackfillComplete: (() => void) | null = null;

export function setSaleCallback(cb: SaleCallback): void {
  onSale = cb;
}

export function setHistorySaleHandler(cb: (sale: Sale) => boolean): void {
  onHistorySale = cb;
}

export function setBackfillCompleteHandler(cb: () => void): void {
  onBackfillComplete = cb;
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

  async function handleSalesChannelMessage(
    message: Record<string, unknown>,
    client: WebClient,
    opts?: { fromPoll?: boolean },
  ): Promise<void> {
    if (!("channel" in message) || typeof message.channel !== "string") return;

    const configuredCh = config.slack.salesChannelId;
    const incomingCh = message.channel.toUpperCase();
    if (configuredCh && incomingCh !== configuredCh) return;

    const msg = message;
    const nBlocks = Array.isArray(msg.blocks) ? msg.blocks.length : 0;
    const tLen = typeof msg.text === "string" ? msg.text.length : 0;
    const hasBot = Boolean(msg.bot_id);
    const subtype = typeof msg.subtype === "string" ? msg.subtype : "";

    console.log(
      `[Slack] Incoming message ts=${msg.ts} subtype=${subtype || "(none)"} bot_id=${msg.bot_id ?? "none"} blocks=${nBlocks} textLen=${tLen}`,
    );

    let sale = parseMessageToSale(msg);

    if (!sale && (hasBot || subtype === "bot_message" || nBlocks === 0) && typeof message.ts === "string") {
      console.log(`[Slack] First parse failed, attempting re-fetch for ts=${message.ts}…`);
      sale = await refetchAndParse(
        client,
        message.channel,
        message.ts as string,
      );
    }

    if (!sale) {
      if ((hasBot || subtype === "bot_message") && configuredCh && !opts?.fromPoll) {
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

    if (sale.meta?.source === "slide_cloud") {
      console.log(
        `[Slack] Parsed Slide order: ${sale.meta.orderId} — ${sale.customer}`,
      );
    } else {
      console.log(
        `[Slack] Parsed sale: ${sale.rep} — $${sale.amount} — ${sale.customer}`,
      );
    }
    onSale?.(sale);
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
    await handleSalesChannelMessage(ev, client as WebClient);
  });

  console.log(
    `[Slack] Effective config: SLACK_SALES_CHANNEL_ID=${config.slack.salesChannelId || "(empty = all channels)"} SLACK_POLL_HISTORY_MS=${config.slack.pollHistoryMs}`,
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
  startSalesChannelHistoryPoll(
    slackClient,
    config.slack.pollHistoryMs,
    handleSalesChannelMessage,
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
  handleMessage: (
    m: Record<string, unknown>,
    c: WebClient,
    o?: { fromPoll?: boolean },
  ) => Promise<void>,
): void {
  const channel = config.slack.salesChannelId;
  if (intervalMs <= 0 || !channel) {
    if (intervalMs > 0 && !channel) {
      console.warn(
        "[Slack] SLACK_POLL_HISTORY_MS is set but SLACK_SALES_CHANNEL_ID is empty — poll disabled.",
      );
    }
    if (intervalMs <= 0) {
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
          console.warn("[Slack] Poll conversations.history not ok:", r.error);
        }
        return;
      }
      const list = r.messages ?? [];
      if (config.slack.logPoll) {
        console.log(`[Slack] Poll tick: ${list.length} message(s) from history`);
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
        "[Slack] Poll conversations.history failed:",
        e instanceof Error ? e.message : e,
      );
    } finally {
      busy = false;
    }
  };

  console.log(
    `[Slack] Polling #${channel.slice(0, 4)}… every ${intervalMs}ms (catches Slide if Socket events are missing). Set SLACK_POLL_HISTORY_MS=0 to disable.`,
  );
  void tick();
  setInterval(() => void tick(), intervalMs);
}

async function verifySalesChannel(client: WebClient): Promise<void> {
  const id = config.slack.salesChannelId;
  if (!id) {
    console.warn(
      "[Slack] SLACK_SALES_CHANNEL_ID is empty — processing messages from every channel the bot is in.",
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
      `[Backfill] Done: scanned=${result.scanned} inserted=${result.inserted} pages=${result.pages}`,
    );
    onBackfillComplete?.();
  } catch (err) {
    console.error("[Backfill] Failed:", err);
  }
}
