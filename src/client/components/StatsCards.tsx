interface StatsCardsProps {
  todayCount: number;
  weekCount: number;
  monthCount: number;
}

const cards: { key: keyof StatsCardsProps; label: string; accent: string }[] = [
  { key: "todayCount", label: "Orders today", accent: "from-emerald-500 to-emerald-600" },
  { key: "weekCount", label: "This week", accent: "from-blue-500 to-blue-600" },
  { key: "monthCount", label: "This month", accent: "from-violet-500 to-violet-600" },
];

export function StatsCards(props: StatsCardsProps) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {cards.map(({ key, label, accent }) => (
        <div
          key={key}
          className="bg-slate-900/50 rounded-2xl border border-slate-800/50 p-5 relative overflow-hidden"
        >
          <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${accent}`} />
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
            {label}
          </div>
          <div className="text-2xl font-bold tabular-nums">{props[key]}</div>
        </div>
      ))}
    </div>
  );
}
