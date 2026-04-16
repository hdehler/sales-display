import type { Sale } from "../../shared/types";

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const PACK_WINDOW_MS = 120_000;

interface OrderRow {
  key: string;
  account: string;
  product: string;
  count: number;
  time: string;
  rep: string;
  newBuyingPartner?: boolean;
}

function buildRows(sales: Sale[]): OrderRow[] {
  const rows: OrderRow[] = [];
  let i = 0;
  while (i < sales.length) {
    const s = sales[i];
    if (s.meta?.source === "slide_cloud") {
      const t0 = new Date(s.timestamp).getTime();
      let j = i + 1;
      while (j < sales.length) {
        const n = sales[j];
        if (n.meta?.source !== "slide_cloud" || n.customer !== s.customer) break;
        if (t0 - new Date(n.timestamp).getTime() > PACK_WINDOW_MS) break;
        j++;
      }
      const pack = sales.slice(i, j);
      const newBuyingPartner = pack.some((x) => x.meta?.newBuyingPartner);
      rows.push({
        key: `${s.timestamp}-${i}`,
        account: s.customer,
        product: s.product || "",
        count: j - i,
        time: s.timestamp,
        rep: s.rep?.trim() || "",
        newBuyingPartner: newBuyingPartner || undefined,
      });
      i = j;
    } else {
      rows.push({
        key: `${s.timestamp}-${i}`,
        account: s.customer,
        product: s.product || "",
        count: 1,
        time: s.timestamp,
        rep: s.rep?.trim() || "",
        newBuyingPartner: s.meta?.newBuyingPartner || undefined,
      });
      i++;
    }
  }
  return rows;
}

export function RecentOrders({ sales }: { sales: Sale[] }) {
  const rows = buildRows(sales);

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 min-h-[12rem] text-center px-4">
        <p className="text-text-muted text-sm font-medium uppercase tracking-wider mb-2">
          Feed
        </p>
        <p className="text-text-secondary text-base max-w-sm leading-relaxed">
          Waiting for orders…
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-end justify-between gap-4 pb-4 mb-1 border-b border-border shrink-0">
        <h2 className="font-display text-xl sm:text-2xl font-normal text-text-primary tracking-tight">
          Recent orders
        </h2>
        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted tabular-nums pb-0.5">
          {rows.length} shown
        </span>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 pt-3 space-y-2 pr-1 -mr-1">
        {rows.map((row, i) => (
          <article
            key={row.key}
            className="group flex items-center gap-4 rounded-xl border border-border px-4 py-3.5 bg-surface-hover/15 hover:bg-surface-hover/35 hover:border-border-bright transition-colors animate-fade-up"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <div
              className="flex-shrink-0 w-11 h-11 rounded-xl bg-accent/12 border border-accent/20 flex items-center justify-center"
              aria-hidden
            >
              <span className="text-accent font-bold text-lg tabular-nums leading-none">
                {row.count}
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap gap-y-1">
                <h3 className="font-semibold text-text-primary text-[15px] sm:text-base truncate">
                  {row.account}
                </h3>
                {row.newBuyingPartner ? (
                  <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md bg-accent/12 text-accent border border-accent/25 shrink-0">
                    New partner
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-2 mt-1 min-w-0 text-sm">
                {row.product ? (
                  <span className="text-text-secondary truncate">{row.product}</span>
                ) : null}
                {row.rep ? (
                  <>
                    {row.product ? (
                      <span className="text-text-muted shrink-0" aria-hidden>
                        ·
                      </span>
                    ) : null}
                    <span className="text-accent/90 font-medium truncate">{row.rep}</span>
                  </>
                ) : null}
              </div>
            </div>

            <time
              className="text-[11px] text-text-muted flex-shrink-0 tabular-nums font-medium uppercase tracking-wide"
              dateTime={row.time}
            >
              {timeAgo(row.time)}
            </time>
          </article>
        ))}
      </div>
    </div>
  );
}
