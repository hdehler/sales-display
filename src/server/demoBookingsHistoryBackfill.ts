import type { WebClient } from "@slack/web-api";
import { parseDemoBookingFromSlackMessage } from "./parseDemoBooking.js";
import { slackTsToIso } from "./parseSlackMessage.js";
import { insertDemoBookingIfNew } from "./db.js";
import {
  walkSlackChannelHistory,
  type BackfillOptions,
  type BackfillResult,
} from "./slackHistoryBackfill.js";

export interface DemoBackfillStats {
  parseCandidates: number;
  parsedAsDemo: number;
  parseMisses: number;
  duplicateSkipped: number;
}

export type DemoBookingsBackfillResult = Omit<BackfillResult, "stats"> & {
  stats?: DemoBackfillStats;
};

/**
 * Same pagination as sales backfill, but parses HubSpot demo messages into `demo_bookings`.
 * No celebrations; dedupe by `slack_ts`.
 */
export async function runDemoBookingsHistoryBackfill(
  client: WebClient,
  channelId: string,
  options: BackfillOptions,
): Promise<DemoBookingsBackfillResult> {
  let inserted = 0;
  const collectStats = options.collectStats === true;
  const stats: DemoBackfillStats = {
    parseCandidates: 0,
    parsedAsDemo: 0,
    parseMisses: 0,
    duplicateSkipped: 0,
  };

  async function processMessage(msg: Record<string, unknown>): Promise<void> {
    if (msg.type !== "message") return;
    if (msg.subtype === "message_deleted") return;

    if (collectStats) stats.parseCandidates += 1;

    const ts = typeof msg.ts === "string" ? msg.ts : undefined;
    if (!ts) {
      if (collectStats) stats.parseMisses += 1;
      return;
    }

    const parsed = parseDemoBookingFromSlackMessage(msg);
    if (!parsed) {
      if (collectStats) stats.parseMisses += 1;
      return;
    }
    if (collectStats) stats.parsedAsDemo += 1;

    const row = insertDemoBookingIfNew({
      slackTs: ts,
      bdr: parsed.bdr,
      company: parsed.company,
      ae: parsed.ae,
      territory: parsed.territory,
      demoScheduledDate: parsed.demoScheduledDate,
      rawMessage: parsed.rawMessage,
      timestamp: slackTsToIso(ts),
    });

    if (row) {
      inserted += 1;
    } else if (collectStats) {
      stats.duplicateSkipped += 1;
    }
  }

  const base = await walkSlackChannelHistory(
    client,
    channelId,
    options,
    processMessage,
  );

  return {
    ...base,
    inserted,
    ...(collectStats ? { stats } : {}),
  };
}
