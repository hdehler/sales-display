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
      if (blob.toLowerCase().includes("big order created"))
        out._header = out._header || "BIG Order Created";
      /** BIG orders post each `Nx SKU (…)` line in rich_text after the View Orders button. */
      const skuLines = blob
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => /^\d+x\s+/i.test(l));
      if (skuLines.length > 0) {
        const merged = skuLines.join(" ");
        out._lineItems = out._lineItems
          ? `${out._lineItems} ${merged}`
          : merged;
      }
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
  /** Slide Cloud alternate template: no `Order o_…` row; qty lines follow Earliest Ship Date */
  if (h.includes("big order created")) return true;
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

/** BIG Order Created — same meta fields except no `Order` id; hardware = qty lines after ship date */
const BIG_ORDER_SEQ_LABELS = [
  "Account",
  "Datacenter Region",
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

/** After Earliest Ship Date value, Slack flattening may glue `2030-01-0117x Slide…` */
function splitEarliestShipDateAndLineItems(rawTail: string): {
  earliestShipDate: string;
  lineItems: string;
} {
  const v = rawTail.trim();
  const glued = /^(\d{4}-\d{2}-\d{2})(\d+x\s)/i.exec(v);
  if (glued) {
    return {
      earliestShipDate: glued[1],
      lineItems: v.slice(glued[1].length).trim(),
    };
  }
  const spaced = v.match(/^(\d{4}-\d{2}-\d{2})\s+([\s\S]+)$/);
  if (spaced && /^\d+x\s/i.test(spaced[2].trim())) {
    return { earliestShipDate: spaced[1], lineItems: spaced[2].trim() };
  }
  return { earliestShipDate: v, lineItems: "" };
}

/**
 * Slide Cloud “BIG Order Created” template: no `Order` row; qty× SKU lines follow ship date.
 * Flattened block text is normalized with spaces (see `normalizeSlidePlaintext`).
 */
function parseBigOrderSlidePlaintext(raw: string): Record<string, string> | null {
  let s = normalizeSlidePlaintext(raw);
  if (!s.length) return null;
  if (!s.toLowerCase().includes("big order created")) return null;

  const accountIdx = s.indexOf("Account");
  if (accountIdx === -1) return null;
  s = s.slice(accountIdx);

  const out: Record<string, string> = { _header: "BIG Order Created" };
  for (let i = 0; i < BIG_ORDER_SEQ_LABELS.length; i++) {
    const label = BIG_ORDER_SEQ_LABELS[i];
    if (!s.startsWith(label)) return null;
    s = s.slice(label.length).replace(/^\s+/, "");
    const next = BIG_ORDER_SEQ_LABELS[i + 1];
    if (!next) {
      const { earliestShipDate, lineItems } = splitEarliestShipDateAndLineItems(s);
      out[label] = earliestShipDate;
      if (lineItems) out._lineItems = lineItems;
      break;
    }
    const nextIdx = s.indexOf(next);
    if (nextIdx === -1) return null;
    out[label] = s.slice(0, nextIdx).trim();
    s = s.slice(nextIdx);
  }

  if (!out.Account?.trim() || !out["Order History"]?.trim()) return null;
  return out;
}

/**
 * Parse "Total Orders" from Slide Order History (plain or mrkdwn).
 * Returns null if no recognizable Total Orders line (caller should not infer new partner).
 */
export function parseTotalOrdersFromOrderHistory(
  orderHistory: string | undefined,
): number | null {
  if (!orderHistory?.trim()) return null;
  const text = orderHistory.replace(/\*+/g, "").replace(/\r\n/g, "\n");
  const re = /total\s+orders?\s*[:\s\-–—]*\s*(\d+)/i;
  const m = text.match(re);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

function isBigOrderSlide(fields: Record<string, string>): boolean {
  return (fields._header || "").toLowerCase().includes("big order created");
}

/** Stable synthetic id when Slack ts missing (rare) */
function syntheticBigOrderId(fields: Record<string, string>): string {
  const seed = [
    fields.Account ?? "",
    fields["Purchased At"] ?? "",
    fields["Order History"] ?? "",
    fields._lineItems ?? fields.Hardware ?? "",
  ].join("|");
  let h = 0;
  for (let i = 0; i < seed.length; i++)
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36).slice(0, 16);
}

/**
 * Parse `_lineItems` like
 *   "17x Slide Z1, 2 TB, 32 GB (…) 33x Slide Z1, 1 TB (…)"
 * into individual SKU entries with their quantities.
 *
 * The flattening normalizer collapses newlines to spaces, so we split before each `Nx `
 * marker rather than relying on line breaks.
 */
function parseBigOrderLineItems(
  lineItems: string,
): { qty: number; sku: string }[] {
  const trimmed = lineItems.trim();
  if (!trimmed) return [];

  const out: { qty: number; sku: string }[] = [];
  const re = /(\d+)x\s+/gi;
  const positions: { qty: number; start: number; valueStart: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(trimmed)) !== null) {
    positions.push({
      qty: parseInt(m[1], 10),
      start: m.index,
      valueStart: m.index + m[0].length,
    });
  }
  for (let i = 0; i < positions.length; i++) {
    const p = positions[i];
    if (!Number.isFinite(p.qty) || p.qty <= 0) continue;
    const end = i + 1 < positions.length ? positions[i + 1].start : trimmed.length;
    const sku = trimmed.slice(p.valueStart, end).trim();
    if (sku) out.push({ qty: p.qty, sku });
  }
  return out;
}

