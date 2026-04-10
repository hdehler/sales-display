interface StatsCardsProps {
  todayCount: number;
  weekCount: number;
  monthCount: number;
}

const cards: {
  key: keyof StatsCardsProps;
  label: string;
  color: string;
}[] = [
  { key: "todayCount", label: "Today", color: "bg-accent" },
  { key: "weekCount", label: "This week", color: "bg-emerald" },
  { key: "monthCount", label: "This month", color: "bg-blue-400" },
];

export function StatsCards(props: StatsCardsProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {cards.map(({ key, label, color }, i) => (
        <div
          key={key}
          className="rounded-xl border border-border bg-surface-raised/60 p-4 animate-fade-up"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <div className="flex items-center gap-2 mb-3">
            <span className={`w-1.5 h-1.5 rounded-full ${color}`} />
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted">
              {label}
            </span>
          </div>
          <div className="text-3xl font-bold tabular-nums text-text-primary">
            {props[key]}
          </div>
          <div className="text-xs text-text-muted mt-1">orders</div>
        </div>
      ))}
    </div>
  );
}
