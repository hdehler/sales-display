import { motion } from "framer-motion";
import { useMemo } from "react";

const LOGOS = ["/images/logo-rounded.png", "/images/logo-dots.png"];

interface Piece {
  id: number;
  logo: string;
  x: number;
  size: number;
  delay: number;
  duration: number;
  rotation: number;
  drift: number;
}

function generatePieces(count: number): Piece[] {
  const pieces: Piece[] = [];
  for (let i = 0; i < count; i++) {
    pieces.push({
      id: i,
      logo: LOGOS[i % LOGOS.length],
      x: Math.random() * 100,
      size: 28 + Math.random() * 32,
      delay: Math.random() * 2.5,
      duration: 3 + Math.random() * 3,
      rotation: -180 + Math.random() * 360,
      drift: -40 + Math.random() * 80,
    });
  }
  return pieces;
}

export function LogoConfetti({ count = 18 }: { count?: number }) {
  const pieces = useMemo(() => generatePieces(count), [count]);

  return (
    <div className="fixed inset-0 z-[55] pointer-events-none overflow-hidden">
      {pieces.map((p) => (
        <motion.img
          key={p.id}
          src={p.logo}
          alt=""
          className="absolute rounded-lg"
          style={{
            width: p.size,
            height: p.size,
            left: `${p.x}%`,
            top: -p.size - 10,
            objectFit: "contain",
          }}
          initial={{
            y: 0,
            x: 0,
            rotate: 0,
            opacity: 0.9,
            scale: 0.6,
          }}
          animate={{
            y: `calc(100vh + ${p.size + 20}px)`,
            x: p.drift,
            rotate: p.rotation,
            opacity: [0.9, 0.85, 0.7, 0],
            scale: [0.6, 1, 0.9, 0.7],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            ease: "easeIn",
          }}
        />
      ))}
    </div>
  );
}
