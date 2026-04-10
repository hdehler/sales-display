import { playJingle, stopJingle, JINGLES } from "./jingles";

let activeAudio: HTMLAudioElement | null = null;
let fadeTimer: ReturnType<typeof setTimeout> | null = null;
let stopTimer: ReturnType<typeof setTimeout> | null = null;

const MAX_PLAY_MS = 20_000;
const FADE_MS = 1_500;

export function playUrl(url: string): HTMLAudioElement {
  stopAll();
  const a = new Audio(url);
  a.volume = 1;
  activeAudio = a;
  a.play().catch(() => {});
  a.onended = () => {
    if (activeAudio === a) activeAudio = null;
  };

  stopTimer = setTimeout(() => fadeOut(), MAX_PLAY_MS - FADE_MS);
  return a;
}

export function playSong(song: string): void {
  if (!song) return;
  if (JINGLES.some((j) => j.id === song)) {
    stopAll();
    playJingle(song);
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
