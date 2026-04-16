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
  bigOrderOverridesRepWalkup: string;
}

type Tab = "general" | "models" | "sounds";

export default function Settings() {
  const [tab, setTab] = useState<Tab>("general");
  const [serverSettings, setServerSettings] = useState<AppSettings | null>(null);
  const [draft, setDraft] = useState<AppSettings | null>(null);
  const [mappings, setMappings] = useState<SongMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const dirty =
    draft && serverSettings
      ? JSON.stringify(draft) !== JSON.stringify(serverSettings)
      : false;

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, mappingsRes] = await Promise.all([
        fetch("/api/settings").then((r) => r.json()),
        fetch("/api/song-mappings").then((r) => r.json()),
      ]);
      const s = settingsRes as AppSettings;
      setServerSettings(s);
      setDraft(s);
      setMappings(mappingsRes as SongMapping[]);
    } catch (e) {
      console.error("Failed to load settings:", e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  function updateDraft(patch: Partial<AppSettings>) {
    if (!draft) return;
    setDraft({ ...draft, ...patch });
    setSaved(false);
  }

  async function saveAll() {
    if (!draft) return;
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      setServerSettings(draft);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* offline */ }
    setSaving(false);
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: "general", label: "General" },
    { id: "models", label: "Model Songs" },
    { id: "sounds", label: "Sound Library" },
  ];

  return (
    <div className="min-h-screen bg-surface text-text-primary">
      <div className="max-w-4xl mx-auto px-6 sm:px-8 py-8 sm:py-10">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8 pb-8 border-b border-border">
          <h1 className="font-display text-3xl sm:text-4xl font-normal text-text-primary tracking-tight">
            Settings
          </h1>
          <a
            href="/"
            className="text-sm font-semibold text-accent hover:text-accent/85 transition-colors uppercase tracking-wider focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface rounded-lg px-2 py-1 -mr-2"
          >
            ← Dashboard
          </a>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border mb-8 -mt-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-5 py-3 text-sm font-semibold transition-colors border-b-2 -mb-px rounded-t-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${
                tab === t.id
                  ? "border-accent text-accent bg-surface-raised/40"
                  : "border-transparent text-text-muted hover:text-text-secondary hover:bg-surface-hover/30"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading || !draft ? (
          <div className="text-text-muted text-lg py-16 text-center">
            Loading…
          </div>
        ) : (
          <>
            {tab === "general" && (
              <GeneralTab draft={draft} onUpdate={updateDraft} />
            )}
            {tab === "models" && (
              <ModelsTab mappings={mappings} onUpdate={fetchAll} />
            )}
            {tab === "sounds" && <SoundsTab />}

            {/* Save bar — only for General tab */}
            {tab === "general" && (
              <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-surface-raised/90 backdrop-blur-md">
                <div className="max-w-4xl mx-auto px-6 sm:px-8 py-4 flex items-center justify-between gap-4">
                  <div className="text-sm text-text-muted min-w-0">
                    {saved
                      ? "✓ Saved"
                      : dirty
                        ? "You have unsaved changes"
                        : "All changes saved"}
                  </div>
                  <button
                    type="button"
                    onClick={saveAll}
                    disabled={!dirty || saving}
                    className={`shrink-0 px-7 py-2.5 rounded-xl font-semibold text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised ${
                      dirty
                        ? "bg-accent text-on-accent hover:bg-accent/90"
                        : "bg-text-muted/15 text-text-muted cursor-not-allowed"
                    }`}
                  >
                    {saving ? "Saving…" : "Save changes"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── General Tab ─────────────────────────────────────────────

function GeneralTab({
  draft,
  onUpdate,
}: {
  draft: AppSettings;
  onUpdate: (patch: Partial<AppSettings>) => void;
}) {
  function handleBigSong(choice: SongChoice) {
    onUpdate({
      bigOrderSong: choice.value,
      bigOrderSongLabel: choice.label,
    });
  }

  return (
    <div className="space-y-8 pb-24">
      {/* Celebration */}
      <section>
        <h3 className="text-base font-bold uppercase tracking-wider text-text-secondary mb-4">
          Celebrations
        </h3>
        <div className="space-y-5 rounded-2xl border border-border bg-surface-raised p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-base font-semibold text-text-primary">
                Celebrate all Slide orders
              </div>
              <div className="text-sm text-text-secondary mt-0.5">
                Show full-screen celebration for every incoming order
              </div>
            </div>
            <button
              onClick={() =>
                onUpdate({
                  celebrateSlideOrders:
                    draft.celebrateSlideOrders === "true" ? "false" : "true",
                })
              }
              className={`relative w-12 h-7 rounded-full transition-colors ${
                draft.celebrateSlideOrders === "true"
                  ? "bg-accent"
                  : "bg-text-muted/30"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                  draft.celebrateSlideOrders === "true" ? "translate-x-5" : ""
                }`}
              />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="text-sm font-medium text-text-secondary block mb-2">
                Duration (seconds)
              </label>
              <input
                type="number"
                min={5}
                max={120}
                value={draft.celebrationDuration}
                onChange={(e) =>
                  onUpdate({ celebrationDuration: e.target.value })
                }
                className="w-full px-4 py-3 rounded-lg bg-surface border border-border text-text-primary text-base focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-text-secondary block mb-2">
                Milestone every N orders (0 = off)
              </label>
              <input
                type="number"
                min={0}
                value={draft.milestoneInterval}
                onChange={(e) =>
                  onUpdate({ milestoneInterval: e.target.value })
                }
                className="w-full px-4 py-3 rounded-lg bg-surface border border-border text-text-primary text-base focus:outline-none focus:border-accent"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Big orders */}
      <section>
        <h3 className="text-base font-bold uppercase tracking-wider text-text-secondary mb-4">
          Big Order
        </h3>
        <div className="rounded-2xl border border-border bg-surface-raised p-6 space-y-4">
          <p className="text-sm text-text-secondary">
            When a single batch has this many or more orders, play a special
            song instead of the model default.
          </p>
          <div className="flex items-center justify-between gap-4 pt-1 pb-2 border-b border-border">
            <div>
              <div className="text-base font-semibold text-text-primary">
                Big order song overrides rep walk-up
              </div>
              <div className="text-sm text-text-secondary mt-0.5">
                On: play the big order track (or model default if none set),
                even when the account owner matches a teammate with a personal
                walk-up. Off: matched rep walk-up still wins. Hero visuals always
                follow the rep when matched.
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                onUpdate({
                  bigOrderOverridesRepWalkup:
                    draft.bigOrderOverridesRepWalkup === "true"
                      ? "false"
                      : "true",
                })
              }
              className={`relative shrink-0 w-12 h-7 rounded-full transition-colors ${
                draft.bigOrderOverridesRepWalkup === "true"
                  ? "bg-accent"
                  : "bg-text-muted/30"
              }`}
              aria-pressed={draft.bigOrderOverridesRepWalkup === "true"}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                  draft.bigOrderOverridesRepWalkup === "true"
                    ? "translate-x-5"
                    : ""
                }`}
              />
            </button>
          </div>
          <div>
            <label className="text-sm font-medium text-text-secondary block mb-2">
              Minimum orders to trigger (0 = disabled)
            </label>
            <input
              type="number"
              min={0}
              value={draft.bigOrderThreshold}
              onChange={(e) =>
                onUpdate({ bigOrderThreshold: e.target.value })
              }
              className="w-full px-4 py-3 rounded-lg bg-surface border border-border text-text-primary text-base focus:outline-none focus:border-accent"
            />
          </div>
          <SongSearch
            value={draft.bigOrderSong}
            onChange={handleBigSong}
            walkupLabel={draft.bigOrderSongLabel}
            label="Big order song"
          />
        </div>
      </section>
    </div>
  );
}

// ── Models Tab ──────────────────────────────────────────────

function ModelsTab({
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

  const modelMappings = mappings.filter((m) => m.matchType === "model");

  return (
    <div className="space-y-6">
      <p className="text-sm text-text-secondary">
        When a device model name contains the text below, play the assigned song
        during the order celebration.
      </p>

      {/* Add new */}
      <div className="rounded-2xl border border-border bg-surface-raised p-6 space-y-4">
        <div className="text-sm font-bold uppercase tracking-widest text-text-secondary">
          Add mapping
        </div>
        <div>
          <label className="text-sm font-medium text-text-secondary block mb-2">
            Model contains
          </label>
          <input
            type="text"
            value={newMatch}
            onChange={(e) => setNewMatch(e.target.value)}
            placeholder="e.g. Slide Z1"
            className="w-full px-4 py-3 rounded-lg bg-surface border border-border text-text-primary text-base focus:outline-none focus:border-accent placeholder:text-text-muted"
          />
        </div>
        <SongSearch
          value={newSongValue}
          onChange={(c) => {
            setNewSongValue(c.value);
            setNewSongLabel(c.label);
          }}
          label="Celebration song"
        />
        <button
          onClick={addMapping}
          disabled={!newMatch.trim() || !newSongValue}
          className="w-full px-5 py-3 rounded-lg bg-accent text-on-accent font-semibold text-base hover:bg-accent/90 disabled:opacity-40 transition-colors"
        >
          Add mapping
        </button>
      </div>

      {/* Existing */}
      <div className="space-y-3">
        {modelMappings.map((m) => (
          <div
            key={m.id}
            className="rounded-2xl border border-border bg-surface-raised p-5"
          >
            {editId === m.id ? (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-text-secondary block mb-2">
                    Model contains
                  </label>
                  <input
                    type="text"
                    value={editMatch}
                    onChange={(e) => setEditMatch(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-surface border border-border text-text-primary text-base focus:outline-none focus:border-accent"
                  />
                </div>
                <SongSearch
                  value={editSongValue}
                  onChange={(c) => {
                    setEditSongValue(c.value);
                    setEditSongLabel(c.label);
                  }}
                  label="Celebration song"
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => saveEdit(m.id)}
                    disabled={!editMatch.trim() || !editSongValue}
                    className="px-6 py-2.5 rounded-lg bg-accent text-on-accent text-base font-semibold disabled:opacity-40"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditId(null)}
                    className="px-6 py-2.5 rounded-lg text-text-muted text-base hover:text-text-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-text-primary text-base">
                    {m.matchValue}
                  </div>
                  <div className="text-sm text-text-secondary truncate mt-0.5">
                    {m.songLabel || getSongLabel(m.songFile)}
                  </div>
                </div>
                <button
                  onClick={() => playSong(m.songFile)}
                  className="w-9 h-9 rounded-full bg-accent/20 text-accent hover:bg-accent/30 flex items-center justify-center text-sm transition-colors flex-shrink-0"
                >
                  ▶
                </button>
                <button
                  onClick={() => startEdit(m)}
                  className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => removeMapping(m.id)}
                  className="text-sm font-medium text-red-soft hover:text-red-400 transition-colors"
                >
                  Remove
                </button>
              </div>
            )}
          </div>
        ))}
        {modelMappings.length === 0 && (
          <div className="text-text-muted text-base text-center py-12 rounded-2xl border border-border bg-surface-raised">
            No model mappings yet. Add one above.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sounds Tab ──────────────────────────────────────────────

function SoundsTab() {
  const [previewingId, setPreviewingId] = useState<string | null>(null);

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
    <div className="space-y-8">
      <p className="text-sm text-text-secondary">
        Preview all available sounds. These can be assigned to reps (Team
        drawer) or device models (Model Songs tab).
      </p>

      {/* Jingles */}
      <section>
        <h3 className="text-base font-bold uppercase tracking-wider text-text-secondary mb-4">
          Built-in jingles
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {JINGLES.map((j) => (
            <button
              key={j.id}
              onClick={() => preview(j.id)}
              className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-left text-sm transition-all ${
                previewingId === j.id
                  ? "bg-accent/15 border border-accent/30 text-accent"
                  : "bg-surface-raised border border-border text-text-secondary hover:text-text-primary"
              }`}
            >
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${
                  previewingId === j.id
                    ? "bg-accent text-on-accent"
                    : "bg-text-muted/20 text-text-muted"
                }`}
              >
                {previewingId === j.id ? "■" : "▶"}
              </span>
              <div className="min-w-0">
                <div className="font-semibold">{j.name}</div>
                <div className="text-text-muted text-xs mt-0.5">
                  {j.description}
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Catalog search note */}
      <section>
        <h3 className="text-base font-bold uppercase tracking-wider text-text-secondary mb-4">
          Song search & previews
        </h3>
        <div className="rounded-2xl border border-border bg-surface-raised p-6 text-sm text-text-secondary leading-relaxed">
          Search for real songs when assigning walk-up songs (Team drawer) or
          model celebration songs (Model Songs tab). When{" "}
          <code className="text-text-primary font-mono text-xs">
            APPLE_MUSIC_*
          </code>{" "}
          keys are set in <code className="text-text-primary font-mono text-xs">.env</code>, results
          use the Apple Music catalog and preview audio. Otherwise the app uses
          Deezer search. Use the start-offset slider to pick the best part of the
          clip.
        </div>
      </section>

      {/* Uploads note */}
      <section>
        <h3 className="text-base font-bold uppercase tracking-wider text-text-secondary mb-4">
          Custom uploads
        </h3>
        <div className="rounded-2xl border border-border bg-surface-raised p-6 text-sm text-text-secondary leading-relaxed">
          Upload your own MP3 or WAV files when assigning songs. Uploaded files
          appear in the "Uploads" tab of the song picker. Use the start-offset
          slider to pick the exact 20-second window you want.
        </div>
      </section>
    </div>
  );
}

function getSongLabel(song: string): string {
  const jingle = JINGLES.find((j) => j.id === song);
  if (jingle) return jingle.name;
  if (song.startsWith("http")) return "Catalog preview";
  if (song.startsWith("/sounds/")) return song.split("/").pop() || song;
  return song;
}
