import { BigQuery } from "@google-cloud/bigquery";
import { readFileSync } from "fs";
import path from "path";
import {
  BIGQUERY_OWNER_COLUMN_DEFAULTS,
  config,
  isBigQueryAccountOwnerConfigured,
} from "./config.js";
import { isSlideOrderMeta, type Sale } from "../shared/types.js";
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

function parseTableRef(ref: string): [string, string, string] {
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
  return [proj, dataset, table];
}

/** Build `proj`.`dataset`.`table` for use in SQL. */
function quoteTableRef(ref: string): string {
  const [proj, dataset, table] = parseTableRef(ref);
  return `\`${proj}\`.\`${dataset}\`.\`${table}\``;
}

/** Hunter = AE (credited on first order). Farmer = AM (credited on every later order). */
export type OwnerKind = "hunter" | "farmer";

export interface AccountOwners {
  /** Resolved AE — hunter column from config. */
  hunter: string | null;
  /** Resolved AM — farmer column from config. */
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

/**
 * Client-side normalization for cache keys — should match the SQL `NORMALIZE … NFKC` path
 * closely (Slack sometimes sends nbsp / odd Unicode in the Account field).
 */
export function normalizeAccountForLookup(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Local testing stand-in for the mart: `BIGQUERY_MOCK_OWNERS_FILE` maps account name →
 * `{ hunter, farmer, legacy }`. Re-read every call so edits apply without a restart.
 * Returns undefined when no mock is configured; an account missing from the file gets
 * empty owners, which exercises the "Unknown" path like a real miss.
 */
function mockOwnersForAccount(raw: string): AccountOwners | undefined {
  const file = config.bigqueryAccountOwner.mockOwnersFile;
  if (!file) return undefined;
  const parsed = JSON.parse(
    readFileSync(path.resolve(file), "utf8"),
  ) as Record<string, Partial<Record<keyof AccountOwners, string>>>;
  const key = normalizeAccountForLookup(raw);
  const hit = Object.entries(parsed).find(
    ([name]) => normalizeAccountForLookup(name) === key,
  )?.[1];
  return {
    hunter: cleanString(hit?.hunter),
    farmer: cleanString(hit?.farmer),
    legacy: cleanString(hit?.legacy),
  };
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
  if (!isSlideOrderMeta(sale.meta)) return "farmer";
  return sale.meta.newBuyingPartner === true ? "hunter" : "farmer";
}

type Row = {
  hunter_name?: string | null;
  farmer_name?: string | null;
  legacy_name?: string | null;
};

function rowToOwners(row: Row | undefined): AccountOwners {
  return {
    hunter: cleanString(row?.hunter_name),
    farmer: cleanString(row?.farmer_name),
    legacy: cleanString(row?.legacy_name),
  };
}

function ownersHasAny(o: AccountOwners): boolean {
  return Boolean(o.hunter || o.farmer || o.legacy);
}

/** BigQuery: normalize account string (NFKC + collapse ASCII spaces), lowercased — matches JS `normalizeAccountForLookup`. */
function sqlNormParam(): string {
  return `LOWER(TRIM(REGEXP_REPLACE(NORMALIZE(@acct, NFKC), r' +', ' ')))`;
}

function sqlNormAcctCol(acctCol: string): string {
  const c = `\`${acctCol}\``;
  return `LOWER(TRIM(REGEXP_REPLACE(NORMALIZE(CAST(${c} AS STRING), NFKC), r' +', ' ')))`;
}

/** Owner columns that actually exist on the mart (null = select NULL for that role). */
interface OwnerColumns {
  hunter: string | null;
  farmer: string | null;
  legacy: string | null;
  /** Configured columns the mart doesn't have (surfaced by the health probe). */
  missing: string[];
}

let ownerColumnsPromise: Promise<OwnerColumns> | null = null;

/**
 * Check configured owner columns against the mart schema. A single unknown column makes
 * BigQuery reject the whole query, which silently turned every order into "Unknown" when the
 * DWH renamed `hubspot_owner_resolved_name`. Missing columns fall back to the current mart
 * default for that role, else are skipped. Account / order-by columns are required.
 */
async function resolveOwnerColumns(bq: BigQuery): Promise<OwnerColumns> {
  const b = config.bigqueryAccountOwner;
  const configured = {
    hunter: b.hunterColumn.trim(),
    farmer: b.farmerColumn.trim(),
    legacy: b.repColumn.trim(),
  };

  const [proj, dataset, table] = parseTableRef(b.tableRef.trim());
  const [meta] = await bq
    .dataset(dataset, { projectId: proj })
    .table(table)
    .getMetadata();
  const fields: { name?: string }[] = meta?.schema?.fields ?? [];
  const have = new Set(fields.map((f) => (f.name ?? "").toLowerCase()));

  for (const [label, col] of [
    ["BIGQUERY_ACCOUNT_NAME_COLUMN", b.accountColumn.trim()],
    ["BIGQUERY_ACCOUNT_OWNER_ORDER_BY", b.orderByColumn.trim()],
  ] as const) {
    if (!have.has(col.toLowerCase())) {
      throw new Error(`${label}=${col} is not a column of ${b.tableRef}`);
    }
  }

  const out: OwnerColumns = { hunter: null, farmer: null, legacy: null, missing: [] };
  for (const role of ["hunter", "farmer", "legacy"] as const) {
    const col = configured[role];
    if (!col) continue;
    if (have.has(col.toLowerCase())) {
      out[role] = assertSafeColumn(col, `${role} column`);
      continue;
    }
    out.missing.push(col);
    const fallback = BIGQUERY_OWNER_COLUMN_DEFAULTS[role];
    if (have.has(fallback)) {
      out[role] = fallback;
      console.warn(
        `[BigQuery] ${role} column ${JSON.stringify(col)} not in ${b.tableRef}; using ${JSON.stringify(fallback)}. Fix the BIGQUERY_* override in .env.`,
      );
    } else {
      console.warn(
        `[BigQuery] ${role} column ${JSON.stringify(col)} not in ${b.tableRef}; skipping it.`,
      );
    }
  }
  return out;
}

/** Cached per process; a failed schema read is retried on the next lookup. */
function getOwnerColumns(bq: BigQuery): Promise<OwnerColumns> {
  if (!ownerColumnsPromise) {
    ownerColumnsPromise = resolveOwnerColumns(bq).catch((e) => {
      ownerColumnsPromise = null;
      throw e;
    });
  }
  return ownerColumnsPromise;
}

function buildSelectParts(cols: OwnerColumns): string[] {
  const part = (col: string | null, alias: string): string =>
    col ? `\`${col}\` AS ${alias}` : `CAST(NULL AS STRING) AS ${alias}`;
  return [
    part(cols.hunter, "hunter_name"),
    part(cols.farmer, "farmer_name"),
    part(cols.legacy, "legacy_name"),
  ];
}

function buildWhereExact(acctCol: string): string {
  return `${sqlNormAcctCol(acctCol)} = ${sqlNormParam()}`;
}

function buildWhereFuzzy(acctCol: string): string {
  const col = sqlNormAcctCol(acctCol);
  const p = sqlNormParam();
  return `(
  CONTAINS_SUBSTR(${col}, ${p})
  OR CONTAINS_SUBSTR(${p}, ${col})
)
AND LENGTH(${p}) >= @fuzzyMinLen`;
}

async function runOwnerQuery(
  bq: BigQuery,
  whereClause: string,
  params: { acct: string; fuzzyMinLen?: number },
): Promise<Row[]> {
  const b = config.bigqueryAccountOwner;
  const tableSql = quoteTableRef(b.tableRef.trim());
  const acctCol = assertSafeColumn(b.accountColumn.trim(), "account column");
  const orderCol = assertSafeColumn(b.orderByColumn.trim(), "order-by column");
  const selectParts = buildSelectParts(await getOwnerColumns(bq));

  const query = `
    SELECT ${selectParts.join(", ")}
    FROM ${tableSql}
    WHERE ${whereClause}
    ORDER BY \`${orderCol}\`
    LIMIT 2
  `;

  const loc = b.location.trim();
  const options: {
    query: string;
    params: Record<string, string | number>;
    location?: string;
  } = {
    query,
    params:
      params.fuzzyMinLen !== undefined
        ? {
            acct: params.acct,
            fuzzyMinLen: params.fuzzyMinLen,
          }
        : { acct: params.acct },
  };
  if (loc) options.location = loc;

  const [rows] = await bq.query(options);
  return rows as Row[];
}

export interface LookupOwnersOptions {
  /** Bypass LRU cache (used by debug endpoint). */
  skipCache?: boolean;
}

/**
 * Single round-trip lookup that returns hunter, farmer, and legacy owner columns
 * for an account. Returns null when BigQuery is not configured or the lookup errors.
 */
export async function lookupOwnersForAccount(
  accountName: string,
  options?: LookupOwnersOptions,
): Promise<AccountOwners | null> {
  const raw = accountName?.trim();
  if (!raw || raw === "Unknown account") return null;

  const mock = mockOwnersForAccount(raw);
  if (mock) return mock;

  const bq = getBigQuery();
  if (!bq) return null;

  const key = normalizeAccountForLookup(raw);
  if (!options?.skipCache) {
    const hit = getCache().get(key);
    if (hit !== undefined) return hit;
  }

  const b = config.bigqueryAccountOwner;
  const acctCol = assertSafeColumn(b.accountColumn.trim(), "account column");
  const fuzzyMin = Math.max(
    2,
    Number.isFinite(b.fuzzyAccountMatchMinLen) ? b.fuzzyAccountMatchMinLen : 5,
  );

  try {
    let list = await runOwnerQuery(bq, buildWhereExact(acctCol), { acct: raw });

    let matchPhase: "exact" | "fuzzy" = "exact";
    if (
      list.length === 0 &&
      b.fuzzyAccountMatch &&
      key.length >= fuzzyMin
    ) {
      matchPhase = "fuzzy";
      list = await runOwnerQuery(bq, buildWhereFuzzy(acctCol), {
        acct: raw,
        fuzzyMinLen: fuzzyMin,
      });
    }

    if (list.length > 1) {
      console.warn(
        `[BigQuery] Multiple owner rows for account=${JSON.stringify(raw)} (${matchPhase}); using first after ORDER BY`,
      );
    }

    const row = list[0];
    const owners = rowToOwners(row);

    if (!ownersHasAny(owners)) {
      console.warn(
        `[BigQuery] No matching row / empty owner columns for account=${JSON.stringify(raw)} ` +
          `(normalized=${JSON.stringify(key)}). Check BIGQUERY_ACCOUNT_NAME_COLUMN vs Slide "Account" text; try GET /api/health/bigquery/lookup?account=…`,
      );
    } else if (!options?.skipCache) {
      getCache().set(key, owners);
    }

    return owners;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(
      `[BigQuery] lookupOwnersForAccount failed for account=${JSON.stringify(raw)}:`,
      msg,
    );
    return null;
  }
}

export interface AccountOwnerLookupDebugResult {
  configured: boolean;
  accountRaw: string;
  accountNormalized: string;
  /** Which predicate produced rows (if any). */
  matchPhase: "exact" | "fuzzy" | "none";
  rowCount: number;
  owners: AccountOwners | null;
  /** Populated when the query throws (often an invalid column name in .env). */
  bigqueryError?: string;
  /** Answered from BIGQUERY_MOCK_OWNERS_FILE, not BigQuery. */
  mock?: boolean;
}

/**
 * Runs the same lookup as production but skips cache and returns structured diagnostics.
 * Call from the Pi: `curl -s 'http://localhost:3000/api/health/bigquery/lookup?account=Grissom%20Technology'`
 */
export async function debugAccountOwnerLookup(
  accountName: string,
): Promise<AccountOwnerLookupDebugResult> {
  const raw = accountName?.trim() ?? "";
  const norm = normalizeAccountForLookup(raw);
  const empty: AccountOwnerLookupDebugResult = {
    configured: isBigQueryAccountOwnerConfigured(),
    accountRaw: raw,
    accountNormalized: norm,
    matchPhase: "none",
    rowCount: 0,
    owners: null,
  };

  if (!isBigQueryAccountOwnerConfigured()) {
    return empty;
  }

  const mock = raw ? mockOwnersForAccount(raw) : undefined;
  if (mock) {
    return {
      ...empty,
      matchPhase: ownersHasAny(mock) ? "exact" : "none",
      rowCount: ownersHasAny(mock) ? 1 : 0,
      owners: ownersHasAny(mock) ? mock : null,
      mock: true,
    };
  }

  const bq = getBigQuery();
  if (!bq || !raw || raw === "Unknown account") {
    return empty;
  }

  const b = config.bigqueryAccountOwner;
  const acctCol = assertSafeColumn(b.accountColumn.trim(), "account column");
  const fuzzyMin = Math.max(
    2,
    Number.isFinite(b.fuzzyAccountMatchMinLen) ? b.fuzzyAccountMatchMinLen : 5,
  );

  try {
    let list = await runOwnerQuery(bq, buildWhereExact(acctCol), { acct: raw });
    let phase: "exact" | "fuzzy" = "exact";
    if (
      list.length === 0 &&
      b.fuzzyAccountMatch &&
      norm.length >= fuzzyMin
    ) {
      phase = "fuzzy";
      list = await runOwnerQuery(bq, buildWhereFuzzy(acctCol), {
        acct: raw,
        fuzzyMinLen: fuzzyMin,
      });
    }

    const owners = rowToOwners(list[0]);
    return {
      configured: true,
      accountRaw: raw,
      accountNormalized: norm,
      matchPhase: list.length > 0 ? phase : "none",
      rowCount: list.length,
      owners: ownersHasAny(owners) ? owners : null,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ...empty,
      bigqueryError: msg,
    };
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
  /** Configured owner columns the mart doesn't have (lookups fall back or skip them). */
  missingColumns?: string[];
  /** Lookups use BIGQUERY_MOCK_OWNERS_FILE instead of BigQuery. */
  mock?: boolean;
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

/** Read the configured mart and check its owner columns (startup or GET /api/health/bigquery). */
export async function probeBigQueryAccountOwner(): Promise<BigQueryProbeResult> {
  if (!isBigQueryAccountOwnerConfigured()) {
    return {
      ok: false,
      error: "BigQuery account owner not configured (BIGQUERY_PROJECT_ID + BIGQUERY_ACCOUNT_OWNER_TABLE)",
    };
  }
  const mockFile = config.bigqueryAccountOwner.mockOwnersFile;
  if (mockFile) {
    try {
      mockOwnersForAccount("");
      return { ok: true, mock: true, elapsedMs: 0 };
    } catch (e) {
      return {
        ok: false,
        mock: true,
        error: `BIGQUERY_MOCK_OWNERS_FILE=${mockFile}: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
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
    /** Re-read the schema so a DWH column change shows up without a restart. */
    ownerColumnsPromise = null;
    const cols = await withTimeout(
      getOwnerColumns(bq),
      PROBE_QUERY_TIMEOUT_MS,
      "BigQuery schema read",
    );
    return {
      ok: true,
      elapsedMs: Date.now() - t0,
      ...(cols.missing.length > 0 ? { missingColumns: cols.missing } : {}),
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      elapsedMs: Date.now() - t0,
    };
  }
}
