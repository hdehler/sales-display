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
  /** Empty when `meta.source === "slide_cloud"` — Slide does not include who sold the deal. */
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
  type: "product" | "milestone" | "walkup";
  message?: string;
  duration: number;
  /** Present when multiple Slide orders for one account are batched */
  slidePack?: {
    account: string;
    count: number;
    sales: Sale[];
  };
  /** Path to audio file to play (resolved server-side) */
  songUrl?: string;
  /** Jingle ID to synthesize client-side (takes priority over songUrl) */
  jingleId?: string;
  /** Present for walk-up celebrations after a rep claims the sale */
  rep?: {
    name: string;
    avatarColor?: string;
  };
}

export interface Rep {
  id: number;
  name: string;
  /** Jingle ID from the built-in library, or filename for uploaded mp3 */
  walkupSong: string | null;
  avatarColor: string;
}

export interface SongMapping {
  id: number;
  matchType: string;
  matchValue: string | null;
  songFile: string;
  songLabel: string;
}