function buildSaleFromSlideFields(
  fields: Record<string, string>,
  slackTs?: string,
): Sale | null {
  if (!isSlideNewOrder(fields)) return null;

  const isBig = isBigOrderSlide(fields);
  const orderRaw = fields.Order?.trim() || "";

  let orderId: string;
  if (/^o_[a-z0-9]+$/i.test(orderRaw)) {
    orderId = orderRaw;
  } else if (isBig) {
    orderId =
      slackTs != null && slackTs !== ""
        ? `slide_big:${slackTs}`
        : `slide_big:${syntheticBigOrderId(fields)}`;
  } else {
    return null;
  }

  const hardware =
    fields.Hardware?.trim() ||
    fields.Service?.trim() ||
    fields._lineItems?.trim() ||
    "";

  const firstSku =
    hardware.split(/\s+(?=\d+x\s)/i)[0]?.trim() ||
    hardware.match(/\d+x\s+/i)?.[0]?.trim();
  const product =
    firstSku ||
    (hardware ? hardware.split(/\s+/).slice(0, 14).join(" ").slice(0, 160) : "") ||
    (isBig ? "Slide BIG order" : "Slide order");

  const meta: SlideOrderMeta = {
    source: "slide_cloud",
    orderId,
    region: fields["Datacenter Region"]?.trim(),
    hardware: hardware || undefined,
    service: fields.Service?.trim() || undefined,
    orderHistory: fields["Order History"]?.trim(),
    purchasedAt: fields["Purchased At"]?.trim(),
    earliestShipDate: fields["Earliest Ship Date"]?.trim(),
  };

  const totalOrders = parseTotalOrdersFromOrderHistory(meta.orderHistory);
  if (totalOrders !== null) {
    meta.newBuyingPartner = totalOrders === 0;
  }

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

/**
 * BIG Order: expand the single parsed sale into one Sale per unit (qty per SKU).
 * Each unit gets a unique deterministic `slackTs` (`<ts>#u<NNN>`) so the existing
 * `slack_ts` dedupe in `insertSaleIfNew` rejects re-imports without extra logic.
 */
function expandBigOrderUnits(
  base: Sale,
  fields: Record<string, string>,
): Sale[] {
  const lineItemsRaw =
    fields._lineItems?.trim() || fields.Hardware?.trim() || "";
  const items = parseBigOrderLineItems(lineItemsRaw);
  if (items.length === 0) return [base];

  const totalUnits = items.reduce((sum, it) => sum + it.qty, 0);
  if (totalUnits <= 0) return [base];

  const baseSlackTs = base.slackTs ?? "";
  const baseOrderId = base.meta?.orderId ?? "";
  const out: Sale[] = [];
  let unitIndex = 0;
  const pad = String(totalUnits).length;
  for (let lineIdx = 0; lineIdx < items.length; lineIdx++) {
    const it = items[lineIdx];
    for (let q = 0; q < it.qty; q++) {
      unitIndex += 1;
      const suffix = `#u${String(unitIndex).padStart(pad, "0")}`;
      const unitMeta: SlideOrderMeta = {
        ...(base.meta as SlideOrderMeta),
        orderId: `${baseOrderId}${suffix}`,
        bigOrder: {
          totalUnits,
          unitIndex,
          sku: it.sku,
          skuLineIndex: lineIdx + 1,
        },
      };
      out.push({
        ...base,
        product: it.sku,
        slackTs: baseSlackTs ? `${baseSlackTs}${suffix}` : undefined,
        meta: unitMeta,
      });
    }
  }
  return out;
}

function expandIfBig(
  sale: Sale | null,
  fields: Record<string, string> | null,
): Sale[] | null {
  if (!sale) return null;
  if (!fields || !isBigOrderSlide(fields)) return [sale];
  return expandBigOrderUnits(sale, fields);
}

function tryBigOrderPlaintextVariants(
  slackTs: string | undefined,
  raws: string[],
): Sale[] | null {
  const seen = new Set<string>();
  for (const raw of raws) {
    const t = raw.trim();
    if (!t.length || seen.has(t)) continue;
    seen.add(t);
    const bigFields = parseBigOrderSlidePlaintext(raw);
    if (!bigFields) continue;
    const sale = buildSaleFromSlideFields(bigFields, slackTs);
    const expanded = expandIfBig(sale, bigFields);
    if (expanded) return expanded;
  }
  return null;
}

/**
 * Returns one or more Sales for a single Slack message:
 *   - normal Slide order → 1 Sale
 *   - BIG Order Created  → N Sales (one per qty unit across all SKU lines)
 *   - non-Slide          → null
 */
export function parseSlideOrderFromSlackMessage(
  msg: Record<string, unknown>,
  slackTs?: string,
): Sale[] | null {
  const legacyFields = extractFieldsFromLegacyAttachments(msg);
  if (legacyFields) {
    const sale = buildSaleFromSlideFields(legacyFields, slackTs);
    const expanded = expandIfBig(sale, legacyFields);
    if (expanded) return expanded;
  }

  const blocks = getBlocksFromMessage(msg);
  const flattened = blocks ? flattenBlocksForSlideSequential(blocks) : "";
  const topText = slackPrimaryTextBody(msg);

  if (blocks) {
    const fromBlocks = extractKeyValuesFromBlocks(blocks);
    const sale = buildSaleFromSlideFields(fromBlocks, slackTs);
    const expanded = expandIfBig(sale, fromBlocks);
    if (expanded) return expanded;

    const big = tryBigOrderPlaintextVariants(slackTs, [
      flattened,
      topText,
      `${topText}${flattened}`,
      `${flattened}${topText}`,
    ]);
    if (big) return big;
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
      const seqSale = buildSaleFromSlideFields(plainFields, slackTs);
      const expanded = expandIfBig(seqSale, plainFields);
      if (expanded) return expanded;
    }
    const big = tryBigOrderPlaintextVariants(slackTs, [c]);
    if (big) return big;
  }

  return null;
}
