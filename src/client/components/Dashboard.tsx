import type { DashboardData } from "../../shared/types";
import { Header } from "./Header";
import { SalesTicker } from "./SalesTicker";
import { Leaderboard } from "./Leaderboard";
import { SalesChart } from "./SalesChart";
import { StatsCards } from "./StatsCards";

export function Dashboard({ data }: { data: DashboardData }) {
  return (
    <div className="h-screen flex flex-col">
      <Header />
      <SalesTicker sales={data.recentSales} />

      <div className="flex-1 grid grid-cols-5 gap-4 p-6 min-h-0">
        <div className="col-span-2">
          <Leaderboard entries={data.leaderboard} />
        </div>
        <div className="col-span-3">
          <SalesChart data={data.dailyTotals} />
        </div>
      </div>

      <div className="px-6 pb-6">
        <StatsCards
          todayCount={data.todayCount}
          weekCount={data.weekCount}
          monthCount={data.monthCount}
        />
      </div>
    </div>
  );
}
