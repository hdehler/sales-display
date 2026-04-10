import { useEffect, useState, useCallback, useRef } from "react";
import type { Rep, SongMapping } from "../../shared/types";

const AVATAR_COLORS = [
  "#e2a336",
  "#ef4444",
  "#3b82f6",
  "#10b981",
  "#a855f7",
  "#f97316",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
  "#6366f1",
];

interface SongFiles {
  walkups: string[];
  models: string[];
  root: string[];
}

export default function Settings() {
  const [tab, setTab] = useState<"reps" | "songs">("reps");
  const [reps, setReps] = useState<Rep[]>([]);
  const [songs, setSongs] = useState<SongFiles>({
    walkups: [],
    models: [],
    root: [],
  });
  const [mappings, setMappings] = useState<SongMapping[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [repsRes, songsRes, mappingsRes] = await Promise.all([
        fetch("/api/reps").then((r) => r.json()),
        fetch("/api/songs").then((r) => r.json()),
        fetch("/api/song-mappings").then((r) => r.json()),
      ]);
      setReps(repsRes as Rep[]);
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

  return (
    <div className="min-h-screen bg-surface text-text-primary">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl text-text-primary">
              Settings
            </h1>
            <p className="text-sm text-text-secondary mt-1">
              Manage reps, walk-up songs, and model mappings
            </p>
          </div>
          <a
            href="/"
            className="text-sm text-accent hover:text-accent/80 transition-colors"
          >
            ← Back to dashboard
          </a>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 mb-6 rounded-lg bg-surface-raised p-1 border border-border w-fit">
          {(["reps", "songs"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                tab === t
                  ? "bg-accent text-surface shadow-sm"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {t === "reps" ? "Reps" : "Songs & Mappings"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-text-muted text-sm py-12 text-center">
            Loading…
          </div>
        ) : tab === "reps" ? (
          <RepsTab reps={reps} songs={songs} onUpdate={fetchAll} />
        ) : (
          <SongsTab
            songs={songs}
            mappings={mappings}
            onUpdate={fetchAll}
          />
        )}
      </div>
    </div>
  );
}

// ── Reps Tab ──────────────────────────────────────────────

function RepsTab({
  reps,
  songs,
  onUpdate,
}: {
  reps: Rep[];
  songs: SongFiles;
  onUpdate: () => void;
}) {
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(AVATAR_COLORS[0]);
  const [newSong, setNewSong] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editSong, setEditSong] = useState("");

  const allSongs = [...songs.walkups];

  async function addRep() {
    if (!newName.trim()) return;
    await fetch("/api/reps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName.trim(),
        avatarColor: newColor,
        walkupSong: newSong || undefined,
      }),
    });
    setNewName("");
    setNewSong("");
    onUpdate();
  }

  async function saveEdit(id: number) {
    await fetch(`/api/reps/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName,
        avatarColor: editColor,
        walkupSong: editSong || null,
      }),
    });
    setEditId(null);
    onUpdate();
  }

  async function removeRep(id: number) {
    await fetch(`/api/reps/${id}`, { method: "DELETE" });
    onUpdate();
  }

  function startEdit(rep: Rep) {
    setEditId(rep.id);
    setEditName(rep.name);
    setEditColor(rep.avatarColor);
    setEditSong(rep.walkupSong || "");
  }

  return (
    <div className="space-y-6">
      {/* Add new rep form */}
      <div className="rounded-xl border border-border bg-surface-raised p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-4">
          Add rep
        </h3>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs text-text-muted block mb-1">Name</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Harry Dehler"
              className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-text-primary text-sm focus:outline-none focus:border-accent"
              onKeyDown={(e) => e.key === "Enter" && addRep()}
            />
          </div>
          <div>
            <label className="text-xs text-text-muted block mb-1">Color</label>
            <div className="flex gap-1">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setNewColor(c)}
                  className={`w-6 h-6 rounded-full border-2 transition-all ${
                    newColor === c
                      ? "border-white scale-110"
                      : "border-transparent"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div className="min-w-[160px]">
            <label className="text-xs text-text-muted block mb-1">
              Walk-up song
            </label>
            <select
              value={newSong}
              onChange={(e) => setNewSong(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-text-primary text-sm focus:outline-none focus:border-accent"
            >
              <option value="">None</option>
              {allSongs.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={addRep}
            className="px-4 py-2 rounded-lg bg-accent text-surface font-medium text-sm hover:bg-accent/90 transition-colors"
          >
            Add
          </button>
        </div>
      </div>

      {/* Rep list */}
      <div className="space-y-2">
        {reps.map((rep) => (
          <div
            key={rep.id}
            className="rounded-xl border border-border bg-surface-raised p-4 flex items-center gap-4"
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
              style={{ backgroundColor: rep.avatarColor }}
            >
              {rep.name.charAt(0).toUpperCase()}
            </div>

            {editId === rep.id ? (
              <div className="flex-1 flex flex-wrap gap-3 items-end">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-surface border border-border text-text-primary text-sm focus:outline-none focus:border-accent"
                />
                <div className="flex gap-1 items-center">
                  {AVATAR_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setEditColor(c)}
                      className={`w-5 h-5 rounded-full border-2 transition-all ${
                        editColor === c
                          ? "border-white scale-110"
                          : "border-transparent"
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <select
                  value={editSong}
                  onChange={(e) => setEditSong(e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-surface border border-border text-text-primary text-sm focus:outline-none focus:border-accent"
                >
                  <option value="">None</option>
                  {allSongs.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => saveEdit(rep.id)}
                  className="px-3 py-1.5 rounded-lg bg-emerald text-surface text-sm font-medium"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditId(null)}
                  className="px-3 py-1.5 rounded-lg text-text-muted text-sm"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <>
                <div className="flex-1">
                  <div className="font-medium text-text-primary">
                    {rep.name}
                  </div>
                  <div className="text-xs text-text-muted">
                    {rep.walkupSong || "No walk-up song"}
                  </div>
                </div>
                {rep.walkupSong && (
                  <PlayButton src={`/sounds/walkups/${rep.walkupSong}`} />
                )}
                <button
                  onClick={() => startEdit(rep)}
                  className="text-xs text-text-secondary hover:text-text-primary transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => removeRep(rep.id)}
                  className="text-xs text-red-soft hover:text-red-400 transition-colors"
                >
                  Remove
                </button>
              </>
            )}
          </div>
        ))}
        {reps.length === 0 && (
          <div className="text-text-muted text-sm text-center py-8">
            No reps yet. Add one above.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Songs Tab ─────────────────────────────────────────────

function SongsTab({
  songs,
  mappings,
  onUpdate,
}: {
  songs: SongFiles;
  mappings: SongMapping[];
  onUpdate: () => void;
}) {
  const [newModelMatch, setNewModelMatch] = useState("");
  const [newModelSong, setNewModelSong] = useState("");
  const [newDefaultSong, setNewDefaultSong] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadFolder, setUploadFolder] = useState<"walkups" | "models">(
    "walkups",
  );
  const [uploading, setUploading] = useState(false);

  const allModelSongs = songs.models;
  const allRootSongs = songs.root;
  const currentDefault = mappings.find((m) => m.matchType === "default");

  async function uploadFile(file: File) {
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    form.append("folder", uploadFolder);
    await fetch("/api/songs/upload", { method: "POST", body: form });
    setUploading(false);
    onUpdate();
  }

  async function addModelMapping() {
    if (!newModelMatch.trim() || !newModelSong) return;
    await fetch("/api/song-mappings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matchType: "model",
        matchValue: newModelMatch.trim(),
        songFile: newModelSong,
      }),
    });
    setNewModelMatch("");
    setNewModelSong("");
    onUpdate();
  }

  async function setDefault() {
    if (!newDefaultSong) return;
    await fetch("/api/song-mappings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matchType: "default",
        matchValue: null,
        songFile: newDefaultSong,
      }),
    });
    setNewDefaultSong("");
    onUpdate();
  }

  async function removeMapping(id: number) {
    await fetch(`/api/song-mappings/${id}`, { method: "DELETE" });
    onUpdate();
  }

  return (
    <div className="space-y-6">
      {/* Upload */}
      <div className="rounded-xl border border-border bg-surface-raised p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-4">
          Upload song
        </h3>
        <div className="flex gap-3 items-end">
          <div>
            <label className="text-xs text-text-muted block mb-1">
              Folder
            </label>
            <select
              value={uploadFolder}
              onChange={(e) =>
                setUploadFolder(e.target.value as "walkups" | "models")
              }
              className="px-3 py-2 rounded-lg bg-surface border border-border text-text-primary text-sm focus:outline-none focus:border-accent"
            >
              <option value="walkups">Walk-ups (rep songs)</option>
              <option value="models">Models (device songs)</option>
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
              {uploading ? "Uploading…" : "Choose file"}
            </button>
          </div>
        </div>

        {/* File lists */}
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-text-muted mb-2">
              Walk-up songs ({songs.walkups.length})
            </div>
            {songs.walkups.map((f) => (
              <div
                key={f}
                className="flex items-center gap-2 text-xs text-text-secondary py-1"
              >
                <PlayButton src={`/sounds/walkups/${f}`} />
                <span className="truncate">{f}</span>
              </div>
            ))}
          </div>
          <div>
            <div className="text-xs text-text-muted mb-2">
              Model songs ({songs.models.length})
            </div>
            {songs.models.map((f) => (
              <div
                key={f}
                className="flex items-center gap-2 text-xs text-text-secondary py-1"
              >
                <PlayButton src={`/sounds/models/${f}`} />
                <span className="truncate">{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Default song */}
      <div className="rounded-xl border border-border bg-surface-raised p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-4">
          Default celebration song
        </h3>
        {currentDefault && (
          <div className="flex items-center gap-3 mb-3 text-sm">
            <PlayButton src={`/sounds/${currentDefault.songFile}`} />
            <span className="text-text-primary">{currentDefault.songFile}</span>
            <button
              onClick={() => removeMapping(currentDefault.id)}
              className="text-xs text-red-soft"
            >
              Remove
            </button>
          </div>
        )}
        <div className="flex gap-3 items-end">
          <select
            value={newDefaultSong}
            onChange={(e) => setNewDefaultSong(e.target.value)}
            className="px-3 py-2 rounded-lg bg-surface border border-border text-text-primary text-sm focus:outline-none focus:border-accent"
          >
            <option value="">Select song…</option>
            {allRootSongs.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
            {allModelSongs.map((s) => (
              <option key={`models/${s}`} value={`models/${s}`}>
                models/{s}
              </option>
            ))}
          </select>
          <button
            onClick={setDefault}
            className="px-4 py-2 rounded-lg bg-accent text-surface font-medium text-sm"
          >
            Set default
          </button>
        </div>
      </div>

      {/* Model mappings */}
      <div className="rounded-xl border border-border bg-surface-raised p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-4">
          Model → song mappings
        </h3>
        <p className="text-xs text-text-muted mb-3">
          When a device model contains the match text, this song plays instead of
          the default.
        </p>

        <div className="flex flex-wrap gap-3 items-end mb-4">
          <div>
            <label className="text-xs text-text-muted block mb-1">
              Model contains
            </label>
            <input
              type="text"
              value={newModelMatch}
              onChange={(e) => setNewModelMatch(e.target.value)}
              placeholder="Slide Z1"
              className="px-3 py-2 rounded-lg bg-surface border border-border text-text-primary text-sm focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="text-xs text-text-muted block mb-1">Song</label>
            <select
              value={newModelSong}
              onChange={(e) => setNewModelSong(e.target.value)}
              className="px-3 py-2 rounded-lg bg-surface border border-border text-text-primary text-sm focus:outline-none focus:border-accent"
            >
              <option value="">Select…</option>
              {allModelSongs.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={addModelMapping}
            className="px-4 py-2 rounded-lg bg-accent text-surface font-medium text-sm"
          >
            Add mapping
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
                <PlayButton src={`/sounds/models/${m.songFile}`} />
                <span className="text-text-secondary">{m.songFile}</span>
                <button
                  onClick={() => removeMapping(m.id)}
                  className="ml-auto text-xs text-red-soft"
                >
                  Remove
                </button>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

// ── Play button ───────────────────────────────────────────

function PlayButton({ src }: { src: string }) {
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
      className="w-6 h-6 rounded-full bg-accent/20 hover:bg-accent/30 flex items-center justify-center text-accent text-[10px] transition-colors flex-shrink-0"
      title={playing ? "Stop" : "Play"}
    >
      {playing ? "■" : "▶"}
    </button>
  );
}
