import {
  isSpotifyConfigured,
  searchSpotifyTracksWithPreviews,
  type CatalogSongHit,
} from "./spotify.js";

export type { CatalogSongHit };

/** Query `provider` on `/api/songs/search` — `auto` matches production behavior. */
export type SearchCatalogMode = "auto" | "spotify" | "deezer";

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

function parseCatalogMode(raw: unknown): SearchCatalogMode {
  const s = String(raw || "auto").toLowerCase();
  if (s === "spotify" || s === "deezer") return s;
  return "auto";
}

export { parseCatalogMode };

/**
 * - `auto`: Spotify first when configured + previews exist; else Deezer.
 * - `spotify`: Spotify only (empty + hint if not configured / no previews).
 * - `deezer`: Deezer only.
 */
export async function searchSongCatalog(
  q: string,
  mode: SearchCatalogMode = "auto",
): Promise<{
  data: CatalogSongHit[];
  source: "spotify" | "deezer" | null;
  hint?: string;
}> {
  const trimmed = q.trim();
  if (!trimmed) return { data: [], source: null };

  if (mode === "deezer") {
    const deezer = await searchDeezerCatalog(trimmed);
    return { data: deezer, source: "deezer" };
  }

  if (mode === "spotify") {
    if (!isSpotifyConfigured()) {
      return {
        data: [],
        source: "spotify",
        hint: "spotify_not_configured",
      };
    }
    try {
      const spotify = await searchSpotifyTracksWithPreviews(trimmed);
      return {
        data: spotify,
        source: "spotify",
        hint:
          spotify.length === 0 ? "spotify_no_previews" : undefined,
      };
    } catch (e) {
      console.error("[Spotify] Search failed (spotify-only mode):", e);
      throw e;
    }
  }

  // auto
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
