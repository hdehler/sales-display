import type { LeaderboardEntry } from "../../shared/types";

const RANK_ACCENTS = [
  "from-amber-400 to-yellow-500",
  "from-slate-300 to-slate-400",
  "from-amber-700 to-amber-600",
];

const RANK_DOT = ["bg-amber-400", "bg-slate-300", "bg-amber-700"];

export function Leaderboard({ entries }: { entries: LeaderboardEntry[] }) {
  const maxCount = entries[0]?.count || 1;

  return (
    <div className="rounded-2xl border border-border bg-surface-raised p-5 flex flex-col h-full shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-lg text-text-primary">Top Accounts</h2>
        <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted">
          This month
        </span>
      </div>

      {entries.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
          No sales data yet
        </div>
      ) : (
        <div className="space-y-3 flex-1 overflow-y-auto">
          {entries.map((entry, i) => {
            const pct = (entry.count / maxCount) * 100;
            return (
              <div
                key={entry.name}
                className="animate-fade-up"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="flex items-center gap-3 mb-1.5">
                  {i < 3 ? (
                    <span
                      className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold bg-gradient-to-br ${RANK_ACCENTS[i]} text-stone-950`}
                    >
                      {i + 1}
                    </span>
                  ) : (
                    <span className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-medium text-text-muted bg-surface-hover">
                      {i + 1}
                    </span>
                  )}
                  <span className="text-sm font-medium text-text-primary truncate flex-1">
                    {entry.name}
                  </span>
                  <span className="text-sm tabular-nums font-semibold text-accent ml-2">
                    {entry.count}
                  </span>
                </div>
                <div className="ml-8 h-1 rounded-full bg-border overflow-hidden">
                  <div
                    className={`h-full rounded-full animate-bar-fill ${
                      i < 3
                        ? `bg-gradient-to-r ${RANK_ACCENTS[i]}`
                        : "bg-text-muted"
                    }`}
                    style={{
                      width: `${pct}%`,
                      animationDelay: `${i * 60 + 200}ms`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
