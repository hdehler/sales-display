import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useCallback, useRef } from "react";
import type { Rep } from "../../shared/types";
import { playSong, stopAll } from "../lib/audio";
import { JINGLES } from "../lib/jingles";

export function WalkUpBar({ version = 0 }: { version?: number }) {
  const [reps, setReps] = useState<Rep[]>([]);
  const [activeRep, setActiveRep] = useState<Rep | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/reps")
      .then((r) => r.json())
      .then((data) => setReps((data as Rep[]).filter((r) => r.walkupSong)))
      .catch(() => {});
  }, [version]);

  const play = useCallback((rep: Rep) => {
    if (activeRep?.id === rep.id) {
      stopAll();
      setActiveRep(null);
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    playSong(rep.walkupSong!);
    setActiveRep(rep);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setActiveRep(null);
    }, 20_000);
  }, [activeRep]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (reps.length === 0) return null;

  return (
    <>
      {/* Now-playing banner */}
      <AnimatePresence>
        {activeRep && (
          <motion.div
            className="fixed bottom-28 left-0 right-0 z-30 flex justify-center pointer-events-none"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <div
              className="flex items-center gap-4 px-6 py-4 rounded-2xl border backdrop-blur-xl shadow-2xl pointer-events-auto"
              style={{
                borderColor: `${activeRep.avatarColor}40`,
                background: `linear-gradient(135deg, ${activeRep.avatarColor}15, rgba(12,14,19,0.9))`,
              }}
            >
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-black text-white animate-pulse"
                style={{ backgroundColor: activeRep.avatarColor }}
              >
                {activeRep.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="font-display text-2xl text-white leading-tight">
                  {activeRep.name}
                </div>
                <div className="text-sm text-text-secondary mt-0.5">
                  {getSongLabel(activeRep.walkupSong)}
                </div>
              </div>
              <div className="flex items-center gap-1.5 ml-4">
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
                onClick={() => {
                  stopAll();
                  setActiveRep(null);
                  if (timerRef.current) clearTimeout(timerRef.current);
                }}
                className="ml-3 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-all active:scale-90"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                </svg>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rep avatars bar */}
      <div className="fixed bottom-0 left-0 right-0 z-20 pb-4 pt-3 px-6">
        <div className="flex items-center justify-center gap-4">
          <span className="text-sm font-semibold uppercase tracking-widest text-text-muted mr-2">
            Play my song
          </span>
          {reps.map((rep) => (
            <motion.button
              key={rep.id}
              onClick={() => play(rep)}
              className={`relative group transition-all active:scale-90 ${
                activeRep?.id === rep.id ? "scale-110" : ""
              }`}
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
            >
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-white shadow-lg transition-shadow"
                style={{
                  backgroundColor: rep.avatarColor,
                  boxShadow:
                    activeRep?.id === rep.id
                      ? `0 0 24px ${rep.avatarColor}66`
                      : "0 2px 8px rgba(0,0,0,0.3)",
                }}
              >
                {rep.name.charAt(0).toUpperCase()}
              </div>
              {activeRep?.id === rep.id && (
                <motion.div
                  className="absolute -inset-1.5 rounded-full border-2"
                  style={{ borderColor: rep.avatarColor }}
                  layoutId="active-ring"
                  transition={{ type: "spring", bounce: 0.3 }}
                />
              )}
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-3 py-1 rounded-lg bg-surface-raised text-xs text-text-secondary whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-border font-medium">
                {rep.name}
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </>
  );
}

function getSongLabel(song: string | null): string {
  if (!song) return "";
  const jingle = JINGLES.find((j) => j.id === song);
  if (jingle) return jingle.name;
  if (song.startsWith("http")) return "Now playing";
  return song;
}
