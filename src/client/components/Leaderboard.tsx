import type { LeaderboardEntry } from "../../shared/types";

function formatCurrency(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 });
}

const RANK_STYLES = [
  "from-yellow-400 to-amber-500",
  "from-slate-300 to-slate-400",
  "from-amber-600 to-amber-700",
];

export function Leaderboard({ entries }: { entries: LeaderboardEntry[] }) {
  const maxTotal = entries[0]?.total || 1;

  return (
    <div className="bg-slate-900/50 rounded-2xl border border-slate-800/50 p-6 flex flex-col h-full">
      <h2 className="text-lg font-bold mb-4 text-slate-200 flex items-center gap-2">
        <span className="text-yellow-400">&#9733;</span>
        Leaderboard
        <span className="text-xs font-normal text-slate-500 ml-auto">This Month</span>
      </h2>

      {entries.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-slate-600 text-sm">
          No sales data yet
        </div>
      ) : (
        <div className="space-y-3 flex-1">
          {entries.map((entry, i) => {
            const pct = (entry.total / maxTotal) * 100;
            return (
              <div key={entry.rep} className="flex items-center gap-3">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                    i < 3
                      ? `bg-gradient-to-br ${RANK_STYLES[i]} text-slate-900`
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium truncate">{entry.rep}</span>
                    <span className="text-sm font-semibold text-emerald-400 ml-2">
                      {formatCurrency(entry.total)}
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                <span className="text-xs text-slate-500 w-12 text-right">
                  {entry.count} deal{entry.count !== 1 ? "s" : ""}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
