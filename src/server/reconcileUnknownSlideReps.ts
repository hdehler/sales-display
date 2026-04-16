import { lookupRepForAccount } from "./bigqueryAccountOwner.js";
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

  const byCustomer = new Map<string, number[]>();
  for (const { id, customer } of rows) {
    const k = customer.trim();
    if (!k) continue;
    if (!byCustomer.has(k)) byCustomer.set(k, []);
    byCustomer.get(k)!.push(id);
  }

  const delay = options?.delayMsBetweenAccounts ?? 80;
  let rowsUpdated = 0;
  let accountsChecked = 0;

  const entries = [...byCustomer.entries()];
  for (let i = 0; i < entries.length; i++) {
    const [customer, ids] = entries[i]!;
    accountsChecked += 1;
    const name = await lookupRepForAccount(customer);
    if (name) {
      rowsUpdated += updateSalesRepForIds(ids, name);
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
