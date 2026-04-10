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
        </div>

        {/* Right — recent orders feed */}
        <div className="col-span-8 min-h-0">
          <RecentOrders sales={data.recentSales} />
        </div>
      </div>
    </div>
  );
}
