import type { Sale } from "../shared/types.js";

type Bucket = { sales: Sale[]; timer: ReturnType<typeof setTimeout> | null };

const byAccount = new Map<string, Bucket>();

/**
 * Buffers Slide orders for the same account and flushes after `debounceMs` of quiet time
 * so bursts (e.g. 4 lines in a few seconds) become one celebration/ticker batch.
 */
export function enqueueSlideOrder(
  sale: Sale,
  debounceMs: number,
  onFlush: (batch: Sale[]) => void,
): void {
  const account = sale.customer;
  let b = byAccount.get(account);
  if (!b) {
    b = { sales: [], timer: null };
    byAccount.set(account, b);
  }

  b.sales.push(sale);
  if (b.timer) clearTimeout(b.timer);
  b.timer = setTimeout(() => {
    const batch = [...b!.sales];
    b!.sales.length = 0;
    b!.timer = null;
    byAccount.delete(account);
    if (batch.length > 0) onFlush(batch);
  }, debounceMs);
}
