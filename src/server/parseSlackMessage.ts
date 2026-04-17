import { config } from "./config.js";
import {
  parseSlideOrderFromSlackMessage,
  slackPrimaryTextBody,
} from "./parseSlideOrder.js";
import type { Sale } from "../shared/types.js";

/**
 * Ingest flow: Slack messages → parse → SQLite `sales` (not an external “orders” DB).
 * 1) Slide / order bot: run-on “Account…Order…” (and Block Kit) → **customer = account**, **order id** in meta, **rep = ""** (no salesperson in Slack).
 * 2) Manual channel posts: regexes on message text (see config.messagePatterns).
 */

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
 * Parse a Slack message object (Socket Mode or conversations.history) into one or more Sales.
 *
 * Most messages map to a single Sale. Slide Cloud "BIG Order Created" expands into one Sale
 * per quantity unit (e.g. `17x Slide Z1` → 17 Sales) so leaderboards, monthCount, and the
 * hunter board reflect every individual unit. Each unit gets a unique deterministic
 * `slackTs` (`<ts>#u<NNN>`) so re-imports still dedupe via `slack_ts`.
 *
 * Returns `null` only when nothing was recognized; otherwise returns a non-empty array.
 */
export function parseMessageToSales(msg: Record<string, unknown>): Sale[] | null {
  const ts = typeof msg.ts === "string" ? msg.ts : undefined;

  const slideSales = parseSlideOrderFromSlackMessage(msg, ts);
  if (slideSales && slideSales.length > 0) {
    if (ts) {
      const iso = slackTsToIso(ts);
      for (const s of slideSales) {
        s.timestamp = iso;
        if (!s.slackTs) s.slackTs = ts;
      }
    }
    return slideSales;
  }

  const text = slackPrimaryTextBody(msg);
  if (!text.trim()) return null;
  const plain = parsePlainTextSale(text.trim(), ts);
  if (!plain) return null;
  if (ts) {
    plain.timestamp = slackTsToIso(ts);
    plain.slackTs = ts;
  }
  return [plain];
}
