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
    <header className="shrink-0 flex items-center justify-between px-4 sm:px-6 py-2.5 border-b border-border bg-surface-raised/40 backdrop-blur-md">
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        <h1 className="font-display text-xl sm:text-2xl font-normal tracking-tight text-text-primary truncate">
          Sales Feed
        </h1>
        <div
          className="flex items-center gap-1.5 pl-3 sm:pl-4 border-l border-border shrink-0"
          aria-live="polite"
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald opacity-60" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald shadow-[0_0_12px_rgba(62,207,155,0.45)]" />
          </span>
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald">
            Live
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <div className="hidden sm:flex flex-col items-end text-right leading-tight">
          <span className="text-xs font-medium uppercase tracking-wider text-text-muted">
            {time.toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </span>
          <span className="text-base font-semibold tabular-nums text-text-primary">
            {time.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true })}
          </span>
        </div>
        <span className="sm:hidden text-sm font-semibold tabular-nums text-text-primary">
          {time.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true })}
        </span>

        <div className="w-px h-7 bg-border self-center hidden sm:block" aria-hidden />

        {onOpenTeam && (
          <button
            type="button"
            onClick={onOpenTeam}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border-bright text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors text-[11px] font-semibold uppercase tracking-wide focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            Team
          </button>
        )}
        <a
          href="/settings"
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border-bright text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors text-[11px] font-semibold uppercase tracking-wide focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          Settings
        </a>
      </div>
    </header>
  );
}
