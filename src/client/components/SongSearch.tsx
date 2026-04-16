import { useState, useRef, useEffect, useCallback } from "react";
import { JINGLES } from "../lib/jingles";
import { playSong, stopAll as stopAudio } from "../lib/audio";

export interface SongChoice {
  type: "deezer" | "jingle" | "upload" | "none";
  /** Spotify/Deezer preview URL (may include #t=N offset), jingle ID, or /sounds/... path */
  value: string;
  label: string;
}

interface SearchResult {
  id: string;
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
  /** Persisted display line for preview URLs (Artist — Title); keeps label when scrubbing start offset */
  walkupLabel?: string | null;
}

function parseOffset(url: string): number {
  const m = url.match(/#t=(\d+(?:\.\d+)?)$/);
  return m ? parseFloat(m[1]) : 0;
}

function stripOffset(url: string): string {
  return url.replace(/#t=[\d.]+$/, "");
}

type Tab = "search" | "jingles" | "uploads";

const CATALOG_MODE_STORAGE_KEY = "sales-display-song-catalog-mode";

type CatalogMode = "auto" | "spotify" | "deezer";

function readStoredCatalogMode(): CatalogMode {
  if (typeof sessionStorage === "undefined") return "auto";
  try {
    const v = sessionStorage.getItem(CATALOG_MODE_STORAGE_KEY);
    if (v === "spotify" || v === "deezer" || v === "auto") return v;
  } catch {
    /* private mode */
  }
  return "auto";
}

function detectTab(value: string): Tab {
  if (!value) return "search";
  if (value.startsWith("/sounds/")) return "uploads";
  if (JINGLES.some((j) => j.id === value)) return "jingles";
  return "search";
}

type WalkupKind = "none" | "jingle" | "upload" | "deezer" | "unknown";

function getWalkupDisplay(
  value: string,
  walkupLabel?: string | null,
): {
  kind: WalkupKind;
  title: string;
  subtitle: string;
  badge: string;
} {
  const v = value?.trim() ?? "";
  if (!v) {
    return {
      kind: "none",
      title: "No walk-up selected",
      subtitle: "Use Search, Uploads, or Jingles below.",
      badge: "",
    };
  }
  const jingle = JINGLES.find((j) => j.id === value);
  if (jingle) {
    return {
      kind: "jingle",
      title: jingle.name,
      subtitle: jingle.description,
      badge: "Jingle",
    };
  }
  if (value.startsWith("/sounds/")) {
    const name = stripOffset(value).split("/").pop() || value;
    return {
      kind: "upload",
      title: name,
      subtitle: "Uploaded file",
      badge: "Upload",
    };
  }
  if (value.startsWith("http")) {
    const line = walkupLabel?.trim();
    if (line) {
      return {
        kind: "deezer",
        title: line,
        subtitle: "Preview clip · adjust start offset below if needed.",
        badge: "Preview",
      };
    }
    return {
      kind: "deezer",
      title: "Song preview",
      subtitle: "Searched track — adjust start offset below if needed.",
      badge: "Preview",
    };
  }
  return {
    kind: "unknown",
    title: value,
    subtitle: "Custom",
    badge: "Custom",
  };
}

/** One-line label for rep lists / summaries (no emoji). */
export function walkupSongDisplayLine(
  value: string | null | undefined,
  storedLabel?: string | null,
): string {
  const v = value || "";
  const line = storedLabel?.trim();
  if (v.startsWith("http") && line) return line;
  const d = getWalkupDisplay(v, line);
  if (d.kind === "none") return "No walk-up song";
  if (d.kind === "jingle") return d.title;
  if (d.kind === "upload") return d.title;
  if (d.kind === "deezer") return "Song preview";
  return d.title;
}

export function SongSearch({ value, onChange, label, walkupLabel }: SongSearchProps) {
  const [tab, setTab] = useState<Tab>(detectTab(value));
  const [query, setQuery] = useState("");
  const [catalogMode, setCatalogMode] = useState<CatalogMode>(readStoredCatalogMode);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchSource, setSearchSource] = useState<"spotify" | "deezer" | null>(
    null,
  );
  const [searchHint, setSearchHint] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [uploads, setUploads] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isUrlValue = value.startsWith("http") || value.startsWith("/sounds/");
  const currentOffset = isUrlValue ? parseOffset(value) : 0;
  const maxOffset = isUrlValue ? Math.max(0, audioDuration - 20) : 10;

  const walkup = getWalkupDisplay(value, walkupLabel);

  useEffect(() => {
    fetchUploads();
  }, []);

  useEffect(() => {
    setTab(detectTab(value));
  }, [value]);

  useEffect(() => {
    if (!isUrlValue) {
      setAudioDuration(0);
      return;
    }
    const a = new Audio(stripOffset(value));
    a.addEventListener("loadedmetadata", () => {
      setAudioDuration(Math.floor(a.duration));
    });
    a.addEventListener("error", () => setAudioDuration(30));
    return () => { a.src = ""; };
  }, [stripOffset(value)]);

  async function fetchUploads() {
    try {
      const r = await fetch("/api/songs");
      const json = (await r.json()) as { walkups: string[]; models: string[] };
      setUploads([
        ...json.walkups.map((f) => `/sounds/walkups/${f}`),
        ...json.models.map((f) => `/sounds/models/${f}`),
      ]);
    } catch { /* offline */ }
  }

  function persistCatalogMode(mode: CatalogMode) {
    setCatalogMode(mode);
    try {
      sessionStorage.setItem(CATALOG_MODE_STORAGE_KEY, mode);
    } catch {
      /* */
    }
  }

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setSearchSource(null);
      setSearchHint(null);
      return;
    }
    setSearching(true);
    setSearchHint(null);
    try {
      const r = await fetch(
        `/api/songs/search?q=${encodeURIComponent(q)}&provider=${encodeURIComponent(catalogMode)}`,
      );
      const json = (await r.json()) as {
        data: SearchResult[];
        source?: "spotify" | "deezer" | null;
        hint?: string;
      };
      setResults(json.data || []);
      setSearchSource(json.source ?? null);
      const h = json.hint;
      setSearchHint(
        h === "spotify_not_configured"
          ? "Spotify not configured — set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in .env."
          : h === "spotify_no_previews"
            ? "Spotify returned no tracks with a preview for this query."
            : null,
      );
    } catch {
      setResults([]);
      setSearchSource(null);
      setSearchHint(
        catalogMode === "spotify"
          ? "Spotify search failed (check server logs)."
          : null,
      );
    }
    setSearching(false);
  }, [catalogMode]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      setSearchSource(null);
      setSearchHint(null);
      return;
    }
    debounceRef.current = setTimeout(() => search(query), 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search, catalogMode]);

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

  function selectUpload(path: string) {
    stopPreview();
    const filename = path.split("/").pop() || path;
    onChange({
      type: "upload",
      value: path,
      label: filename,
    });
  }

  function selectNone() {
    stopPreview();
    onChange({ type: "none", value: "", label: "None" });
  }

  function setOffset(seconds: number) {
    if (!isUrlValue) return;
    const base = stripOffset(value);
    const newVal = seconds > 0 ? `${base}#t=${seconds}` : base;
    const w = getWalkupDisplay(value, walkupLabel);
    const outLabel =
      value.startsWith("http") && walkupLabel?.trim()
        ? walkupLabel.trim()
        : w.title;
    onChange({
      type: value.startsWith("/sounds/") ? "upload" : "deezer",
      value: newVal,
      label: outLabel,
    });
  }

  function previewFromOffset() {
    if (!isUrlValue) return;
    stopPreview();
    playSong(value);
    setPlayingId("offset-preview");
    setTimeout(() => setPlayingId(null), 20_000);
  }

  async function handleUpload(file: File) {
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    form.append("folder", "walkups");
    try {
      const r = await fetch("/api/songs/upload", { method: "POST", body: form });
      const json = (await r.json()) as { filename: string; folder: string };
      await fetchUploads();
      const path = `/sounds/${json.folder}/${json.filename}`;
      selectUpload(path);
    } catch { /* */ }
    setUploading(false);
  }

  function previewCurrentSelection() {
    if (!value.trim()) return;
    if (playingId === "walkup-card") {
      stopPreview();
      return;
    }
    stopPreview();
    playSong(value);
    setPlayingId("walkup-card");
    setTimeout(() => setPlayingId(null), 20_000);
  }

  return (
    <div>
      {label && (
        <div className="text-xs text-text-muted mb-1.5">{label}</div>
      )}

      {/* Current walk-up — always visible so edit/add always show selection state */}
      <div
        className={`mb-3 rounded-xl border p-4 transition-colors ${
          value.trim()
            ? "border-accent/35 bg-gradient-to-br from-accent/[0.12] to-transparent"
            : "border-dashed border-border bg-surface/40"
        }`}
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-[10px] uppercase tracking-widest text-text-muted font-semibold">
            Current walk-up
          </span>
          {value.trim() && walkup.badge && (
            <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md bg-accent/20 text-accent">
              {walkup.badge}
            </span>
          )}
        </div>
        <div className="flex items-start gap-3">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${
              value.trim() ? "bg-accent/25 text-accent" : "bg-surface text-text-muted"
            }`}
            aria-hidden
          >
            {value.trim() ? "♪" : "♫"}
          </div>
          <div className="min-w-0 flex-1">
            <div
              className={`text-base font-semibold leading-tight ${
                value.trim() ? "text-text-primary" : "text-text-secondary"
              }`}
            >
              {walkup.title}
            </div>
            <p className="text-sm text-text-muted mt-1 leading-snug">
              {walkup.subtitle}
            </p>
          </div>
          <div className="flex flex-col gap-1.5 flex-shrink-0">
            {value.trim() ? (
              <>
                <button
                  type="button"
                  onClick={previewCurrentSelection}
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-xs transition-colors ${
                    playingId === "walkup-card"
                      ? "bg-accent text-on-accent"
                      : "bg-accent/20 text-accent hover:bg-accent/35"
                  }`}
                  title="Preview"
                >
                  {playingId === "walkup-card" ? "■" : "▶"}
                </button>
                <button
                  type="button"
                  onClick={selectNone}
                  className="text-[11px] font-medium text-text-muted hover:text-text-secondary px-1 py-0.5"
                >
                  Clear
                </button>
              </>
            ) : null}
          </div>
        </div>

        {/* Start offset scrubber — for Spotify/Deezer previews and uploads */}
        {value.trim() && isUrlValue && (
          <div className="mt-3 pt-3 border-t border-border/80">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] uppercase tracking-widest text-text-muted font-medium">
                Start at
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs tabular-nums text-text-secondary font-medium">
                  {currentOffset.toFixed(0)}s
                  {audioDuration > 0 && (
                    <span className="text-text-muted"> / {audioDuration}s</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={previewFromOffset}
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] transition-colors ${
                    playingId === "offset-preview"
                      ? "bg-accent text-on-accent"
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
              max={maxOffset || 10}
              step={0.5}
              value={currentOffset}
              onChange={(e) => setOffset(parseFloat(e.target.value))}
              className="w-full h-1.5 accent-accent cursor-pointer"
            />
            <div className="flex justify-between text-[9px] text-text-muted mt-0.5">
              <span>0s</span>
              <span>{Math.round((maxOffset || 10) / 2)}s</span>
              <span>{maxOffset || 10}s</span>
            </div>
            <div className="text-[10px] text-text-muted mt-1">
              Plays 20s starting from this point
            </div>
          </div>
        )}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 mb-2 rounded-md bg-surface p-0.5 border border-border text-[10px]">
        <button
          onClick={() => setTab("search")}
          className={`flex-1 px-2 py-1 rounded transition-all font-medium ${
            tab === "search"
              ? "bg-accent text-on-accent"
              : "text-text-muted hover:text-text-secondary"
          }`}
        >
          Search songs
        </button>
        <button
          onClick={() => setTab("uploads")}
          className={`flex-1 px-2 py-1 rounded transition-all font-medium ${
            tab === "uploads"
              ? "bg-accent text-on-accent"
              : "text-text-muted hover:text-text-secondary"
          }`}
        >
          Uploads
        </button>
        <button
          onClick={() => setTab("jingles")}
          className={`flex-1 px-2 py-1 rounded transition-all font-medium ${
            tab === "jingles"
              ? "bg-accent text-on-accent"
              : "text-text-muted hover:text-text-secondary"
          }`}
        >
          Jingles
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
          <div
            className="flex flex-wrap items-center gap-1 mb-2"
            role="group"
            aria-label="Catalog source (testing)"
          >
            <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted shrink-0">
              Source
            </span>
            {(
              [
                ["auto", "Auto"],
                ["spotify", "Spotify"],
                ["deezer", "Deezer"],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => persistCatalogMode(mode)}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide transition-colors ${
                  catalogMode === mode
                    ? "bg-accent text-on-accent"
                    : "bg-surface-hover text-text-muted hover:text-text-secondary border border-border"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {searching && (
            <div className="text-xs text-text-muted py-2">Searching…</div>
          )}
          {!searching && searchSource && query.trim() && (
            <div className="text-[10px] text-text-muted mb-1.5">
              {searchSource === "spotify"
                ? "Results from Spotify (tracks with a preview only)"
                : "Results from Deezer"}
            </div>
          )}
          {!searching && searchHint && query.trim() && (
            <div className="text-[10px] text-text-secondary mb-1.5 leading-snug">
              {searchHint}
            </div>
          )}
          <div className="max-h-52 overflow-y-auto space-y-1">
            {results.map((r) => {
              const rowKey = `${searchSource ?? "deezer"}-${r.id}`;
              return (
              <div
                key={rowKey}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-hover transition-colors cursor-pointer group"
                onClick={() => selectDeezer(r)}
              >
                {r.cover ? (
                  <img
                    src={r.cover}
                    alt=""
                    className="w-8 h-8 rounded flex-shrink-0 object-cover"
                  />
                ) : (
                  <div
                    className="w-8 h-8 rounded flex-shrink-0 bg-surface-hover border border-border"
                    aria-hidden
                  />
                )}
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
                    preview(rowKey, r.previewUrl);
                  }}
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[8px] flex-shrink-0 transition-colors ${
                    playingId === rowKey
                      ? "bg-accent text-on-accent"
                      : "bg-text-muted/20 text-text-muted opacity-0 group-hover:opacity-100"
                  }`}
                >
                  {playingId === rowKey ? "■" : "▶"}
                </button>
              </div>
            );
            })}
          </div>
        </div>
      ) : tab === "uploads" ? (
        <div>
          <div className="mb-2">
            <input
              ref={fileRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
              }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-full px-3 py-2 rounded-lg border border-dashed border-border text-text-muted hover:text-text-secondary hover:border-border-bright transition-all text-xs"
            >
              {uploading ? "Uploading…" : "+ Upload MP3 / WAV"}
            </button>
          </div>
          <div className="max-h-52 overflow-y-auto space-y-1">
            {uploads.map((u) => {
              const filename = u.split("/").pop() || u;
              return (
                <div
                  key={u}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors cursor-pointer group ${
                    stripOffset(value) === u
                      ? "bg-accent/15 border border-accent/30"
                      : "hover:bg-surface-hover"
                  }`}
                  onClick={() => selectUpload(u)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-text-primary truncate">
                      {filename}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      preview(`upload-${u}`, u);
                    }}
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[8px] flex-shrink-0 transition-colors ${
                      playingId === `upload-${u}`
                        ? "bg-accent text-on-accent"
                        : "bg-text-muted/20 text-text-muted opacity-0 group-hover:opacity-100"
                    }`}
                  >
                    {playingId === `upload-${u}` ? "■" : "▶"}
                  </button>
                </div>
              );
            })}
            {uploads.length === 0 && !uploading && (
              <div className="text-text-muted text-xs text-center py-4">
                No uploads yet
              </div>
            )}
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
                    ? "bg-accent text-on-accent"
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
