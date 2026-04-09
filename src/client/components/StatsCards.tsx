interface StatsCardsProps {
  todayTotal: number;
  weekTotal: number;
  monthTotal: number;
  todayCount: number;
}

function formatCurrency(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 });
}

const cards: { key: keyof StatsCardsProps; label: string; accent: string }[] = [
  { key: "todayTotal", label: "Today", accent: "from-emerald-500 to-emerald-600" },
  { key: "weekTotal", label: "This Week", accent: "from-blue-500 to-blue-600" },
  { key: "monthTotal", label: "This Month", accent: "from-violet-500 to-violet-600" },
  { key: "todayCount", label: "Deals Today", accent: "from-amber-500 to-amber-600" },
];

export function StatsCards(props: StatsCardsProps) {
  return (
    <div className="grid grid-cols-4 gap-4">
      {cards.map(({ key, label, accent }) => {
        const value = props[key];
        const display = key === "todayCount" ? value.toString() : formatCurrency(value);
        return (
          <div
            key={key}
            className="bg-slate-900/50 rounded-2xl border border-slate-800/50 p-5 relative overflow-hidden"
          >
            <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${accent}`} />
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
              {label}
            </div>
            <div className="text-2xl font-bold">{display}</div>
          </div>
        );
      })}
    </div>
  );
}
