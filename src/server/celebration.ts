import { config } from "./config.js";
import { setAllPlugs } from "./plugs.js";
import { getTodaySaleCount } from "./db.js";
import type { Sale, CelebrationEvent } from "../shared/types.js";

type CelebrationCallback = (event: CelebrationEvent) => void;

let onCelebration: CelebrationCallback | null = null;
let activeTimeout: ReturnType<typeof setTimeout> | null = null;
const queue: CelebrationEvent[] = [];
let processing = false;

export function setCelebrationCallback(cb: CelebrationCallback): void {
  onCelebration = cb;
}

export function shouldCelebrate(sale: Sale): CelebrationEvent | null {
  const { triggerProducts, milestoneInterval, defaultDuration } =
    config.celebration;

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
      };
    }
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

  console.log(
    `[Celebration] Starting: ${event.type} — ${event.sale.rep} $${event.sale.amount}`,
  );

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

export function cancelCelebration(): void {
  if (activeTimeout) {
    clearTimeout(activeTimeout);
    activeTimeout = null;
  }
  queue.length = 0;
  processing = false;
  setAllPlugs(false).catch(() => {});
}
