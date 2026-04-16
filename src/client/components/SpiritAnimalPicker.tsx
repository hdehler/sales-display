import { SPIRIT_ANIMALS } from "../../shared/animals";
import { TwemojiImg } from "./TwemojiImg";

interface SpiritAnimalPickerProps {
  value: string;
  onChange: (id: string) => void;
}

export function SpiritAnimalPicker({
  value,
  onChange,
}: SpiritAnimalPickerProps) {
  return (
    <div
      className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-64 overflow-y-auto rounded-xl border border-border bg-surface p-2"
      role="listbox"
      aria-label="Spirit animal"
    >
      {SPIRIT_ANIMALS.map((a) => {
        const selected = value === a.id;
        return (
          <button
            key={a.id || "none"}
            type="button"
            role="option"
            aria-selected={selected}
            onClick={() => onChange(a.id)}
            className={`flex flex-col items-center justify-center gap-0.5 rounded-lg border px-1.5 py-2 min-h-[3.75rem] transition-all outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              selected
                ? "border-accent bg-accent/15 shadow-[0_0_0_1px_rgba(12,136,255,0.35)]"
                : "border-border/60 bg-surface-raised/50 hover:border-border-bright hover:bg-surface-hover"
            }`}
          >
            <span className="flex items-center justify-center min-h-[1.75rem]">
              {a.emoji ? (
                <TwemojiImg emoji={a.emoji} displaySize={28} assetSize={72} />
              ) : (
                <span className="text-text-muted text-lg leading-none">—</span>
              )}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-text-secondary leading-tight text-center line-clamp-2">
              {a.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
