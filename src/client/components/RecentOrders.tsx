import type { Sale } from "../../shared/types";
import type { AssignRepContext } from "./AssignRepPanel";
import { UNKNOWN_REP, isUnresolvedRepName } from "../../shared/rep";
import { Sprout } from "lucide-react";

/** Always show a rep label so rows with unresolved reps aren’t visually “missing” the seller. */
function displayRep(s: Sale): string {
  const t = s.rep?.trim() ?? "";
  if (!t || t.toLowerCase() === "unknown") return UNKNOWN_REP;
  return t;
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

const PACK_WINDOW_MS = 120_000;

interface OrderRow {
  key: string;
  account: string;
  product: string;
  count: number;
  time: string;
  rep: string;
  newBuyingPartner?: boolean;
  /** DB ids for this row (packed Slide rows include every unit id). Used for Assign. */
  saleIds: number[];
}

function buildRows(sales: Sale[]): OrderRow[] {
  const rows: OrderRow[] = [];
  let i = 0;
  while (i < sales.length) {
    const s = sales[i];
    if (s.meta?.source === "slide_cloud") {
      const t0 = new Date(s.timestamp).getTime();
      let j = i + 1;
      while (j < sales.length) {
        const n = sales[j];
        if (n.meta?.source !== "slide_cloud" || n.customer !== s.customer) break;
        if (t0 - new Date(n.timestamp).getTime() > PACK_WINDOW_MS) break;
        j++;
      }
      const pack = sales.slice(i, j);
      const newBuyingPartner = pack.some((x) => x.meta?.newBuyingPartner);
      const saleIds = pack
        .map((x) => x.id)
        .filter((id): id is number => typeof id === "number" && id > 0);
      rows.push({
        key: `${s.timestamp}-${i}`,
        account: s.customer,
        product: pack.find((x) => x.product)?.product || "",
        count: j - i,
        time: s.timestamp,
        rep: displayRep(s),
        newBuyingPartner: newBuyingPartner || undefined,
        saleIds,
      });
      i = j;
    } else {
      const sid =
        typeof s.id === "number" && s.id > 0 ? [s.id] : ([] as number[]);
      rows.push({
        key: `${s.timestamp}-${i}`,
        account: s.customer,
        product: s.product || "",
        count: 1,
        time: s.timestamp,
        rep: displayRep(s),
        newBuyingPartner: s.meta?.newBuyingPartner || undefined,
        saleIds: sid,
      });
      i++;
    }
  }
  return rows;
}

interface RecentOrdersProps {
  sales: Sale[];
  /** Single-line rows, no product line — for side column */
  compact?: boolean;
  /** Uppercase rail on the right (e.g. month tag or `LIVE · 20`) */
  headingRight?: string;
  /** Opens rep picker when user taps Assign on Unknown rows */
  onAssignRep?: (ctx: AssignRepContext) => void;
}

export function RecentOrders({
  sales,
  compact,
  headingRight,
  onAssignRep,
}: RecentOrdersProps) {
  const rows = buildRows(sales);

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 min-h-0 py-8 text-center px-2">
        <p className="text-text-muted text-xs uppercase tracking-wider">
          No activity yet
        </p>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex flex-col h-full min-h-0">
        <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-border shrink-0 min-w-0">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-primary truncate">
            This month
          </h2>
          <span className="text-sm font-semibold uppercase tracking-wider text-text-muted shrink-0 tabular-nums">
            {headingRight ?? `${rows.length} orders`}
          </span>
        </div>
        <div className="touch-scroll-y flex-1 min-h-0 pt-2 space-y-0">
          {rows.map((row) => (
            <div
              key={row.key}
              className="list-row-compact flex items-center gap-2 py-1.5 px-0.5 rounded-md min-w-0"
            >
              {row.count > 1 ? (
                <span
                  className="shrink-0 text-sm font-bold tabular-nums text-accent w-6 text-center"
                  title={`${row.count} orders`}
                >
                  ×{row.count}
                </span>
              ) : (
                <span className="shrink-0 w-6" aria-hidden />
              )}
              <div className="flex-1 min-w-0 flex items-baseline gap-1.5 flex-wrap">
                <span className="text-sm font-medium text-text-primary truncate">
                  {row.account}
                </span>
                {row.newBuyingPartner ? (
                  <span className="inline-flex shrink-0" title="New partner">
                    <Sprout
                      className="new-partner-icon h-4 w-4 text-emerald-600 dark:text-emerald-400"
                      strokeWidth={2}
                      aria-hidden
                    />
                    <span className="sr-only">New partner</span>
                  </span>
                ) : null}
                <span className="text-sm text-text-muted truncate max-w-[35%] sm:max-w-[40%]">
                  · {row.rep}
                </span>
                {isUnresolvedRepName(row.rep) &&
                row.saleIds.length > 0 &&
                onAssignRep ? (
                  <button
                    type="button"
                    onClick={() =>
                      onAssignRep({
                        saleIds: row.saleIds,
                        account: row.account,
                        product: row.product,
                      })
                    }
                    className="shrink-0 text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md border border-accent/35 bg-accent/10 text-accent transition-colors active:bg-accent/25 active:border-accent/55"
                  >
                    Assign
                  </button>
                ) : null}
              </div>
              <time
                className="text-sm text-text-muted tabular-nums shrink-0 font-medium"
                dateTime={row.time}
              >
                {timeAgo(row.time)}
              </time>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between gap-3 pb-3 mb-1 border-b border-border shrink-0 min-w-0">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-text-primary truncate">
          Recent orders
        </h2>
        <span className="text-xs font-semibold uppercase tracking-wider text-text-muted shrink-0 tabular-nums">
          {headingRight ?? `${rows.length} SHOWN`}
        </span>
      </div>

      <div className="touch-scroll-y flex-1 min-h-0 pt-3 space-y-2">
        {rows.map((row, i) => (
          <article
            key={row.key}
            className="list-row-card group flex items-center gap-4 rounded-xl border border-border px-4 py-3.5 bg-surface-hover/15 animate-fade-up"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <div
              className="flex-shrink-0 w-11 h-11 rounded-xl bg-accent/12 border border-accent/20 flex items-center justify-center"
              aria-hidden
            >
              <span className="text-accent font-bold text-lg tabular-nums leading-none">
                {row.count}
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap gap-y-1">
                <h3 className="font-semibold text-text-primary text-[15px] sm:text-base truncate">
                  {row.account}
                </h3>
                {row.newBuyingPartner ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 shrink-0 text-[10px] font-semibold uppercase tracking-wide">
                    <Sprout
                      className="new-partner-icon h-3 w-3 text-current"
                      strokeWidth={2}
                      aria-hidden
                    />
                    New partner
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-2 mt-1 min-w-0 text-sm flex-wrap">
                {row.product ? (
                  <span className="text-text-secondary truncate">{row.product}</span>
                ) : null}
                {row.rep ? (
                  <>
                    {row.product ? (
                      <span className="text-text-muted shrink-0" aria-hidden>
                        ·
                      </span>
                    ) : null}
                    <span className="text-accent/90 font-medium truncate">{row.rep}</span>
                  </>
                ) : null}
                {isUnresolvedRepName(row.rep) &&
                row.saleIds.length > 0 &&
                onAssignRep ? (
                  <button
                    type="button"
                    onClick={() =>
                      onAssignRep({
                        saleIds: row.saleIds,
                        account: row.account,
                        product: row.product,
                      })
                    }
                    className="text-[11px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-lg border border-accent/35 bg-accent/10 text-accent transition-colors active:bg-accent/25 active:border-accent/55"
                  >
                    Assign
                  </button>
                ) : null}
              </div>
            </div>

            <time
              className="text-[11px] text-text-muted flex-shrink-0 tabular-nums font-medium uppercase tracking-wide self-start pt-0.5"
              dateTime={row.time}
            >
              {timeAgo(row.time)}
            </time>
          </article>
        ))}
      </div>
    </div>
  );
}
