import { config } from "./config.js";
import { setAllPlugs } from "./plugs.js";
import {
  getTodaySaleCount,
  getSongForModel,
  getDefaultSong,
  getRepById,
  claimSale,
  getSetting,
} from "./db.js";
import type { Sale, CelebrationEvent } from "../shared/types.js";

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

  const packMessage =
    sales.length === 1
      ? `${account} — new order created`
      : `${sales.length} orders from ${account}`;

  if (triggerProducts.length > 0) {
    const match = sales.some((sale) =>
      triggerProducts.some((kw) =>
        sale.product.toLowerCase().includes(kw.toLowerCase()),
      ),
    );
    if (match) {
      return {
        sale: first,
        type: "product",
        duration: defaultDuration,
        slidePack,
        message: packMessage,
        songUrl,
        jingleId,
      };
    }
  }

  if (milestoneInterval > 0) {
    const count = getTodaySaleCount();
    if (count > 0 && count % milestoneInterval === 0) {
      return {
        sale: first,
        type: "milestone",
        duration: defaultDuration,
        slidePack,
        message: `${count} orders today!`,
        songUrl,
        jingleId,
      };
    }
  }

  const bigThreshold = parseInt(getSetting("bigOrderThreshold") || "0", 10);
  const isBigOrder = bigThreshold > 0 && sales.length >= bigThreshold;

  if (isBigOrder) {
    const bigSong = getSetting("bigOrderSong") || "";
    const resolved = bigSong ? classifySongValue(bigSong) : { songUrl, jingleId };
    return {
      sale: first,
      type: "product",
      duration: defaultDuration,
      slidePack,
      message: `🔥 ${sales.length} orders from ${account}!`,
      songUrl: resolved.songUrl,
      jingleId: resolved.jingleId,
    };
  }

  if (config.celebration.celebrateSlideOrders) {
    return {
      sale: first,
      type: "product",
      duration: defaultDuration,
      slidePack,
      message: packMessage,
      songUrl,
      jingleId,
    };
  }

  return null;
}

export async function triggerCelebration(
  event: CelebrationEvent,
): Promise<void> {
  queue.push(event);
  if (!processing) {
    processQueue();
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

  onCelebration?.(event);

  try {
    await setAllPlugs(true);
  } catch {
    console.warn("[Celebration] Failed to activate plugs");
  }

  activeTimeout = setTimeout(async () => {
    try {
      await setAllPlugs(false);
    } catch {
      console.warn("[Celebration] Failed to deactivate plugs");
    }
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

  const walkup = rep.walkup_song || "";
  const isUrl = walkup.startsWith("http");
  const isFile = walkup.includes(".") && !isUrl;
  const isJingle = walkup && !isUrl && !isFile;

  let songUrl: string | undefined;
  let jingleId: string | undefined;

  if (isUrl) {
    songUrl = walkup;
  } else if (isFile) {
    songUrl = `/sounds/walkups/${walkup}`;
  } else if (isJingle) {
    jingleId = walkup;
  } else {
    const fallback = resolveSong(sale.product);
    songUrl = fallback.songUrl;
    jingleId = fallback.jingleId;
  }

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
  setAllPlugs(false).catch(() => {});
}
