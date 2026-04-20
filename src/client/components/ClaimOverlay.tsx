import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useCallback } from "react";
import type { Rep, CelebrationEvent } from "../../shared/types";
import { isUnresolvedRepName } from "../../shared/rep";

const CLAIM_WINDOW_MS = 30_000;

/** Show manual claim only when we could not resolve a rep (e.g. Slide + no DWH owner). */
function needsRepClaimFromCelebration(event: CelebrationEvent): boolean {
  if (event.slidePack?.sales?.length) {
    return event.slidePack.sales.some((s) => isUnresolvedRepName(s.rep));
  }
  return isUnresolvedRepName(event.sale?.rep);
}

interface ClaimOverlayProps {
  lastCelebration: CelebrationEvent | null;
}

export function ClaimOverlay({ lastCelebration }: ClaimOverlayProps) {
  const [reps, setReps] = useState<Rep[]>([]);
  const [visible, setVisible] = useState(false);
  const [claimableSale, setClaimableSale] = useState<{
    saleId: number;
    account: string;
    product: string;
  } | null>(null);
  const [claimed, setClaimed] = useState(false);

  useEffect(() => {
    fetch("/api/reps")
      .then((r) => r.json())
      .then((data) => setReps(data as Rep[]))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!lastCelebration) return;
    if (lastCelebration.type === "walkup") return;

    if (!needsRepClaimFromCelebration(lastCelebration)) return;

    const sale = lastCelebration.slidePack
      ? lastCelebration.slidePack.sales[0]
      : lastCelebration.sale;

    if (!sale?.id) return;

    setClaimableSale({
      saleId: sale.id,
      account: sale.customer,
      product: sale.product || "",
    });
    setClaimed(false);
    setVisible(true);

    const timer = setTimeout(() => setVisible(false), CLAIM_WINDOW_MS);
    return () => clearTimeout(timer);
  }, [lastCelebration]);

  const handleClaim = useCallback(
    async (repId: number) => {
      if (!claimableSale || claimed) return;
      setClaimed(true);
      try {
        await fetch(`/api/sales/${claimableSale.saleId}/claim`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ repId }),
        });
      } catch (e) {
        console.error("[ClaimOverlay] Claim failed:", e);
        setClaimed(false);
      }
    },
    [claimableSale, claimed],
  );

  if (reps.length === 0) return null;

  return (
    <AnimatePresence>
      {visible && claimableSale && !claimed && (
        <motion.div
          className="fixed bottom-0 left-0 right-0 z-40 p-6"
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
        >
          <div className="max-w-4xl mx-auto rounded-2xl border border-border-bright bg-surface-raised/95 backdrop-blur-xl p-6 shadow-2xl ring-1 ring-white/[0.05]">
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="text-sm font-bold uppercase tracking-widest text-accent mb-1">
                  Who sold it?
                </div>
                <div className="text-base text-text-secondary">
                  {claimableSale.account}
                  {claimableSale.product && (
                    <span className="text-text-muted">
                      {" "}
                      · {claimableSale.product}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setVisible(false)}
                className="modal-quiet-btn text-text-muted transition-colors text-base px-4 py-2 rounded-lg active:bg-surface-hover/60"
              >
                Dismiss
              </button>
            </div>

            <div className="flex flex-wrap gap-3">
              {reps.map((rep, i) => (
                <motion.button
                  key={rep.id}
                  onClick={() => handleClaim(rep.id)}
                  className="rep-pick-tile flex items-center gap-3 px-5 py-3.5 rounded-xl border border-border bg-surface-hover transition-all active:scale-95 active:bg-accent-soft/80"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <span
                    className="w-10 h-10 rounded-full flex items-center justify-center text-base font-bold text-white flex-shrink-0"
                    style={{ backgroundColor: rep.avatarColor }}
                  >
                    {rep.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="text-base font-semibold text-text-primary">
                    {rep.name}
                  </span>
                </motion.button>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
