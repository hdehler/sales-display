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

/** Today / Week / Month — match section rails (`ContainerHeading`) + display figures */
const orderCountLabel =
  "text-xs font-semibold uppercase tracking-wider text-text-muted mb-1";
const orderCountValue =
  "font-display text-3xl sm:text-4xl font-normal tabular-nums text-text-primary leading-none tracking-tight";

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
  const tickerSales = data.recentSales.slice(0, 20);

  return (
    <div className="h-screen flex flex-col bg-surface">
      <Header onOpenTeam={onOpenTeam} />
      <SalesTicker sales={tickerSales} />

      <div className="flex-1 flex flex-col min-h-0 gap-3 px-4 lg:px-5 py-3">
        {/* Order counts — full width */}
        <div className="shrink-0 flex flex-col gap-2">
          <ContainerHeading title="Order counts" right={monthTag} />
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div
              className={`${panel} p-3 sm:p-3.5 relative overflow-hidden shrink-0`}
            >
              <div
                className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/45 to-transparent"
                aria-hidden
              />
              <div className={orderCountLabel}>Today</div>
              <div className={orderCountValue}>{data.todayCount}</div>
            </div>
            <div className={`${panel} p-3 sm:p-3.5 shrink-0`}>
              <div className={orderCountLabel}>Week</div>
              <div className={orderCountValue}>{data.weekCount}</div>
            </div>
            <div className={`${panel} p-3 sm:p-3.5 shrink-0`}>
              <div className={orderCountLabel}>Month</div>
              <div className={orderCountValue}>{data.monthCount}</div>
            </div>
          </div>
        </div>

        {/* Hunter + Orders | This month — same row height (not spanning order counts) */}
        <div className="flex-1 flex flex-col lg:flex-row gap-3 min-h-0 min-w-0">
          <div className="flex-1 flex flex-col gap-3 min-h-0 min-w-0 lg:basis-0 lg:min-w-0">
            <div className={`${panel} p-3 sm:p-4 flex-1 min-h-0 flex flex-col`}>
              <ContainerHeading
                title="New buying partners"
                right={monthTag}
              />
              <div className="overflow-y-auto overflow-x-hidden min-h-0 flex-1 overscroll-contain">
                {data.hunterLeaderboard.length === 0 ? (
                  <p className="text-sm text-text-secondary leading-snug">
                    No Slide orders with parsed Total Orders this month.
                  </p>
                ) : (
                  <table className="w-full min-w-0 table-fixed border-collapse text-left text-sm">
                    <caption className="sr-only">
                      Reps ranked by new buying partners this month, then by order
                      count
                    </caption>
                    <thead>
                      <tr className="border-b border-border">
                        <th
                          scope="col"
                          className="sticky top-0 z-10 bg-surface-raised py-2 pr-2 w-[10%] max-w-[2.5rem] text-xs font-semibold uppercase tracking-wider text-text-muted"
                        >
                          #
                        </th>
                        <th
                          scope="col"
                          className="sticky top-0 z-10 bg-surface-raised py-2 text-xs font-semibold uppercase tracking-wider text-text-muted w-[46%]"
                        >
                          Rep
                        </th>
                        <th
                          scope="col"
                          className="sticky top-0 z-10 bg-surface-raised py-2 text-right text-xs font-semibold uppercase tracking-wider text-accent tabular-nums pl-2 leading-tight w-[22%]"
                          title="New buying partners"
                        >
                          New buying
                          <br />
                          partners
                        </th>
                        <th
                          scope="col"
                          className="sticky top-0 z-10 bg-surface-raised py-2 text-right text-xs font-semibold uppercase tracking-wider text-text-muted tabular-nums pl-2 w-[22%]"
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
                          <td className="py-2 font-medium text-text-primary truncate align-middle min-w-0">
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

            <div
              className={`${panel} p-3 sm:p-4 flex-[2] min-h-0 min-w-0 flex flex-col overflow-x-hidden`}
            >
              <ContainerHeading title="Orders" right={monthTag} />
              {data.repLeaderboard.length === 0 ? (
                <p className="text-sm text-text-secondary leading-snug min-w-0">
                  No rep-attributed orders this month.
                </p>
              ) : (
                <ol className="min-w-0 space-y-0 overflow-y-auto overflow-x-hidden min-h-0 flex-1 divide-y divide-border/40 text-sm overscroll-contain">
                  {data.repLeaderboard.map((row, i) => (
                    <li
                      key={row.name}
                      className="flex min-w-0 items-center justify-between gap-2 sm:gap-3 py-2 first:pt-0 rounded-md px-0.5 transition-colors hover:bg-surface-hover/25"
                    >
                      <span className="flex min-w-0 flex-1 items-center gap-2.5">
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

          <div
            className={`flex flex-1 flex-col min-h-0 min-w-0 lg:flex-none lg:basis-[32%] lg:max-w-md ${panel} p-2.5 sm:p-3`}
          >
            <RecentOrders
              sales={data.recentSales}
              compact
              headingRight={`${data.recentSales.length} orders`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
