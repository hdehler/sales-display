/** Extra fields parsed from Slide Cloud Block Kit order messages */
export interface SlideOrderMeta {
  source: "slide_cloud";
  orderId: string;
  region?: string;
  hardware?: string;
  service?: string;
  orderHistory?: string;
  purchasedAt?: string;
  earliestShipDate?: string;
}

export interface Sale {
  id?: number;
  rep: string;
  customer: string;
  product: string;
  amount: number;
  timestamp: string;
  slackTs?: string;
  rawMessage?: string;
  meta?: SlideOrderMeta;
}

/** Ranked row: `name` is account/customer (Slide has no per-rep field in Slack). */
export interface LeaderboardEntry {
  name: string;
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
  /** Order counts (no $ — Slide has no price in Slack) */
  todayCount: number;
  weekCount: number;
  monthCount: number;
  dailyTotals: DailyTotal[];
}

export interface CelebrationEvent {
  sale: Sale;
  type: "product" | "milestone";
  message?: string;
  duration: number;
  /** Present when multiple Slide orders for one account are batched */
  slidePack?: {
    account: string;
    count: number;
    sales: Sale[];
  };
}
