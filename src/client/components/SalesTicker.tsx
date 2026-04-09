import type { Sale } from "../../shared/types";

function formatCurrency(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 });
}

export function SalesTicker({ sales }: { sales: Sale[] }) {
  if (sales.length === 0) {
    return (
      <div className="px-8 py-3 bg-slate-900/40 border-b border-slate-800/40 text-slate-500 text-sm">
        No recent sales yet
      </div>
    );
  }

  const items = [...sales, ...sales];

  return (
    <div className="overflow-hidden bg-slate-900/40 border-b border-slate-800/40">
      <div className="flex animate-marquee whitespace-nowrap py-3">
        {items.map((sale, i) => (
          <span key={`${sale.id}-${i}`} className="mx-6 inline-flex items-center gap-2 text-sm">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-emerald-400">{formatCurrency(sale.amount)}</span>
            <span className="text-slate-300">{sale.customer}</span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-400">{sale.rep}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
