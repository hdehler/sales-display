import type { DashboardData } from "../../shared/types";
import { Header } from "./Header";
import { SalesTicker } from "./SalesTicker";
import { RecentOrders } from "./RecentOrders";

interface DashboardProps {
  data: DashboardData;
  onOpenTeam?: () => void;
}

const panel =
  "rounded-2xl border border-border bg-surface-raised flex flex-col min-h-0";

export function Dashboard({ data, onOpenTeam }: DashboardProps) {
  return (
    <div className="h-screen flex flex-col bg-surface">
      <Header onOpenTeam={onOpenTeam} />
      <SalesTicker sales={data.recentSales} />

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 px-6 lg:px-8 py-6 min-h-0">
        {/* Left — KPIs + leaderboards */}
        <div className="lg:col-span-4 flex flex-col gap-5 min-h-0">
          {/* Hero KPI */}
          <div className={`${panel} relative overflow-hidden p-8 shrink-0`}>
            <div
              className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent"
              aria-hidden
            />
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted mb-4">
              Orders today
            </div>
            <div className="font-display text-7xl sm:text-8xl font-normal tabular-nums text-text-primary leading-none tracking-tight">
              {data.todayCount}
            </div>
          </div>

          {/* Week + month — single segmented card */}
          <div className="rounded-2xl border border-border bg-surface-raised overflow-hidden shrink-0 grid grid-cols-2 divide-x divide-border">
            <div className="p-5 sm:p-6">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted mb-2">
                This week
              </div>
              <div className="text-3xl sm:text-4xl font-semibold tabular-nums text-text-primary tracking-tight">
                {data.weekCount}
              </div>
            </div>
            <div className="p-5 sm:p-6">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted mb-2">
                This month
              </div>
              <div className="text-3xl sm:text-4xl font-semibold tabular-nums text-text-primary tracking-tight">
                {data.monthCount}
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-0 flex flex-col gap-5">
            {/* Hunters */}
            <div className={`${panel} p-5 sm:p-6 flex-1`}>
              <div className="flex items-start justify-between gap-3 mb-1">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted">
                  Hunters · month
                </h2>
              </div>
              <p className="text-xs text-text-muted leading-relaxed mb-4">
                Ranked by new buying partners when Slide order history shows{" "}
                <span className="text-text-secondary font-medium">
                  Total Orders: 0
                </span>
                , then by sales volume.
              </p>
              {data.hunterLeaderboard.length === 0 ? (
                <p className="text-sm text-text-secondary leading-relaxed">
                  No attributed Slide orders this month yet, or no Order History
                  with Total Orders parsed.
                </p>
              ) : (
                <div className="overflow-auto min-h-0 flex-1 -mx-1">
                  <table className="w-full text-sm border-collapse">
                    <caption className="sr-only">
                      Hunter leaderboard by new buying partners and sales
                    </caption>
                    <thead>
                      <tr className="text-left border-b border-border">
                        <th
                          scope="col"
                          className="sticky top-0 z-10 bg-surface-raised py-2.5 pr-2 w-9 text-[10px] font-semibold uppercase tracking-wider text-text-muted"
                        >
                          #
                        </th>
                        <th
                          scope="col"
                          className="sticky top-0 z-10 bg-surface-raised py-2.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted"
                        >
                          Rep
                        </th>
                        <th
                          scope="col"
                          className="sticky top-0 z-10 bg-surface-raised py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-text-muted tabular-nums"
                        >
                          Sales
                        </th>
                        <th
                          scope="col"
                          className="sticky top-0 z-10 bg-surface-raised py-2.5 pl-2 text-right text-[10px] font-semibold uppercase tracking-wider text-text-muted tabular-nums whitespace-nowrap"
                        >
                          New
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.hunterLeaderboard.map((row, i) => (
                        <tr
                          key={row.name}
                          className="border-b border-border/60 last:border-0 hover:bg-surface-hover/40 transition-colors"
                        >
                          <td className="py-2.5 pr-2 text-text-muted font-mono text-xs tabular-nums align-middle">
                            {i + 1}.
                          </td>
                          <td className="py-2.5 font-medium text-text-primary truncate max-w-[min(10rem,40vw)] align-middle">
                            {row.name}
                          </td>
                          <td className="py-2.5 text-right tabular-nums text-text-secondary align-middle">
                            {row.sales}
                          </td>
                          <td className="py-2.5 pl-2 text-right tabular-nums font-semibold text-accent align-middle">
                            {row.newBuyingPartners}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Top reps */}
            <div className={`${panel} p-5 sm:p-6 flex-1`}>
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted mb-4">
                Top reps · month
              </h2>
              {data.repLeaderboard.length === 0 ? (
                <p className="text-sm text-text-secondary leading-relaxed">
                  No rep-attributed orders yet. When Slide accounts match the
                  DWH, owner names appear here.
                </p>
              ) : (
                <ol className="space-y-0 overflow-y-auto min-h-0 flex-1 divide-y divide-border/60">
                  {data.repLeaderboard.map((row, i) => (
                    <li
                      key={row.name}
                      className="flex items-center justify-between gap-3 py-2.5 first:pt-0 text-sm hover:bg-surface-hover/30 -mx-2 px-2 rounded-lg transition-colors"
                    >
                      <span className="flex items-center gap-3 min-w-0">
                        <span className="text-text-muted font-mono text-xs tabular-nums w-6 shrink-0 text-right">
                          {i + 1}
                        </span>
                        <span className="font-medium text-text-primary truncate">
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
        </div>

        {/* Right — feed */}
        <div className={`lg:col-span-8 min-h-0 ${panel} p-5 sm:p-6`}>
          <RecentOrders sales={data.recentSales} />
        </div>
      </div>
    </div>
  );
}
