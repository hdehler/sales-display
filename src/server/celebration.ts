import { config } from "./config.js";
import {
  getTodaySaleCount,
  getSongForModel,
  getDefaultSong,
  getRepById,
  getRepByDisplayName,
  claimSale,
  getSetting,
} from "./db.js";
import type { Sale, CelebrationEvent } from "../shared/types.js";
import { UNKNOWN_REP, isUnresolvedRepName } from "../shared/rep.js";

type CelebrationCallback = (event: CelebrationEvent) => void;

let onCelebration: CelebrationCallback | null = null;
let activeTimeout: ReturnType<typeof setTimeout> | null = null;
const queue: CelebrationEvent[] = [];
let processing = false;

export function setCelebrationCallback(cb: CelebrationCallback): void {
  onCelebration = cb;
}

interface ResolvedSong {
  songUrl?: string;
  jingleId?: string;
}

function classifySongValue(val: string): ResolvedSong {
  if (val.startsWith("http")) return { songUrl: val };
  if (val.startsWith("/sounds/")) return { songUrl: val };
  if (val.includes(".")) return { songUrl: `/sounds/models/${val}` };
  return { jingleId: val };
}

function resolveSong(product?: string): ResolvedSong {
  if (product) {
    const modelSong = getSongForModel(product);
    if (modelSong) return classifySongValue(modelSong);
  }
  const def = getDefaultSong();
  if (def) return classifySongValue(def);
  return {};
}

/** Resolve Team walk-up the same way as manual claim; empty walkup falls back to product/default. */
export function repWalkupToResolvedSong(
  walkup: string | null | undefined,
  product: string,
): ResolvedSong {
  const w = (walkup ?? "").trim();
  if (!w) return resolveSong(product);
  const isUrl = w.startsWith("http");
  const isSoundsPath = w.startsWith("/sounds/");
  const isFile = w.includes(".") && !isUrl && !isSoundsPath;
  const isJingle = !isUrl && !isSoundsPath && !isFile;
  if (isUrl) return { songUrl: w };
  if (isSoundsPath) return { songUrl: w };
  if (isFile) return { songUrl: `/sounds/walkups/${w}` };
  if (isJingle) return { jingleId: w };
  return resolveSong(product);
}

/** True when walk-up resolution actually picked a file or jingle (not an empty fallback). */
function resolvedSongHasAudio(s: ResolvedSong): boolean {
  return (
    (s.songUrl != null && String(s.songUrl).trim() !== "") ||
    (s.jingleId != null && String(s.jingleId).trim() !== "")
  );
}

/**
 * Merge rep walk-up into the celebration audio. `repWalkupToResolvedSong` often returns only
 * `songUrl` **or** `jingleId`; spreading both onto the event was wiping the model/default track
 * with `undefined` so nothing played (and leftover `jingleId` could beat the rep `songUrl`).
 */
function mergeWalkupIntoCelebrationAudio(
  base: ResolvedSong,
  rep: ResolvedSong,
): ResolvedSong {
  if (!resolvedSongHasAudio(rep)) return { ...base };
  return {
    songUrl: rep.songUrl,
    jingleId: rep.jingleId,
  };
}

export function attachSlideRepHero(
  event: CelebrationEvent,
  first: Sale,
  opts?: { skipRepWalkup?: boolean },
): CelebrationEvent {
  const nm = first.rep?.trim() || UNKNOWN_REP;

  if (opts?.skipRepWalkup) {
    const row = getRepByDisplayName(nm);
    if (row) {
      return {
        ...event,
        repHero: {
          name: row.name,
          avatarColor: row.avatar_color,
          animal: row.spirit_animal?.trim() || undefined,
        },
      };
    }
    return {
      ...event,
      repHero:
        nm === UNKNOWN_REP
          ? { name: nm, avatarColor: "#64748b" }
          : { name: nm },
    };
  }

  const row = getRepByDisplayName(nm);
  if (row) {
    const repSong = repWalkupToResolvedSong(row.walkup_song, first.product);
    const audio = mergeWalkupIntoCelebrationAudio(
      { songUrl: event.songUrl, jingleId: event.jingleId },
      repSong,
    );
    return {
      ...event,
      songUrl: audio.songUrl,
      jingleId: audio.jingleId,
      repHero: {
        name: row.name,
        avatarColor: row.avatar_color,
        animal: row.spirit_animal?.trim() || undefined,
      },
    };
  }
  return {
    ...event,
    repHero:
      nm === UNKNOWN_REP
        ? { name: nm, avatarColor: "#64748b" }
        : { name: nm },
  };
}

/**
 * Full-screen celebration for HubSpot demo bookings (BDR = rep).
 * Uses the same enable flag as Slide order celebrations (`celebrateSlideOrders`).
 * Does not use order-milestone intervals or `getTodaySaleCount()`.
 */
export function shouldCelebrateDemoBooking(sale: Sale): CelebrationEvent | null {
  if (sale.meta?.source !== "hubspot_demo") return null;
  if (!config.celebration.celebrateSlideOrders) return null;

  const { songUrl, jingleId } = resolveSong(sale.product);
  const base: CelebrationEvent = {
    sale,
    type: "product",
    duration: config.celebration.defaultDuration,
    message: `${sale.customer} — demo booked`,
    songUrl,
    jingleId,
  };
  return attachSlideRepHero(base, sale);
}

