import type { Express } from "express";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { simulateSlackMessage } from "./slack.js";
import { getAllReps, getRepByDisplayName } from "./db.js";
import { repWalkupToResolvedSong } from "./celebration.js";
import { isUnresolvedRepName } from "../shared/rep.js";
import type { Sale } from "../shared/types.js";

/**
 * Local testing routes (ENABLE_DEV_ENDPOINTS=true, set by `make local`). Each one builds a Slack
 * message the way Slide / HubSpot post it and runs it through the live parse → DWH → celebration
 * path, then reports who got credited and which walk-up song will play.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "../../public");

let seq = 0;
/** Unique Slack-style ts so each simulated message is a new row (dedupe is by slack_ts). */
function fakeTs(): string {
  seq = (seq + 1) % 1_000_000;
  return `${Math.floor(Date.now() / 1000)}.${String(seq).padStart(6, "0")}`;
}

function field(label: string, value: string): { type: string; text: string } {
  return { type: "mrkdwn", text: `*${label}*\n${value}` };
}

/** Same Block Kit shape as a Slide Cloud "New Order Created" post. */
export function slideOrderMessage(o: {
  account: string;
  newBuyingPartner: boolean;
  hardware: string;
  service: string;
}): Record<string, unknown> {
  const ts = fakeTs();
  const orderId = `o_sim${ts.replace(".", "")}`;
  return {
    ts,
    bot_id: "BSIMULATED",
    text: `New Order Created: ${o.account}`,
    blocks: [
      { type: "header", text: { type: "plain_text", text: "New Order Created" } },
      {
        type: "section",
        fields: [
          field("Account", o.account),
          field("Order", orderId),
          field("Datacenter Region", "us-east"),
          field("Hardware", o.hardware),
          field("Service", o.service),
          field("Order History", `Total Orders: ${o.newBuyingPartner ? 0 : 3}`),
        ],
      },
    ],
  };
}

/** Same `Label: value` text HubSpot posts in the demo-bookings channel. */
export function demoMessage(bdr: string, company: string): Record<string, unknown> {
  return {
    ts: fakeTs(),
    bot_id: "BSIMULATED",
    text: `New demo booked\nBDR: ${bdr}\nCompany: ${company}`,
  };
}

/** What the celebration will do for this rep name — the part that broke when DWH changed. */
function walkupReport(repName: string, product: string) {
  if (isUnresolvedRepName(repName)) {
    return {
      teamMatch: false,
      plays: "default song (no rep credited)",
    };
  }
  const row = getRepByDisplayName(repName);
  if (!row) {
    return {
      teamMatch: false,
      plays: "default song (credited name is not on the Team list)",
      teamNames: getAllReps().map((r) => r.name),
    };
  }
  const song = repWalkupToResolvedSong(row.walkup_song, product);
  const file = song.songUrl?.startsWith("/sounds/")
    ? path.join(publicDir, song.songUrl)
    : null;
  return {
    teamMatch: true,
    walkupSong: row.walkup_song || null,
    plays: song.songUrl ?? (song.jingleId ? `jingle:${song.jingleId}` : "default song"),
    ...(file && !existsSync(file)
      ? { warning: `song file not on this machine (${song.songUrl}); run make pull-pi` }
      : {}),
  };
}

function reportSales(sales: Sale[]) {
  return sales.map((s) => ({
    customer: s.customer,
    rep: s.rep,
    newBuyingPartner:
      s.meta?.source === "slide_cloud" ? s.meta.newBuyingPartner : undefined,
    ...walkupReport(s.rep, s.product),
  }));
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

export function registerDevRoutes(app: Express): void {
  console.warn("[Dev] ENABLE_DEV_ENDPOINTS is on — /api/dev/* simulators are live");

  /** Body: { account, newBuyingPartner?, hardware?, service? } */
  app.post("/api/dev/simulate/order", async (req, res) => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const account = str(b.account);
    if (!account) {
      res.status(400).json({ error: "account is required" });
      return;
    }
    const msg = slideOrderMessage({
      account,
      newBuyingPartner: b.newBuyingPartner === true || b.newBuyingPartner === "true",
      hardware: str(b.hardware, "Slide Z1, 1 TB"),
      service: str(b.service, "Subscription"),
    });
    const r = await simulateSlackMessage(msg, "sales");
    if (!r || !("sales" in r)) {
      res.status(500).json({ error: "simulated Slide message did not parse", message: msg });
      return;
    }
    res.json({ ok: true, sales: reportSales(r.sales) });
  });

  /** Body: { bdr, company } */
  app.post("/api/dev/simulate/demo", async (req, res) => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const bdr = str(b.bdr);
    if (!bdr) {
      res.status(400).json({ error: "bdr is required" });
      return;
    }
    const r = await simulateSlackMessage(demoMessage(bdr, str(b.company, "Test Co")), "demo");
    if (!r || !("demo" in r)) {
      res.status(500).json({ error: "simulated demo message did not parse" });
      return;
    }
    res.json({ ok: true, bdr: r.demo.bdr, company: r.demo.company, ...walkupReport(r.demo.bdr, "") });
  });

  /**
   * Replay a real Slack message JSON (e.g. copied from logs with SLACK_DEBUG_PARSE).
   * Body: { channel?: "sales" | "demo", message: {...} } — a fresh `ts` is used so it always inserts.
   */
  app.post("/api/dev/simulate/slack", async (req, res) => {
    const b = (req.body ?? {}) as { channel?: unknown; message?: unknown };
    if (!b.message || typeof b.message !== "object") {
      res.status(400).json({ error: "message (Slack message object) is required" });
      return;
    }
    const channel = b.channel === "demo" ? "demo" : "sales";
    const msg = { ...(b.message as Record<string, unknown>), ts: fakeTs() };
    const r = await simulateSlackMessage(msg, channel);
    if (!r) {
      res.status(422).json({ ok: false, error: `message did not parse as a ${channel} post` });
      return;
    }
    if ("sales" in r) res.json({ ok: true, sales: reportSales(r.sales) });
    else res.json({ ok: true, bdr: r.demo.bdr, company: r.demo.company, ...walkupReport(r.demo.bdr, "") });
  });
}
