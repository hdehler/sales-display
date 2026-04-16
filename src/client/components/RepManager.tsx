import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useCallback } from "react";
import type { Rep } from "../../shared/types";
import {
  spiritAnimalEmoji,
  spiritAnimalLabel,
} from "../../shared/animals";
import { SpiritAnimalPicker } from "./SpiritAnimalPicker";
import { TwemojiImg } from "./TwemojiImg";
import { playSong } from "../lib/audio";
import { SongSearch, type SongChoice, walkupSongDisplayLine } from "./SongSearch";

const AVATAR_COLORS = [
  "#e2a336", "#ef4444", "#3b82f6", "#10b981", "#a855f7",
  "#f97316", "#06b6d4", "#ec4899", "#84cc16", "#6366f1",
];

interface RepManagerProps {
  open: boolean;
  onClose: () => void;
  onRepsChanged?: () => void;
}

export function RepManager({ open, onClose, onRepsChanged }: RepManagerProps) {
  const [reps, setReps] = useState<Rep[]>([]);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(AVATAR_COLORS[0]);
  const [newSong, setNewSong] = useState("");
  const [newWalkupLabel, setNewWalkupLabel] = useState("");
  const [newSpiritAnimal, setNewSpiritAnimal] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editSong, setEditSong] = useState("");
  const [editWalkupLabel, setEditWalkupLabel] = useState("");
  const [editSpiritAnimal, setEditSpiritAnimal] = useState("");

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
        walkupSongLabel: newWalkupLabel.trim() || null,
        spiritAnimal: newSpiritAnimal || undefined,
      }),
    });
    setNewName("");
    setNewSong("");
    setNewWalkupLabel("");
    setNewSpiritAnimal("");
    fetchReps();
    onRepsChanged?.();
  }

  async function saveEdit(id: number) {
    await fetch(`/api/reps/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName,
        avatarColor: editColor,
        walkupSong: editSong || null,
        walkupSongLabel: editSong.trim()
          ? editWalkupLabel.trim() || null
          : null,
        spiritAnimal: editSpiritAnimal || null,
      }),
    });
    setEditId(null);
    fetchReps();
    onRepsChanged?.();
  }

  async function removeRep(id: number) {
    await fetch(`/api/reps/${id}`, { method: "DELETE" });
    fetchReps();
    onRepsChanged?.();
  }

  function startEdit(rep: Rep) {
    setEditId(rep.id);
    setEditName(rep.name);
    setEditColor(rep.avatarColor);
    setEditSong(rep.walkupSong || "");
    setEditWalkupLabel(rep.walkupSongLabel?.trim() || "");
    setEditSpiritAnimal(rep.spiritAnimal || "");
  }

  function handleNewSong(choice: SongChoice) {
    setNewSong(choice.value);
    setNewWalkupLabel(
      choice.type === "none" ? "" : choice.label?.trim() || "",
    );
  }

  function handleEditSong(choice: SongChoice) {
    setEditSong(choice.value);
    setEditWalkupLabel(
      choice.type === "none" ? "" : choice.label?.trim() || "",
    );
  }

  function previewCurrent(song: string) {
    if (!song) return;
    playSong(song);
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-stone-900/35"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-xl bg-surface-raised border-l border-border shadow-2xl overflow-y-auto"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
          >
            <div className="p-8">
              <div className="flex items-center justify-between mb-8">
                <h2 className="font-display text-3xl text-text-primary">
                  Sales Team
                </h2>
                <button
                  onClick={onClose}
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-hover transition-all text-2xl"
                >
                  ✕
                </button>
              </div>

              {/* Add new rep */}
              <div className="rounded-2xl border border-border bg-surface-raised p-6 mb-8">
                <div className="text-sm font-bold uppercase tracking-widest text-text-secondary mb-4">
                  Add rep
                </div>
                <div className="space-y-4">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Name"
                    className="w-full px-4 py-3 rounded-xl bg-surface border border-border text-text-primary text-base focus:outline-none focus:border-accent placeholder:text-text-muted"
                    onKeyDown={(e) => e.key === "Enter" && addRep()}
                  />
                  <div>
                    <div className="text-sm text-text-secondary mb-2">Color</div>
                    <div className="flex gap-2.5">
                      {AVATAR_COLORS.map((c) => (
                        <button
                          key={c}
                          onClick={() => setNewColor(c)}
                          className={`w-9 h-9 rounded-full border-2 transition-all ${
                            newColor === c
                              ? "ring-2 ring-white/90 ring-offset-2 ring-offset-surface-raised scale-110 border-transparent"
                              : "border-transparent"
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                  <SongSearch
                    value={newSong}
                    onChange={handleNewSong}
                    walkupLabel={newWalkupLabel}
                    label="Walk-up song"
                  />
                  <div>
                    <div className="text-sm text-text-secondary mb-2">
                      Spirit animal
                    </div>
                    <SpiritAnimalPicker
                      value={newSpiritAnimal}
                      onChange={setNewSpiritAnimal}
                    />
                    <p className="text-xs text-text-muted mt-2 leading-relaxed">
                      Use the same name as in HubSpot (DWH) so walk-up song and animal
                      apply on Slide orders.
                    </p>
                  </div>
                  <button
                    onClick={addRep}
                    disabled={!newName.trim()}
                    className="w-full px-5 py-3.5 rounded-xl bg-accent text-on-accent font-semibold text-base hover:bg-accent/90 transition-colors disabled:opacity-40"
                  >
                    Add to team
                  </button>
                </div>
              </div>

              {/* Rep list */}
              <div className="space-y-3">
                {reps.map((rep) => (
                  <div
                    key={rep.id}
                    className="rounded-2xl border border-border bg-surface-raised p-5"
                  >
                    {editId === rep.id ? (
                      <div className="space-y-4">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl bg-surface border border-border text-text-primary text-base focus:outline-none focus:border-accent"
                        />
                        <div className="flex gap-2.5">
                          {AVATAR_COLORS.map((c) => (
                            <button
                              key={c}
                              onClick={() => setEditColor(c)}
                              className={`w-8 h-8 rounded-full border-2 transition-all ${
                                editColor === c
                                  ? "ring-2 ring-white/90 ring-offset-2 ring-offset-surface-raised scale-110 border-transparent"
                                  : "border-transparent"
                              }`}
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </div>
                        <SongSearch
                          value={editSong}
                          onChange={handleEditSong}
                          walkupLabel={editWalkupLabel}
                          label="Walk-up song"
                        />
                        <div>
                          <div className="text-sm text-text-secondary mb-2">
                            Spirit animal
                          </div>
                          <SpiritAnimalPicker
                            value={editSpiritAnimal}
                            onChange={setEditSpiritAnimal}
                          />
                        </div>
                        <div className="flex gap-3">
                          <button
                            onClick={() => saveEdit(rep.id)}
                            className="px-6 py-3 rounded-xl bg-emerald text-on-emerald text-base font-semibold"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditId(null)}
                            className="px-6 py-3 rounded-xl text-text-muted text-base hover:text-text-secondary"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-4">
                        <div
                          className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold text-white flex-shrink-0"
                          style={{ backgroundColor: rep.avatarColor }}
                        >
                          {rep.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-text-primary text-base">
                            {rep.name}
                          </div>
                          <div className="text-sm text-text-secondary truncate mt-0.5">
                            {walkupSongDisplayLine(
                              rep.walkupSong,
                              rep.walkupSongLabel,
                            )}
                            {rep.spiritAnimal?.trim() ? (
                              <>
                                <span> · </span>
                                <span className="inline-flex items-center gap-1 align-middle">
                                  <TwemojiImg
                                    emoji={spiritAnimalEmoji(rep.spiritAnimal)}
                                    displaySize={18}
                                    assetSize={36}
                                    title={spiritAnimalLabel(rep.spiritAnimal)}
                                    className="inline-block shrink-0"
                                  />
                                  <span>{spiritAnimalLabel(rep.spiritAnimal)}</span>
                                </span>
                              </>
                            ) : null}
                          </div>
                        </div>
                        {rep.walkupSong && (
                          <button
                            onClick={() => previewCurrent(rep.walkupSong!)}
                            className="w-11 h-11 rounded-full bg-accent/20 text-accent hover:bg-accent/30 flex items-center justify-center text-sm transition-colors flex-shrink-0"
                          >
                            ▶
                          </button>
                        )}
                        <button
                          onClick={() => startEdit(rep)}
                          className="px-4 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-all"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => removeRep(rep.id)}
                          className="px-4 py-2.5 rounded-lg text-sm font-medium text-red-soft hover:text-red-400 hover:bg-red-soft/10 transition-all"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {reps.length === 0 && (
                  <div className="text-text-muted text-base text-center py-12">
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
