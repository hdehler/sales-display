import type {
  DashboardData,
  HunterLeaderboardEntry,
  LeaderboardEntry,
} from "../../shared/types";
import { Header } from "./Header";
import { SalesTicker } from "./SalesTicker";
import { RecentOrders } from "./RecentOrders";

interface DashboardProps {
  data: DashboardData;
  onOpenTeam?: () => void;
}

const panel =
  "rounded-xl border border-border bg-surface-raised flex flex-col min-h-0";

function HunterLeaderboardPanel({
  title,
  rows,
  emptyMessage,
  caption,
}: {
  title: string;
  rows: HunterLeaderboardEntry[];
  emptyMessage: string;
  caption: string;
}) {
  return (
    <div className={`${panel} p-3 sm:p-4 flex-1 min-h-0 flex flex-col`}>
      <h2 className="text-xs font-semibold text-text-primary tracking-tight mb-2">
        {title}
      </h2>
      <div className="overflow-auto min-h-0 flex-1 -mx-0.5 px-0.5">
        {rows.length === 0 ? (
          <p className="text-sm text-text-secondary leading-snug">{emptyMessage}</p>
        ) : (
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">{caption}</caption>
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
              {rows.map((row, i) => (
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
  );
}

function RepOrdersQuarterPanel({
  title,
  rows,
  emptyMessage,
}: {
  title: string;
  rows: LeaderboardEntry[];
  emptyMessage: string;
}) {
  return (
    <div className={`${panel} p-3 sm:p-4 flex-1 min-h-0 flex flex-col`}>
      <h2 className="text-xs font-semibold text-text-primary tracking-tight mb-2">
        {title}
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm text-text-secondary leading-snug">{emptyMessage}</p>
      ) : (
        <ol className="space-y-0 overflow-y-auto min-h-0 flex-1 divide-y divide-border/40 -mx-0.5 px-0.5 text-sm">
          {rows.map((row, i) => (
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
  );
}

export function Dashboard({ data, onOpenTeam }: DashboardProps) {
  return (
    <div className="h-screen flex flex-col bg-surface">
      <Header onOpenTeam={onOpenTeam} />
      <SalesTicker sales={data.recentSales} />

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-4 px-4 lg:px-5 py-3 min-h-0">
        <div className="lg:col-span-8 flex flex-col gap-3 min-h-0">
          <div className="rounded-xl border border-border bg-surface-raised overflow-hidden shrink-0 grid grid-cols-3 divide-x divide-border">
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

          <div className="flex-1 min-h-0 flex flex-col gap-3">
            <HunterLeaderboardPanel
              title="New buying partners · month"
              rows={data.hunterLeaderboardMonth}
              emptyMessage="No Slide orders with parsed Total Orders this month."
              caption="Reps ranked by new buying partners this calendar month, then by order count"
            />
            <RepOrdersQuarterPanel
              title="Orders by rep · quarter"
              rows={data.repLeaderboardQuarter}
              emptyMessage="No rep-attributed orders this quarter."
            />
            <HunterLeaderboardPanel
              title="New buying partners · quarter"
              rows={data.hunterLeaderboardQuarter}
              emptyMessage="No Slide orders with parsed Total Orders this quarter."
              caption="Reps ranked by new buying partners this calendar quarter, then by order count"
            />
          </div>
        </div>

        <div className={`lg:col-span-4 min-h-0 ${panel} p-2.5 sm:p-3`}>
          <RecentOrders sales={data.recentSales} compact />
        </div>
      </div>
    </div>
  );
}
