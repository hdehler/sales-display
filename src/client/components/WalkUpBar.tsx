import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useCallback, useRef } from "react";
import type { Rep } from "../../shared/types";
import { playSong, stopAll } from "../lib/audio";
import { walkupSongDisplayLine } from "./SongSearch";

export function WalkUpBar({ version = 0 }: { version?: number }) {
  const [reps, setReps] = useState<Rep[]>([]);
  const [activeRep, setActiveRep] = useState<Rep | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/reps")
      .then((r) => r.json())
      .then((data) => setReps((data as Rep[]).filter((r) => r.walkupSong)))
      .catch(() => {});
  }, [version]);

  const play = useCallback((rep: Rep, opts?: { closeModal?: boolean }) => {
    if (activeRep?.id === rep.id) {
      stopAll();
      setActiveRep(null);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (opts?.closeModal) setModalOpen(false);
      return;
    }

    playSong(rep.walkupSong!);
    setActiveRep(rep);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setActiveRep(null);
    }, 20_000);
    if (opts?.closeModal) setModalOpen(false);
  }, [activeRep]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen]);

  useEffect(() => {
    if (!modalOpen) setQuery("");
  }, [modalOpen]);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? reps.filter((r) => r.name.toLowerCase().includes(q))
    : reps;

  if (reps.length === 0) return null;

  return (
    <>
      {/* Now-playing banner */}
      <AnimatePresence>
        {activeRep && (
          <motion.div
            className="fixed bottom-24 left-0 right-0 z-40 flex justify-center pointer-events-none px-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <div
              className="flex items-center gap-4 px-6 py-4 rounded-2xl border backdrop-blur-xl shadow-2xl pointer-events-auto max-w-[min(100%,28rem)]"
              style={{
                borderColor: `${activeRep.avatarColor}50`,
                background: `linear-gradient(135deg, ${activeRep.avatarColor}22, rgba(250,251,254,0.96))`,
              }}
            >
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-black text-white animate-pulse shrink-0"
                style={{ backgroundColor: activeRep.avatarColor }}
              >
                {activeRep.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-display text-2xl text-text-primary leading-tight truncate">
                  {activeRep.name}
                </div>
                <div className="text-sm text-text-secondary mt-0.5 truncate">
                  {walkupSongDisplayLine(
                    activeRep.walkupSong,
                    activeRep.walkupSongLabel,
                  )}
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                {[0, 1, 2, 3, 4].map((i) => (
                  <motion.div
                    key={i}
                    className="w-1 rounded-full"
                    style={{ backgroundColor: activeRep.avatarColor }}
                    animate={{
                      height: [10, 24, 10, 18, 10],
                    }}
                    transition={{
                      duration: 0.8,
                      repeat: Infinity,
                      delay: i * 0.12,
                    }}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  stopAll();
                  setActiveRep(null);
                  if (timerRef.current) clearTimeout(timerRef.current);
                }}
                className="shrink-0 w-12 h-12 rounded-full bg-white/10 hover:bg-white/15 flex items-center justify-center text-text-muted hover:text-text-primary transition-all active:scale-90"
                aria-label="Stop"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                </svg>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Trigger — single control; team lives in modal (Tailwind pointer-events-auto: invalid React `pointerEvents` prop did not undo parent none) */}
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 flex justify-center pointer-events-none">
        <motion.button
          type="button"
          onClick={() => setModalOpen(true)}
          className="pointer-events-auto px-8 py-3.5 rounded-2xl border border-border-bright bg-surface-raised/95 backdrop-blur-xl text-sm font-bold uppercase tracking-widest text-accent shadow-lg hover:bg-surface-hover hover:border-accent/40 transition-colors"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Play my song
        </motion.button>
      </div>

      {/* Team picker modal */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            className="fixed inset-0 z-[55] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <button
              type="button"
              aria-label="Close"
              className="absolute inset-0 bg-black/25 backdrop-blur-sm"
              onClick={() => setModalOpen(false)}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="walkup-modal-title"
              className="relative w-full max-w-sm max-h-[min(70vh,520px)] flex flex-col rounded-2xl border border-border-bright bg-surface-raised shadow-2xl overflow-hidden"
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
            >
              <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-border shrink-0">
                <div>
                  <h2
                    id="walkup-modal-title"
                    className="font-display text-xl text-text-primary leading-tight"
                  >
                    Who&apos;s playing?
                  </h2>
                  <p className="text-xs text-text-muted mt-1">
                    {reps.length} with a walk-up · tap to play
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors text-lg shrink-0"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              {reps.length > 5 && (
                <div className="px-4 pt-3 shrink-0">
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by name…"
                    className="w-full px-3 py-2.5 rounded-xl bg-surface border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                  />
                </div>
              )}

              <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-1.5">
                {filtered.length === 0 ? (
                  <div className="text-sm text-text-muted text-center py-8 px-4">
                    No names match &ldquo;{query}&rdquo;.
                  </div>
                ) : (
                  filtered.map((rep) => {
                    const playing = activeRep?.id === rep.id;
                    return (
                      <button
                        key={rep.id}
                        type="button"
                        onClick={() => play(rep, { closeModal: true })}
                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-colors ${
                          playing
                            ? "bg-accent/15 border border-accent/35"
                            : "border border-transparent hover:bg-surface-hover hover:border-border"
                        }`}
                      >
                        <div
                          className="w-11 h-11 rounded-full flex items-center justify-center text-base font-bold text-white shrink-0"
                          style={{ backgroundColor: rep.avatarColor }}
                        >
                          {rep.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-text-primary truncate">
                            {rep.name}
                          </div>
                          <div className="text-xs text-text-muted truncate">
                            {walkupSongDisplayLine(
                              rep.walkupSong,
                              rep.walkupSongLabel,
                            )}
                          </div>
                        </div>
                        <span
                          className={`text-xs font-semibold uppercase tracking-wide shrink-0 px-2 py-1 rounded-md ${
                            playing
                              ? "bg-accent text-on-accent"
                              : "bg-surface text-text-secondary"
                          }`}
                        >
                          {playing ? "■" : "▶"}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
