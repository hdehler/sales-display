import { useEffect, useState } from "react";

export function Header() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="flex items-center justify-between px-8 py-4 border-b border-border">
      <div className="flex items-center gap-4">
        <div className="relative flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald" />
          <span className="absolute inline-block w-2 h-2 rounded-full bg-emerald animate-live-ring" />
          <span className="text-xs font-medium uppercase tracking-[0.15em] text-text-secondary">
            Live
          </span>
        </div>
        <div className="w-px h-5 bg-border-bright" />
        <h1 className="font-display text-xl text-text-primary tracking-wide">
          Order Feed
        </h1>
      </div>

      <div className="flex items-center gap-6">
        <span className="text-sm text-text-secondary">
          {time.toLocaleDateString(undefined, {
            weekday: "long",
            month: "short",
            day: "numeric",
          })}
        </span>
        <span className="text-xl font-medium tabular-nums text-text-primary tracking-tight">
          {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </header>
  );
}
