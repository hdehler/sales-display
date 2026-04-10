import { useState, useRef, useEffect, useCallback } from "react";
import { JINGLES } from "../lib/jingles";
import { playSong, stopAll as stopAudio } from "../lib/audio";

export interface SongChoice {
  type: "deezer" | "jingle" | "none";
  /** Deezer preview URL (may include #t=N offset) or jingle ID */
  value: string;
  label: string;
}

interface SearchResult {
  id: number;
  title: string;
  artist: string;
  album: string;
  cover: string;
  previewUrl: string;
}

interface SongSearchProps {
  value: string;
  onChange: (choice: SongChoice) => void;
  label?: string;
}

function parseOffset(url: string): number {
  const m = url.match(/#t=(\d+(?:\.\d+)?)$/);
  return m ? parseFloat(m[1]) : 0;
}

function stripOffset(url: string): string {
  return url.replace(/#t=[\d.]+$/, "");
}

export function SongSearch({ value, onChange, label }: SongSearchProps) {
  const [tab, setTab] = useState<"search" | "jingles">(
    value && !JINGLES.some((j) => j.id === value) && value !== "" ? "search" : "jingles",
  );
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isDeezerValue = value.startsWith("http");
  const currentOffset = isDeezerValue ? parseOffset(value) : 0;

  const displayLabel = getDisplayLabel(value);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const r = await fetch(`/api/songs/search?q=${encodeURIComponent(q)}`);
      const json = (await r.json()) as { data: SearchResult[] };
      setResults(json.data || []);
    } catch {
      setResults([]);
    }
    setSearching(false);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => search(query), 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search]);

  function stopPreview() {
    stopAudio();
    setPlayingId(null);
  }

  function preview(id: string, song: string) {
    if (playingId === id) {
      stopPreview();
      return;
    }
    stopPreview();
    playSong(song);
    setPlayingId(id);
    setTimeout(() => setPlayingId(null), 20_000);
  }

  function selectDeezer(result: SearchResult) {
    stopPreview();
    onChange({
      type: "deezer",
      value: result.previewUrl,
      label: `${result.artist} — ${result.title}`,
    });
  }

  function selectJingle(id: string) {
    stopPreview();
    const j = JINGLES.find((j) => j.id === id);
    onChange({
      type: "jingle",
      value: id,
      label: j?.name || id,
    });
  }

  function selectNone() {
    stopPreview();
    onChange({ type: "none", value: "", label: "None" });
  }

  function setOffset(seconds: number) {
    if (!isDeezerValue) return;
    const base = stripOffset(value);
    const newVal = seconds > 0 ? `${base}#t=${seconds}` : base;
    onChange({
      type: "deezer",
      value: newVal,
      label: displayLabel.replace(/^🎶 /, ""),
    });
  }

  function previewFromOffset() {
    if (!isDeezerValue) return;
    stopPreview();
    playSong(value);
    setPlayingId("offset-preview");
    setTimeout(() => setPlayingId(null), 20_000);
  }

  return (
    <div>
      {label && (
        <div className="text-xs text-text-muted mb-1.5">{label}</div>
      )}

      {/* Current selection */}
      {value && (
        <div className="mb-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent/10 border border-accent/20 text-xs">
            <span className="text-accent font-medium truncate flex-1">
              {displayLabel}
            </span>
            <button
              onClick={selectNone}
              className="text-text-muted hover:text-text-secondary flex-shrink-0"
            >
              ✕
            </button>
          </div>

          {/* Start offset scrubber — only for Deezer songs */}
          {isDeezerValue && (
            <div className="mt-2 px-3 py-2.5 rounded-lg bg-surface border border-border">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] uppercase tracking-widest text-text-muted font-medium">
                  Start at
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs tabular-nums text-text-secondary font-medium">
                    {currentOffset.toFixed(0)}s
                  </span>
                  <button
                    onClick={previewFromOffset}
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] transition-colors ${
                      playingId === "offset-preview"
                        ? "bg-accent text-surface"
                        : "bg-accent/20 text-accent hover:bg-accent/30"
                    }`}
                  >
                    {playingId === "offset-preview" ? "■" : "▶"}
                  </button>
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={10}
                step={0.5}
                value={currentOffset}
                onChange={(e) => setOffset(parseFloat(e.target.value))}
                className="w-full h-1.5 accent-accent cursor-pointer"
              />
              <div className="flex justify-between text-[9px] text-text-muted mt-0.5">
                <span>0s</span>
                <span>5s</span>
                <span>10s</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex gap-1 mb-2 rounded-md bg-surface p-0.5 border border-border text-[10px]">
        <button
          onClick={() => setTab("search")}
          className={`flex-1 px-2 py-1 rounded transition-all font-medium ${
            tab === "search"
              ? "bg-accent text-surface"
              : "text-text-muted hover:text-text-secondary"
          }`}
        >
          Search songs
        </button>
        <button
          onClick={() => setTab("jingles")}
          className={`flex-1 px-2 py-1 rounded transition-all font-medium ${
            tab === "jingles"
              ? "bg-accent text-surface"
              : "text-text-muted hover:text-text-secondary"
          }`}
        >
          Built-in jingles
        </button>
      </div>

      {tab === "search" ? (
        <div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search artist or song…"
            className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-text-primary text-sm focus:outline-none focus:border-accent mb-2"
          />
          {searching && (
            <div className="text-xs text-text-muted py-2">Searching…</div>
          )}
          <div className="max-h-52 overflow-y-auto space-y-1">
            {results.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-hover transition-colors cursor-pointer group"
                onClick={() => selectDeezer(r)}
              >
                <img
                  src={r.cover}
                  alt=""
                  className="w-8 h-8 rounded flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-text-primary truncate">
                    {r.title}
                  </div>
                  <div className="text-[10px] text-text-muted truncate">
                    {r.artist}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    preview(`deezer-${r.id}`, r.previewUrl);
                  }}
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[8px] flex-shrink-0 transition-colors ${
                    playingId === `deezer-${r.id}`
                      ? "bg-accent text-surface"
                      : "bg-text-muted/20 text-text-muted opacity-0 group-hover:opacity-100"
                  }`}
                >
                  {playingId === `deezer-${r.id}` ? "■" : "▶"}
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-1.5 max-h-52 overflow-y-auto">
          {JINGLES.map((j) => (
            <div
              key={j.id}
              className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs transition-all cursor-pointer ${
                value === j.id
                  ? "bg-accent/15 border border-accent/30 text-accent"
                  : "bg-surface border border-border text-text-secondary hover:text-text-primary"
              }`}
              onClick={() => selectJingle(j.id)}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  preview(j.id, j.id);
                }}
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] flex-shrink-0 transition-colors ${
                  playingId === j.id
                    ? "bg-accent text-surface"
                    : "bg-text-muted/20 text-text-muted hover:bg-accent/30 hover:text-accent"
                }`}
              >
                {playingId === j.id ? "■" : "▶"}
              </button>
              <div className="min-w-0">
                <div className="font-medium truncate">{j.name}</div>
                <div className="text-text-muted truncate text-[10px]">
                  {j.description}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function getDisplayLabel(value: string): string {
  if (!value) return "None";
  const jingle = JINGLES.find((j) => j.id === value);
  if (jingle) return `🎵 ${jingle.name}`;
  if (value.startsWith("http")) return "🎶 Custom song";
  return value;
}
