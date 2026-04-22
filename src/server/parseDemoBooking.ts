import { slackPrimaryTextBody } from "./parseSlideOrder.js";

/** Parsed HubSpot → Slack demo notification (before DB insert). */
export interface ParsedDemoBooking {
  bdr: string;
  company: string;
  ae?: string;
  territory?: string;
  demoScheduledDate?: string;
  rawMessage: string;
}

/**
 * Collect plain text from rich_text blocks (HubSpot sometimes uses rich_text instead of section fields).
 */
function collectRichTextStrings(elements: unknown[]): string[] {
  const parts: string[] = [];
  for (const el of elements) {
    if (!el || typeof el !== "object") continue;
    const e = el as Record<string, unknown>;
    switch (e.type) {
      case "text":
        if (typeof e.text === "string" && e.text.length) parts.push(e.text);
        break;
      case "link":
        if (typeof e.text === "string" && e.text.length) parts.push(e.text);
        break;
      default:
        if (Array.isArray(e.elements))
          parts.push(...collectRichTextStrings(e.elements));
    }
  }
  return parts;
}

/** Flatten Block Kit into lines so `Label: value` parsing works without `message.text`. */
function flattenBlocksDemo(msg: Record<string, unknown>): string {
  const blocks = msg.blocks;
  if (!Array.isArray(blocks)) return "";
  const chunks: string[] = [];
  for (const block of blocks) {
    if (!block || typeof block !== "object") continue;
    const b = block as Record<string, unknown>;

    if (b.type === "header" && b.text && typeof b.text === "object") {
      const t = (b.text as { text?: string }).text;
      if (typeof t === "string" && t.trim()) chunks.push(t.trim());
    }

    if (b.type === "section") {
      const textObj = b.text;
      if (textObj && typeof textObj === "object" && "text" in textObj) {
        const tt = (textObj as { text?: string }).text;
        if (typeof tt === "string" && tt.trim()) chunks.push(tt.trim());
      }
      const fields = b.fields;
      if (Array.isArray(fields)) {
        for (const f of fields) {
          const ft = (f as { text?: string }).text;
          if (typeof ft === "string" && ft.trim()) chunks.push(ft.trim());
        }
      }
    }

    if (b.type === "rich_text" && Array.isArray(b.elements)) {
      chunks.push(...collectRichTextStrings(b.elements));
    }
  }
  return chunks.join("\n");
}

export function combineDemoSlackMessageText(msg: Record<string, unknown>): string {
  const primary = slackPrimaryTextBody(msg).trim();
  const fromBlocks = flattenBlocksDemo(msg).trim();
  return [primary, fromBlocks].filter(Boolean).join("\n\n");
}

/** Parse `Label: value` lines (bold labels optional). */
export function extractHubSpotKeyValues(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const sameLine = line.match(/^\*?([^*:]+?)\*?\s*:\s*(.+)$/);
    if (sameLine) {
      const label = sameLine[1].replace(/\*+/g, "").trim();
      const value = sameLine[2].trim();
      if (label && value) out[label] = value;
    }
  }
  return out;
}

function looksLikeDemoBooking(text: string, fields: Record<string, string>): boolean {
  const low = text.toLowerCase();
  if (low.includes("new demo") || low.includes("web inquiry")) return true;
  if (low.includes("demo scheduled date")) return true;
  if (fields.BDR !== undefined && fields.Company !== undefined) return true;
  return false;
}

/**
 * Parse a HubSpot app message from the demo-bookings channel.
 * Credits **BDR** as the rep; **Company** is the account line.
 */
export function parseDemoBookingFromSlackMessage(
  msg: Record<string, unknown>,
): ParsedDemoBooking | null {
  const raw = combineDemoSlackMessageText(msg);
  if (!raw.trim()) return null;

  const fields = extractHubSpotKeyValues(raw);
  if (!looksLikeDemoBooking(raw, fields)) return null;

  const bdr = fields.BDR?.trim();
  if (!bdr) {
    return null;
  }

  const company = fields.Company?.trim() || "Unknown";

  return {
    bdr,
    company,
    ae: fields.AE?.trim(),
    territory: fields.Territory?.trim(),
    demoScheduledDate: fields["Demo Scheduled Date"]?.trim(),
    rawMessage: raw.length > 80_000 ? raw.slice(0, 80_000) : raw,
  };
}
