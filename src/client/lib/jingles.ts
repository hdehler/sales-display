import * as Tone from "tone";

export interface Jingle {
  id: string;
  name: string;
  description: string;
  notes: { note: string; duration: string; time: number }[];
  bpm: number;
  synth: "triangle" | "square" | "sawtooth" | "sine" | "fatsawtooth" | "fatsquare";
  envelope?: { attack?: number; decay?: number; sustain?: number; release?: number };
  volume?: number;
}

export const JINGLES: Jingle[] = [
  {
    id: "champion",
    name: "Champion",
    description: "Bold brass fanfare",
    bpm: 140,
    synth: "fatsawtooth",
    envelope: { attack: 0.02, decay: 0.3, sustain: 0.4, release: 0.4 },
    volume: -6,
    notes: [
      { note: "C5", duration: "8n", time: 0 },
      { note: "E5", duration: "8n", time: 0.15 },
      { note: "G5", duration: "8n", time: 0.3 },
      { note: "C6", duration: "4n", time: 0.5 },
      { note: "G5", duration: "8n", time: 0.9 },
      { note: "C6", duration: "2n", time: 1.1 },
    ],
  },
  {
    id: "knockout",
    name: "Knockout",
    description: "Heavy rock power chords",
    bpm: 130,
    synth: "fatsquare",
    envelope: { attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.3 },
    volume: -8,
    notes: [
      { note: "E4", duration: "8n", time: 0 },
      { note: "E4", duration: "8n", time: 0.12 },
      { note: "G4", duration: "8n", time: 0.25 },
      { note: "A4", duration: "4n", time: 0.4 },
      { note: "B4", duration: "8n", time: 0.7 },
      { note: "E5", duration: "2n", time: 0.85 },
    ],
  },
  {
    id: "victory-lap",
    name: "Victory Lap",
    description: "Triumphant ascending run",
    bpm: 160,
    synth: "triangle",
    envelope: { attack: 0.01, decay: 0.15, sustain: 0.5, release: 0.5 },
    volume: -4,
    notes: [
      { note: "G4", duration: "16n", time: 0 },
      { note: "A4", duration: "16n", time: 0.1 },
      { note: "B4", duration: "16n", time: 0.2 },
      { note: "D5", duration: "16n", time: 0.3 },
      { note: "E5", duration: "8n", time: 0.4 },
      { note: "G5", duration: "4n", time: 0.55 },
      { note: "A5", duration: "8n", time: 0.85 },
      { note: "G5", duration: "2n", time: 1.05 },
    ],
  },
  {
    id: "big-deal",
    name: "Big Deal",
    description: "Deep dramatic entrance",
    bpm: 100,
    synth: "fatsawtooth",
    envelope: { attack: 0.05, decay: 0.4, sustain: 0.5, release: 0.8 },
    volume: -6,
    notes: [
      { note: "C3", duration: "4n", time: 0 },
      { note: "G3", duration: "4n", time: 0.4 },
      { note: "C4", duration: "4n", time: 0.8 },
      { note: "E4", duration: "2n", time: 1.2 },
    ],
  },
  {
    id: "sparkle",
    name: "Sparkle",
    description: "Bright magical chime",
    bpm: 180,
    synth: "sine",
    envelope: { attack: 0.005, decay: 0.3, sustain: 0.1, release: 0.8 },
    volume: -4,
    notes: [
      { note: "E6", duration: "16n", time: 0 },
      { note: "G6", duration: "16n", time: 0.08 },
      { note: "B6", duration: "16n", time: 0.16 },
      { note: "E7", duration: "8n", time: 0.24 },
      { note: "B6", duration: "16n", time: 0.45 },
      { note: "E7", duration: "4n", time: 0.55 },
    ],
  },
  {
    id: "thunder",
    name: "Thunder",
    description: "Rumbling bass drop",
    bpm: 110,
    synth: "fatsawtooth",
    envelope: { attack: 0.01, decay: 0.5, sustain: 0.3, release: 1.0 },
    volume: -5,
    notes: [
      { note: "E2", duration: "4n", time: 0 },
      { note: "E2", duration: "8n", time: 0.3 },
      { note: "G2", duration: "8n", time: 0.5 },
      { note: "B2", duration: "4n", time: 0.65 },
      { note: "E3", duration: "2n", time: 0.95 },
    ],
  },
  {
    id: "fiesta",
    name: "Fiesta",
    description: "Upbeat latin-style riff",
    bpm: 150,
    synth: "triangle",
    envelope: { attack: 0.01, decay: 0.1, sustain: 0.4, release: 0.3 },
    volume: -4,
    notes: [
      { note: "A4", duration: "16n", time: 0 },
      { note: "C5", duration: "16n", time: 0.1 },
      { note: "E5", duration: "16n", time: 0.2 },
      { note: "A5", duration: "8n", time: 0.3 },
      { note: "G5", duration: "16n", time: 0.5 },
      { note: "E5", duration: "16n", time: 0.6 },
      { note: "A5", duration: "4n", time: 0.7 },
      { note: "C6", duration: "4n", time: 1.0 },
    ],
  },
  {
    id: "swagger",
    name: "Swagger",
    description: "Cool hip-hop bounce",
    bpm: 90,
    synth: "fatsquare",
    envelope: { attack: 0.02, decay: 0.3, sustain: 0.4, release: 0.5 },
    volume: -8,
    notes: [
      { note: "G3", duration: "8n", time: 0 },
      { note: "Bb3", duration: "8n", time: 0.25 },
      { note: "C4", duration: "8n", time: 0.5 },
      { note: "Eb4", duration: "4n", time: 0.75 },
      { note: "D4", duration: "8n", time: 1.2 },
      { note: "G4", duration: "2n", time: 1.45 },
    ],
  },
  {
    id: "arcade",
    name: "Arcade",
    description: "Retro 8-bit power up",
    bpm: 200,
    synth: "square",
    envelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 0.2 },
    volume: -10,
    notes: [
      { note: "C5", duration: "32n", time: 0 },
      { note: "E5", duration: "32n", time: 0.06 },
      { note: "G5", duration: "32n", time: 0.12 },
      { note: "C6", duration: "16n", time: 0.18 },
      { note: "E6", duration: "16n", time: 0.28 },
      { note: "G6", duration: "8n", time: 0.38 },
      { note: "C7", duration: "4n", time: 0.5 },
    ],
  },
  {
    id: "midnight",
    name: "Midnight",
    description: "Smooth jazz entrance",
    bpm: 80,
    synth: "sine",
    envelope: { attack: 0.08, decay: 0.4, sustain: 0.6, release: 1.0 },
    volume: -4,
    notes: [
      { note: "Eb4", duration: "4n", time: 0 },
      { note: "G4", duration: "4n", time: 0.4 },
      { note: "Bb4", duration: "4n", time: 0.8 },
      { note: "D5", duration: "2n", time: 1.3 },
    ],
  },
  {
    id: "blitz",
    name: "Blitz",
    description: "Fast aggressive shred",
    bpm: 190,
    synth: "sawtooth",
    envelope: { attack: 0.005, decay: 0.15, sustain: 0.3, release: 0.2 },
    volume: -8,
    notes: [
      { note: "E4", duration: "32n", time: 0 },
      { note: "F#4", duration: "32n", time: 0.05 },
      { note: "G#4", duration: "32n", time: 0.1 },
      { note: "A4", duration: "32n", time: 0.15 },
      { note: "B4", duration: "16n", time: 0.2 },
      { note: "E5", duration: "8n", time: 0.3 },
      { note: "B4", duration: "16n", time: 0.5 },
      { note: "E5", duration: "4n", time: 0.6 },
    ],
  },
  {
    id: "royal",
    name: "Royal",
    description: "Regal coronation theme",
    bpm: 120,
    synth: "fatsawtooth",
    envelope: { attack: 0.04, decay: 0.3, sustain: 0.5, release: 0.6 },
    volume: -6,
    notes: [
      { note: "D4", duration: "4n", time: 0 },
      { note: "F#4", duration: "8n", time: 0.35 },
      { note: "A4", duration: "8n", time: 0.55 },
      { note: "D5", duration: "4n", time: 0.75 },
      { note: "F#5", duration: "8n", time: 1.1 },
      { note: "A5", duration: "2n", time: 1.3 },
    ],
  },
];

let currentSynth: Tone.Synth | null = null;

export async function playJingle(jingleId: string): Promise<void> {
  const jingle = JINGLES.find((j) => j.id === jingleId);
  if (!jingle) return;

  await Tone.start();
  const raw = Tone.getContext().rawContext as AudioContext;
  if (raw.state === "suspended") {
    await raw.resume().catch(() => {});
  }

  if (currentSynth) {
    currentSynth.dispose();
    currentSynth = null;
  }

  const synth = new Tone.Synth({
    oscillator: { type: jingle.synth },
    envelope: {
      attack: jingle.envelope?.attack ?? 0.02,
      decay: jingle.envelope?.decay ?? 0.2,
      sustain: jingle.envelope?.sustain ?? 0.4,
      release: jingle.envelope?.release ?? 0.5,
    },
    volume: jingle.volume ?? -6,
  }).toDestination();

  currentSynth = synth;
  const now = Tone.now();

  for (const n of jingle.notes) {
    synth.triggerAttackRelease(n.note, n.duration, now + n.time);
  }
}

export function stopJingle(): void {
  if (currentSynth) {
    currentSynth.dispose();
    currentSynth = null;
  }
}
