import type { Sale, SlideOrderMeta } from "../shared/types.js";

/** Extract Slack section field text into label → value (handles *Label* and Label:). */
function parseSectionFieldText(text: string): { label: string; value: string } | null {
  const trimmed = text.trim();
  const nl = trimmed.indexOf("\n");
  if (nl === -1) return null;
  let label = trimmed.slice(0, nl).trim();
  label = label.replace(/^\*+|\*+$/g, "").replace(/:$/, "").trim();
  const value = trimmed.slice(nl + 1).trim();
  if (!label || !value) return null;
  return { label, value };
}

/** Walk rich_text / nested elements and collect text (Slide often uses rich_text instead of section fields). */
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
      case "emoji":
        if (typeof e.name === "string") parts.push(`:${e.name}:`);
        break;
      default:
        if (Array.isArray(e.elements))
          parts.push(...collectRichTextStrings(e.elements));
    }
  }
  return parts;
}

function mergeLinesIntoFields(lines: string[], out: Record<string, string>): void {
  const cleaned = lines.map((l) => l.trim()).filter(Boolean);
  for (let i = 0; i < cleaned.length - 1; i++) {
    const parsed = parseSectionFieldText(`${cleaned[i]}\n${cleaned[i + 1]}`);
    if (parsed) out[parsed.label] = parsed.value;
  }
}

function extractFromMrkdwnBlob(text: string, out: Record<string, string>): void {
  const lines = text.split(/\r?\n/);
  mergeLinesIntoFields(lines, out);
  for (const line of lines) {
    const sameLine = line.match(/^\*?([^*:]+?)\*?\s*:\s*(.+)$/);
    if (sameLine) {
      const label = sameLine[1].replace(/\*+/g, "").trim();
      const value = sameLine[2].trim();
      if (label && value) out[label] = value;
    }
  }
}

function extractKeyValuesFromBlocks(blocks: unknown[]): Record<string, string> {
  const out: Record<string, string> = {};

  for (const block of blocks) {
    if (!block || typeof block !== "object") continue;
    const b = block as Record<string, unknown>;

    if (b.type === "header" && b.text && typeof b.text === "object") {
      const t = (b.text as { text?: string }).text;
      if (typeof t === "string" && t.trim()) out._header = t.trim();
    }

    if (b.type === "section" && Array.isArray(b.fields)) {
      for (const f of b.fields) {
        if (!f || typeof f !== "object") continue;
        const ft = (f as { type?: string; text?: string }).text;
        if (typeof ft !== "string") continue;
        const parsed = parseSectionFieldText(ft);
        if (parsed) out[parsed.label] = parsed.value;
        extractFromMrkdwnBlob(ft, out);
      }
    }

    if (b.type === "section" && b.text && typeof b.text === "object") {
      const ft = (b.text as { text?: string }).text;
      if (typeof ft === "string") {
        const parsed = parseSectionFieldText(ft);
        if (parsed) out[parsed.label] = parsed.value;
        extractFromMrkdwnBlob(ft, out);
      }
    }

    if (b.type === "context" && Array.isArray(b.elements)) {
      for (const el of b.elements) {
        if (!el || typeof el !== "object") continue;
        const ce = el as { type?: string; text?: string };
        if (ce.type === "mrkdwn" && typeof ce.text === "string")
          extractFromMrkdwnBlob(ce.text, out);
        if (ce.type === "plain_text" && typeof ce.text === "string")
          extractFromMrkdwnBlob(ce.text, out);
      }
    }

    if (b.type === "rich_text" && Array.isArray(b.elements)) {
      const strings = collectRichTextStrings(b.elements);
      const blob = strings.join("\n");
      mergeLinesIntoFields(blob.split(/\r?\n/), out);
      extractFromMrkdwnBlob(blob, out);
      if (blob.toLowerCase().includes("new order created"))
        out._header = out._header || "New Order Created";
    }
  }

  return out;
}

/** True if the payload has Block Kit we might try to parse (for debug logging). */
export function slackMessageHasStructuredContent(msg: Record<string, unknown>): boolean {
  if (Array.isArray(msg.blocks) && msg.blocks.length > 0) return true;
  const atts = msg.attachments;
  if (!Array.isArray(atts)) return false;
  return atts.some(
    (a) =>
      a &&
      typeof a === "object" &&
      Array.isArray((a as { blocks?: unknown[] }).blocks) &&
      (a as { blocks: unknown[] }).blocks.length > 0,
  );
}

