import { Buffer } from "node:buffer";

/** Unified hit for `/api/songs/search` (same shape as Deezer). */
export type CatalogSongHit = {
  id: string;
  title: string;
  artist: string;
  album: string;
  cover: string;
  previewUrl: string;
  duration: number;
};

let tokenCache: { accessToken: string; expiresAtMs: number } | null = null;

export function isSpotifyConfigured(): boolean {
  const id = (process.env.SPOTIFY_CLIENT_ID || "").trim();
  const secret = (process.env.SPOTIFY_CLIENT_SECRET || "").trim();
  return Boolean(id && secret);
}

function market(): string {
  return (process.env.SPOTIFY_MARKET || "US").trim().toUpperCase() || "US";
}

async function fetchClientCredentialsToken(): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const clientId = (process.env.SPOTIFY_CLIENT_ID || "").trim();
  const clientSecret = (process.env.SPOTIFY_CLIENT_SECRET || "").trim();
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const r = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`Spotify token ${r.status}: ${t.slice(0, 200)}`);
  }
  return (await r.json()) as { access_token: string; expires_in: number };
}

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAtMs - 60_000 > now) {
    return tokenCache.accessToken;
  }
  const json = await fetchClientCredentialsToken();
  tokenCache = {
    accessToken: json.access_token,
    expiresAtMs: now + (json.expires_in || 3600) * 1000,
  };
  return tokenCache.accessToken;
}

/** Clear cache (e.g. after 401 on API call). */
export function clearSpotifyTokenCache(): void {
  tokenCache = null;
}

function pickCover(images: { url: string; height?: number }[] | undefined): string {
  if (!images?.length) return "";
  const sorted = [...images].sort(
    (a, b) => (a.height ?? 0) - (b.height ?? 0),
  );
  return sorted[0]?.url || images[0].url;
}

type SpotifyTrack = {
  id: string;
  name: string;
  artists?: { name: string }[];
  album?: { name: string; images?: { url: string; height?: number }[] };
  preview_url: string | null;
  duration_ms: number;
};

type SpotifySearchResponse = {
  tracks?: {
    items?: SpotifyTrack[];
  };
};

/**
 * Search catalog tracks that have a non-null preview_url.
 * Many Spotify tracks have no preview; those are skipped (up to `limit` API hits).
 * @see https://developer.spotify.com/documentation/web-api/reference/search
 */
export async function searchSpotifyTracksWithPreviews(
  q: string,
): Promise<CatalogSongHit[]> {
  const token = await getAccessToken();
  const m = market();
  const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=20&market=${encodeURIComponent(m)}`;

  const fetchOnce = async (access: string) => {
    return fetch(url, {
      headers: { Authorization: `Bearer ${access}` },
    });
  };

  let r = await fetchOnce(token);
  if (r.status === 401) {
    clearSpotifyTokenCache();
    const t2 = await getAccessToken();
    r = await fetchOnce(t2);
  }

  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new Error(`Spotify search ${r.status}: ${body.slice(0, 200)}`);
  }

  const json = (await r.json()) as SpotifySearchResponse;
  const items = json.tracks?.items || [];
  const out: CatalogSongHit[] = [];

  for (const t of items) {
    const preview = t.preview_url;
    if (!preview) continue;
    const artist = (t.artists || []).map((a) => a.name).filter(Boolean).join(", ") || "Unknown";
    out.push({
      id: t.id,
      title: t.name || "Unknown",
      artist,
      album: t.album?.name || "",
      cover: pickCover(t.album?.images),
      previewUrl: preview,
      duration: Math.round((t.duration_ms ?? 30_000) / 1000),
    });
    if (out.length >= 12) break;
  }

  return out;
}
