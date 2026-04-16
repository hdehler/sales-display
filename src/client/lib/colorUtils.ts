/** Convert HSL (h 0–360, s/l 0–100) to #rrggbb */
export function hslToHex(h: number, s: number, l: number): string {
  let hue = h % 360;
  if (hue < 0) hue += 360;
  const sat = Math.max(0, Math.min(100, s)) / 100;
  const light = Math.max(0, Math.min(100, l)) / 100;
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = light - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hue < 60) {
    r = c;
    g = x;
  } else if (hue < 120) {
    r = x;
    g = c;
  } else if (hue < 180) {
    g = c;
    b = x;
  } else if (hue < 240) {
    g = x;
    b = c;
  } else if (hue < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  const toHex = (n: number) =>
    Math.round(Math.min(255, Math.max(0, (n + m) * 255)))
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Normalize user hex to #rrggbb for input[type=color] */
export function normalizeHex(hex: string): string {
  const s = hex.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    const a = s.slice(1).split("");
    return `#${a[0]}${a[0]}${a[1]}${a[1]}${a[2]}${a[2]}`.toLowerCase();
  }
  return "#0c88ff";
}
