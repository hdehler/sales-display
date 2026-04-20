import { BigQuery } from "@google-cloud/bigquery";
import { config, isBigQueryAccountOwnerConfigured } from "./config.js";
import type { Sale } from "../shared/types.js";
import { UNKNOWN_REP } from "../shared/rep.js";

let bigqueryClient: BigQuery | null = null;

/** BigQuery column / dataset / table id: letters, digits, underscore. */
const SAFE_ID = /^[a-zA-Z0-9_]+$/;
const SAFE_PROJECT = /^[a-zA-Z0-9_-]+$/;

function assertSafeColumn(name: string, label: string): string {
  if (!SAFE_ID.test(name)) {
    throw new Error(
      `Invalid ${label} identifier (use only letters, digits, underscore): ${name}`,
    );
  }
  return name;
}

/** Build `proj`.`dataset`.`table` for use in SQL. */
function quoteTableRef(ref: string): string {
  const parts = ref.split(".").map((p) => p.trim()).filter(Boolean);
  if (parts.length !== 3) {
    throw new Error(
      `BIGQUERY_ACCOUNT_OWNER_TABLE must be project.dataset.table (3 segments), got: ${ref}`,
    );
  }
  const [proj, dataset, table] = parts;
  if (!SAFE_PROJECT.test(proj) || !SAFE_ID.test(dataset) || !SAFE_ID.test(table)) {
    throw new Error(
      `BIGQUERY_ACCOUNT_OWNER_TABLE has invalid characters in: ${ref}`,
    );
  }
  return `\`${proj}\`.\`${dataset}\`.\`${table}\``;
}

/** Hunter = AE (credited on first order). Farmer = AM (credited on every later order). */
export type OwnerKind = "hunter" | "farmer";

export interface AccountOwners {
  /** Resolved AE — `account_executive` (or whatever `BIGQUERY_HUNTER_COLUMN` is set to). */
  hunter: string | null;
  /** Resolved AM — `account_manager` (or whatever `BIGQUERY_FARMER_COLUMN` is set to). */
  farmer: string | null;
  /** Legacy single-owner column, when configured (used as last-resort fallback). */
  legacy: string | null;
}

class LruCache<V> {
  private readonly map = new Map<string, V>();
  constructor(private readonly max: number) {}

  get(key: string): V | undefined {
    const v = this.map.get(key);
    if (v === undefined) return undefined;
    this.map.delete(key);
    this.map.set(key, v);
    return v;
  }

  set(key: string, value: V): void {
    if (this.map.has(key)) this.map.delete(key);
    else if (this.map.size >= this.max) {
      const first = this.map.keys().next().value;
      if (first !== undefined) this.map.delete(first);
    }
    this.map.set(key, value);
  }
}

let cache: LruCache<AccountOwners> | null = null;

function normKey(account: string): string {
  return account.trim().toLowerCase();
}

function getBigQuery(): BigQuery | null {
  if (!isBigQueryAccountOwnerConfigured()) return null;
  if (!bigqueryClient) {
    bigqueryClient = new BigQuery({
      projectId: config.bigqueryAccountOwner.projectId.trim(),
    });
  }
  return bigqueryClient;
}

function getCache(): LruCache<AccountOwners> {
  const max = Math.max(
    1,
    Number.isFinite(config.bigqueryAccountOwner.lookupCacheMax)
      ? config.bigqueryAccountOwner.lookupCacheMax
      : 512,
  );
  if (!cache) cache = new LruCache<AccountOwners>(max);
  return cache;
}

