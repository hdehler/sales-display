export interface Sale {
  id?: number;
  rep: string;
  customer: string;
  product: string;
  amount: number;
  timestamp: string;
  slackTs?: string;
  rawMessage?: string;
}

export interface LeaderboardEntry {
  rep: string;
  total: number;
  count: number;
}

export interface DailyTotal {
  date: string;
  total: number;
  count: number;
}

export interface DashboardData {
  recentSales: Sale[];
  leaderboard: LeaderboardEntry[];
  todayTotal: number;
  weekTotal: number;
  monthTotal: number;
  todayCount: number;
  dailyTotals: DailyTotal[];
}

export interface CelebrationEvent {
  sale: Sale;
  type: "product" | "milestone";
  message?: string;
  duration: number;
}
