import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useCallback } from "react";
import type { Rep } from "../../shared/types";
import { JINGLES, playJingle, stopJingle } from "../lib/jingles";
import { SongSearch, type SongChoice } from "./SongSearch";

const AVATAR_COLORS = [
  "#e2a336", "#ef4444", "#3b82f6", "#10b981", "#a855f7",
  "#f97316", "#06b6d4", "#ec4899", "#84cc16", "#6366f1",
];

interface RepManagerProps {
  open: boolean;
  onClose: () => void;
}

export function RepManager({ open, onClose }: RepManagerProps) {
  const [reps, setReps] = useState<Rep[]>([]);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(AVATAR_COLORS[0]);
  const [newSong, setNewSong] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editSong, setEditSong] = useState("");

  const fetchReps = useCallback(async () => {
    try {
      const r = await fetch("/api/reps");
      setReps((await r.json()) as Rep[]);
    } catch { /* offline */ }
  }, []);

  useEffect(() => {
    if (open) fetchReps();
  }, [open, fetchReps]);

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
    fetchReps();
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
    fetchReps();
  }

  async function removeRep(id: number) {
    await fetch(`/api/reps/${id}`, { method: "DELETE" });
    fetchReps();
  }

  function startEdit(rep: Rep) {
    setEditId(rep.id);
    setEditName(rep.name);
    setEditColor(rep.avatarColor);
    setEditSong(rep.walkupSong || "");
  }

  function handleNewSong(choice: SongChoice) {
    setNewSong(choice.value);
  }

  function handleEditSong(choice: SongChoice) {
    setEditSong(choice.value);
  }

  function previewCurrent(song: string) {
    if (!song) return;
    if (JINGLES.some((j) => j.id === song)) {
      playJingle(song);
      return;
    }
    if (song.startsWith("http")) {
      const a = new Audio(song);
      a.play().catch(() => {});
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg bg-surface border-l border-border overflow-y-auto"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display text-2xl text-text-primary">
                  Sales Team
                </h2>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text-secondary hover:bg-surface-hover transition-all text-lg"
                >
                  ✕
                </button>
              </div>

              {/* Add new rep */}
              <div className="rounded-xl border border-border bg-surface-raised p-4 mb-6">
                <div className="text-xs font-semibold uppercase tracking-[0.15em] text-text-muted mb-3">
                  Add rep
                </div>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Name"
                    className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-text-primary text-sm focus:outline-none focus:border-accent"
                    onKeyDown={(e) => e.key === "Enter" && addRep()}
                  />
                  <div>
                    <div className="text-xs text-text-muted mb-1.5">Color</div>
                    <div className="flex gap-1.5">
                      {AVATAR_COLORS.map((c) => (
                        <button
                          key={c}
                          onClick={() => setNewColor(c)}
                          className={`w-6 h-6 rounded-full border-2 transition-all ${
                            newColor === c ? "border-white scale-110" : "border-transparent"
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                  <SongSearch
                    value={newSong}
                    onChange={handleNewSong}
                    label="Walk-up song"
                  />
                  <button
                    onClick={addRep}
                    disabled={!newName.trim()}
                    className="w-full px-4 py-2 rounded-lg bg-accent text-surface font-medium text-sm hover:bg-accent/90 transition-colors disabled:opacity-40"
                  >
                    Add to team
                  </button>
                </div>
              </div>

              {/* Rep list */}
              <div className="space-y-2">
                {reps.map((rep) => (
                  <div
                    key={rep.id}
                    className="rounded-xl border border-border bg-surface-raised p-4"
                  >
                    {editId === rep.id ? (
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-text-primary text-sm focus:outline-none focus:border-accent"
                        />
                        <div className="flex gap-1.5">
                          {AVATAR_COLORS.map((c) => (
                            <button
                              key={c}
                              onClick={() => setEditColor(c)}
                              className={`w-5 h-5 rounded-full border-2 transition-all ${
                                editColor === c ? "border-white scale-110" : "border-transparent"
                              }`}
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </div>
                        <SongSearch
                          value={editSong}
                          onChange={handleEditSong}
                          label="Walk-up song"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => saveEdit(rep.id)}
                            className="px-3 py-1.5 rounded-lg bg-emerald text-surface text-sm font-medium"
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
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                          style={{ backgroundColor: rep.avatarColor }}
                        >
                          {rep.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-text-primary">
                            {rep.name}
                          </div>
                          <div className="text-xs text-text-muted truncate">
                            {getSongLabel(rep.walkupSong)}
                          </div>
                        </div>
                        {rep.walkupSong && (
                          <button
                            onClick={() => previewCurrent(rep.walkupSong!)}
                            className="w-7 h-7 rounded-full bg-accent/20 text-accent hover:bg-accent/30 flex items-center justify-center text-[10px] transition-colors flex-shrink-0"
                          >
                            ▶
                          </button>
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
                      </div>
                    )}
                  </div>
                ))}
                {reps.length === 0 && (
                  <div className="text-text-muted text-sm text-center py-8">
                    No reps yet. Add your team above.
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function getSongLabel(song: string | null): string {
  if (!song) return "No walk-up song";
  const jingle = JINGLES.find((j) => j.id === song);
  if (jingle) return jingle.name;
  if (song.startsWith("http")) return "Custom song";
  return song;
}
