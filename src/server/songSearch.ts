import {
  isAppleMusicConfigured,
  searchAppleMusicCatalog,
  type CatalogSongHit,
} from "./appleMusic.js";

export type { CatalogSongHit };

async function searchDeezerCatalog(q: string): Promise<CatalogSongHit[]> {
  const url = `https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=12`;
  const r = await fetch(url);
  const json = (await r.json()) as {
    data?: {
      id: number;
      title: string;
      artist: { name: string };
      album: { title: string; cover_small: string };
      preview: string;
      duration: number;
    }[];
  };
  return (json.data || []).map((t) => ({
    id: String(t.id),
    title: t.title,
    artist: t.artist.name,
    album: t.album.title,
    cover: t.album.cover_small,
    previewUrl: t.preview,
    duration: t.duration,
  }));
}

/**
 * When Apple Music env is set, search Apple first; if it errors or returns
 * nothing, fall back to Deezer (same as before when Apple is off).
 */
export async function searchSongCatalog(q: string): Promise<{
  data: CatalogSongHit[];
  source: "apple" | "deezer";
}> {
  const trimmed = q.trim();
  if (!trimmed) return { data: [], source: "deezer" };

  if (isAppleMusicConfigured()) {
    try {
      const apple = await searchAppleMusicCatalog(trimmed);
      if (apple.length > 0) {
        return { data: apple, source: "apple" };
      }
    } catch (e) {
      console.error("[Apple Music] Search failed, falling back to Deezer:", e);
    }
  }

  const deezer = await searchDeezerCatalog(trimmed);
  return { data: deezer, source: "deezer" };
}
