import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

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
  </StrictMode>,
);
