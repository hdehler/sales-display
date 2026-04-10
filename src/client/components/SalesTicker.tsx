import type { Sale } from "../../shared/types";

/** Merge adjacent Slide rows (same account, close in time) for ticker copy */
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
      const t = new Date(n.timestamp).getTime();
      if (t0 - t > PACK_WINDOW_MS) break;
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
      <div className="px-8 py-3 bg-slate-900/40 border-b border-slate-800/40 text-slate-500 text-sm">
        No recent orders yet
      </div>
    );
  }

  const rows = buildTickerRows(sales);
  const items = [...rows, ...rows];

  return (
    <div className="overflow-hidden bg-slate-900/40 border-b border-slate-800/40">
      <div className="flex animate-marquee whitespace-nowrap py-3">
        {items.map((row, i) => (
          <span
            key={`marquee-${i}-${row.kind === "slide_pack" ? `${row.account}-${row.count}` : row.kind === "slide_single" ? row.sale.id : row.sale.id}`}
            className="mx-6 inline-flex items-center gap-2 text-sm"
          >
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            {row.kind === "slide_pack" ? (
              <>
                <span className="font-semibold text-sky-300">
                  {row.count} orders from {row.account}
                </span>
              </>
            ) : row.kind === "slide_single" ? (
              <>
                <span className="font-semibold text-slate-100">
                  {row.sale.customer}
                </span>
                <span className="text-slate-500">—</span>
                <span className="text-emerald-400/90">new order created</span>
                <span className="text-slate-600 font-mono text-xs">
                  {row.sale.meta?.orderId}
                </span>
              </>
            ) : (
              <>
                <span className="font-medium text-slate-200">
                  {row.sale.customer}
                </span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-400">{row.sale.rep}</span>
                {row.sale.product ? (
                  <>
                    <span className="text-slate-600">·</span>
                    <span className="text-slate-500 max-w-[18rem] truncate">
                      {row.sale.product}
                    </span>
                  </>
                ) : null}
              </>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
