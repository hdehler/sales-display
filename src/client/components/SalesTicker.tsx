import type { Sale } from "../../shared/types";

function TickerItems({ sales }: { sales: Sale[] }) {
  return (
    <>
      {sales.map((sale, i) => (
        <span
          key={`t-${i}`}
          className="mx-6 inline-flex items-center gap-2 text-sm flex-shrink-0"
        >
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />
          <span className="font-semibold text-text-primary">{sale.customer}</span>
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
              <span className="text-accent/90 font-medium">{sale.rep}</span>
            </>
          )}
        </span>
      ))}
    </>
  );
}

export function SalesTicker({ sales }: { sales: Sale[] }) {
  if (sales.length === 0) {
    return (
      <div className="px-8 py-3 border-b border-border bg-surface-raised/60 text-text-muted text-xs font-medium uppercase tracking-wider">
        No recent orders
      </div>
    );
  }

  return (
    <div className="overflow-hidden border-b border-border bg-surface-raised/50 shrink-0">
      <div className="flex animate-marquee whitespace-nowrap py-3.5 w-max [mask-image:linear-gradient(90deg,transparent,black_4%,black_96%,transparent)]">
        <TickerItems sales={sales} />
        <TickerItems sales={sales} />
      </div>
    </div>
  );
}
