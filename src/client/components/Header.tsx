import { useEffect, useState } from "react";

export function Header() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="flex items-center justify-between px-8 py-4 bg-slate-900/60 border-b border-slate-800/60 backdrop-blur-sm">
      <div className="flex items-center gap-4">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center font-black text-xl text-white shadow-lg shadow-emerald-500/20">
          S
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Sales Dashboard</h1>
      </div>
      <div className="text-right">
        <div className="text-xl font-semibold tabular-nums">
          {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
        <div className="text-sm text-slate-400">
          {time.toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </div>
      </div>
    </header>
  );
}
