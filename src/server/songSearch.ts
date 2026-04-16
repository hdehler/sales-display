import {
  isSpotifyConfigured,
  searchSpotifyTracksWithPreviews,
  type CatalogSongHit,
} from "./spotify.js";

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
 * Spotify first when `SPOTIFY_CLIENT_ID` + `SPOTIFY_CLIENT_SECRET` are set and
 * at least one track has a preview; otherwise Deezer (unchanged behavior).
 */
export async function searchSongCatalog(q: string): Promise<{
  data: CatalogSongHit[];
  source: "spotify" | "deezer";
}> {
  const trimmed = q.trim();
  if (!trimmed) return { data: [], source: "deezer" };

  if (isSpotifyConfigured()) {
    try {
      const spotify = await searchSpotifyTracksWithPreviews(trimmed);
      if (spotify.length > 0) {
        return { data: spotify, source: "spotify" };
      }
    } catch (e) {
      console.error("[Spotify] Search failed, falling back to Deezer:", e);
    }
  }

  const deezer = await searchDeezerCatalog(trimmed);
  return { data: deezer, source: "deezer" };
}
