import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import type { Rep } from "../../shared/types";
import { UNKNOWN_REP } from "../../shared/rep";

export interface AssignRepContext {
  saleIds: number[];
  account: string;
  product: string;
}

interface AssignRepPanelProps {
  context: AssignRepContext | null;
  onClose: () => void;
}

/**
 * Full-screen dim + center card: pick a rep to attribute Unknown orders (same pattern as live claim).
 */
export function AssignRepPanel({ context, onClose }: AssignRepPanelProps) {
  const [reps, setReps] = useState<Rep[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!context) return;
    void fetch("/api/reps")
      .then((r) => r.json())
      .then((data) => setReps(data as Rep[]))
      .catch(() => setReps([]));
  }, [context]);

  const handlePick = useCallback(
    async (repId: number) => {
      if (!context || submitting) return;
      setSubmitting(true);
      try {
        const r = await fetch("/api/sales/assign-rep", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ saleIds: context.saleIds, repId }),
        });
        if (r.ok) onClose();
      } catch (e) {
        console.error("[AssignRepPanel]", e);
      } finally {
        setSubmitting(false);
      }
    },
    [context, submitting, onClose],
  );

  const open = Boolean(context && context.saleIds.length > 0);

  return (
    <AnimatePresence>
      {open && context && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/55 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="assign-rep-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !submitting) onClose();
          }}
        >
          <motion.div
            className="w-full max-w-lg rounded-2xl border border-border-bright bg-surface-raised/98 shadow-2xl ring-1 ring-white/[0.06] p-6 max-h-[90vh] overflow-y-auto"
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: "spring", bounce: 0.2, duration: 0.45 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-5">
              <div className="min-w-0">
                <h2
                  id="assign-rep-title"
                  className="text-sm font-bold uppercase tracking-widest text-accent mb-2"
                >
                  Assign rep
                </h2>
                <p className="text-sm text-text-secondary leading-snug">
                  <span className="font-medium text-text-primary">
                    {context.account}
                  </span>
                  {context.product ? (
                    <span className="text-text-muted">
                      {" "}
                      · {context.product}
                    </span>
                  ) : null}
                </p>
                <p className="text-xs text-text-muted mt-2">
                  Currently <span className="text-accent/90 font-medium">{UNKNOWN_REP}</span>
                  {context.saleIds.length > 1 ? (
                    <span className="tabular-nums">
                      {" "}
                      · {context.saleIds.length} order rows
                    </span>
                  ) : null}
                </p>
              </div>
              <button
                type="button"
                onClick={() => !submitting && onClose()}
                className="shrink-0 text-text-muted hover:text-text-secondary transition-colors text-sm px-3 py-2 rounded-lg hover:bg-surface-hover"
              >
                Close
              </button>
            </div>

            {reps.length === 0 ? (
              <p className="text-sm text-text-muted py-6 text-center">
                No team members yet — open Team to add reps.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2.5">
                {reps.map((rep, i) => (
                  <motion.button
                    key={rep.id}
                    type="button"
                    disabled={submitting}
                    onClick={() => handlePick(rep.id)}
                    className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-border hover:border-accent/40 bg-surface-hover hover:bg-accent-soft transition-all active:scale-[0.98] disabled:opacity-50"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <span
                      className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                      style={{ backgroundColor: rep.avatarColor }}
                    >
                      {rep.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="text-sm font-semibold text-text-primary">
                      {rep.name}
                    </span>
                  </motion.button>
                ))}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
