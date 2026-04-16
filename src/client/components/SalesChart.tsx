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
    <div className="rounded-2xl border border-border bg-surface-raised/60 p-5 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-lg text-text-primary">Volume</h2>
        <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted">
          Last 14 days
        </span>
      </div>

      {chartData.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
          No order data yet
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--color-accent)"
                    stopOpacity={0.25}
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--color-accent)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#8b95a6", fontSize: 10 }}
                interval="preserveStartEnd"
              />
              <YAxis
                allowDecimals={false}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#8b95a6", fontSize: 10 }}
                width={28}
              />
              <Tooltip
                contentStyle={{
                  background: "#141a26",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "0.75rem",
                  fontSize: "0.8rem",
                  color: "#eef2f8",
                }}
                labelStyle={{ color: "#a3adb8" }}
                formatter={(value: unknown) => [
                  `${value ?? 0}`,
                  "Orders",
                ]}
                cursor={{ stroke: "rgba(12,136,255,0.22)" }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="var(--color-accent)"
                strokeWidth={2}
                fill="url(#chartGrad)"
                dot={false}
                activeDot={{
                  r: 4,
                  fill: "var(--color-accent)",
                  stroke: "#0f141f",
                  strokeWidth: 2,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
