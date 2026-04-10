import type { Sale } from "../../shared/types";

interface TopAccount {
  account: string;
  count: number;
  latestProduct: string;
  latestTime: string;
}

function findTopAccountToday(sales: Sale[]): TopAccount | null {
  const now = new Date();
  const startOfDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();

  const todaySales = sales.filter(
    (s) => new Date(s.timestamp).getTime() >= startOfDay,
  );
  if (todaySales.length === 0) return null;

  const byAccount = new Map<
    string,
    { count: number; latestProduct: string; latestTime: string }
  >();

  for (const s of todaySales) {
    const key = s.customer;
    const existing = byAccount.get(key);
    if (!existing) {
      byAccount.set(key, {
        count: 1,
        latestProduct: s.product,
        latestTime: s.timestamp,
      });
    } else {
      existing.count++;
      if (new Date(s.timestamp) > new Date(existing.latestTime)) {
        existing.latestProduct = s.product;
        existing.latestTime = s.timestamp;
      }
    }
  }

  let top: TopAccount | null = null;
  for (const [account, data] of byAccount) {
    if (!top || data.count > top.count) {
      top = { account, ...data };
    }
  }
  return top;
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

export function FeaturedOrder({ sales }: { sales: Sale[] }) {
  const top = findTopAccountToday(sales);

  if (!top) {
    return (
      <div className="flex items-center justify-center h-full rounded-2xl border border-border bg-surface-raised/60">
        <div className="text-center">
          <div className="font-display text-2xl text-text-muted mb-2">
            No orders today yet
          </div>
          <div className="text-sm text-text-muted">
            Waiting for the first one…
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col justify-between h-full rounded-2xl border border-border-bright bg-surface-raised/80 p-6 overflow-hidden">
      {/* Subtle accent gradient in corner */}
      <div
        className="absolute -top-16 -right-16 w-48 h-48 rounded-full opacity-20 blur-3xl pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, var(--color-accent) 0%, transparent 70%)",
        }}
      />

      <div>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
            Top account today
          </span>
        </div>

        <h2 className="font-display text-3xl leading-tight text-text-primary mb-2">
          {top.account}
        </h2>

        {top.latestProduct && (
          <div className="text-sm text-text-secondary mb-1">
            {top.latestProduct}
          </div>
        )}
      </div>

      <div className="flex items-end justify-between mt-4">
        <div>
          <div className="text-4xl font-bold tabular-nums text-accent">
            {top.count}
          </div>
          <div className="text-xs text-text-muted uppercase tracking-wider">
            order{top.count !== 1 ? "s" : ""} today
          </div>
        </div>
        <div className="text-xs text-text-muted">{timeAgo(top.latestTime)}</div>
      </div>
    </div>
  );
}
