import { AnimatePresence } from "framer-motion";
import { useSocket } from "./hooks/useSocket";
import { Dashboard } from "./components/Dashboard";
import { Celebration } from "./components/Celebration";

export default function App() {
  const { dashboard, celebration, connected } = useSocket();

  return (
    <div className="h-screen w-screen bg-slate-950 text-white overflow-hidden relative">
      {dashboard ? (
        <Dashboard data={dashboard} />
      ) : (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="text-4xl font-bold mb-3">Sales Dashboard</div>
            <div className="text-slate-400 text-lg">
              {connected ? "Loading data..." : "Connecting to server..."}
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {celebration && <Celebration event={celebration} />}
      </AnimatePresence>
    </div>
  );
}
