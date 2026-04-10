import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { DailyTotal } from "../../shared/types";

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function SalesChart({ data }: { data: DailyTotal[] }) {
  const chartData = data.map((d) => ({
    date: formatShortDate(d.date),
    count: d.count,
  }));

  return (
    <div className="bg-slate-900/50 rounded-2xl border border-slate-800/50 p-6 flex flex-col h-full">
      <h2 className="text-lg font-bold mb-4 text-slate-200 flex items-center gap-2">
        <span className="text-blue-400">&#9679;</span>
        Order volume
        <span className="text-xs font-normal text-slate-500 ml-auto">
          Last 14 days
        </span>
      </h2>

      {chartData.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-slate-600 text-sm">
          No order data yet
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="ordersGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#64748b", fontSize: 11 }}
              />
              <YAxis
                allowDecimals={false}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#64748b", fontSize: 11 }}
                width={36}
              />
              <Tooltip
                contentStyle={{
                  background: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: "0.75rem",
                  fontSize: "0.875rem",
                }}
                labelStyle={{ color: "#94a3b8" }}
                formatter={(value: number | undefined) => [
                  `${value ?? 0} orders`,
                  "Count",
                ]}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#ordersGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
