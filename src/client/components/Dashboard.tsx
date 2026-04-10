import type { DashboardData } from "../../shared/types";
import { Header } from "./Header";
import { SalesTicker } from "./SalesTicker";
import { FeaturedOrder } from "./FeaturedOrder";
import { StatsCards } from "./StatsCards";
import { Leaderboard } from "./Leaderboard";
import { SalesChart } from "./SalesChart";

export function Dashboard({ data }: { data: DashboardData }) {
  return (
    <div className="h-screen flex flex-col">
      <Header />
      <SalesTicker sales={data.recentSales} />

      <div className="flex-1 grid grid-cols-12 gap-4 p-5 min-h-0">
        {/* Left: Featured order hero + stats below */}
        <div className="col-span-4 flex flex-col gap-4 min-h-0">
          <div className="flex-1 min-h-0">
            <FeaturedOrder sales={data.recentSales} />
          </div>
          <StatsCards
            todayCount={data.todayCount}
            weekCount={data.weekCount}
            monthCount={data.monthCount}
          />
        </div>

        {/* Center: Leaderboard */}
        <div className="col-span-4 min-h-0">
          <Leaderboard entries={data.leaderboard} />
        </div>

        {/* Right: Volume chart */}
        <div className="col-span-4 min-h-0">
          <SalesChart data={data.dailyTotals} />
        </div>
      </div>
    </div>
  );
}
