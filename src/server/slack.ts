import { App, LogLevel } from "@slack/bolt";
import type { WebClient } from "@slack/web-api";
import { config } from "./config.js";
import { parseMessageToSale } from "./parseSlackMessage.js";
import { runSlackHistoryBackfill } from "./slackHistoryBackfill.js";
import type { Sale } from "../shared/types.js";

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

  slackApp.message(async ({ message }) => {
    if (!("channel" in message)) return;

    if (
      config.slack.salesChannelId &&
      message.channel !== config.slack.salesChannelId
    ) {
      return;
    }

    const msg = message as unknown as Record<string, unknown>;
    const sale = parseMessageToSale(msg);
    if (!sale) return;

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

  if (
    config.slack.backfillOnStart &&
    config.slack.salesChannelId &&
    onHistorySale
  ) {
    const client = slackApp.client as WebClient;
    void runBackfillJob(client);
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