export function shouldCelebrate(sale: Sale): CelebrationEvent | null {
  const { triggerProducts, milestoneInterval, defaultDuration } =
    config.celebration;

  const { songUrl, jingleId } = resolveSong(sale.product);

  if (triggerProducts.length > 0) {
    const match = triggerProducts.some((kw) =>
      sale.product.toLowerCase().includes(kw.toLowerCase()),
    );
    if (match) {
      return {
        sale,
        type: "product",
        message: `${sale.rep} just closed a deal!`,
        duration: defaultDuration,
        songUrl,
        jingleId,
      };
    }
  }

  if (milestoneInterval > 0) {
    const count = getTodaySaleCount();
    if (count > 0 && count % milestoneInterval === 0) {
      return {
        sale,
        type: "milestone",
        message: `${count} sales today!`,
        duration: defaultDuration,
        songUrl,
        jingleId,
      };
    }
  }

  return null;
}

/** After debounced Slide inserts; DB already has all rows. */
export function shouldCelebrateSlidePack(
  sales: Sale[],
): CelebrationEvent | null {
  if (sales.length === 0) return null;
  const { triggerProducts, milestoneInterval, defaultDuration } =
    config.celebration;
  const first = sales[0];
  const account = first.customer;
  const slidePack = { account, count: sales.length, sales };
  const { songUrl, jingleId } = resolveSong(first.product);

  const rawRep = first.rep?.trim() ?? "";
  const repSuffix =
    rawRep && !isUnresolvedRepName(rawRep) ? ` — ${rawRep}` : "";

  const packMessage =
    sales.length === 1
      ? `${account} — new order created${repSuffix}`
      : `${sales.length} orders from ${account}${repSuffix}`;

  if (triggerProducts.length > 0) {
    const match = sales.some((sale) =>
      triggerProducts.some((kw) =>
        sale.product.toLowerCase().includes(kw.toLowerCase()),
      ),
    );
    if (match) {
      return attachSlideRepHero(
        {
          sale: first,
          type: "product",
          duration: defaultDuration,
          slidePack,
          message: packMessage,
          songUrl,
          jingleId,
        },
        first,
      );
    }
  }

  if (milestoneInterval > 0) {
    const count = getTodaySaleCount();
    if (count > 0 && count % milestoneInterval === 0) {
      return attachSlideRepHero(
        {
          sale: first,
          type: "milestone",
          duration: defaultDuration,
          slidePack,
          message: `${count} orders today!`,
          songUrl,
          jingleId,
        },
        first,
      );
    }
  }

  const bigThreshold = parseInt(getSetting("bigOrderThreshold") || "0", 10);
  const isBigOrder = bigThreshold > 0 && sales.length >= bigThreshold;

  if (isBigOrder) {
    const bigSong = getSetting("bigOrderSong") || "";
    const resolved = bigSong ? classifySongValue(bigSong) : { songUrl, jingleId };
    const bigOrderOverridesRepWalkup =
      getSetting("bigOrderOverridesRepWalkup") === "true";
    return attachSlideRepHero(
      {
        sale: first,
        type: "product",
        duration: defaultDuration,
        slidePack,
        message: `🔥 ${sales.length} orders from ${account}!${repSuffix}`,
        songUrl: resolved.songUrl,
        jingleId: resolved.jingleId,
      },
      first,
      bigOrderOverridesRepWalkup ? { skipRepWalkup: true } : undefined,
    );
  }

  if (config.celebration.celebrateSlideOrders) {
    return attachSlideRepHero(
      {
        sale: first,
        type: "product",
        duration: defaultDuration,
        slidePack,
        message: packMessage,
        songUrl,
        jingleId,
      },
      first,
    );
  }

  return null;
}

export async function triggerCelebration(
  event: CelebrationEvent,
): Promise<void> {
  queue.push(event);
  if (!processing) {
    void processQueue().catch((err) => {
      console.error("[Celebration] processQueue failed:", err);
      processing = false;
    });
  }
}

async function processQueue(): Promise<void> {
  if (queue.length === 0) {
    processing = false;
    return;
  }

  processing = true;
  const event = queue.shift()!;

  const packInfo = event.slidePack
    ? `${event.slidePack.account} ×${event.slidePack.count}`
    : `${event.sale.rep} $${event.sale.amount}`;
  console.log(`[Celebration] Starting: ${event.type} — ${packInfo}`);

  try {
    onCelebration?.(event);
  } catch (err) {
    console.warn("[Celebration] onCelebration callback failed:", err);
  }

  activeTimeout = setTimeout(() => {
    console.log("[Celebration] Ended");
    setTimeout(() => processQueue(), 2000);
  }, event.duration * 1000);
}

export function buildWalkupCelebration(
  saleId: number,
  repId: number,
): CelebrationEvent | null {
  const sale = claimSale(saleId, repId);
  if (!sale) return null;
  const rep = getRepById(repId);
  if (!rep) return null;

  const { songUrl, jingleId } = repWalkupToResolvedSong(
    rep.walkup_song,
    sale.product,
  );

  return {
    sale,
    type: "walkup",
    message: `${rep.name} closed it!`,
    duration: config.celebration.defaultDuration,
    songUrl,
    jingleId,
    rep: {
      name: rep.name,
      avatarColor: rep.avatar_color,
      animal: rep.spirit_animal?.trim() || undefined,
    },
  };
}

export function cancelCelebration(): void {
  if (activeTimeout) {
    clearTimeout(activeTimeout);
    activeTimeout = null;
  }
  queue.length = 0;
  processing = false;
}