function cleanString(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

/**
 * Returns the appropriate owner for a sale, applying fallbacks:
 *   1. Preferred kind column for the sale (hunter on first order, farmer otherwise)
 *   2. The other kind column (better than nothing if BigQuery only filled one side)
 *   3. Legacy single-owner column (back-compat with the old mart)
 */
export function pickOwnerForSale(
  sale: Sale,
  owners: AccountOwners,
): { name: string | null; kind: OwnerKind | "legacy" | null } {
  const kind = ownerKindForSale(sale);
  const primary = owners[kind];
  if (primary) return { name: primary, kind };
  const otherKey: OwnerKind = kind === "hunter" ? "farmer" : "hunter";
  const secondary = owners[otherKey];
  if (secondary) return { name: secondary, kind: otherKey };
  if (owners.legacy) return { name: owners.legacy, kind: "legacy" };
  return { name: null, kind: null };
}

/**
 * Hunter (AE) is credited on a customer's first-ever order; farmer (AM) on every later order.
 * `meta.newBuyingPartner` is set by the parser from the `Order History: Total Orders: N` line:
 *   - true  → first order ever for this account → hunter
 *   - false → existing customer → farmer
 *   - undefined (no order history parsed) → default to farmer to avoid wrongly crediting
 *     a hunter when we couldn't confirm it's truly a first sale.
 */
export function ownerKindForSale(sale: Sale): OwnerKind {
  return sale.meta?.newBuyingPartner === true ? "hunter" : "farmer";
}

/**
 * Single round-trip lookup that returns hunter, farmer, and legacy owner columns
 * for an account. Returns null when BigQuery is not configured or the lookup errors.
 */
export async function lookupOwnersForAccount(
  accountName: string,
): Promise<AccountOwners | null> {
  const raw = accountName?.trim();
  if (!raw || raw === "Unknown account") return null;

  const bq = getBigQuery();
  if (!bq) return null;

  const key = normKey(raw);
  const hit = getCache().get(key);
  if (hit !== undefined) return hit;

  const b = config.bigqueryAccountOwner;
  const tableSql = quoteTableRef(b.tableRef.trim());
  const acctCol = assertSafeColumn(b.accountColumn.trim(), "account column");
  const orderCol = assertSafeColumn(b.orderByColumn.trim(), "order-by column");

  const selectParts: string[] = [];
  const hunterCol = b.hunterColumn.trim();
  const farmerCol = b.farmerColumn.trim();
  const legacyCol = b.repColumn.trim();
  if (hunterCol) {
    selectParts.push(
      `\`${assertSafeColumn(hunterCol, "hunter column")}\` AS hunter_name`,
    );
  } else {
    selectParts.push(`CAST(NULL AS STRING) AS hunter_name`);
  }
  if (farmerCol) {
    selectParts.push(
      `\`${assertSafeColumn(farmerCol, "farmer column")}\` AS farmer_name`,
    );
  } else {
    selectParts.push(`CAST(NULL AS STRING) AS farmer_name`);
  }
  if (legacyCol) {
    selectParts.push(
      `\`${assertSafeColumn(legacyCol, "legacy owner column")}\` AS legacy_name`,
    );
  } else {
    selectParts.push(`CAST(NULL AS STRING) AS legacy_name`);
  }

  const query = `
    SELECT ${selectParts.join(", ")}
    FROM ${tableSql}
    WHERE LOWER(TRIM(CAST(\`${acctCol}\` AS STRING))) = LOWER(TRIM(@acct))
    ORDER BY \`${orderCol}\`
    LIMIT 2
  `;

  const loc = b.location.trim();
  const options: {
    query: string;
    params: { acct: string };
    location?: string;
  } = {
    query,
    params: { acct: raw },
  };
  if (loc) options.location = loc;

  try {
    const [rows] = await bq.query(options);
    const list = rows as {
      hunter_name?: string | null;
      farmer_name?: string | null;
      legacy_name?: string | null;
    }[];
    if (list.length > 1) {
      console.warn(
        `[BigQuery] Multiple owner rows for account=${JSON.stringify(raw)}; using first after ORDER BY`,
      );
    }
    const row = list[0];
    const owners: AccountOwners = {
      hunter: cleanString(row?.hunter_name),
      farmer: cleanString(row?.farmer_name),
      legacy: cleanString(row?.legacy_name),
    };
    if (owners.hunter || owners.farmer || owners.legacy) {
      getCache().set(key, owners);
    } else {
      console.warn(
        `[BigQuery] No owner row for account=${JSON.stringify(raw)}`,
      );
    }
    return owners;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[BigQuery] lookupOwnersForAccount failed:", msg);
    return null;
  }
}

/**
 * Back-compat shim used by callers that just want a single owner name (no NBP context).
 * Picks legacy → farmer → hunter, in that order, since callers without a Sale typically
 * want "the current owner" (farmer) rather than the AE who first signed the account.
 */
export async function lookupRepForAccount(
  accountName: string,
): Promise<string | null> {
  const owners = await lookupOwnersForAccount(accountName);
  if (!owners) return null;
  return owners.legacy ?? owners.farmer ?? owners.hunter ?? null;
}

/**
 * For Slide Cloud orders: resolve `rep` from DWH using hunter (AE) on the first order
 * and farmer (AM) on every later order. When no owner is resolvable (no BQ row, BQ off,
 * or lookup error), store `UNKNOWN_REP` so counts/leaderboards/celebrations attribute it
 * to "Unknown".
 */
export async function enrichSaleWithAccountOwnerFromDwh(
  sale: Sale,
): Promise<Sale> {
  if (sale.meta?.source !== "slide_cloud") return sale;

  let next: Sale = sale;
  if (isBigQueryAccountOwnerConfigured()) {
    const owners = await lookupOwnersForAccount(sale.customer);
    if (owners) {
      const picked = pickOwnerForSale(sale, owners);
      if (picked.name) {
        next = { ...sale, rep: picked.name };
        const wantedKind = ownerKindForSale(sale);
        if (picked.kind !== wantedKind) {
          console.warn(
            `[BigQuery] Account=${JSON.stringify(sale.customer)} missing ${wantedKind} (newBuyingPartner=${sale.meta?.newBuyingPartner}); fell back to ${picked.kind}=${JSON.stringify(picked.name)}`,
          );
        }
      }
    }
  }

  const trimmed = next.rep?.trim() ?? "";
  if (!trimmed) return { ...next, rep: UNKNOWN_REP };
  return next;
}

export interface BigQueryProbeResult {
  ok: boolean;
  error?: string;
  elapsedMs?: number;
}

const PROBE_QUERY_TIMEOUT_MS = 25_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms,
    );
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}

/** Run a trivial read against the configured mart (startup or GET /api/health/bigquery). */
export async function probeBigQueryAccountOwner(): Promise<BigQueryProbeResult> {
  if (!isBigQueryAccountOwnerConfigured()) {
    return {
      ok: false,
      error: "BigQuery account owner not configured (BIGQUERY_PROJECT_ID + BIGQUERY_ACCOUNT_OWNER_TABLE)",
    };
  }
  const t0 = Date.now();
  try {
    const bq = getBigQuery();
    if (!bq) {
      return { ok: false, error: "BigQuery client unavailable" };
    }
    const tableSql = quoteTableRef(
      config.bigqueryAccountOwner.tableRef.trim(),
    );
    const loc = config.bigqueryAccountOwner.location.trim();
    const options: { query: string; location?: string } = {
      query: `SELECT 1 AS ok FROM ${tableSql} LIMIT 1`,
    };
    if (loc) options.location = loc;
    await withTimeout(
      bq.query(options),
      PROBE_QUERY_TIMEOUT_MS,
      "BigQuery probe query",
    );
    return { ok: true, elapsedMs: Date.now() - t0 };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      elapsedMs: Date.now() - t0,
    };
  }
}
