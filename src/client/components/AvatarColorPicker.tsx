import { useCallback, useMemo, useRef } from "react";
import { hslToHex, normalizeHex } from "../lib/colorUtils";

const PRESETS = [
  "#0c88ff",
  "#2663b8",
  "#2fb140",
  "#d50b0b",
  "#ffce00",
  "#777777",
  "#666666",
  "#3da0ff",
  "#1a4a90",
  "#5ad66e",
];

export const DEFAULT_AVATAR_COLOR = PRESETS[0];

const WHEEL_STOPS = 48;
const DEFAULT_S = 78;
const DEFAULT_L = 52;

function buildConicGradient(): string {
  const parts: string[] = [];
  for (let i = 0; i <= WHEEL_STOPS; i++) {
    const h = (i / WHEEL_STOPS) * 360;
    parts.push(`hsl(${h.toFixed(1)} ${DEFAULT_S}% ${DEFAULT_L}%)`);
  }
  return `conic-gradient(from 0deg, ${parts.join(", ")})`;
}

interface AvatarColorPickerProps {
  value: string;
  onChange: (hex: string) => void;
  className?: string;
}

/**
 * Hue ring + center preview, preset dots, and native color input for exact picks.
 */
export function AvatarColorPicker({ value, onChange, className = "" }: AvatarColorPickerProps) {
  const safeHex = normalizeHex(value);
  const wheelBg = useMemo(() => buildConicGradient(), []);
  const dragging = useRef(false);

  const pickFromWheel = useCallback(
    (clientX: number, clientY: number, target: HTMLDivElement) => {
      const rect = target.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = clientX - cx;
      const dy = clientY - cy;
      const dist = Math.hypot(dx, dy);
      const outer = rect.width / 2;
      const inner = outer * 0.42;
      if (dist < inner || dist > outer + 2) return;
      // Top = 0° hue (red) to match conic-gradient(from 0deg, …)
      const hue = (Math.atan2(dy, dx) * 180) / Math.PI + 90 + 360;
      const h = hue % 360;
      onChange(hslToHex(h, DEFAULT_S, DEFAULT_L));
    },
    [onChange],
  );

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="text-sm text-text-secondary">Color</div>

      <div className="flex items-center gap-5 flex-wrap">
        <div className="relative h-[148px] w-[148px] shrink-0">
          <div
            role="presentation"
            aria-label="Hue wheel — click or drag around the ring to pick a color"
            className="absolute inset-0 rounded-full cursor-crosshair border border-border/60 shadow-inner touch-none select-none"
            style={{ background: wheelBg }}
            onPointerDown={(e) => {
              dragging.current = true;
              (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
              pickFromWheel(e.clientX, e.clientY, e.currentTarget);
            }}
            onPointerMove={(e) => {
              if (!dragging.current) return;
              pickFromWheel(e.clientX, e.clientY, e.currentTarget);
            }}
            onPointerUp={(e) => {
              dragging.current = false;
              try {
                (e.currentTarget as HTMLDivElement).releasePointerCapture(
                  e.pointerId,
                );
              } catch {
                /* already released */
              }
            }}
            onPointerCancel={() => {
              dragging.current = false;
            }}
          />
          <div
            className="pointer-events-none absolute inset-[34%] rounded-full border-2 border-white/25 shadow-lg"
            style={{ backgroundColor: safeHex }}
            aria-hidden
          />
        </div>

        <div className="flex flex-col gap-2 min-w-0 flex-1">
          <label className="flex items-center gap-2 text-xs text-text-muted uppercase tracking-wide">
            <span>Fine tune</span>
            <input
              type="color"
              value={safeHex}
              onChange={(e) => onChange(normalizeHex(e.target.value))}
              className="h-9 w-14 cursor-pointer rounded-lg border border-border bg-surface p-0.5"
              title="Exact color"
            />
          </label>
          <p className="text-xs text-text-muted leading-snug">
            Click or drag on the ring for hue; use the square for any shade.
          </p>
        </div>
      </div>

      <div>
        <div className="text-xs text-text-muted mb-2">Quick picks</div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChange(c)}
              className={`w-9 h-9 rounded-full border-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised ${
                safeHex.toLowerCase() === c.toLowerCase()
                  ? "ring-2 ring-white/90 ring-offset-2 ring-offset-surface-raised scale-110 border-transparent"
                  : "border-transparent hover:scale-105"
              }`}
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
