import type { Sale } from "../../shared/types";

export function SalesTicker({ sales }: { sales: Sale[] }) {
  if (sales.length === 0) {
    return (
      <div className="px-8 py-3 border-b border-border text-text-muted text-sm">
        No recent orders
      </div>
    );
  }

  const items = [...sales, ...sales];

  return (
    <div className="overflow-hidden border-y border-border bg-surface-raised/40">
      <div className="flex animate-marquee whitespace-nowrap py-3">
        {items.map((sale, i) => (
          <span
            key={`t-${i}`}
            className="mx-6 inline-flex items-center gap-2 text-sm"
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />
            <span className="font-semibold text-white">{sale.customer}</span>
            {sale.product && (
              <>
                <span className="text-text-muted">—</span>
                <span className="text-text-secondary max-w-[14rem] truncate">
                  {sale.product}
                </span>
              </>
            )}
            {sale.rep?.trim() && (
              <>
                <span className="text-text-muted">·</span>
                <span className="text-accent/80">{sale.rep}</span>
              </>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
