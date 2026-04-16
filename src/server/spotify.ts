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

/** ISO 3166-1 alpha-2; Spotify rejects bad values on some endpoints. */
function marketCode(): string {
  const raw = (process.env.SPOTIFY_MARKET || "US").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(raw) ? raw : "US";
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

function searchUrl(q: string, offset: number): string {
  const params = new URLSearchParams({
    q,
    type: "track",
    /** Some app / API modes reject `limit=20` with 400 "Invalid limit"; 10 is safe. */
    limit: "10",
    offset: String(offset),
    market: marketCode(),
  });
  return `https://api.spotify.com/v1/search?${params.toString()}`;
}

async function fetchSearchPage(
  q: string,
  access: string,
  offset: number,
): Promise<Response> {
  return fetch(searchUrl(q, offset), {
    headers: { Authorization: `Bearer ${access}` },
  });
}

/**
 * Search catalog tracks that have a non-null preview_url.
 * Many Spotify tracks have no preview; those are skipped.
 * Fetches two pages (10 + 10) so we still have enough candidates after filtering.
 * @see https://developer.spotify.com/documentation/web-api/reference/search
 */
export async function searchSpotifyTracksWithPreviews(
  q: string,
): Promise<CatalogSongHit[]> {
  const load = async (access: string) => {
    const r0 = await fetchSearchPage(q, access, 0);
    if (r0.status === 401) {
      return { unauthorized: true as const, items: [] as SpotifyTrack[] };
    }
    if (!r0.ok) {
      const body = await r0.text().catch(() => "");
      throw new Error(`Spotify search ${r0.status}: ${body.slice(0, 200)}`);
    }
    const j0 = (await r0.json()) as SpotifySearchResponse;
    const first = j0.tracks?.items || [];
    const r1 = await fetchSearchPage(q, access, 10);
    let second: SpotifyTrack[] = [];
    if (r1.ok) {
      const j1 = (await r1.json()) as SpotifySearchResponse;
      second = j1.tracks?.items || [];
    }
    const seen = new Set<string>();
    const merged: SpotifyTrack[] = [];
    for (const t of [...first, ...second]) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      merged.push(t);
    }
    return { unauthorized: false as const, items: merged };
  };

  let access = await getAccessToken();
  let { unauthorized, items } = await load(access);
  if (unauthorized) {
    clearSpotifyTokenCache();
    access = await getAccessToken();
    ({ unauthorized, items } = await load(access));
  }
  if (unauthorized) {
    throw new Error("Spotify search 401 after token refresh");
  }

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