function getBlocksFromMessage(msg: Record<string, unknown>): unknown[] | null {
  if (Array.isArray(msg.blocks) && msg.blocks.length > 0) return msg.blocks;
  const atts = msg.attachments;
  if (Array.isArray(atts)) {
    for (const a of atts) {
      if (a && typeof a === "object" && Array.isArray((a as { blocks?: unknown[] }).blocks)) {
        const bl = (a as { blocks: unknown[] }).blocks;
        if (bl.length) return bl;
      }
    }
  }
  return null;
}

/**
 * Top-level message text or attachment fallback (used for Slide sequential parse and manual $-sale lines).
 */
export function slackPrimaryTextBody(msg: Record<string, unknown>): string {
  const t = typeof msg.text === "string" ? msg.text : "";
  if (t.trim()) return t;
  const atts = msg.attachments;
  if (!Array.isArray(atts)) return "";
  for (const a of atts) {
    if (!a || typeof a !== "object") continue;
    const att = a as { fallback?: string; text?: string };
    if (typeof att.fallback === "string" && att.fallback.trim()) return att.fallback;
    if (typeof att.text === "string" && att.text.trim()) return att.text;
  }
  return "";
}

function isSlideNewOrder(fields: Record<string, string>): boolean {
  const h = (fields._header || "").toLowerCase();
  if (h.includes("new order created")) return true;
  if (fields.Account && fields.Order && (fields.Hardware || fields.Service)) return true;
  return false;
}

/** Slide Cloud sometimes flattens the card into one string: AccountProject OrcaOrdero_xxx... */
const SLIDE_CONCAT_LABELS = [
  "Account",
  "Order",
  "Datacenter Region",
  "Hardware",
  "Service",
  "Order History",
  "Purchased At",
  "Earliest Ship Date",
] as const;

