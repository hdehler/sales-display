/** Extra fields parsed from Slide Cloud Block Kit order messages */
export interface SlideOrderMeta {
  source: "slide_cloud";
  orderId: string;
  region?: string;
  hardware?: string;
  service?: string;
  orderHistory?: string;
  /** Set when Order History text includes Total Orders and the count is 0 (first-time buyer for that account). */
  newBuyingPartner?: boolean;
  purchasedAt?: string;
  earliestShipDate?: string;
}

/** Hunters: rep performance on order volume and net-new buying partners (Slide Total Orders = 0). */
export interface HunterLeaderboardEntry {
  name: string;
  sales: number;
  newBuyingPartners: number;
}

export interface Sale {
  id?: number;
  /**
   * Salesperson name from Slack text patterns, or from BigQuery (Slide account → HubSpot owner)
   * when `meta.source === "slide_cloud"` and DWH lookup succeeds.
   * Slide orders with no attributed owner use the shared sentinel `Unknown` (see `shared/rep.ts`).
   */
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
  /** Current calendar month, newest first (dashboard column + ticker source). */
  recentSales: Sale[];
  /** Top accounts by order count this month (customer field). */
  leaderboard: LeaderboardEntry[];
  /** Top reps by order count this month (non-empty `rep` on stored sales). */
  repLeaderboard: LeaderboardEntry[];
  /** Reps ranked by new buying partners (Slide), then by sales count — same month window as other boards. */
  hunterLeaderboard: HunterLeaderboardEntry[];
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
    /** Spirit animal slug when matched from Team */
    animal?: string;
  };
  /**
   * Slide (and similar) when `sale.rep` matched a Team row: hero + walkup + spirit animal.
   */
  repHero?: {
    name: string;
    avatarColor?: string;
    /** Spirit animal slug from Team (see `SPIRIT_ANIMALS`). */
    animal?: string;
  };
}

export interface Rep {
  id: number;
  name: string;
  /** Jingle ID from the built-in library, or filename for uploaded mp3 */
  walkupSong: string | null;
  /** Deezer (etc.) display title saved at pick time, e.g. Artist — Song */
  walkupSongLabel?: string | null;
  avatarColor: string;
  /** Slug from `SPIRIT_ANIMALS`; empty string if unset */
  spiritAnimal: string;
}

export interface SongMapping {
  id: number;
  matchType: string;
  matchValue: string | null;
  songFile: string;
  songLabel: string;
}
