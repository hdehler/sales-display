import { AnimatePresence } from "framer-motion";
import { useRef, useState, useCallback } from "react";
import { useSocket } from "./hooks/useSocket";
import { Dashboard } from "./components/Dashboard";
import { Celebration } from "./components/Celebration";
import { ClaimOverlay } from "./components/ClaimOverlay";
import { RepManager } from "./components/RepManager";
import { WalkUpBar } from "./components/WalkUpBar";
import type { CelebrationEvent } from "../shared/types";
import { stopAll } from "./lib/audio";

export default function App() {
  const { dashboard, celebration, connected, dismissCelebration } = useSocket();
  const lastCelebrationRef = useRef<CelebrationEvent | null>(null);
  const [teamOpen, setTeamOpen] = useState(false);

  if (celebration && celebration.type !== "walkup") {
    lastCelebrationRef.current = celebration;
  }

  const handleStopCelebration = useCallback(() => {
    stopAll();
    dismissCelebration();
  }, [dismissCelebration]);

  return (
    <div className="h-screen w-screen bg-surface text-text-primary overflow-hidden relative">
      {/* Ambient glow */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        aria-hidden="true"
      >
        <div
          className="absolute top-1/3 left-1/2 w-[60vw] h-[60vw] rounded-full animate-glow-sway"
          style={{
            background:
              "radial-gradient(circle, rgba(226,163,54,0.08) 0%, transparent 70%)",
          }}
        />
      </div>

      {/* Grain texture */}
      <div
        className="pointer-events-none fixed inset-0 z-[1] opacity-[0.03] animate-grain"
        aria-hidden="true"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")",
          backgroundSize: "128px 128px",
        }}
      />

      {/* Content */}
      <div className="relative z-[2] h-full">
        {dashboard ? (
          <Dashboard data={dashboard} onOpenTeam={() => setTeamOpen(true)} />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="font-display text-4xl mb-3 text-text-primary">
                Sales Dashboard
              </div>
              <div className="text-text-secondary text-lg">
                {connected ? "Loading data…" : "Connecting to server…"}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Walk-up bar — reps tap their face to play their song */}
      {!celebration && <WalkUpBar />}

      <AnimatePresence>
        {celebration && (
          <Celebration event={celebration} onStop={handleStopCelebration} />
        )}
      </AnimatePresence>

      <ClaimOverlay lastCelebration={lastCelebrationRef.current} />

      <RepManager open={teamOpen} onClose={() => setTeamOpen(false)} />
    </div>
  );
}
