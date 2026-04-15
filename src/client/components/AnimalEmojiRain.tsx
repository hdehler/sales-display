import { motion } from "framer-motion";
import { useMemo, useState, useCallback } from "react";
import { emojiToTwemojiPngUrl } from "../../shared/animals";

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

/** Falling Twemoji PNGs (no reliance on OS emoji fonts). */
export function AnimalEmojiRain({
  emoji,
  count = 44,
}: {
  emoji: string;
  count?: number;
}) {
  const drops = useMemo(() => generateDrops(count), [count]);
  const [failed, setFailed] = useState<Set<number>>(() => new Set());
  const url = useMemo(() => emojiToTwemojiPngUrl(emoji, 72), [emoji]);

  const onImgError = useCallback((id: number) => {
    setFailed((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  if (!emoji.trim() || !url) return null;

  return (
    <div
      className="fixed inset-0 z-[54] pointer-events-none overflow-hidden"
      aria-hidden
    >
      {drops.map((d) =>
        failed.has(d.id) ? null : (
          <motion.img
            key={d.id}
            src={url}
            alt=""
            draggable={false}
            className="absolute opacity-95"
            style={{
              left: `${d.x}%`,
              top: -64,
              width: d.size,
              height: d.size,
              objectFit: "contain",
              filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.4))",
            }}
            initial={{ y: 0, x: 0, rotate: 0, opacity: 0.9 }}
            animate={{
              y: "calc(100vh + 80px)",
              x: d.drift,
              rotate: d.rotate,
              opacity: [0.9, 0.75, 0.45, 0],
            }}
            transition={{
              duration: d.duration,
              delay: d.delay,
              repeat: Infinity,
              ease: "linear",
            }}
            onError={() => onImgError(d.id)}
          />
        ),
      )}
    </div>
  );
}
