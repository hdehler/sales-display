import { BigQuery } from "@google-cloud/bigquery";
import { config, isBigQueryAccountOwnerConfigured } from "./config.js";
import type { Sale } from "../shared/types.js";

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

class LruCache {
  private readonly map = new Map<string, string>();
  constructor(private readonly max: number) {}

  get(key: string): string | undefined {
    const v = this.map.get(key);
    if (v === undefined) return undefined;
    this.map.delete(key);
    this.map.set(key, v);
    return v;
  }

  set(key: string, value: string): void {
    if (this.map.has(key)) this.map.delete(key);
    else if (this.map.size >= this.max) {
      const first = this.map.keys().next().value;
      if (first !== undefined) this.map.delete(first);
    }
    this.map.set(key, value);
  }
}

let cache: LruCache | null = null;

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

function getCache(): LruCache {
  const max = Math.max(
    1,
    Number.isFinite(config.bigqueryAccountOwner.lookupCacheMax)
      ? config.bigqueryAccountOwner.lookupCacheMax
      : 512,
  );
  if (!cache) cache = new LruCache(max);
  return cache;
}

/**
 * Resolve HubSpot owner display name for an account name (Slide customer string).
 * Uses LOWER(TRIM) match. Returns null if not configured, on error, or no row.
 */
export async function lookupRepForAccount(
  accountName: string,
): Promise<string | null> {
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
  const repCol = assertSafeColumn(b.repColumn.trim(), "owner/rep column");
  const orderCol = assertSafeColumn(
    b.orderByColumn.trim(),
    "order-by column",
  );

  const query = `
    SELECT \`${repCol}\` AS rep_name
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
    const list = rows as { rep_name?: string | null }[];
    if (list.length > 1) {
      console.warn(
        `[BigQuery] Multiple owner rows for account=${JSON.stringify(raw)}; using first after ORDER BY`,
      );
    }
    const row = list[0];
    const name =
      row?.rep_name != null && String(row.rep_name).trim() !== ""
        ? String(row.rep_name).trim()
        : null;
    if (name) getCache().set(key, name);
    else {
      console.warn(
        `[BigQuery] No owner row for account=${JSON.stringify(raw)}`,
      );
    }
    return name;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[BigQuery] lookupRepForAccount failed:", msg);
    return null;
  }
}

/** For Slide Cloud orders, fill `rep` from DWH when configured. */
export async function enrichSaleWithAccountOwnerFromDwh(
  sale: Sale,
): Promise<Sale> {
  if (sale.meta?.source !== "slide_cloud") return sale;
  if (!isBigQueryAccountOwnerConfigured()) return sale;

  const rep = await lookupRepForAccount(sale.customer);
  if (!rep) return sale;
  return { ...sale, rep };
}

export interface BigQueryProbeResult {
  ok: boolean;
  error?: string;
  elapsedMs?: number;
}

/** Run a trivial read against the configured mart (startup or GET /api/health/bigquery). */
export async function probeBigQueryAccountOwner(): Promise<BigQueryProbeResult> {
  if (!isBigQueryAccountOwnerConfigured()) {
    return {
      ok: false,
      error: "BigQuery account owner not configured (BIGQUERY_PROJECT_ID + BIGQUERY_ACCOUNT_OWNER_TABLE)",
    };
  }
  const bq = getBigQuery();
  if (!bq) {
    return { ok: false, error: "BigQuery client unavailable" };
  }
  const t0 = Date.now();
  try {
    const tableSql = quoteTableRef(
      config.bigqueryAccountOwner.tableRef.trim(),
    );
    const loc = config.bigqueryAccountOwner.location.trim();
    const options: { query: string; location?: string } = {
      query: `SELECT 1 AS ok FROM ${tableSql} LIMIT 1`,
    };
    if (loc) options.location = loc;
    await bq.query(options);
    return { ok: true, elapsedMs: Date.now() - t0 };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      elapsedMs: Date.now() - t0,
    };
  }
}