function normalizeSlidePlaintext(raw: string): string {
  return raw
    .replace(/[\u200b\ufeff\u00a0]/g, "")
    .replace(/\*+/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Slack often sends Slide as Block Kit only; `message.text` is empty or a short preview.
 * Concatenate visible text in block order (no separator) so we get strings like
 * `New Order CreatedAccountProject OrcaOrdero_xxx...` matching the app’s layout.
 */
function flattenBlocksForSlideSequential(blocks: unknown[]): string {
  const chunks: string[] = [];
  for (const block of blocks) {
    if (!block || typeof block !== "object") continue;
    const b = block as Record<string, unknown>;

    if (b.type === "header" && b.text && typeof b.text === "object") {
      const t = (b.text as { text?: string }).text;
      if (typeof t === "string" && t.trim()) chunks.push(t);
    }

    if (b.type === "section" && Array.isArray(b.fields)) {
      for (const f of b.fields) {
        if (!f || typeof f !== "object") continue;
        const ft = (f as { text?: string }).text;
        if (typeof ft === "string" && ft.length) chunks.push(ft);
      }
    }

    if (b.type === "section" && b.text && typeof b.text === "object") {
      const ft = (b.text as { text?: string }).text;
      if (typeof ft === "string" && ft.length) chunks.push(ft);
    }

    if (b.type === "context" && Array.isArray(b.elements)) {
      for (const el of b.elements) {
        if (!el || typeof el !== "object") continue;
        const ce = el as { type?: string; text?: string };
        if (typeof ce.text === "string" && ce.text.length) chunks.push(ce.text);
      }
    }

    if (b.type === "rich_text" && Array.isArray(b.elements)) {
      const strings = collectRichTextStrings(b.elements);
      if (strings.length) chunks.push(strings.join(""));
    }
  }
  return chunks.join("");
}

function parseSequentialSlidePlaintext(raw: string): Record<string, string> | null {
  let s = normalizeSlidePlaintext(raw);
  if (!s.length) return null;

  const first = SLIDE_CONCAT_LABELS[0];
  if (!s.startsWith(first)) {
    const i = s.indexOf(first);
    if (i === -1) return null;
    s = s.slice(i);
  }

  const out: Record<string, string> = {};
  for (let i = 0; i < SLIDE_CONCAT_LABELS.length; i++) {
    const label = SLIDE_CONCAT_LABELS[i];
    if (!s.startsWith(label)) return null;
    s = s.slice(label.length).replace(/^\s+/, "");
    const next = SLIDE_CONCAT_LABELS[i + 1];
    if (!next) {
      out[label] = s.trim();
      break;
    }
    const nextIdx = s.indexOf(next);
    if (nextIdx === -1) return null;
    out[label] = s.slice(0, nextIdx).trim();
    s = s.slice(nextIdx);
  }

  const orderId = out.Order?.trim() || "";
  if (!/^o_[a-z0-9]+$/i.test(orderId)) return null;
  return out;
}

function buildSaleFromSlideFields(
  fields: Record<string, string>,
  slackTs?: string,
): Sale | null {
  if (!isSlideNewOrder(fields)) return null;

  const orderId = fields.Order?.trim() || "";
  if (!/^o_[a-z0-9]+$/i.test(orderId)) return null;

  const hardware = fields.Hardware?.trim() || "";
  const service = fields.Service?.trim() || "";
  const product =
    hardware && service
      ? `${hardware} · ${service}`
      : hardware || service || "Slide order";

  const meta: SlideOrderMeta = {
    source: "slide_cloud",
    orderId,
    region: fields["Datacenter Region"]?.trim(),
    hardware: hardware || undefined,
    service: service || undefined,
    orderHistory: fields["Order History"]?.trim(),
    purchasedAt: fields["Purchased At"]?.trim(),
    earliestShipDate: fields["Earliest Ship Date"]?.trim(),
  };

  const customer = fields.Account?.trim() || "Unknown account";
  const rawLines = Object.entries(fields)
    .filter(([k]) => !k.startsWith("_"))
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");

  return {
    rep: "",
    customer,
    product,
    amount: 0,
    timestamp: new Date().toISOString(),
    slackTs,
    rawMessage: rawLines || JSON.stringify(fields),
    meta,
  };
}

/**
 * Slide uses legacy Slack attachments with `fields: [{title, value, short}, …]`.
 * This is NOT Block Kit — it's the old attachment format.
 */
function extractFieldsFromLegacyAttachments(msg: Record<string, unknown>): Record<string, string> | null {
  const atts = msg.attachments;
  if (!Array.isArray(atts)) return null;

  for (const a of atts) {
    if (!a || typeof a !== "object") continue;
    const att = a as {
      fields?: { title?: string; value?: string }[];
      title?: string;
      fallback?: string;
    };
    if (!Array.isArray(att.fields) || att.fields.length === 0) continue;

    const out: Record<string, string> = {};
    if (typeof att.title === "string" && att.title.trim()) {
      out._header = att.title.trim();
    } else if (typeof att.fallback === "string" && att.fallback.trim()) {
      out._header = att.fallback.trim();
    }

    for (const f of att.fields) {
      if (!f || typeof f !== "object") continue;
      const title = typeof f.title === "string" ? f.title.trim() : "";
      const value = typeof f.value === "string" ? f.value.trim() : "";
      if (title && value) out[title] = value;
    }

    if (Object.keys(out).length > 1) return out;
  }
  return null;
}

export function parseSlideOrderFromSlackMessage(
  msg: Record<string, unknown>,
  slackTs?: string,
): Sale | null {
  const legacyFields = extractFieldsFromLegacyAttachments(msg);
  if (legacyFields) {
    const sale = buildSaleFromSlideFields(legacyFields, slackTs);
    if (sale) return sale;
  }

  const blocks = getBlocksFromMessage(msg);
  const flattened = blocks ? flattenBlocksForSlideSequential(blocks) : "";
  const topText = slackPrimaryTextBody(msg);

  if (blocks) {
    const fromBlocks = extractKeyValuesFromBlocks(blocks);
    const sale = buildSaleFromSlideFields(fromBlocks, slackTs);
    if (sale) return sale;
  }

  const candidates = [
    flattened,
    topText,
    `${topText}${flattened}`,
    `${flattened}${topText}`,
  ]
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const seen = new Set<string>();
  for (const c of candidates) {
    if (seen.has(c)) continue;
    seen.add(c);
    const plainFields = parseSequentialSlidePlaintext(c);
    if (plainFields) {
      const sale = buildSaleFromSlideFields(plainFields, slackTs);
      if (sale) return sale;
    }
  }

  return null;
}
