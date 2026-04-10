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

  slackApp.message(async ({ message, client }) => {
    if (!("channel" in message)) return;

    const configuredCh = config.slack.salesChannelId;
    const incomingCh =
      typeof message.channel === "string"
        ? message.channel.toUpperCase()
        : "";
    if (configuredCh && incomingCh !== configuredCh) {
      return;
    }

    const msg = message as unknown as Record<string, unknown>;
    let sale = parseMessageToSale(msg);

    if (
      !sale &&
      shouldRefetchMessageForParse(msg) &&
      typeof message.channel === "string" &&
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
  });

  await slackApp.start();
  console.log("[Slack] Connected via Socket Mode");

  void verifySalesChannel(slackApp.client as WebClient);

  if (
    config.slack.backfillOnStart &&
    config.slack.salesChannelId &&
    onHistorySale
  ) {
    const client = slackApp.client as WebClient;
    void runBackfillJob(client);
  }
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
