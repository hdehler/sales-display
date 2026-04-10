import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useCallback } from "react";
import type { Rep, CelebrationEvent } from "../../shared/types";

const CLAIM_WINDOW_MS = 30_000;

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
          className="fixed bottom-0 left-0 right-0 z-40 p-4"
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
        >
          <div className="max-w-4xl mx-auto rounded-2xl border border-border-bright bg-surface-raised/95 backdrop-blur-xl p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.15em] text-accent mb-1">
                  Who sold it?
                </div>
                <div className="text-sm text-text-secondary">
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
                className="text-text-muted hover:text-text-secondary transition-colors text-sm px-2"
              >
                Dismiss
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {reps.map((rep, i) => (
                <motion.button
                  key={rep.id}
                  onClick={() => handleClaim(rep.id)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border hover:border-accent/40 bg-surface-hover hover:bg-accent-soft transition-all active:scale-95"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <span
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ backgroundColor: rep.avatarColor }}
                  >
                    {rep.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="text-sm font-medium text-text-primary">
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
