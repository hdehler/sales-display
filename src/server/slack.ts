import { App, LogLevel } from "@slack/bolt";
import { config } from "./config.js";
import type { Sale } from "../shared/types.js";

type SaleCallback = (sale: Sale) => void;
let onSale: SaleCallback | null = null;

export function setSaleCallback(cb: SaleCallback): void {
  onSale = cb;
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
    if (!("channel" in message) || !("text" in message)) return;

    if (
      config.slack.salesChannelId &&
      message.channel !== config.slack.salesChannelId
    ) {
      return;
    }

    const text = (message as Record<string, unknown>).text as string;
    if (!text) return;

    const sale = parseSaleMessage(
      text,
      (message as Record<string, unknown>).ts as string | undefined,
    );

    if (sale) {
      console.log(
        `[Slack] Parsed sale: ${sale.rep} — $${sale.amount} — ${sale.customer}`,
      );
      onSale?.(sale);
    }
  });

  await slackApp.start();
  console.log("[Slack] Connected via Socket Mode");
}

function parseSaleMessage(text: string, ts?: string): Sale | null {
  for (const pattern of config.messagePatterns) {
    const match = text.match(pattern.regex);
    if (match) {
      const g = pattern.groups;
      return {
        rep: match[g.rep]?.trim() || "Unknown",
        customer: match[g.customer]?.trim() || "Unknown",
        product: match[g.product]?.trim() || "",
        amount: parseFloat(match[g.amount]?.replace(/[,$]/g, "") || "0"),
        timestamp: new Date().toISOString(),
        slackTs: ts,
        rawMessage: text,
      };
    }
  }

  return null;
}
