import {
  lookupOwnersForAccount,
  type OwnerKind,
} from "./bigqueryAccountOwner.js";
import { isBigQueryAccountOwnerConfigured } from "./config.js";
import {
  listSlideSalesWithUnknownRep,
  updateSalesRepForIds,
} from "./db.js";

export interface ReconcileUnknownSlideRepsResult {
  /** Rows in DB still Unknown / empty rep */
  candidateRows: number;
  /** Distinct accounts checked against BigQuery */
  accountsChecked: number;
  /** Sale rows updated with a resolved owner name */
  rowsUpdated: number;
}

/**
 * For each distinct account on Slide orders stored as Unknown, re-query the DWH and
 * update `rep` when an owner now exists (late HubSpot assignment).
 *
 * Owner attribution mirrors the live ingestion path:
 *   - rows where the parser flagged `newBuyingPartner` get the AE (hunter / `account_executive`)
 *   - all other rows get the AM (farmer / `account_manager`)
 *   - missing column falls back to the other side, then to the legacy single-owner column
 *
 * Skips rows with `claimed_by` set — manual claim keeps precedence for attribution logic.
 */
export async function reconcileUnknownSlideRepsFromDwh(options?: {
  /** Pause between BigQuery lookups (ms) to limit rate */
  delayMsBetweenAccounts?: number;
}): Promise<ReconcileUnknownSlideRepsResult> {
  const empty: ReconcileUnknownSlideRepsResult = {
    candidateRows: 0,
    accountsChecked: 0,
    rowsUpdated: 0,
  };
  if (!isBigQueryAccountOwnerConfigured()) return empty;

  const rows = listSlideSalesWithUnknownRep();
  if (rows.length === 0) return empty;

  /** Group rows by account so we make one BQ lookup per account, then split ids by kind. */
  type Buckets = { hunter: number[]; farmer: number[] };
  const byCustomer = new Map<string, Buckets>();
  for (const { id, customer, newBuyingPartner } of rows) {
    const k = customer.trim();
    if (!k) continue;
    if (!byCustomer.has(k)) byCustomer.set(k, { hunter: [], farmer: [] });
    /** Default unknown nbp → farmer (mirrors live `ownerKindForSale` policy). */
    const kind: OwnerKind = newBuyingPartner === true ? "hunter" : "farmer";
    byCustomer.get(k)![kind].push(id);
  }

  const delay = options?.delayMsBetweenAccounts ?? 80;
  let rowsUpdated = 0;
  let accountsChecked = 0;

  const entries = [...byCustomer.entries()];
  for (let i = 0; i < entries.length; i++) {
    const [customer, buckets] = entries[i]!;
    accountsChecked += 1;
    const owners = await lookupOwnersForAccount(customer);
    if (owners) {
      const hunterName =
        owners.hunter ?? owners.farmer ?? owners.legacy ?? null;
      const farmerName =
        owners.farmer ?? owners.legacy ?? owners.hunter ?? null;
      if (hunterName && buckets.hunter.length > 0) {
        rowsUpdated += updateSalesRepForIds(buckets.hunter, hunterName);
      }
      if (farmerName && buckets.farmer.length > 0) {
        rowsUpdated += updateSalesRepForIds(buckets.farmer, farmerName);
      }
    }
    if (delay > 0 && i < entries.length - 1) {
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  return {
    candidateRows: rows.length,
    accountsChecked,
    rowsUpdated,
  };
}
