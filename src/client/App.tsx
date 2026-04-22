import { AnimatePresence } from "framer-motion";
import { useRef, useState, useCallback } from "react";
import { useSocket } from "./hooks/useSocket";
import { useGlobalDragScroll } from "./hooks/useDragScroll";
import { Dashboard } from "./components/Dashboard";
import { Celebration } from "./components/Celebration";
import { ClaimOverlay } from "./components/ClaimOverlay";
import { AssignRepPanel, type AssignRepContext } from "./components/AssignRepPanel";
import { RepManager } from "./components/RepManager";
import { WalkUpBar } from "./components/WalkUpBar";
import type { CelebrationEvent } from "../shared/types";
import { stopAll } from "./lib/audio";

export default function App() {
  useGlobalDragScroll();
  const { dashboard, celebration, connected, dismissCelebration, socket } =
    useSocket();
  const lastCelebrationRef = useRef<CelebrationEvent | null>(null);
  const [teamOpen, setTeamOpen] = useState(false);
  const [repsVersion, setRepsVersion] = useState(0);
  const [assignRepContext, setAssignRepContext] =
    useState<AssignRepContext | null>(null);

  if (celebration && celebration.type !== "walkup") {
    lastCelebrationRef.current = celebration;
  }

  const handleStopCelebration = useCallback(() => {
    socket?.emit("celebration:dismiss");
    stopAll();
    dismissCelebration();
  }, [socket, dismissCelebration]);

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
              "radial-gradient(circle, rgba(12,136,255,0.12) 0%, transparent 68%)",
          }}
        />
      </div>

      {/* Grain texture */}
      <div
        className="pointer-events-none fixed inset-0 z-[1] opacity-[0.042] animate-grain"
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
          <Dashboard
            data={dashboard}
            onOpenTeam={() => setTeamOpen(true)}
            onAssignRep={(ctx) => setAssignRepContext(ctx)}
          />
        ) : (
          <div className="flex items-center justify-center h-full px-6">
            <div className="text-center max-w-md">
              <div className="font-display text-3xl sm:text-4xl font-normal mb-3 text-text-primary tracking-tight">
                Sales Dashboard
              </div>
              <div className="text-text-secondary text-sm font-medium uppercase tracking-[0.2em]">
                {connected ? "Loading data…" : "Connecting to server…"}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Walk-up bar — reps tap their face to play their song */}
      {!celebration && <WalkUpBar version={repsVersion} />}

      <AnimatePresence>
        {celebration && (
          <Celebration event={celebration} onStop={handleStopCelebration} />
        )}
      </AnimatePresence>

      <ClaimOverlay lastCelebration={lastCelebrationRef.current} />

      <AssignRepPanel
        context={assignRepContext}
        onClose={() => setAssignRepContext(null)}
      />

      <RepManager open={teamOpen} onClose={() => setTeamOpen(false)} onRepsChanged={() => setRepsVersion((v) => v + 1)} />
    </div>
  );
}
