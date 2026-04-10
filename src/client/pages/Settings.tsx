import { useEffect, useState, useCallback } from "react";
import type { SongMapping } from "../../shared/types";
import { JINGLES, playJingle, stopJingle } from "../lib/jingles";
import { SongSearch, type SongChoice } from "../components/SongSearch";
import { playSong } from "../lib/audio";

interface AppSettings {
  celebrationDuration: string;
  milestoneInterval: string;
  celebrateSlideOrders: string;
  bigOrderThreshold: string;
  bigOrderSong: string;
  bigOrderSongLabel: string;
}

export default function Settings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [mappings, setMappings] = useState<SongMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewingId, setPreviewingId] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, mappingsRes] = await Promise.all([
        fetch("/api/settings").then((r) => r.json()),
        fetch("/api/song-mappings").then((r) => r.json()),
      ]);
      setSettings(settingsRes as AppSettings);
      setMappings(mappingsRes as SongMapping[]);
    } catch (e) {
      console.error("Failed to load settings:", e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  async function saveSettings(patch: Partial<AppSettings>) {
    if (!settings) return;
    const updated = { ...settings, ...patch };
    setSettings(updated);
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    } catch {
      /* offline */
    }
    setSaving(false);
  }

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
              Celebration config, model song mappings, and big order songs.
            </p>
          </div>
          <a
            href="/"
            className="text-sm text-accent hover:text-accent/80 transition-colors"
          >
            ← Dashboard
          </a>
        </div>

        {loading || !settings ? (
          <div className="text-text-muted text-sm py-12 text-center">
            Loading…
          </div>
        ) : (
          <div className="space-y-6">
            {/* Celebration config */}
            <ConfigSection
              settings={settings}
              saving={saving}
              onSave={saveSettings}
            />

            {/* Big order song */}
            <BigOrderSection
              settings={settings}
              onSave={saveSettings}
            />

            {/* Model → song mappings */}
            <MappingsSection mappings={mappings} onUpdate={fetchAll} />

            {/* Jingle library preview */}
            <div className="rounded-xl border border-border bg-surface-raised p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-4">
                Built-in jingles
              </h3>
              <p className="text-xs text-text-muted mb-3">
                Synth jingles available for walk-ups, models, or big orders.
                Tap to preview.
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
          </div>
        )}
      </div>
    </div>
  );
}

// ── Config Section ──────────────────────────────────────────

function ConfigSection({
  settings,
  saving,
  onSave,
}: {
  settings: AppSettings;
  saving: boolean;
  onSave: (patch: Partial<AppSettings>) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-raised p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-4">
        Celebration
      </h3>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-text-primary">
              Celebrate all Slide orders
            </div>
            <div className="text-xs text-text-muted">
              Show full-screen celebration for every incoming order
            </div>
          </div>
          <button
            onClick={() =>
              onSave({
                celebrateSlideOrders:
                  settings.celebrateSlideOrders === "true" ? "false" : "true",
              })
            }
            className={`relative w-11 h-6 rounded-full transition-colors ${
              settings.celebrateSlideOrders === "true"
                ? "bg-accent"
                : "bg-text-muted/30"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                settings.celebrateSlideOrders === "true"
                  ? "translate-x-5"
                  : ""
              }`}
            />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-text-muted block mb-1">
              Celebration duration (seconds)
            </label>
            <input
              type="number"
              min={5}
              max={120}
              value={settings.celebrationDuration}
              onChange={(e) =>
                onSave({ celebrationDuration: e.target.value })
              }
              className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-text-primary text-sm focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="text-xs text-text-muted block mb-1">
              Milestone every N orders (0 = off)
            </label>
            <input
              type="number"
              min={0}
              value={settings.milestoneInterval}
              onChange={(e) =>
                onSave({ milestoneInterval: e.target.value })
              }
              className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-text-primary text-sm focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        {saving && (
          <div className="text-[10px] text-accent">Saving…</div>
        )}
      </div>
    </div>
  );
}

// ── Big Order Section ───────────────────────────────────────

function BigOrderSection({
  settings,
  onSave,
}: {
  settings: AppSettings;
  onSave: (patch: Partial<AppSettings>) => void;
}) {
  function handleSong(choice: SongChoice) {
    onSave({
      bigOrderSong: choice.value,
      bigOrderSongLabel: choice.label,
    });
  }

  return (
    <div className="rounded-xl border border-border bg-surface-raised p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-1">
        Big order celebration
      </h3>
      <p className="text-xs text-text-muted mb-4">
        When a single batch has this many or more orders, play a special song
        instead of the model default.
      </p>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-text-muted block mb-1">
            Minimum orders to trigger (0 = disabled)
          </label>
          <input
            type="number"
            min={0}
            value={settings.bigOrderThreshold}
            onChange={(e) =>
              onSave({ bigOrderThreshold: e.target.value })
            }
            className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-text-primary text-sm focus:outline-none focus:border-accent"
          />
        </div>
        <SongSearch
          value={settings.bigOrderSong}
          onChange={handleSong}
          label="Big order song"
        />
      </div>
    </div>
  );
}

// ── Model Mappings ──────────────────────────────────────────

