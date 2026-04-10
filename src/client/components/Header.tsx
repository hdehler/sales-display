import { useEffect, useState } from "react";

interface HeaderProps {
  onOpenTeam?: () => void;
}

export function Header({ onOpenTeam }: HeaderProps) {
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

      <div className="flex items-center gap-5">
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
        {onOpenTeam && (
          <button
            onClick={onOpenTeam}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-text-muted hover:text-text-secondary hover:border-border-bright hover:bg-surface-hover transition-all text-xs font-medium uppercase tracking-wider"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            Team
          </button>
        )}
      </div>
    </header>
  );
}
