import { playJingle, stopJingle, JINGLES } from "./jingles";

let activeAudio: HTMLAudioElement | null = null;
let fadeTimer: ReturnType<typeof setTimeout> | null = null;
let stopTimer: ReturnType<typeof setTimeout> | null = null;
let audioUnlocked = false;

const MAX_PLAY_MS = 20_000;
const FADE_MS = 1_500;

/**
 * Call on the first user gesture to permanently unlock audio autoplay.
 * Creates a silent AudioContext + plays a silent HTML5 Audio element.
 */
export function unlockAudio(): void {
  if (audioUnlocked) return;
  audioUnlocked = true;

  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AC) {
      const ctx = new AC();
      if (ctx.state === "suspended") ctx.resume();
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
    }
  } catch {
    // best-effort
  }

  try {
    const a = new Audio();
    a.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
    a.volume = 0;
    a.play().then(() => a.remove()).catch(() => {});
  } catch {
    // best-effort
  }
}

function parseStartOffset(url: string): { cleanUrl: string; offset: number } {
  const match = url.match(/#t=(\d+(?:\.\d+)?)$/);
  if (match) {
    return {
      cleanUrl: url.replace(/#t=[\d.]+$/, ""),
      offset: parseFloat(match[1]),
    };
  }
  return { cleanUrl: url, offset: 0 };
}

export function playUrl(url: string): HTMLAudioElement {
  stopAll();
  if (!audioUnlocked) unlockAudio();
  const { cleanUrl, offset } = parseStartOffset(url);
  const a = new Audio(cleanUrl);
  a.volume = 1;
  activeAudio = a;

  if (offset > 0) {
    a.addEventListener("loadedmetadata", () => {
      if (offset < a.duration) a.currentTime = offset;
    }, { once: true });
  }

  a.play().catch((err) => {
    console.warn("[Audio] Could not play URL (autoplay/device?):", cleanUrl, err);
  });
  a.onended = () => {
    if (activeAudio === a) activeAudio = null;
  };

  stopTimer = setTimeout(() => fadeOut(), MAX_PLAY_MS - FADE_MS);
  return a;
}

export function playSong(song: string): void {
  if (!song) return;
  /** Jingle path used to skip unlock — keep HTML5 + Web Audio ready for Tone.js. */
  unlockAudio();
  if (JINGLES.some((j) => j.id === song)) {
    stopAll();
    void playJingle(song).catch((err) => {
      console.warn("[Audio] Jingle failed (autoplay/context?):", song, err);
    });
    return;
  }
  if (song.startsWith("http") || song.startsWith("/")) {
    playUrl(song);
  }
}

export function fadeOut(): void {
  if (fadeTimer) clearTimeout(fadeTimer);

  const a = activeAudio;
  if (!a) {
    stopJingle();
    return;
  }

  let vol = a.volume;
  const step = vol / (FADE_MS / 50);
  const interval = setInterval(() => {
    vol -= step;
    if (vol <= 0) {
      clearInterval(interval);
      a.pause();
      a.currentTime = 0;
      if (activeAudio === a) activeAudio = null;
      return;
    }
    a.volume = vol;
  }, 50);

  stopJingle();
}

export function stopAll(): void {
  if (stopTimer) {
    clearTimeout(stopTimer);
    stopTimer = null;
  }
  if (fadeTimer) {
    clearTimeout(fadeTimer);
    fadeTimer = null;
  }
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.currentTime = 0;
    activeAudio = null;
  }
  stopJingle();
}

export function isPlaying(): boolean {
  return (activeAudio !== null && !activeAudio.paused) || false;
}
