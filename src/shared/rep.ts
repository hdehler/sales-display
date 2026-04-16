/** Stored on Slide sales when Slack/DWH cannot attribute an owner. */
export const UNKNOWN_REP = "Unknown" as const;

export function isUnresolvedRepName(rep: string | undefined | null): boolean {
  const t = rep?.trim() ?? "";
  return t === "" || t === UNKNOWN_REP;
}
