import { motion } from "framer-motion";
import { useEffect, useRef, useCallback } from "react";
import confetti from "canvas-confetti";
import type { CelebrationEvent } from "../../shared/types";
import { playSong, stopAll } from "../lib/audio";
import { LogoConfetti } from "./LogoConfetti";

function fireConfetti(isWalkup: boolean) {
  const gold = ["#e2a336", "#f5c842", "#d4890f"];
  const colors = isWalkup
    ? [...gold, "#ff6b6b", "#a855f7", "#fff"]
    : [...gold, "#34d399", "#60a5fa"];

  confetti({
    particleCount: isWalkup ? 100 : 60,
    angle: 60,
    spread: isWalkup ? 70 : 55,
    origin: { x: 0, y: 0.7 },
    colors,
  });
  confetti({
    particleCount: isWalkup ? 100 : 60,
    angle: 120,
    spread: isWalkup ? 70 : 55,
    origin: { x: 1, y: 0.7 },
    colors,
  });
}

interface CelebrationProps {
  event: CelebrationEvent;
  onStop?: () => void;
}

export function Celebration({ event, onStop }: CelebrationProps) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(
    undefined,
  );

  const isWalkup = event.type === "walkup";
  const pack = event.slidePack;

  useEffect(() => {
    const song = event.jingleId || event.songUrl || "";
    playSong(song);
    fireConfetti(isWalkup);

    const end = Date.now() + Math.min(event.duration * 1000, 15000);
    intervalRef.current = setInterval(() => {
      if (Date.now() > end) {
        clearInterval(intervalRef.current);
        return;
      }
      fireConfetti(isWalkup);
    }, isWalkup ? 700 : 900);

    return () => {
      if (intervalRef.current !== undefined)
        clearInterval(intervalRef.current);
    };
  }, [event]);

  const handleStop = useCallback(() => {
    stopAll();
    onStop?.();
  }, [onStop]);

  const account = pack ? pack.account : event.sale.customer;
  const isSlide = pack ? true : event.sale.meta?.source === "slide_cloud";
  const count = pack ? pack.count : 1;
  const single = count === 1;

  const products = pack
    ? pack.sales
        .map((s) => s.product)
        .filter(Boolean)
        .filter((p, idx, a) => a.indexOf(p) === idx)
        .slice(0, 4)
    : event.sale.product
      ? [event.sale.product]
      : [];

  const backdropGradient = isWalkup
    ? "radial-gradient(ellipse at 50% 40%, rgba(168,85,247,0.15) 0%, rgba(12,14,19,0.98) 55%, rgba(12,14,19,1) 100%)"
    : "radial-gradient(ellipse at 50% 40%, rgba(226,163,54,0.12) 0%, rgba(12,14,19,0.98) 55%, rgba(12,14,19,1) 100%)";

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        style={{ background: backdropGradient }}
      />

      {/* Logo confetti */}
      <LogoConfetti count={isWalkup ? 24 : 16} />

      {/* Stop button — always visible, top-right */}
      <motion.button
        onClick={handleStop}
        className="fixed top-6 right-6 z-[60] flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 text-white/70 hover:text-white hover:bg-white/20 transition-all active:scale-95"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <rect x="4" y="4" width="16" height="16" rx="2" />
        </svg>
        <span className="text-sm font-medium">Stop</span>
      </motion.button>

      <motion.div
        className="relative z-10 text-center px-16 py-12 max-w-[90vw]"
        initial={{ scale: 0.85, y: 40, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: "spring", bounce: 0.35, duration: 0.7 }}
      >
        {/* Walk-up: rep avatar + name hero */}
        {isWalkup && event.rep && (
          <>
            <motion.div
              className="mb-6 flex justify-center"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", bounce: 0.5, duration: 0.6 }}
            >
              <div
                className="w-24 h-24 rounded-full flex items-center justify-center text-4xl font-black text-white shadow-2xl"
                style={{
                  background: `linear-gradient(135deg, ${event.rep.avatarColor || "#e2a336"}, ${event.rep.avatarColor || "#e2a336"}88)`,
                  boxShadow: `0 0 60px ${event.rep.avatarColor || "#e2a336"}44`,
                }}
              >
                {event.rep.name.charAt(0).toUpperCase()}
              </div>
            </motion.div>

            <motion.h1
              className="font-display text-6xl md:text-8xl text-text-primary leading-[1] mb-4"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5 }}
            >
              {event.rep.name}
            </motion.h1>

            <motion.div
              className="mb-6"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <span className="inline-block px-4 py-1.5 rounded-full border border-purple-400/30 bg-purple-500/10 text-purple-300 text-xs font-semibold uppercase tracking-[0.2em]">
                Closed it
              </span>
            </motion.div>

            <motion.div
              className="text-2xl md:text-3xl font-display text-text-secondary mb-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35 }}
            >
              {account}
            </motion.div>

            {products.length > 0 && (
              <motion.div
                className="text-base text-text-muted"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.45 }}
              >
                {products.join(" · ")}
              </motion.div>
            )}
          </>
        )}

        {/* Standard celebration (not walk-up) */}
        {!isWalkup && (
          <>
            <motion.div
              className="mb-6"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <span className="inline-block px-4 py-1.5 rounded-full border border-accent/30 bg-accent-soft text-accent text-xs font-semibold uppercase tracking-[0.2em]">
                {isSlide
                  ? single
                    ? "New order"
                    : `${count} new orders`
                  : "New sale"}
              </span>
            </motion.div>

            <motion.h1
              className="font-display text-5xl md:text-7xl text-text-primary leading-[1.1] mb-5"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.5 }}
            >
              {account}
            </motion.h1>

            {products.length > 0 && (
              <motion.div
                className="text-lg md:text-xl text-text-secondary mb-6 max-w-3xl mx-auto"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35 }}
              >
                {products.join(" · ")}
              </motion.div>
            )}

            {!isSlide && event.sale.rep.trim() && (
              <motion.div
                className="text-base text-text-secondary mb-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                {event.sale.rep}
              </motion.div>
            )}
          </>
        )}

        {event.message && (
          <motion.div
            className="mt-4 inline-block px-5 py-2 rounded-lg bg-accent/10 border border-accent/20 text-accent font-semibold text-base"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            {event.message}
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}
