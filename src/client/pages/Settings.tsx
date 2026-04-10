import { useEffect, useState, useCallback, useRef } from "react";
import type { SongMapping } from "../../shared/types";
import { JINGLES, playJingle, stopJingle } from "../lib/jingles";

interface SongFiles {
  walkups: string[];
  models: string[];
  root: string[];
}

export default function Settings() {
  const [songs, setSongs] = useState<SongFiles>({
    walkups: [],
    models: [],
    root: [],
  });
  const [mappings, setMappings] = useState<SongMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewingId, setPreviewingId] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [songsRes, mappingsRes] = await Promise.all([
        fetch("/api/songs").then((r) => r.json()),
        fetch("/api/song-mappings").then((r) => r.json()),
      ]);
      setSongs(songsRes as SongFiles);
      setMappings(mappingsRes as SongMapping[]);
    } catch (e) {
      console.error("Failed to load settings:", e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  function preview(jingleId: string) {
    if (previewingId === jingleId) {
      stopJingle();
      setPreviewingId(null);
      return;
    }
    stopJingle();
    playJingle(jingleId);
    setPreviewingId(jingleId);
    setTimeout(() => setPreviewingId(null), 3000);
  }

  return (
    <div className="min-h-screen bg-surface text-text-primary">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl text-text-primary">
              Settings
            </h1>
            <p className="text-sm text-text-secondary mt-1">
              Song mappings and audio configuration. Manage reps from the
              dashboard Team button.
            </p>
          </div>
          <a
            href="/"
            className="text-sm text-accent hover:text-accent/80 transition-colors"
          >
            ← Dashboard
          </a>
        </div>

        {loading ? (
          <div className="text-text-muted text-sm py-12 text-center">
            Loading…
          </div>
        ) : (
          <div className="space-y-6">
            {/* Jingle library preview */}
            <div className="rounded-xl border border-border bg-surface-raised p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-4">
                Built-in jingles
              </h3>
              <p className="text-xs text-text-muted mb-3">
                These are the walk-up jingles reps can pick from. Tap to
                preview.
              </p>
              <div className="grid grid-cols-3 gap-2">
                {JINGLES.map((j) => (
                  <button
                    key={j.id}
                    onClick={() => preview(j.id)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-left text-xs transition-all ${
                      previewingId === j.id
                        ? "bg-accent/15 border border-accent/30 text-accent"
                        : "bg-surface border border-border text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] flex-shrink-0 ${
                        previewingId === j.id
                          ? "bg-accent text-surface"
                          : "bg-text-muted/20 text-text-muted"
                      }`}
                    >
                      {previewingId === j.id ? "■" : "▶"}
                    </span>
                    <div className="min-w-0">
                      <div className="font-medium">{j.name}</div>
                      <div className="text-text-muted text-[10px]">
                        {j.description}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Upload mp3 (optional, for custom songs) */}
            <UploadSection songs={songs} onUpdate={fetchAll} />

            {/* Model → song mappings */}
            <MappingsSection
              songs={songs}
              mappings={mappings}
              onUpdate={fetchAll}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function UploadSection({
  songs,
  onUpdate,
}: {
  songs: SongFiles;
  onUpdate: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadFolder, setUploadFolder] = useState<"walkups" | "models">(
    "walkups",
  );
  const [uploading, setUploading] = useState(false);

  async function uploadFile(file: File) {
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    form.append("folder", uploadFolder);
    await fetch("/api/songs/upload", { method: "POST", body: form });
    setUploading(false);
    onUpdate();
  }

  return (
    <div className="rounded-xl border border-border bg-surface-raised p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-4">
        Custom audio files (optional)
      </h3>
      <p className="text-xs text-text-muted mb-3">
        Upload mp3/wav files for custom walk-ups or model-specific songs.
      </p>
      <div className="flex gap-3 items-end mb-4">
        <div>
          <label className="text-xs text-text-muted block mb-1">Folder</label>
          <select
            value={uploadFolder}
            onChange={(e) =>
              setUploadFolder(e.target.value as "walkups" | "models")
            }
            className="px-3 py-2 rounded-lg bg-surface border border-border text-text-primary text-sm focus:outline-none focus:border-accent"
          >
            <option value="walkups">Walk-ups</option>
            <option value="models">Models</option>
          </select>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadFile(f);
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="px-4 py-2 rounded-lg bg-accent text-surface font-medium text-sm hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            {uploading ? "Uploading…" : "Upload file"}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 text-xs">
        <div>
          <div className="text-text-muted mb-1">
            Walk-ups ({songs.walkups.length})
          </div>
          {songs.walkups.map((f) => (
            <div key={f} className="flex items-center gap-2 text-text-secondary py-0.5">
              <PlayBtn src={`/sounds/walkups/${f}`} />
              <span className="truncate">{f}</span>
            </div>
          ))}
          {songs.walkups.length === 0 && (
            <div className="text-text-muted">None</div>
          )}
        </div>
        <div>
          <div className="text-text-muted mb-1">
            Models ({songs.models.length})
          </div>
          {songs.models.map((f) => (
            <div key={f} className="flex items-center gap-2 text-text-secondary py-0.5">
              <PlayBtn src={`/sounds/models/${f}`} />
              <span className="truncate">{f}</span>
            </div>
          ))}
          {songs.models.length === 0 && (
            <div className="text-text-muted">None</div>
          )}
        </div>
      </div>
    </div>
  );
}

function MappingsSection({
  songs,
  mappings,
  onUpdate,
}: {
  songs: SongFiles;
  mappings: SongMapping[];
  onUpdate: () => void;
}) {
  const [newMatch, setNewMatch] = useState("");
  const [newSong, setNewSong] = useState("");

  async function addMapping() {
    if (!newMatch.trim() || !newSong) return;
    await fetch("/api/song-mappings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matchType: "model",
        matchValue: newMatch.trim(),
        songFile: newSong,
      }),
    });
    setNewMatch("");
    setNewSong("");
    onUpdate();
  }

  async function removeMapping(id: number) {
    await fetch(`/api/song-mappings/${id}`, { method: "DELETE" });
    onUpdate();
  }

  return (
    <div className="rounded-xl border border-border bg-surface-raised p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-4">
        Model → song mappings
      </h3>
      <p className="text-xs text-text-muted mb-3">
        When a device model matches the text, play this song during the initial
        celebration (before someone claims it).
      </p>
      <div className="flex flex-wrap gap-3 items-end mb-4">
        <div>
          <label className="text-xs text-text-muted block mb-1">
            Model contains
          </label>
          <input
            type="text"
            value={newMatch}
            onChange={(e) => setNewMatch(e.target.value)}
            placeholder="Slide Z1"
            className="px-3 py-2 rounded-lg bg-surface border border-border text-text-primary text-sm focus:outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="text-xs text-text-muted block mb-1">Song file</label>
          <select
            value={newSong}
            onChange={(e) => setNewSong(e.target.value)}
            className="px-3 py-2 rounded-lg bg-surface border border-border text-text-primary text-sm focus:outline-none focus:border-accent"
          >
            <option value="">Select…</option>
            {songs.models.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={addMapping}
          className="px-4 py-2 rounded-lg bg-accent text-surface font-medium text-sm"
        >
          Add
        </button>
      </div>
      <div className="space-y-2">
        {mappings
          .filter((m) => m.matchType === "model")
          .map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-3 rounded-lg bg-surface p-3 text-sm"
            >
              <span className="text-text-primary font-medium">
                "{m.matchValue}"
              </span>
              <span className="text-text-muted">→</span>
              <span className="text-text-secondary">{m.songFile}</span>
              <button
                onClick={() => removeMapping(m.id)}
                className="ml-auto text-xs text-red-soft"
              >
                Remove
              </button>
            </div>
          ))}
        {mappings.filter((m) => m.matchType === "model").length === 0 && (
          <div className="text-text-muted text-xs text-center py-4">
            No mappings. Upload model songs above first.
          </div>
        )}
      </div>
    </div>
  );
}

function PlayBtn({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  function toggle() {
    if (playing && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlaying(false);
      return;
    }
    const a = new Audio(src);
    audioRef.current = a;
    a.play().catch(() => {});
    a.onended = () => setPlaying(false);
    setPlaying(true);
  }

  return (
    <button
      onClick={toggle}
      className="w-5 h-5 rounded-full bg-accent/20 hover:bg-accent/30 flex items-center justify-center text-accent text-[8px] transition-colors flex-shrink-0"
    >
      {playing ? "■" : "▶"}
    </button>
  );
}
