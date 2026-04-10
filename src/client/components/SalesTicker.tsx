import type { Sale } from "../../shared/types";

const PACK_WINDOW_MS = 120_000;

type TickerRow =
  | { kind: "slide_single"; sale: Sale }
  | { kind: "slide_pack"; account: string; count: number }
  | { kind: "other"; sale: Sale };

function buildTickerRows(sales: Sale[]): TickerRow[] {
  const rows: TickerRow[] = [];
  let i = 0;
  while (i < sales.length) {
    const s = sales[i];
    if (s.meta?.source !== "slide_cloud") {
      rows.push({ kind: "other", sale: s });
      i++;
      continue;
    }
    const t0 = new Date(s.timestamp).getTime();
    let j = i + 1;
    while (j < sales.length) {
      const n = sales[j];
      if (n.meta?.source !== "slide_cloud" || n.customer !== s.customer) break;
      if (t0 - new Date(n.timestamp).getTime() > PACK_WINDOW_MS) break;
      j++;
    }
    const count = j - i;
    if (count === 1) rows.push({ kind: "slide_single", sale: s });
    else rows.push({ kind: "slide_pack", account: s.customer, count });
    i = j;
  }
  return rows;
}

export function SalesTicker({ sales }: { sales: Sale[] }) {
  if (sales.length === 0) {
    return (
      <div className="px-8 py-3 border-b border-border text-text-muted text-sm">
        No recent orders yet
      </div>
    );
  }

  const rows = buildTickerRows(sales);
  const items = [...rows, ...rows];

  return (
    <div className="overflow-hidden border-b border-border bg-surface-raised/30">
      <div className="flex animate-marquee whitespace-nowrap py-3">
        {items.map((row, i) => (
          <span
            key={`t-${i}`}
            className="mx-8 inline-flex items-center gap-2.5 text-sm"
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent" />
            {row.kind === "slide_pack" ? (
              <span className="font-semibold text-accent">
                {row.count} orders — {row.account}
              </span>
            ) : row.kind === "slide_single" ? (
              <>
                <span className="font-medium text-text-primary">
                  {row.sale.customer}
                </span>
                <span className="text-text-muted">—</span>
                <span className="text-text-secondary">new order</span>
                {row.sale.product && (
                  <>
                    <span className="text-text-muted">·</span>
                    <span className="text-text-secondary max-w-[16rem] truncate">
                      {row.sale.product}
                    </span>
                  </>
                )}
              </>
            ) : (
              <>
                <span className="font-medium text-text-primary">
                  {row.sale.customer}
                </span>
                {row.sale.rep.trim() && (
                  <>
                    <span className="text-text-muted">·</span>
                    <span className="text-text-secondary">{row.sale.rep}</span>
                  </>
                )}
                {row.sale.product && (
                  <>
                    <span className="text-text-muted">·</span>
                    <span className="text-text-secondary max-w-[16rem] truncate">
                      {row.sale.product}
                    </span>
                  </>
                )}
              </>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
