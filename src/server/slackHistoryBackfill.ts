import type { WebClient } from "@slack/web-api";
import { parseMessageToSale } from "./parseSlackMessage.js";
import { enrichSaleWithAccountOwnerFromDwh } from "./bigqueryAccountOwner.js";
import type { Sale } from "../shared/types.js";

export interface BackfillOptions {
  maxMessages: number;
  /** Pause between API pages (ms) to respect rate limits */
  pageDelayMs: number;
  /**
   * Slack `ts` strings (Unix seconds.microseconds). When set, passed to
   * `conversations.history` so only messages in [oldest, latest) are fetched (Slack semantics).
   */
  oldest?: string;
  /** Upper bound exclusive in practice: use start of day after your last inclusive day. */
  latest?: string;
  /**
   * `conversations.history` omits thread replies. When true (default), also call
   * `conversations.replies` for each message with `reply_count > 0` so orders posted only
   * in threads are imported.
   */
  includeThreadReplies?: boolean;
  /** Pause between `conversations.replies` pages (ms). */
  threadReplyPageDelayMs?: number;
}

export interface BackfillResult {
  scanned: number;
  inserted: number;
  pages: number;
  /** Top-level channel messages counted (excludes thread-only scan tally if you need raw split, use scanned) */
  channelMessagesScanned: number;
  threadMessagesScanned: number;
}

/**
 * Walk channel history (newest-first pages) and insert parsed sales.
 * `onInsert` should return true if the row was new (dedupe by slack_ts in caller).
 *
 * When `oldest` is set (CLI date range), pagination continues until Slack returns no
 * `next_cursor` — `maxMessages` is not applied, so busy channels do not truncate the month.
 */
export async function runSlackHistoryBackfill(
  client: WebClient,
  channelId: string,
  options: BackfillOptions,
  onInsert: (sale: Sale) => boolean,
): Promise<BackfillResult> {
  let scanned = 0;
  let channelMessagesScanned = 0;
  let threadMessagesScanned = 0;
  let inserted = 0;
  let pages = 0;
  let cursor: string | undefined;

  const dateBounded =
    options.oldest != null && String(options.oldest).trim() !== "";
  /** In date-range mode, fetch every page in the window; otherwise respect maxMessages (e.g. startup backfill). */
  const messageCap = dateBounded ? Number.MAX_SAFE_INTEGER : Math.max(1, options.maxMessages);
  const includeThreadReplies = options.includeThreadReplies !== false;
  const threadReplyPageDelayMs = Math.max(
    0,
    options.threadReplyPageDelayMs ?? options.pageDelayMs,
  );

  async function tryInsertFromMessage(msg: Record<string, unknown>): Promise<void> {
    if (msg.type !== "message") return;
    if (msg.subtype === "message_deleted") return;

    const sale = parseMessageToSale(msg);
    if (!sale) return;

    const enriched = await enrichSaleWithAccountOwnerFromDwh(sale);
    if (onInsert(enriched)) inserted += 1;
  }

  async function fetchThreadReplies(parentTs: string): Promise<void> {
    let replyCursor: string | undefined;
    for (;;) {
      const rep = await client.conversations.replies({
        channel: channelId,
        ts: parentTs,
        limit: 200,
        cursor: replyCursor,
        include_all_metadata: true,
      });

      if (!rep.ok) {
        console.warn(
          `[Backfill] conversations.replies failed (thread ${parentTs}): ${rep.error ?? "unknown"}`,
        );
        return;
      }

      const msgs = rep.messages ?? [];
      for (let i = 0; i < msgs.length; i++) {
        if (i === 0) continue;
        if (scanned >= messageCap) return;

        scanned += 1;
        threadMessagesScanned += 1;
        const raw = msgs[i] as unknown as Record<string, unknown>;
        await tryInsertFromMessage(raw);
      }

      replyCursor = rep.response_metadata?.next_cursor;
      if (!replyCursor) break;
      if (threadReplyPageDelayMs > 0) {
        await new Promise((r) => setTimeout(r, threadReplyPageDelayMs));
      }
    }
  }

  while (scanned < messageCap) {
    const pageSize = Math.min(200, messageCap - scanned);
    if (pageSize <= 0) break;

    const res = await client.conversations.history({
      channel: channelId,
      limit: pageSize,
      cursor,
      include_all_metadata: true,
      ...(options.oldest != null && options.oldest !== ""
        ? { oldest: options.oldest }
        : {}),
      ...(options.latest != null && options.latest !== ""
        ? { latest: options.latest }
        : {}),
    });

    if (!res.ok) {
      throw new Error(`conversations.history failed: ${res.error || "unknown"}`);
    }

    pages += 1;
    const messages = res.messages ?? [];

    for (const raw of messages) {
      if (scanned >= messageCap) break;
      scanned += 1;
      channelMessagesScanned += 1;

      const msg = raw as unknown as Record<string, unknown>;
      await tryInsertFromMessage(msg);

      if (includeThreadReplies && typeof msg.ts === "string") {
        const rc = msg.reply_count;
        const n = typeof rc === "number" ? rc : 0;
        if (n > 0) await fetchThreadReplies(msg.ts);
      }
    }

    cursor = res.response_metadata?.next_cursor;
    if (!cursor) break;

    await new Promise((r) => setTimeout(r, options.pageDelayMs));
  }

  return {
    scanned,
    inserted,
    pages,
    channelMessagesScanned,
    threadMessagesScanned,
  };
}
