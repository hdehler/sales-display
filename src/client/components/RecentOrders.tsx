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
      rows.push({
        key: `${s.timestamp}-${i}`,
        account: s.customer,
        product: s.product || "",
        count: j - i,
        time: s.timestamp,
        rep: s.rep?.trim() || "",
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
      <div className="flex items-center justify-center h-full text-text-muted text-lg">
        Waiting for orders…
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-white">Recent Orders</h2>
        <span className="text-xs font-semibold uppercase tracking-widest text-text-muted">
          {rows.length} orders
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
        {rows.map((row, i) => (
          <div
            key={row.key}
            className="flex items-center gap-4 px-4 py-3.5 rounded-xl bg-surface-raised/70 border border-border hover:border-border-bright transition-colors animate-fade-up"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            {/* Count badge */}
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-accent/15 flex items-center justify-center">
              <span className="text-accent font-bold text-lg tabular-nums">
                {row.count}
              </span>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white text-base truncate">
                  {row.account}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {row.product && (
                  <span className="text-sm text-text-secondary truncate">
                    {row.product}
                  </span>
                )}
                {row.rep && (
                  <>
                    {row.product && (
                      <span className="text-text-muted">·</span>
                    )}
                    <span className="text-sm text-accent/80">{row.rep}</span>
                  </>
                )}
              </div>
            </div>

            {/* Time */}
            <span className="text-xs text-text-muted flex-shrink-0 tabular-nums">
              {timeAgo(row.time)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
