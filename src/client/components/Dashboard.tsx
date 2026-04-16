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

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 px-5 lg:px-7 py-5 min-h-0">
        {/* Rankings + KPIs — wide */}
        <div className="lg:col-span-8 flex flex-col gap-4 min-h-0">
          {/* KPI strip */}
          <div className="rounded-2xl border border-border bg-surface-raised overflow-hidden shrink-0 grid grid-cols-3 divide-x divide-border">
            <div className="p-4 sm:p-5 relative">
              <div
                className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/45 to-transparent"
                aria-hidden
              />
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted mb-1.5">
                Today
              </div>
              <div className="font-display text-4xl sm:text-5xl font-normal tabular-nums text-text-primary leading-none tracking-tight">
                {data.todayCount}
              </div>
            </div>
            <div className="p-4 sm:p-5">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted mb-1.5">
                Week
              </div>
              <div className="text-2xl sm:text-3xl font-semibold tabular-nums text-text-primary tracking-tight">
                {data.weekCount}
              </div>
            </div>
            <div className="p-4 sm:p-5">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted mb-1.5">
                Month
              </div>
              <div className="text-2xl sm:text-3xl font-semibold tabular-nums text-text-primary tracking-tight">
                {data.monthCount}
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-0 flex flex-col gap-4">
            {/* Partner + volume rankings — new partners first */}
            <div className={`${panel} p-4 sm:p-6 flex-1 min-h-[12rem]`}>
              <div className="overflow-auto min-h-0 flex-1 -mx-1 px-1">
                {data.hunterLeaderboard.length === 0 ? (
                  <p className="text-base text-text-secondary leading-relaxed py-2">
                    No attributed Slide orders this month yet, or no order history
                    with Total Orders parsed.
                  </p>
                ) : (
                  <table className="w-full border-collapse text-left">
                    <caption className="sr-only">
                      Reps ranked by new buying partners this month, then by
                      sales count
                    </caption>
                    <thead>
                      <tr className="border-b border-border">
                        <th
                          scope="col"
                          className="sticky top-0 z-10 bg-surface-raised py-3 pr-3 w-12 text-xs font-semibold uppercase tracking-wider text-text-muted align-bottom"
                        >
                          #
                        </th>
                        <th
                          scope="col"
                          className="sticky top-0 z-10 bg-surface-raised py-3 text-xs font-semibold uppercase tracking-wider text-text-muted align-bottom"
                        >
                          Rep
                        </th>
                        <th
                          scope="col"
                          className="sticky top-0 z-10 bg-surface-raised py-3 text-right text-xs font-semibold uppercase tracking-wider text-accent align-bottom tabular-nums whitespace-nowrap pl-2"
                        >
                          New partners
                        </th>
                        <th
                          scope="col"
                          className="sticky top-0 z-10 bg-surface-raised py-3 text-right text-xs font-semibold uppercase tracking-wider text-text-muted align-bottom tabular-nums whitespace-nowrap pl-3"
                        >
                          Sales
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.hunterLeaderboard.map((row, i) => (
                        <tr
                          key={row.name}
                          className="border-b border-border/50 last:border-0 hover:bg-surface-hover/35 transition-colors"
                        >
                          <td className="py-3.5 pr-3 text-text-muted font-mono text-base tabular-nums align-middle">
                            {i + 1}.
                          </td>
                          <td className="py-3.5 font-medium text-text-primary text-lg sm:text-xl truncate max-w-[min(14rem,50vw)] align-middle">
                            {row.name}
                          </td>
                          <td className="py-3.5 pl-2 text-right tabular-nums align-middle">
                            <span className="text-2xl sm:text-3xl font-semibold text-accent leading-none">
                              {row.newBuyingPartners}
                            </span>
                          </td>
                          <td className="py-3.5 pl-3 text-right tabular-nums text-text-secondary text-lg sm:text-xl font-medium align-middle">
                            {row.sales}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Order volume only — secondary, smaller */}
            <div className={`${panel} p-4 sm:p-5 shrink-0 max-h-[40%] min-h-0 flex flex-col`}>
              <h2 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted mb-3">
                By order volume
              </h2>
              {data.repLeaderboard.length === 0 ? (
                <p className="text-sm text-text-secondary">
                  No rep-attributed orders this month.
                </p>
              ) : (
                <ol className="space-y-0 overflow-y-auto min-h-0 flex-1 divide-y divide-border/50 -mx-1 px-1">
                  {data.repLeaderboard.map((row, i) => (
                    <li
                      key={row.name}
                      className="flex items-center justify-between gap-4 py-3 first:pt-0 text-base sm:text-lg hover:bg-surface-hover/25 -mx-2 px-2 rounded-lg transition-colors"
                    >
                      <span className="flex items-center gap-4 min-w-0">
                        <span className="text-text-muted font-mono text-sm tabular-nums w-8 shrink-0 text-right">
                          {i + 1}
                        </span>
                        <span className="font-medium text-text-primary truncate">
                          {row.name}
                        </span>
                      </span>
                      <span className="text-accent font-semibold tabular-nums text-lg shrink-0">
                        {row.count}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </div>

        {/* Activity — narrow, minimal */}
        <div className={`lg:col-span-4 min-h-0 ${panel} p-3 sm:p-4`}>
          <RecentOrders sales={data.recentSales} compact />
        </div>
      </div>
    </div>
  );
}