function MappingsSection({
  mappings,
  onUpdate,
}: {
  mappings: SongMapping[];
  onUpdate: () => void;
}) {
  const [newMatch, setNewMatch] = useState("");
  const [newSongValue, setNewSongValue] = useState("");
  const [newSongLabel, setNewSongLabel] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editMatch, setEditMatch] = useState("");
  const [editSongValue, setEditSongValue] = useState("");
  const [editSongLabel, setEditSongLabel] = useState("");

  async function addMapping() {
    if (!newMatch.trim() || !newSongValue) return;
    await fetch("/api/song-mappings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matchType: "model",
        matchValue: newMatch.trim(),
        songFile: newSongValue,
        songLabel: newSongLabel,
      }),
    });
    setNewMatch("");
    setNewSongValue("");
    setNewSongLabel("");
    onUpdate();
  }

  async function saveEdit(id: number) {
    await fetch(`/api/song-mappings/${id}`, { method: "DELETE" });
    await fetch("/api/song-mappings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matchType: "model",
        matchValue: editMatch.trim(),
        songFile: editSongValue,
        songLabel: editSongLabel,
      }),
    });
    setEditId(null);
    onUpdate();
  }

  async function removeMapping(id: number) {
    await fetch(`/api/song-mappings/${id}`, { method: "DELETE" });
    onUpdate();
  }

  function startEdit(m: SongMapping) {
    setEditId(m.id);
    setEditMatch(m.matchValue || "");
    setEditSongValue(m.songFile);
    setEditSongLabel(m.songLabel || "");
  }

  function handleNewSong(choice: SongChoice) {
    setNewSongValue(choice.value);
    setNewSongLabel(choice.label);
  }

  function handleEditSong(choice: SongChoice) {
    setEditSongValue(choice.value);
    setEditSongLabel(choice.label);
  }

  const modelMappings = mappings.filter((m) => m.matchType === "model");

  return (
    <div className="rounded-xl border border-border bg-surface-raised p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-1">
        Model → song mappings
      </h3>
      <p className="text-xs text-text-muted mb-4">
        When a device model matches the text below, play this song during the
        order celebration.
      </p>

      {/* Add new mapping */}
      <div className="rounded-xl border border-border bg-surface p-4 mb-4">
        <div className="text-xs font-semibold uppercase tracking-[0.15em] text-text-muted mb-3">
          Add mapping
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-text-muted block mb-1">
              Model contains
            </label>
            <input
              type="text"
              value={newMatch}
              onChange={(e) => setNewMatch(e.target.value)}
              placeholder="e.g. Slide Z1"
              className="w-full px-3 py-2 rounded-lg bg-surface-raised border border-border text-text-primary text-sm focus:outline-none focus:border-accent"
            />
          </div>
          <SongSearch
            value={newSongValue}
            onChange={handleNewSong}
            label="Celebration song"
          />
          <button
            onClick={addMapping}
            disabled={!newMatch.trim() || !newSongValue}
            className="w-full px-4 py-2 rounded-lg bg-accent text-surface font-medium text-sm hover:bg-accent/90 disabled:opacity-40 transition-colors"
          >
            Add mapping
          </button>
        </div>
      </div>

      {/* Existing mappings */}
      <div className="space-y-2">
        {modelMappings.map((m) => (
          <div
            key={m.id}
            className="rounded-xl border border-border bg-surface p-4"
          >
            {editId === m.id ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-text-muted block mb-1">
                    Model contains
                  </label>
                  <input
                    type="text"
                    value={editMatch}
                    onChange={(e) => setEditMatch(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-surface-raised border border-border text-text-primary text-sm focus:outline-none focus:border-accent"
                  />
                </div>
                <SongSearch
                  value={editSongValue}
                  onChange={handleEditSong}
                  label="Celebration song"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => saveEdit(m.id)}
                    disabled={!editMatch.trim() || !editSongValue}
                    className="px-3 py-1.5 rounded-lg bg-emerald text-surface text-sm font-medium disabled:opacity-40"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditId(null)}
                    className="px-3 py-1.5 rounded-lg text-text-muted text-sm hover:text-text-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-text-primary text-sm">
                    {m.matchValue}
                  </div>
                  <div className="text-xs text-text-muted truncate">
                    {m.songLabel || getSongLabel(m.songFile)}
                  </div>
                </div>
                <button
                  onClick={() => playSong(m.songFile)}
                  className="w-7 h-7 rounded-full bg-accent/20 text-accent hover:bg-accent/30 flex items-center justify-center text-[10px] transition-colors flex-shrink-0"
                >
                  ▶
                </button>
                <button
                  onClick={() => startEdit(m)}
                  className="text-xs text-text-secondary hover:text-text-primary transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => removeMapping(m.id)}
                  className="text-xs text-red-soft hover:text-red-400 transition-colors"
                >
                  Remove
                </button>
              </div>
            )}
          </div>
        ))}
        {modelMappings.length === 0 && (
          <div className="text-text-muted text-xs text-center py-4">
            No mappings yet. Add one above.
          </div>
        )}
      </div>
    </div>
  );
}

function getSongLabel(song: string): string {
  const jingle = JINGLES.find((j) => j.id === song);
  if (jingle) return jingle.name;
  if (song.startsWith("http")) return "Deezer song";
  return song;
}
