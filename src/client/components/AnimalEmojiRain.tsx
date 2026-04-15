import { motion } from "framer-motion";
import { useMemo } from "react";
import { SPIRIT_EMOJI_FONT_STACK } from "../../shared/animals";

interface Drop {
  id: number;
  x: number;
  size: number;
  delay: number;
  duration: number;
  drift: number;
  rotate: number;
}

function generateDrops(count: number): Drop[] {
  const drops: Drop[] = [];
  for (let i = 0; i < count; i++) {
    drops.push({
      id: i,
      x: Math.random() * 100,
      size: 22 + Math.random() * 36,
      delay: Math.random() * 3.2,
      duration: 2.8 + Math.random() * 3.5,
      drift: -100 + Math.random() * 200,
      rotate: -45 + Math.random() * 90,
    });
  }
  return drops;
}

/** Falling emoji layer (pointer-events none). */
export function AnimalEmojiRain({
  emoji,
  count = 44,
}: {
  emoji: string;
  count?: number;
}) {
  const drops = useMemo(() => generateDrops(count), [count]);

  if (!emoji) return null;

  return (
    <div
      className="fixed inset-0 z-[54] pointer-events-none overflow-hidden"
      aria-hidden
    >
      {drops.map((d) => (
        <motion.span
          key={d.id}
          className="absolute opacity-90"
          style={{
            left: `${d.x}%`,
            top: -64,
            fontSize: d.size,
            fontFamily: SPIRIT_EMOJI_FONT_STACK,
            lineHeight: 1,
            filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.35))",
          }}
          initial={{ y: 0, x: 0, rotate: 0, opacity: 0.85 }}
          animate={{
            y: "calc(100vh + 80px)",
            x: d.drift,
            rotate: d.rotate,
            opacity: [0.85, 0.75, 0.5, 0],
          }}
          transition={{
            duration: d.duration,
            delay: d.delay,
            repeat: Infinity,
            ease: "linear",
          }}
        >
          {emoji}
        </motion.span>
      ))}
    </div>
  );
}
