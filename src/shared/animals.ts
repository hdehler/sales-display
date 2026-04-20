/** Slugs stored in `reps.spirit_animal` and sent on `CelebrationEvent.repHero`. */
export const SPIRIT_ANIMALS = [
  { id: "", label: "None", emoji: "" },
  { id: "wolf", label: "Wolf", emoji: "🐺" },
  { id: "eagle", label: "Eagle", emoji: "🦅" },
  { id: "falcon", label: "Falcon", emoji: "🦅" },
  { id: "hawk", label: "Hawk", emoji: "🦅" },
  { id: "owl", label: "Owl", emoji: "🦉" },
  { id: "crow", label: "Crow", emoji: "🐦" },
  { id: "parrot", label: "Parrot", emoji: "🦜" },
  { id: "peacock", label: "Peacock", emoji: "🦚" },
  { id: "flamingo", label: "Flamingo", emoji: "🦩" },
  { id: "duck", label: "Duck", emoji: "🦆" },
  { id: "swan", label: "Swan", emoji: "🦢" },
  { id: "turkey", label: "Turkey", emoji: "🦃" },
  { id: "chicken", label: "Chicken", emoji: "🐔" },
  { id: "rooster", label: "Rooster", emoji: "🐓" },
  { id: "tiger", label: "Tiger", emoji: "🐯" },
  { id: "lion", label: "Lion", emoji: "🦁" },
  { id: "leopard", label: "Leopard", emoji: "🐆" },
  { id: "cat", label: "Cat", emoji: "🐱" },
  { id: "black_cat", label: "Black cat", emoji: "🐈" },
  { id: "fox", label: "Fox", emoji: "🦊" },
  { id: "dog", label: "Dog", emoji: "🐕" },
  { id: "poodle", label: "Poodle", emoji: "🐩" },
  { id: "bear", label: "Bear", emoji: "🐻" },
  { id: "panda", label: "Panda", emoji: "🐼" },
  { id: "koala", label: "Koala", emoji: "🐨" },
  { id: "rabbit", label: "Rabbit", emoji: "🐰" },
  { id: "mouse", label: "Mouse", emoji: "🐭" },
  { id: "rat", label: "Rat", emoji: "🐀" },
  { id: "hamster", label: "Hamster", emoji: "🐹" },
  { id: "hedgehog", label: "Hedgehog", emoji: "🦔" },
  { id: "raccoon", label: "Raccoon", emoji: "🦝" },
  { id: "badger", label: "Badger", emoji: "🦡" },
  { id: "otter", label: "Otter", emoji: "🦦" },
  { id: "skunk", label: "Skunk", emoji: "🦨" },
  { id: "monkey", label: "Monkey", emoji: "🐵" },
  { id: "gorilla", label: "Gorilla", emoji: "🦍" },
  { id: "orangutan", label: "Orangutan", emoji: "🦧" },
  { id: "horse", label: "Horse", emoji: "🐴" },
  { id: "unicorn", label: "Unicorn", emoji: "🦄" },
  { id: "zebra", label: "Zebra", emoji: "🦓" },
  { id: "deer", label: "Deer", emoji: "🦌" },
  { id: "bison", label: "Bison", emoji: "🦬" },
  { id: "cow", label: "Cow", emoji: "🐮" },
  { id: "pig", label: "Pig", emoji: "🐷" },
  { id: "boar", label: "Boar", emoji: "🐗" },
  { id: "ram", label: "Ram", emoji: "🐏" },
  { id: "goat", label: "Goat", emoji: "🐐" },
  { id: "camel", label: "Camel", emoji: "🐪" },
  { id: "llama", label: "Llama", emoji: "🦙" },
  { id: "giraffe", label: "Giraffe", emoji: "🦒" },
  { id: "elephant", label: "Elephant", emoji: "🐘" },
  { id: "rhino", label: "Rhino", emoji: "🦏" },
  { id: "hippo", label: "Hippo", emoji: "🦛" },
  { id: "dolphin", label: "Dolphin", emoji: "🐬" },
  { id: "whale", label: "Whale", emoji: "🐋" },
  { id: "shark", label: "Shark", emoji: "🦈" },
  { id: "fish", label: "Fish", emoji: "🐟" },
  { id: "tropical_fish", label: "Tropical fish", emoji: "🐠" },
  { id: "blowfish", label: "Blowfish", emoji: "🐡" },
  { id: "octopus", label: "Octopus", emoji: "🐙" },
  { id: "squid", label: "Squid", emoji: "🦑" },
  { id: "lobster", label: "Lobster", emoji: "🦞" },
  { id: "crab", label: "Crab", emoji: "🦀" },
  { id: "shrimp", label: "Shrimp", emoji: "🦐" },
  { id: "snail", label: "Snail", emoji: "🐌" },
  { id: "butterfly", label: "Butterfly", emoji: "🦋" },
  { id: "bee", label: "Bee", emoji: "🐝" },
  { id: "ladybug", label: "Ladybug", emoji: "🐞" },
  { id: "ant", label: "Ant", emoji: "🐜" },
  { id: "spider", label: "Spider", emoji: "🕷" },
  { id: "scorpion", label: "Scorpion", emoji: "🦂" },
  { id: "snake", label: "Snake", emoji: "🐍" },
  { id: "lizard", label: "Lizard", emoji: "🦎" },
  { id: "turtle", label: "Turtle", emoji: "🐢" },
  { id: "crocodile", label: "Crocodile", emoji: "🐊" },
  { id: "frog", label: "Frog", emoji: "🐸" },
  { id: "penguin", label: "Penguin", emoji: "🐧" },
  { id: "bird", label: "Bird", emoji: "🐦" },
  { id: "bat", label: "Bat", emoji: "🦇" },
  { id: "dragon", label: "Dragon", emoji: "🐉" },
  { id: "t_rex", label: "T-Rex", emoji: "🦖" },
  { id: "sauropod", label: "Sauropod", emoji: "🦕" },
  { id: "phoenix", label: "Phoenix", emoji: "✨" },
  { id: "seal", label: "Seal", emoji: "🦭" },
  // Hoofed grazers — gazelle/antelope have no dedicated emoji in Unicode,
  // so they reuse 🦌 (deer) as the closest visual.
  { id: "gazelle", label: "Gazelle", emoji: "🦌" },
  { id: "antelope", label: "Antelope", emoji: "🦌" },
  { id: "moose", label: "Moose", emoji: "🦌" },
  { id: "kangaroo", label: "Kangaroo", emoji: "🦘" },
  { id: "sloth", label: "Sloth", emoji: "🦥" },
  { id: "mammoth", label: "Mammoth", emoji: "🦣" },
  { id: "beaver", label: "Beaver", emoji: "🦫" },
  { id: "dodo", label: "Dodo", emoji: "🦤" },
  { id: "polar_bear", label: "Polar bear", emoji: "🐻\u200d❄️" },
  { id: "guide_dog", label: "Guide dog", emoji: "🦮" },
  { id: "service_dog", label: "Service dog", emoji: "🐕\u200d🦺" },
  { id: "caterpillar", label: "Caterpillar", emoji: "🐛" },
  { id: "beetle", label: "Beetle", emoji: "🪲" },
  { id: "cockroach", label: "Cockroach", emoji: "🪳" },
  { id: "fly", label: "Fly", emoji: "🪰" },
  { id: "mosquito", label: "Mosquito", emoji: "🦟" },
  { id: "worm", label: "Worm", emoji: "🪱" },
  { id: "microbe", label: "Microbe", emoji: "🦠" },
  { id: "oyster", label: "Oyster", emoji: "🦪" },
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

/** Twemoji assets (PNG) — works on Linux/Pi/Electron without system color emoji fonts. */
const TWEMOJI_BASE =
  "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets";

/**
 * URL to a Twemoji PNG for a grapheme (e.g. "🦈" → …/72x72/1f988.png).
 * Returns null for empty input.
 */
export function emojiToTwemojiPngUrl(
  emoji: string,
  size: 36 | 72 = 72,
): string | null {
  const trimmed = emoji.trim();
  if (!trimmed) return null;
  const hex: string[] = [];
  for (const rune of trimmed) {
    const cp = rune.codePointAt(0);
    if (cp === undefined) continue;
    hex.push(cp.toString(16));
  }
  if (hex.length === 0) return null;
  return `${TWEMOJI_BASE}/${size}x${size}/${hex.join("-")}.png`;
}
