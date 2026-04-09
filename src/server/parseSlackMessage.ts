import { config } from "./config.js";
import { parseSlideOrderFromSlackMessage } from "./parseSlideOrder.js";
import type { Sale } from "../shared/types.js";

/** Slack message `ts` (seconds.micros) → ISO timestamp for DB ordering */
export function slackTsToIso(ts: string): string {
  const ms = Math.floor(parseFloat(ts) * 1000);
  return new Date(ms).toISOString();
}

function parsePlainTextSale(text: string, ts?: string): Sale | null {
  for (const pattern of config.messagePatterns) {
    const match = text.match(pattern.regex);
    if (match) {
      const g = pattern.groups;
      return {
        rep: match[g.rep]?.trim() || "Unknown",
        customer: match[g.customer]?.trim() || "Unknown",
        product: match[g.product]?.trim() || "",
        amount: parseFloat(match[g.amount]?.replace(/[,$]/g, "") || "0"),
        timestamp: ts ? slackTsToIso(ts) : new Date().toISOString(),
        slackTs: ts ?? undefined,
        rawMessage: text,
      };
    }
  }
  return null;
}

/**
 * Parse a Slack message object (Socket Mode or conversations.history) into a Sale.
 */
export function parseMessageToSale(msg: Record<string, unknown>): Sale | null {
  const ts = typeof msg.ts === "string" ? msg.ts : undefined;

  let sale: Sale | null = parseSlideOrderFromSlackMessage(msg, ts);

  if (!sale) {
    const text = typeof msg.text === "string" ? msg.text : "";
    if (!text) return null;
    sale = parsePlainTextSale(text, ts);
  }

  if (sale && ts) {
    sale.timestamp = slackTsToIso(ts);
    sale.slackTs = ts;
  }

  return sale;
}
