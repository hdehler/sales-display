import { motion } from "framer-motion";
import { useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import type { CelebrationEvent } from "../../shared/types";

function playSound() {
  const audio = new Audio("/sounds/celebration.mp3");
  audio.play().catch(() => playGeneratedChime());
}

function playGeneratedChime() {
  try {
    const ctx = new AudioContext();
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.25, ctx.currentTime + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(
        0.01,
        ctx.currentTime + i * 0.15 + 0.5,
      );
      osc.start(ctx.currentTime + i * 0.15);
      osc.stop(ctx.currentTime + i * 0.15 + 0.5);
    });
  } catch {
    /* no audio context */
  }
}

function fireConfetti() {
  const gold = ["#e2a336", "#f5c842", "#d4890f"];
  const mixed = [...gold, "#34d399", "#60a5fa"];

  confetti({
    particleCount: 60,
    angle: 60,
    spread: 55,
    origin: { x: 0, y: 0.7 },
    colors: mixed,
  });
  confetti({
    particleCount: 60,
    angle: 120,
    spread: 55,
    origin: { x: 1, y: 0.7 },
    colors: mixed,
  });
}

export function Celebration({ event }: { event: CelebrationEvent }) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(
    undefined,
  );

  const pack = event.slidePack;

  useEffect(() => {
    playSound();
    fireConfetti();

    const end = Date.now() + Math.min(event.duration * 1000, 15000);
    intervalRef.current = setInterval(() => {
      if (Date.now() > end) {
        clearInterval(intervalRef.current);
        return;
      }
      fireConfetti();
    }, 900);

    return () => {
      if (intervalRef.current !== undefined)
        clearInterval(intervalRef.current);
    };
  }, [event]);

  const account = pack ? pack.account : event.sale.customer;
  const isSlide = pack
    ? true
    : event.sale.meta?.source === "slide_cloud";
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

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        style={{
          background:
            "radial-gradient(ellipse at 50% 40%, rgba(226,163,54,0.12) 0%, rgba(12,14,19,0.98) 55%, rgba(12,14,19,1) 100%)",
        }}
      />

      {/* Central card */}
      <motion.div
        className="relative z-10 text-center px-16 py-12 max-w-[90vw]"
        initial={{ scale: 0.85, y: 40, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: "spring", bounce: 0.35, duration: 0.7 }}
      >
        {/* Overline label */}
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

        {/* Account name — hero */}
        <motion.h1
          className="font-display text-5xl md:text-7xl text-text-primary leading-[1.1] mb-5"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
        >
          {account}
        </motion.h1>

        {/* Product / device */}
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

        {/* Rep (non-Slide only) */}
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

        {/* Milestone / message */}
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
