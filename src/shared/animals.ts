/** Slugs stored in `reps.spirit_animal` and sent on `CelebrationEvent.repHero`. */
export const SPIRIT_ANIMALS = [
  { id: "", label: "None", emoji: "" },
  { id: "wolf", label: "Wolf", emoji: "🐺" },
  { id: "eagle", label: "Eagle", emoji: "🦅" },
  { id: "tiger", label: "Tiger", emoji: "🐯" },
  { id: "lion", label: "Lion", emoji: "🦁" },
  { id: "bear", label: "Bear", emoji: "🐻" },
  { id: "fox", label: "Fox", emoji: "🦊" },
  { id: "owl", label: "Owl", emoji: "🦉" },
  { id: "shark", label: "Shark", emoji: "🦈" },
  { id: "dolphin", label: "Dolphin", emoji: "🐬" },
  { id: "octopus", label: "Octopus", emoji: "🐙" },
  { id: "falcon", label: "Falcon", emoji: "🦅" },
  { id: "dragon", label: "Dragon", emoji: "🐉" },
  { id: "phoenix", label: "Phoenix", emoji: "✨" },
  { id: "panther", label: "Panther", emoji: "🐈‍⬛" },
  { id: "hawk", label: "Hawk", emoji: "🦅" },
  { id: "snake", label: "Snake", emoji: "🐍" },
  { id: "stag", label: "Stag", emoji: "🦌" },
  { id: "bee", label: "Bee", emoji: "🐝" },
] as const;

export type SpiritAnimalId = (typeof SPIRIT_ANIMALS)[number]["id"];

export function spiritAnimalEmoji(id: string): string {
  const row = SPIRIT_ANIMALS.find((a) => a.id === id);
  return row?.emoji ?? "";
}

export function spiritAnimalLabel(id: string): string {
  const row = SPIRIT_ANIMALS.find((a) => a.id === id);
  return row?.label ?? "";
}
