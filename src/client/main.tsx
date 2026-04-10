import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { VirtualKeyboard } from "./components/VirtualKeyboard";
import { unlockAudio } from "./lib/audio";

// Unlock audio on the very first user interaction so that
// celebration sounds can play automatically from Socket events.
function onFirstInteraction() {
  unlockAudio();
  for (const evt of ["pointerdown", "touchstart", "keydown"] as const) {
    document.removeEventListener(evt, onFirstInteraction, true);
  }
}
for (const evt of ["pointerdown", "touchstart", "keydown"] as const) {
  document.addEventListener(evt, onFirstInteraction, true);
}

const App = lazy(() => import("./App.tsx"));
const Settings = lazy(() => import("./pages/Settings.tsx"));

const isSettings = window.location.pathname.startsWith("/settings");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Suspense
      fallback={
        <div className="h-screen w-screen bg-surface flex items-center justify-center text-text-secondary">
          Loading…
        </div>
      }
    >
      {isSettings ? <Settings /> : <App />}
    </Suspense>
    <VirtualKeyboard />
  </StrictMode>,
);
