import type { DashboardData } from "../../shared/types";
import { Header } from "./Header";
import { SalesTicker } from "./SalesTicker";
import { RecentOrders } from "./RecentOrders";

interface DashboardProps {
  data: DashboardData;
  onOpenTeam?: () => void;
}

const panel =
  "rounded-xl border border-border bg-surface-raised flex flex-col min-h-0";

/** Short month + year for header rails, e.g. "APR 2026" */
function monthScopeLabel(): string {
  return new Date()
    .toLocaleDateString(undefined, { month: "short", year: "numeric" })
    .toUpperCase();
}

function ContainerHeading({
  title,
  right,
}: {
  title: string;
  right: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 mb-2 min-w-0">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-text-primary truncate">
        {title}
      </h2>
      <span className="text-xs font-semibold uppercase tracking-wider text-text-muted shrink-0 tabular-nums">
        {right}
      </span>
    </div>
  );
}

export function Dashboard({ data, onOpenTeam }: DashboardProps) {
  const monthTag = monthScopeLabel();

  return (
    <div className="h-screen flex flex-col bg-surface">
      <Header onOpenTeam={onOpenTeam} />
      <SalesTicker sales={data.recentSales} />

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-4 px-4 lg:px-5 py-3 min-h-0">
        <div className="lg:col-span-8 flex flex-col gap-3 min-h-0">
          {/* KPI strip */}
          <div className="rounded-xl border border-border bg-surface-raised overflow-hidden shrink-0 flex flex-col">
            <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-border min-w-0">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-primary truncate">
                Order counts
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-text-muted shrink-0 tabular-nums">
                {monthTag}
              </span>
            </div>
            <div className="grid grid-cols-3 divide-x divide-border">
              <div className="p-3 sm:p-3.5 relative">
                <div
                  className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent"
                  aria-hidden
                />
                <div className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-1">
                  Today
                </div>
                <div className="font-display text-3xl sm:text-4xl font-normal tabular-nums text-text-primary leading-none tracking-tight">
                  {data.todayCount}
                </div>
              </div>
              <div className="p-3 sm:p-3.5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-1">
                  Week
                </div>
                <div className="text-xl sm:text-2xl font-semibold tabular-nums text-text-primary tracking-tight">
                  {data.weekCount}
                </div>
              </div>
              <div className="p-3 sm:p-3.5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-1">
                  Month
                </div>
                <div className="text-xl sm:text-2xl font-semibold tabular-nums text-text-primary tracking-tight">
                  {data.monthCount}
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-0 flex flex-col gap-3">
            {/* Smaller share — fewer new-partner rows than order volume */}
            <div className={`${panel} p-3 sm:p-4 flex-1 min-h-0`}>
              <ContainerHeading
                title="New buying partners"
                right={monthTag}
              />
              <div className="overflow-auto min-h-0 flex-1 -mx-0.5 px-0.5 overscroll-contain">
                {data.hunterLeaderboard.length === 0 ? (
                  <p className="text-sm text-text-secondary leading-snug">
                    No Slide orders with parsed Total Orders this month.
                  </p>
                ) : (
                  <table className="w-full border-collapse text-left text-sm">
                    <caption className="sr-only">
                      Reps ranked by new buying partners this month, then by order
                      count
                    </caption>
                    <thead>
                      <tr className="border-b border-border">
                        <th
                          scope="col"
                          className="sticky top-0 z-10 bg-surface-raised py-2 pr-2 w-8 text-xs font-semibold uppercase tracking-wider text-text-muted"
                        >
                          #
                        </th>
                        <th
                          scope="col"
                          className="sticky top-0 z-10 bg-surface-raised py-2 text-xs font-semibold uppercase tracking-wider text-text-muted"
                        >
                          Rep
                        </th>
                        <th
                          scope="col"
                          className="sticky top-0 z-10 bg-surface-raised py-2 text-right text-xs font-semibold uppercase tracking-wider text-accent tabular-nums pl-2 leading-tight"
                          title="New buying partners"
                        >
                          New buying
                          <br />
                          partners
                        </th>
                        <th
                          scope="col"
                          className="sticky top-0 z-10 bg-surface-raised py-2 text-right text-xs font-semibold uppercase tracking-wider text-text-muted tabular-nums pl-2"
                        >
                          Orders
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.hunterLeaderboard.map((row, i) => (
                        <tr
                          key={row.name}
                          className="border-b border-border/40 last:border-0 hover:bg-surface-hover/30 transition-colors"
                        >
                          <td className="py-2 pr-2 text-text-muted font-mono text-xs tabular-nums align-middle">
                            {i + 1}.
                          </td>
                          <td className="py-2 font-medium text-text-primary truncate max-w-[min(11rem,42vw)] align-middle">
                            {row.name}
                          </td>
                          <td className="py-2 pl-2 text-right tabular-nums align-middle">
                            <span className="text-base font-semibold text-accent tabular-nums">
                              {row.newBuyingPartners}
                            </span>
                          </td>
                          <td className="py-2 pl-2 text-right tabular-nums text-text-secondary font-medium align-middle">
                            {row.sales}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Larger: full rep order list */}
            <div className={`${panel} p-3 sm:p-4 flex-[2] min-h-0 flex flex-col`}>
              <ContainerHeading title="Orders" right={monthTag} />
              {data.repLeaderboard.length === 0 ? (
                <p className="text-sm text-text-secondary leading-snug">
                  No rep-attributed orders this month.
                </p>
              ) : (
                <ol className="space-y-0 overflow-y-auto min-h-0 flex-1 divide-y divide-border/40 -mx-0.5 px-0.5 text-sm overscroll-contain">
                  {data.repLeaderboard.map((row, i) => (
                    <li
                      key={row.name}
                      className="flex items-center justify-between gap-3 py-2 first:pt-0 hover:bg-surface-hover/25 -mx-1 px-1 rounded-md transition-colors"
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <span className="text-text-muted font-mono text-xs tabular-nums w-5 shrink-0 text-right">
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

        <div className={`lg:col-span-4 min-h-0 ${panel} p-2.5 sm:p-3`}>
          <RecentOrders
            sales={data.recentSales}
            compact
            headingRight={`LIVE · ${data.recentSales.length}`.toUpperCase()}
          />
        </div>
      </div>
    </div>
  );
}
