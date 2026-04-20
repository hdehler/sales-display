import type { DashboardData } from "../../shared/types";
import type { AssignRepContext } from "./AssignRepPanel";
import { Header } from "./Header";
import { SalesTicker } from "./SalesTicker";
import { RecentOrders } from "./RecentOrders";

interface DashboardProps {
  data: DashboardData;
  onOpenTeam?: () => void;
  onAssignRep?: (ctx: AssignRepContext) => void;
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

export function Dashboard({
  data,
  onOpenTeam,
  onAssignRep,
}: DashboardProps) {
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
              {data.hunterLeaderboard.length === 0 ? (
                <p className="text-sm text-text-secondary leading-snug min-h-0">
                  No Slide orders with parsed Total Orders this month.
                </p>
              ) : (
                <div
                  className="flex min-h-0 flex-1 flex-col text-sm text-left"
                  role="table"
                  aria-label="Reps ranked by new buying partners this month, then by order count"
                >
                  {/*
                    Header sits outside the scroll region so we avoid sticky thead inside
                    overflow — that pairing often breaks finger scrolling on touch UAs.
                  */}
                  <div
                    role="row"
                    className="grid shrink-0 grid-cols-[2.25rem_minmax(0,1fr)_5.75rem_5.75rem] gap-x-2 border-b border-border bg-surface-raised py-2 text-xs font-semibold uppercase tracking-wider text-text-muted sm:grid-cols-[2.5rem_minmax(0,1fr)_6.5rem_6.5rem]"
                  >
                    <div role="columnheader" className="pr-1">
                      #
                    </div>
                    <div role="columnheader" className="min-w-0">
                      Rep
                    </div>
                    <div
                      role="columnheader"
                      className="text-right tabular-nums leading-tight text-accent pl-1"
                      title="New buying partners"
                    >
                      New buying
                      <br />
                      partners
                    </div>
                    <div
                      role="columnheader"
                      className="text-right tabular-nums text-text-muted pl-1"
                    >
                      Orders
                    </div>
                  </div>
                  <div className="touch-scroll-y min-h-0 flex-1 select-none">
                    {data.hunterLeaderboard.map((row, i) => (
                      <div
                        key={row.name}
                        role="row"
                        className="list-row-dim grid grid-cols-[2.25rem_minmax(0,1fr)_5.75rem_5.75rem] gap-x-2 border-b border-border/40 py-2 last:border-0 sm:grid-cols-[2.5rem_minmax(0,1fr)_6.5rem_6.5rem]"
                      >
                        <div
                          role="cell"
                          className="pr-1 text-text-muted font-mono text-xs tabular-nums"
                        >
                          {i + 1}.
                        </div>
                        <div
                          role="cell"
                          className="min-w-0 truncate font-medium text-text-primary"
                        >
                          {row.name}
                        </div>
                        <div role="cell" className="pl-1 text-right tabular-nums">
                          <span className="text-base font-semibold text-accent tabular-nums">
                            {row.newBuyingPartners}
                          </span>
                        </div>
                        <div
                          role="cell"
                          className="pl-1 text-right tabular-nums font-medium text-text-secondary"
                        >
                          {row.sales}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
                <ol className="touch-scroll-y min-w-0 space-y-0 min-h-0 flex-1 divide-y divide-border/40 text-sm select-none">
                  {data.repLeaderboard.map((row, i) => (
                    <li
                      key={row.name}
                      className="list-row-dim-sm flex min-w-0 items-center justify-between gap-2 sm:gap-3 py-2 first:pt-0 rounded-md px-0.5"
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
              onAssignRep={onAssignRep}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
