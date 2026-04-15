import type { DashboardData } from "../../shared/types";
import { Header } from "./Header";
import { SalesTicker } from "./SalesTicker";
import { RecentOrders } from "./RecentOrders";

interface DashboardProps {
  data: DashboardData;
  onOpenTeam?: () => void;
}

export function Dashboard({ data, onOpenTeam }: DashboardProps) {
  return (
    <div className="h-screen flex flex-col">
      <Header onOpenTeam={onOpenTeam} />
      <SalesTicker sales={data.recentSales} />

      <div className="flex-1 grid grid-cols-12 gap-6 p-6 min-h-0">
        {/* Left — big stats hero */}
        <div className="col-span-4 flex flex-col gap-5 min-h-0">
          {/* Orders today — the big number */}
          <div className="flex-shrink-0 rounded-2xl border border-border-bright bg-surface-raised p-8">
            <div className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-3">
              Orders Today
            </div>
            <div className="text-8xl font-bold tabular-nums text-white leading-none">
              {data.todayCount}
            </div>
          </div>

          {/* Week + month */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-border bg-surface-raised/60 p-5">
              <div className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-2">
                This Week
              </div>
              <div className="text-4xl font-bold tabular-nums text-white">
                {data.weekCount}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-surface-raised/60 p-5">
              <div className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-2">
                This Month
              </div>
              <div className="text-4xl font-bold tabular-nums text-white">
                {data.monthCount}
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-0 rounded-2xl border border-border bg-surface-raised/60 p-5 flex flex-col">
            <div className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-3">
              Top reps · month
            </div>
            {data.repLeaderboard.length === 0 ? (
              <p className="text-sm text-text-secondary leading-relaxed">
                No rep-attributed orders yet. When Slide accounts match the DWH,
                owner names appear here.
              </p>
            ) : (
              <ol className="space-y-2 overflow-y-auto min-h-0 flex-1">
                {data.repLeaderboard.map((row, i) => (
                  <li
                    key={row.name}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="text-text-muted font-mono w-5 shrink-0">
                        {i + 1}.
                      </span>
                      <span className="font-medium text-white truncate">
                        {row.name}
                      </span>
                    </span>
                    <span className="text-accent font-semibold tabular-nums shrink-0">
                      {row.count}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        {/* Right — recent orders feed */}
        <div className="col-span-8 min-h-0">
          <RecentOrders sales={data.recentSales} />
        </div>
      </div>
    </div>
  );
}
