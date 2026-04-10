"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  Building,
  Package,
  ShoppingCart,
  TrendingUp,
  PieChart,
} from "lucide-react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { Line, Doughnut, Bar } from "react-chartjs-2";

import "../styles/global.css";
import "./dashboard.css";

ChartJS.register(
  CategoryScale,
  ChartDataLabels,
  ArcElement,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
);

// Individual component styles
const statValueStyle = {
  fontSize: "1.5rem",
};

const chartTitleStyle = {
  fontSize: "0.85rem",
};

const tableFontStyle = {
  fontSize: "0.7rem",
};

interface Order {
  order_id: string;
  customer: string;
  model: string;
  date: string;
  status: string;
  created: string;
  line1: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

interface ModelCount {
  model: string;
  count: number;
}

interface MonthlyCount {
  year: number;
  month: number;
  count: number;
}

interface DailyCount {
  date: string;
  count: number;
}

const Dashboard = () => {
  const [activeDevices, setActiveDevices] = useState<number | null>(null);
  const [logoCount, setLogoCount] = useState<number | null>(null);
  const [partnerChange, setPartnerChange] = useState<number | null>(null);
  const [totalOrders, setTotalOrders] = useState<number | null>(null);
  const [orderChange, setOrderChange] = useState<number | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [showNotification, setShowNotification] = useState(false);
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const [salesBreakdown, setSalesBreakdown] = useState<ModelCount[]>([]);
  const [monthlySales, setMonthlySales] = useState<MonthlyCount[]>([]);
  const [dailyCounts, setDailyCounts] = useState<DailyCount[]>([]);
  const hasInitializedRef = useRef(false);
  const latestOrderIdsRef = useRef<Set<string>>(new Set());

  // Fetch active devices and logo count and total orders
  useEffect(() => {
    const fetchDashboardStats = async () => {
      try {
        const [
          activeDevicesRes,
          partnerStatsRes,
          recentOrdersRes,
          totalOrdersRes,
          salesBreakdownRes,
          monthlySalesRes,
          dailyCountsRes,
        ] = await Promise.all([
          fetch("http://10.80.1.96:8080/api/active-devices"),
          fetch("http://10.80.1.96:8080/api/partner-stats"),
          fetch("http://10.80.1.96:8080/api/recent-orders"),
          fetch("http://10.80.1.96:8080/api/total-orders"),
          fetch("http://10.80.1.96:8080/api/sales-breakdown"),
          fetch("http://10.80.1.96:8080/api/monthly-sales"),
          fetch("http://10.80.1.96:8080/api/daily-counts"),
        ]);

        // Update active devices
        const activeDevicesText = await activeDevicesRes.text();
        setActiveDevices(Number.parseInt(activeDevicesText));

        // Update partner stats
        const partnerStats = await partnerStatsRes.json();
        setLogoCount(partnerStats.total);
        setPartnerChange(partnerStats.thisQuarter);

        // Update total order counts from dedicated endpoint
        const orderStats = await totalOrdersRes.json();
        setTotalOrders(orderStats.total);
        setOrderChange(orderStats.thisMonth);

        // Update chart data from dedicated aggregate endpoints
        const salesBreakdownData: ModelCount[] = await salesBreakdownRes.json();
        setSalesBreakdown(salesBreakdownData);
        const monthlySalesData: MonthlyCount[] = await monthlySalesRes.json();
        setMonthlySales(monthlySalesData);
        const dailyCountsData: DailyCount[] = await dailyCountsRes.json();
        setDailyCounts(dailyCountsData);

        // Update recent orders + all related updates
        const data: Order[] = await recentOrdersRes.json();
        const recentIds = data.map((order) => order.order_id);
        const newOrderIds = recentIds.filter(
          (id) => !latestOrderIdsRef.current.has(id),
        );

        if (hasInitializedRef.current && newOrderIds.length > 0) {
          setNewOrdersCount(newOrderIds.length);
          setShowNotification(true);
          setTimeout(() => setShowNotification(false), 5000);
        }

        // Always update the ref after first fetch
        latestOrderIdsRef.current = new Set(recentIds);
        hasInitializedRef.current = true;

        setRecentOrders(data.slice(0, 15));
      } catch (error) {
        console.error("Error fetching dashboard stats:", error);
      }
    };

    fetchDashboardStats(); // Initial fetch
    const interval = setInterval(fetchDashboardStats, 30000); // every 30s
    return () => clearInterval(interval);
  }, []);

  const now = new Date();
  const thisMonth = now.getMonth();

  // Build model counts from the server-provided sales breakdown
  const modelCounts: { [model: string]: number } = {};
  for (const item of salesBreakdown) {
    if (item.model) {
      const normalizedModel = item.model.replace(/, *32GB$/, "").trim();
      modelCounts[normalizedModel] =
        (modelCounts[normalizedModel] || 0) + item.count;
    }
  }

  // Derive this month / last month counts from server-provided monthly sales
  let ordersThisMonth = 0;
  let ordersLastMonth = 0;
  const currentYear = now.getFullYear();
  const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
  const lastMonthYear = thisMonth === 0 ? currentYear - 1 : currentYear;

  for (const item of monthlySales) {
    if (item.year === currentYear && item.month === thisMonth + 1) {
      ordersThisMonth = item.count;
    } else if (item.year === lastMonthYear && item.month === lastMonth + 1) {
      ordersLastMonth = item.count;
    }
  }

  // Colors for the doughnut chart
  const chartColors = [
    "#4dc9f6", // blue
    "#f67019", // orange
    "#f53794", // pink
    "#537bc4", // dark blue
    "#acc236", // lime green
    "#166a8f", // deep blue
    "#00a950", // emerald green
    "#58595b", // gray
    "#8549ba", // purple
    "#e6194b", // red
    "#3cb44b", // green
    "#ffe119", // yellow
    "#4363d8", // royal blue
    "#f58231", // tangerine
    "#911eb4", // violet
    "#46f0f0", // cyan
    "#fabebe", // light pink
    "#008080", // teal
    "#e6beff", // lavender
    "#9a6324", // brown
  ];

  //doughnut chart styling
  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "60%",
    plugins: {
      datalabels: {
        display: false,
      },
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const label = context.label || "";
            const value = context.raw || 0;
            const total = context.dataset.data.reduce(
              (a: number, b: number) => a + b,
              0,
            );
            const percentage = Math.round((value / total) * 100);
            return `${label}: ${value} (${percentage}%)`;
          },
        },
      },
    },
    backgroundColor: "transparent",
  };

  // doughnut chart data
  const doughnutData = {
    labels: Object.keys(modelCounts),
    datasets: [
      {
        data: Object.values(modelCounts),
        backgroundColor: chartColors.slice(0, Object.keys(modelCounts).length),
      },
    ],
  };

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // calculate avg orders per weekday
  let weekdayCount = 0;
  for (let d = new Date(startOfMonth); d <= now; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) {
      weekdayCount++;
    }
  }
  const avgOrdersPerWeekday =
    weekdayCount > 0 ? (ordersThisMonth / weekdayCount).toFixed(1) : "0";

  // growth % vs last month
  let growthPercentage = "0";
  if (ordersLastMonth > 0) {
    growthPercentage = (
      ((ordersThisMonth - ordersLastMonth) / ordersLastMonth) *
      100
    ).toFixed(1);
  }

  const stats = [
    {
      id: 1,
      name: "Total Orders (YTD)",
      value: totalOrders?.toLocaleString() ?? "Loading...",
      change:
        orderChange !== null
          ? `+${orderChange} orders this quarter`
          : "Loading...",
      icon: ShoppingCart,
    },
    {
      id: 2,
      name: "Partners (Accounts with one or more devices)",
      value: logoCount?.toLocaleString() ?? "Loading...",
      change:
        partnerChange !== null
          ? `+${partnerChange.toLocaleString()} new this quarter`
          : "Loading...",
      icon: Building,
    },
    {
      id: 3,
      name: "Active Devices",
      value: activeDevices?.toLocaleString() ?? "Loading...",
      icon: Package,
    },
  ];

  const formatStatus = (status: string) =>
    status
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      datalabels: {
        /* color: "white",
        font: {
          weight: "bold",
          size: 14,
        }, */
        display: false,
      },
    },
    scales: {
      x: {
        ticks: {
          color: "rgba(255, 255, 255, 0.9)",
          maxRotation: 45,
          minRotation: 45,
          autoSkip: true,
          maxTicksLimit: 15,
        },
        grid: {
          drawOnChartArea: true,
          drawTicks: true,
          drawBorder: true,
          color: "rgba(255, 255, 255, 0.1)",
        },
        border: {
          color: "rgba(255, 255, 255, 0.7)",
        },
      },
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: "Orders",
          color: "rgba(255, 255, 255, 0.7)",
          font: {
            size: 14,
          },
        },
        ticks: {
          stepSize: 1,
          color: "rgba(255, 255, 255, 0.9)",
          precision: 0,
        },
        grid: {
          drawOnChartArea: true,
          drawTicks: true,
          drawBorder: true,
          color: "rgba(255, 255, 255, 0.1)",
        },
        border: {
          color: "rgba(255, 255, 255, 0.7)",
        },
      },
    },
  };

  const getLast30Days = (): { dates: string[]; labels: string[] } => {
    const dates: string[] = [];
    const labels: string[] = [];
    const now = new Date();

    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      dates.push(iso);
      labels.push(`${d.getMonth() + 1}/${d.getDate()}`); // e.g., "5/1"
    }

    return { dates, labels };
  };

  const { dates: last30Dates, labels: last30Labels } = getLast30Days();

  const salesPerDay: { [date: string]: number } = {};
  for (const item of dailyCounts) {
    salesPerDay[item.date] = item.count;
  }

  const chartData = {
    labels: last30Labels,
    datasets: [
      {
        label: "Orders",
        data: last30Dates.map((date) => salesPerDay[date] ?? 0),
        borderColor: "rgb(78,128,238)",
        backgroundColor: "rgba(75, 192, 192, 0.2)",
        tension: 0.4,
        pointRadius: 3,
        pointHoverRadius: 4,
        pointBorderColor: "rgba(255, 255, 255, 0.8)",
        pointBackgroundColor: "rgb(78,128,238)",
      },
    ],
  };

  // Build sales per month from server-provided monthly sales
  const salesPerMonth: { [month: string]: number } = {};
  for (const item of monthlySales) {
    const key = `${item.year}-${item.month - 1}`;
    salesPerMonth[key] = item.count;
  }

  // data for the bar chart
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const sortedMonthKeys = Object.keys(salesPerMonth).sort((a, b) => {
    const [yearA, monthA] = a.split("-").map(Number);
    const [yearB, monthB] = b.split("-").map(Number);

    if (yearA !== yearB) {
      return yearA - yearB;
    }
    return monthA - monthB;
  });
  const last6MonthsKeys = sortedMonthKeys.slice(-6); // get last 6

  const barChartData = {
    labels: last6MonthsKeys.map((key) => {
      const [, month] = key.split("-").map(Number);
      return monthNames[month]; // turn 3 into "Apr"
    }),
    datasets: [
      {
        label: "Orders",
        data: last6MonthsKeys.map((key) => salesPerMonth[key]),
        backgroundColor: "rgba(78, 128, 238, 0.7)",
        borderRadius: 8,
      },
    ],
  };

  // options for the bar chart
  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      datalabels: {
        display: true,
        anchor: "center" as const,
        align: "center" as const,
        color: "white",
        font: {
          weight: "bold" as const,
          size: 10,
        },
        formatter: Math.round,
      },
    },
    scales: {
      x: {
        type: "category" as const,
        ticks: {
          color: "rgba(255, 255, 255, 0.9)",
          autoSkip: false,
        },
      },
      y: {
        beginAtZero: true,
        grid: {
          drawOnChartArea: false,
          drawTicks: true,
          drawBorder: true,
          color: "rgba(255, 255, 255, 0.7)",
        },
        title: {
          display: true,
          text: "Orders",
          color: "rgba(255, 255, 255, 0.7)",
          font: {
            size: 14,
          },
        },
        border: {
          color: "rgba(255, 255, 255, 0.7)",
        },
      },
    },
  };

  const renderDoughnutLegend = () => {
    // Get the model names and their counts
    const models = Object.keys(modelCounts);
    const counts = Object.values(modelCounts);
    const total = counts.reduce((sum, count) => sum + count, 0);

    const sortedIndices = counts
      .map((_, i) => i)
      .sort((a, b) => counts[b] - counts[a]);

    return (
      <div className="doughnut-legend">
        {sortedIndices.map((index) => {
          const model = models[index];
          const count = counts[index];
          const percentage = Math.round((count / total) * 100);
          const color = chartColors[index % chartColors.length];

          return (
            <div key={model} className="legend-item">
              <div
                className="legend-color"
                style={{ backgroundColor: color }}
              ></div>
              <div className="legend-text">
                <span className="legend-label">{model}</span>
                <span className="legend-value">
                  {count} ({percentage}%)
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="tv-dashboard-content">
      {/* Notification Overlay */}
      {showNotification && (
        <div className="exciting-notification-overlay">
          <div className="exciting-notification-content">
            <div className="notification-blue-top"></div>
            <div className="logo-container">
              <img
                src="/images/logo_icon_round_edges.png"
                alt="Company Logo"
                className="logo-image"
                style={{ width: "100px", height: "100px" }}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.onerror = null;
                  target.src = "/placeholder.svg?height=100&width=100";
                }}
              />
            </div>
            <h1 className="notification-title">New Order Received</h1>
            <p className="notification-message">
              <span className="order-count">{newOrdersCount}</span> new order
              {newOrdersCount > 1 ? "s have" : " has"} just come in!
            </p>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="stats-grid">
        {stats.map((stat) => (
          <div key={stat.id} className="stat-card">
            <div className="stat-content">
              <div className="stat-icon">
                <stat.icon />
              </div>
              <div className="stat-details">
                <p className="stat-label">{stat.name}</p>
                <div className="stat-value-container">
                  <p className="stat-value" style={statValueStyle}>
                    {stat.value}
                  </p>
                  <p className="stat-change">{stat.change}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="main-panels">
        {/* Left side with doughnut and bar charts stacked vertically */}
        <div className="left-charts">
          <div className="chart-card doughnut-chart-container">
            <div className="chart-header">
              <h2 className="chart-title" style={chartTitleStyle}>
                Device Sales Breakdown
              </h2>
              <PieChart className="chart-icon" />
            </div>
            <div className="chart-container">
              <div className="doughnut-chart-area">
                <div className="chart-wrapper">
                  <Doughnut
                    data={doughnutData}
                    options={{
                      ...doughnutOptions,
                      animation: false,
                      responsive: true,
                      maintainAspectRatio: false,
                    }}
                  />
                </div>
              </div>
              <div className="legend-container">{renderDoughnutLegend()}</div>
            </div>
          </div>

          {/* Bar Chart */}
          <div className="chart-card bar-chart-container">
            <div className="chart-header">
              <h2 className="chart-title" style={chartTitleStyle}>
                Sales by Month
              </h2>
              <TrendingUp className="chart-icon" />
            </div>
            <div className="chart-placeholder">
              <div className="chart-wrapper">
                <Bar
                  data={barChartData}
                  options={{
                    ...barChartOptions,
                    animation: false,
                    responsive: true,
                    maintainAspectRatio: false,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="right-panels">
          {/* Order Trend Chart */}
          <div className="chart-card trend-card">
            <div className="chart-header">
              <h2 className="chart-title" style={chartTitleStyle}>
                30-Day Order Trend
              </h2>
              <TrendingUp className="chart-icon" />
            </div>
            {/* line chart */}
            <div className="chart-placeholder">
              <Line data={chartData} options={options} />
            </div>
            <div className="chart-stats">
              <div>
                <p className="chart-stat-value">{avgOrdersPerWeekday}</p>
                <p className="chart-stat-label">Avg Order/Day</p>
              </div>
              <div>
                <p className="chart-stat-value">{growthPercentage}%</p>
                <p className="chart-stat-label">Growth vs Last Month</p>
              </div>
            </div>
          </div>

          {/* Recent Orders */}
          <div className="chart-card orders-card">
            <div className="chart-header">
              <h2 className="chart-title" style={chartTitleStyle}>
                Recent Orders
              </h2>
              <div className="live-indicator">
                <span className="pulse-dot">
                  <span className="pulse-ring"></span>
                  <span className="pulse-dot-inner"></span>
                </span>
                <span className="live-text">Live Updates</span>
              </div>
            </div>
            <div className="orders-table-container">
              <table className="orders-table" style={tableFontStyle}>
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Customer</th>
                    <th>Model</th>
                    <th>Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders
                    .sort(
                      (a, b) =>
                        new Date(b.created).getTime() -
                        new Date(a.created).getTime(),
                    ) // Sort by date, newest first
                    .slice(0, 15) // Take only the first 15 orders
                    .map((order) => (
                      <tr key={order.order_id}>
                        <td className="order-id">{order.order_id}</td>
                        <td className="order-customer">{order.customer}</td>
                        <td className="order-model">{order.model}</td>
                        <td className="order-date">{order.date}</td>
                        <td>
                          <span
                            className={`status-badge ${
                              order.status.toLowerCase() === "shipped"
                                ? "status-shipped"
                                : order.status.toLowerCase() === "ready_to_ship"
                                  ? "status-ready"
                                  : order.status.toLowerCase() === "new"
                                    ? "status-new"
                                    : ""
                            }`}
                          >
                            {formatStatus(order.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
