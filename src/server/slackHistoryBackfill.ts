import type { WebClient } from "@slack/web-api";
import { parseMessageToSale } from "./parseSlackMessage.js";
import type { Sale } from "../shared/types.js";

export interface BackfillOptions {
  maxMessages: number;
  /** Pause between API pages (ms) to respect rate limits */
  pageDelayMs: number;
}

export interface BackfillResult {
  scanned: number;
  inserted: number;
  pages: number;
}

/**
 * Walk channel history (newest-first pages) and insert parsed sales.
 * `onInsert` should return true if the row was new (dedupe by slack_ts in caller).
 */
export async function runSlackHistoryBackfill(
  client: WebClient,
  channelId: string,
  options: BackfillOptions,
  onInsert: (sale: Sale) => boolean,
): Promise<BackfillResult> {
  let scanned = 0;
  let inserted = 0;
  let pages = 0;
  let cursor: string | undefined;

  while (scanned < options.maxMessages) {
    const pageSize = Math.min(200, options.maxMessages - scanned);
    if (pageSize <= 0) break;

    const res = await client.conversations.history({
      channel: channelId,
      limit: pageSize,
      cursor,
      include_all_metadata: true,
    });

    if (!res.ok) {
      throw new Error(`conversations.history failed: ${res.error || "unknown"}`);
    }

    pages += 1;
    const messages = res.messages ?? [];

    for (const raw of messages) {
      if (scanned >= options.maxMessages) break;
      scanned += 1;

      const msg = raw as unknown as Record<string, unknown>;
      if (msg.type !== "message") continue;
      if (msg.subtype === "message_deleted") continue;

      const sale = parseMessageToSale(msg);
      if (!sale) continue;

      if (onInsert(sale)) inserted += 1;
    }

    cursor = res.response_metadata?.next_cursor;
    if (!cursor) break;

    await new Promise((r) => setTimeout(r, options.pageDelayMs));
  }

  return { scanned, inserted, pages };
}
