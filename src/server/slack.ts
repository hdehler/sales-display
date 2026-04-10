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
 * Ignore edits, deletes, joins, etc. User posts have no subtype; Slide uses `bot_message`.
 */
function isProcessableMessageSubtype(msg: Record<string, unknown>): boolean {
  const sub = typeof msg.subtype === "string" ? msg.subtype : "";
  if (!sub) return true;
  return sub === "bot_message";
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
    let sale = parseMessageToSale(msg);

    if (
      !sale &&
      shouldRefetchMessageForParse(msg) &&
      typeof message.ts === "string"
    ) {
      try {
        const hist = await client.conversations.history({
          channel: message.channel,
          oldest: message.ts,
          latest: message.ts,
          inclusive: true,
          limit: 1,
        });
        const full = hist.messages?.[0] as unknown as
          | Record<string, unknown>
          | undefined;
        if (full) {
          sale = parseMessageToSale(full);
          if (sale) {
            console.log(
              "[Slack] Parsed after conversations.history re-fetch (Socket payload was incomplete).",
            );
          }
        }
      } catch (err) {
        console.warn(
          "[Slack] conversations.history re-fetch failed (need channels:history + bot in channel):",
          err instanceof Error ? err.message : err,
        );
      }
    }

    if (!sale) {
      const fromBot = Boolean(msg.bot_id || msg.subtype === "bot_message");
      if (fromBot && configuredCh && !opts?.fromPoll) {
        const nBlocks = Array.isArray(msg.blocks) ? msg.blocks.length : 0;
        const tLen = typeof msg.text === "string" ? msg.text.length : 0;
        console.warn(
          `[Slack] Unparsed app/bot message in sales channel (ts=${msg.ts}) blocks=${nBlocks} textLen=${tLen}. If Slide posts look correct, set SLACK_DEBUG_PARSE=1 and restart.`,
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
    if (!isProcessableMessageSubtype(ev)) return;
    await handleSalesChannelMessage(ev, client as WebClient);
  });

  await slackApp.start();
  console.log("[Slack] Connected via Socket Mode");
  console.log(
    "[Slack] If other bots’ posts never log anything, add Event Subscriptions → Subscribe to bot events → message.channels at api.slack.com/apps (then reinstall to workspace).",
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
    return;
  }

  let busy = false;
  const tick = async (): Promise<void> => {
    if (busy) return;
    busy = true;
    try {
      const r = await client.conversations.history({
        channel,
        limit: 50,
      });
      if (!r.ok || !r.messages?.length) return;
      const ordered = [...r.messages].reverse();
      for (const raw of ordered) {
        const rec = {
          ...(raw as object),
          channel,
        } as Record<string, unknown>;
        if (!isProcessableMessageSubtype(rec)) continue;
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
