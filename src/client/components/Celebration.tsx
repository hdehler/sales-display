import { motion } from "framer-motion";
import { useEffect, useRef, useCallback } from "react";
import confetti from "canvas-confetti";
import type { CelebrationEvent } from "../../shared/types";
import { spiritAnimalEmoji } from "../../shared/animals";
import { playSong, stopAll } from "../lib/audio";
import { AnimalEmojiRain } from "./AnimalEmojiRain";
import { MixedEmojiLogoRain } from "./MixedEmojiLogoRain";
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

  const slideRepHeroName = (
    event.repHero?.name ||
    (isSlide ? event.sale.rep.trim() : "")
  ).trim();
  const showSlideRepHero = isSlide && Boolean(slideRepHeroName);
  const slideAnimal = event.repHero?.animal?.trim();
  const slideAnimalEmojiChar = slideAnimal
    ? spiritAnimalEmoji(slideAnimal)
    : "";
  const walkupAnimalEmoji = event.rep?.animal
    ? spiritAnimalEmoji(event.rep.animal)
    : "";
  const slideAvatarColor = event.repHero?.avatarColor;

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
    ? "radial-gradient(ellipse at 50% 40%, rgba(168,85,247,0.18) 0%, #08090d 55%)"
    : "radial-gradient(ellipse at 50% 40%, rgba(226,163,54,0.15) 0%, #08090d 55%)";

  const showAnimalRain =
    (showSlideRepHero && Boolean(slideAnimalEmojiChar)) ||
    (isWalkup && Boolean(walkupAnimalEmoji));

  /** Slide + spirit animal: logos and Twemoji share one layer, ~50/50, same fall timing. */
  const showMixedSlideEmojiLogoRain =
    showSlideRepHero && Boolean(slideAnimalEmojiChar);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#08090d]"
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

      {/* Logos only when not mixed with spirit-animal rain (walk-up or Slide without animal). */}
      {!showMixedSlideEmojiLogoRain && (
        <LogoConfetti
          count={showAnimalRain ? (isWalkup ? 8 : 10) : isWalkup ? 24 : 16}
        />
      )}
      {showMixedSlideEmojiLogoRain ? (
        <MixedEmojiLogoRain emoji={slideAnimalEmojiChar} totalCount={40} />
      ) : showAnimalRain ? (
        <AnimalEmojiRain emoji={walkupAnimalEmoji} count={isWalkup ? 36 : 48} />
      ) : null}

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
                className="mt-2 text-lg md:text-2xl font-semibold text-white/95 max-w-3xl mx-auto leading-snug px-5 py-3 rounded-2xl border border-white/15 bg-white/[0.06]"
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

            {showSlideRepHero ? (
              <>
                {slideAvatarColor && (
                  <motion.div
                    className="mb-5 flex justify-center"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", bounce: 0.45, duration: 0.55 }}
                  >
                    <div
                      className="w-20 h-20 md:w-28 md:h-28 rounded-full flex items-center justify-center text-3xl md:text-4xl font-black text-white shadow-2xl"
                      style={{
                        background: `linear-gradient(135deg, ${slideAvatarColor}, ${slideAvatarColor}99)`,
                        boxShadow: `0 0 48px ${slideAvatarColor}44`,
                      }}
                    >
                      {slideRepHeroName.charAt(0).toUpperCase()}
                    </div>
                  </motion.div>
                )}

                <motion.h1
                  className="font-display text-5xl md:text-8xl text-text-primary leading-[1.05] mb-3 md:mb-4"
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.12, duration: 0.55 }}
                >
                  {slideRepHeroName}
                </motion.h1>

                <motion.div
                  className="font-display text-4xl md:text-6xl text-accent leading-tight mb-4 md:mb-5 max-w-5xl mx-auto"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.22, duration: 0.5 }}
                >
                  {account}
                </motion.div>

                {products.length > 0 && (
                  <motion.div
                    className="mt-3 text-xl md:text-3xl font-semibold text-white/95 max-w-4xl mx-auto leading-snug px-6 py-4 rounded-2xl border border-accent/25 bg-accent/10 shadow-[0_0_40px_rgba(226,163,54,0.12)] mb-2"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.45 }}
                  >
                    {products.join(" · ")}
                  </motion.div>
                )}
              </>
            ) : (
              <>
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
          </>
        )}

        {event.message && !isSlide && (
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
