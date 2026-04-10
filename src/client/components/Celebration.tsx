import { motion } from "framer-motion";
import { useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import type { CelebrationEvent } from "../../shared/types";

function formatCurrency(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  });
}

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
      gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(
        0.01,
        ctx.currentTime + i * 0.15 + 0.5,
      );
      osc.start(ctx.currentTime + i * 0.15);
      osc.stop(ctx.currentTime + i * 0.15 + 0.5);
    });
  } catch {
    // AudioContext not available
  }
}

export function Celebration({ event }: { event: CelebrationEvent }) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(
    undefined,
  );

  const pack = event.slidePack;

  useEffect(() => {
    playSound();

    const end = Date.now() + Math.min(event.duration * 1000, 15000);
    const fire = () => {
      confetti({
        particleCount: 80,
        angle: 60,
        spread: 70,
        origin: { x: 0, y: 0.7 },
        colors: ["#10b981", "#f59e0b", "#3b82f6", "#ef4444", "#a855f7"],
      });
      confetti({
        particleCount: 80,
        angle: 120,
        spread: 70,
        origin: { x: 1, y: 0.7 },
        colors: ["#10b981", "#f59e0b", "#3b82f6", "#ef4444", "#a855f7"],
      });
    };

    fire();
    intervalRef.current = setInterval(() => {
      if (Date.now() > end) {
        clearInterval(intervalRef.current);
        return;
      }
      fire();
    }, 800);

    return () => {
      if (intervalRef.current !== undefined) {
        clearInterval(intervalRef.current);
      }
    };
  }, [event]);

  if (pack) {
    const single = pack.count === 1;
    return (
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(88, 28, 135, 0.85) 0%, rgba(15, 23, 42, 0.97) 60%, rgba(2, 6, 23, 1) 100%)",
          }}
        />

        <motion.div
          className="relative text-center z-10 px-12 max-w-[95vw]"
          initial={{ scale: 0.5, y: 60 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: "spring", bounce: 0.4, duration: 0.8 }}
        >
          <motion.div
            className="text-3xl md:text-4xl font-black mb-4 bg-gradient-to-r from-yellow-300 via-orange-400 to-pink-500 bg-clip-text text-transparent"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            {single ? "New order created" : "New orders created"}
          </motion.div>

          <div className="text-4xl md:text-6xl font-black text-white drop-shadow-2xl mb-4 leading-tight">
            {pack.account}
          </div>

          {!single && (
            <div className="text-2xl md:text-3xl font-bold text-sky-300 mb-6">
              {pack.count} orders
            </div>
          )}

          {single && pack.sales[0]?.meta?.orderId && (
            <div className="text-lg font-mono text-slate-400 mb-4">
              {pack.sales[0].meta.orderId}
            </div>
          )}

          {pack.sales[0]?.product && (
            <div className="text-base text-slate-300 max-w-3xl mx-auto leading-snug">
              {!single
                ? pack.sales
                    .map((s) => s.product)
                    .filter(Boolean)
                    .filter((p, idx, a) => a.indexOf(p) === idx)
                    .slice(0, 4)
                    .join(" · ")
                : pack.sales[0].product}
            </div>
          )}

          {event.message && (
            <motion.div
              className="mt-6 text-lg font-semibold text-yellow-300"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              {event.message}
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    );
  }

  const isSlide = event.sale.meta?.source === "slide_cloud";

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(88, 28, 135, 0.85) 0%, rgba(15, 23, 42, 0.97) 60%, rgba(2, 6, 23, 1) 100%)",
        }}
      />

      <motion.div
        className="relative text-center z-10 px-12"
        initial={{ scale: 0.5, y: 60 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", bounce: 0.4, duration: 0.8 }}
      >
        <motion.div
          className="text-5xl font-black mb-6 bg-gradient-to-r from-yellow-300 via-orange-400 to-pink-500 bg-clip-text text-transparent"
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          {isSlide ? "NEW ORDER!" : "NEW SALE!"}
        </motion.div>

        {isSlide ? (
          <div className="text-5xl md:text-7xl font-black mb-6 text-white drop-shadow-2xl font-mono tracking-tight break-all max-w-[90vw]">
            {event.sale.meta!.orderId}
          </div>
        ) : event.sale.amount > 0 ? (
          <div className="text-8xl font-black mb-8 text-white drop-shadow-2xl">
            {formatCurrency(event.sale.amount)}
          </div>
        ) : (
          <div className="text-3xl font-bold text-white mb-8">New activity</div>
        )}

        <div className="text-3xl font-bold text-emerald-400 mb-3">
          {event.sale.customer}
        </div>
        {isSlide ? (
          <div className="text-sm text-slate-500 mb-2">
            {event.sale.customer} — new order created
          </div>
        ) : event.sale.rep.trim() ? (
          <div className="text-xl text-slate-400 mb-2">{event.sale.rep}</div>
        ) : null}
        {event.sale.product && (
          <div className="text-lg text-slate-300 mt-2 max-w-3xl mx-auto leading-snug">
            {event.sale.product}
          </div>
        )}
        {isSlide && event.sale.meta?.region && (
          <div className="text-sm text-slate-500 mt-3">{event.sale.meta.region}</div>
        )}
        {event.message && (
          <motion.div
            className="mt-6 text-xl font-bold text-yellow-300"
            initial={{ opacity: 0, y: 20 }}
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
