import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useCallback, useRef } from "react";
import type { Rep } from "../../shared/types";
import { playSong, stopAll } from "../lib/audio";
import { JINGLES } from "../lib/jingles";

export function WalkUpBar() {
  const [reps, setReps] = useState<Rep[]>([]);
  const [activeRep, setActiveRep] = useState<Rep | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/reps")
      .then((r) => r.json())
      .then((data) => setReps((data as Rep[]).filter((r) => r.walkupSong)))
      .catch(() => {});
  }, []);

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
            className="fixed bottom-20 left-0 right-0 z-30 flex justify-center pointer-events-none"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <div
              className="flex items-center gap-3 px-5 py-3 rounded-2xl border backdrop-blur-xl shadow-2xl pointer-events-auto"
              style={{
                borderColor: `${activeRep.avatarColor}40`,
                background: `linear-gradient(135deg, ${activeRep.avatarColor}15, rgba(12,14,19,0.9))`,
              }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-black text-white animate-pulse"
                style={{ backgroundColor: activeRep.avatarColor }}
              >
                {activeRep.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="font-display text-lg text-text-primary leading-tight">
                  {activeRep.name}
                </div>
                <div className="text-[11px] text-text-muted">
                  {getSongLabel(activeRep.walkupSong)}
                </div>
              </div>
              <div className="flex items-center gap-1 ml-3">
                {[0, 1, 2, 3, 4].map((i) => (
                  <motion.div
                    key={i}
                    className="w-[3px] rounded-full"
                    style={{ backgroundColor: activeRep.avatarColor }}
                    animate={{
                      height: [8, 18, 8, 14, 8],
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
                className="ml-2 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-all active:scale-90"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                </svg>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rep avatars bar */}
      <div className="fixed bottom-0 left-0 right-0 z-20 pb-3 pt-2 px-4">
        <div className="flex items-center justify-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.2em] text-text-muted mr-2 hidden sm:block">
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
                className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-lg transition-shadow"
                style={{
                  backgroundColor: rep.avatarColor,
                  boxShadow:
                    activeRep?.id === rep.id
                      ? `0 0 20px ${rep.avatarColor}66`
                      : "0 2px 8px rgba(0,0,0,0.3)",
                }}
              >
                {rep.name.charAt(0).toUpperCase()}
              </div>
              {activeRep?.id === rep.id && (
                <motion.div
                  className="absolute -inset-1 rounded-full border-2"
                  style={{ borderColor: rep.avatarColor }}
                  layoutId="active-ring"
                  transition={{ type: "spring", bounce: 0.3 }}
                />
              )}
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-surface-raised text-[10px] text-text-secondary whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-border">
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
