import { motion } from "framer-motion";
import { useMemo, useState, useCallback } from "react";
import { emojiToTwemojiPngUrl } from "../../shared/animals";

const LOGOS = ["/images/logo-rounded.png", "/images/logo-dots.png"];

interface MixedDrop {
  id: number;
  kind: "emoji" | "logo";
  logoSrc?: string;
  x: number;
  size: number;
  delay: number;
  duration: number;
  drift: number;
  rotate: number;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Same timing envelope as spirit-animal rain so logos and animals feel equal. */
function buildMixedDrops(total: number): MixedDrop[] {
  const logoN = Math.floor(total / 2);
  const emojiN = total - logoN;
  const drops: MixedDrop[] = [];
  let id = 0;
  for (let i = 0; i < emojiN; i++) {
    drops.push({
      id: id++,
      kind: "emoji",
      x: Math.random() * 100,
      size: 22 + Math.random() * 36,
      delay: Math.random() * 3.2,
      duration: 2.8 + Math.random() * 3.5,
      drift: -100 + Math.random() * 200,
      rotate: -45 + Math.random() * 90,
    });
  }
  for (let i = 0; i < logoN; i++) {
    drops.push({
      id: id++,
      kind: "logo",
      logoSrc: LOGOS[i % LOGOS.length],
      x: Math.random() * 100,
      size: 24 + Math.random() * 34,
      delay: Math.random() * 3.2,
      duration: 2.8 + Math.random() * 3.5,
      drift: -100 + Math.random() * 200,
      rotate: -45 + Math.random() * 90,
    });
  }
  return shuffle(drops);
}

/**
 * Slide celebrations: spirit animal Twemoji + Slide logos in one layer,
 * ~equal counts, shuffled so they fall mixed with the same repeat/duration feel.
 */
export function MixedEmojiLogoRain({
  emoji,
  totalCount = 40,
}: {
  emoji: string;
  /** Total falling pieces; split as evenly as possible (emoji vs logo). */
  totalCount?: number;
}) {
  const n = Math.max(4, totalCount);
  const drops = useMemo(() => buildMixedDrops(n), [n]);
  const emojiUrl = useMemo(() => emojiToTwemojiPngUrl(emoji, 72), [emoji]);
  const [failed, setFailed] = useState<Set<number>>(() => new Set());

  const onImgError = useCallback((id: number) => {
    setFailed((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  if (!emoji.trim() || !emojiUrl) return null;

  return (
    <div
      className="fixed inset-0 z-[54] pointer-events-none overflow-hidden"
      aria-hidden
    >
      {drops.map((d) => {
        if (failed.has(d.id)) return null;
        const src = d.kind === "emoji" ? emojiUrl : d.logoSrc!;
        return (
          <motion.img
            key={d.id}
            src={src}
            alt=""
            draggable={false}
            className={`absolute opacity-95 ${d.kind === "logo" ? "rounded-lg" : ""}`}
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
        );
      })}
    </div>
  );
}
