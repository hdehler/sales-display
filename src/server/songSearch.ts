/** Unified hit for `/api/songs/search` (same shape regardless of source). */
export type CatalogSongHit = {
  id: string;
  title: string;
  artist: string;
  album: string;
  cover: string;
  previewUrl: string;
  duration: number;
};

/** Query `provider` on `/api/songs/search` — `auto` matches production behavior. */
export type SearchCatalogMode = "auto" | "itunes" | "deezer";

function parseCatalogMode(raw: unknown): SearchCatalogMode {
  const s = String(raw || "auto").toLowerCase();
  if (s === "itunes" || s === "deezer") return s;
  return "auto";
}

export { parseCatalogMode };

// ── iTunes ───────────────────────────────────────────────────
// Public, no keys required. Returns a 30s preview URL for most tracks.
// @see https://performance-partners.apple.com/search-api

type ITunesResult = {
  trackId?: number;
  trackName?: string;
  artistName?: string;
  collectionName?: string;
  artworkUrl100?: string;
  artworkUrl60?: string;
  previewUrl?: string;
  trackTimeMillis?: number;
  kind?: string;
};

type ITunesResponse = {
  resultCount: number;
  results: ITunesResult[];
};

/** Upgrade iTunes artwork URL to a crisp 200px square. */
function upsizeArtwork(url: string | undefined): string {
  if (!url) return "";
  return url.replace(/\/\d+x\d+bb\.(jpg|png)$/i, "/200x200bb.$1");
}

/**
 * iTunes' edge servers periodically return `404 [newNullResponse]` — a known,
 * long-standing routing flakiness on Apple's side. Mitigations that help:
 *   1. Real browser User-Agent + Accept headers (Node's defaults get 404'd).
 *   2. Percent-encode the query manually; `URLSearchParams` encodes spaces
 *      as `+` which some Apple edges reject.
 *   3. Only the minimum set of params (`term`, `entity`, `limit`).
 *   4. A few retries with exponential backoff to ride out a bad edge node.
 */
const ITUNES_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
  Accept: "application/json, text/javascript, */*; q=0.01",
  "Accept-Language": "en-US,en;q=0.9",
};

const ITUNES_MAX_ATTEMPTS = 4;

function buildItunesUrl(q: string): string {
  const parts = [
    `term=${encodeURIComponent(q)}`,
    "entity=song",
    "limit=20",
  ];
  const country = (process.env.ITUNES_COUNTRY || "").trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(country)) {
    parts.push(`country=${country}`);
  }
  return `https://itunes.apple.com/search?${parts.join("&")}`;
}

async function fetchITunes(url: string): Promise<Response> {
  let last: Response | null = null;
  for (let attempt = 0; attempt < ITUNES_MAX_ATTEMPTS; attempt++) {
    const r = await fetch(url, { headers: ITUNES_HEADERS });
    if (r.ok) return r;
    last = r;
    // 404 / 5xx are the transient ones worth retrying.
    if (r.status !== 404 && r.status < 500) return r;
    if (attempt < ITUNES_MAX_ATTEMPTS - 1) {
      const delay = 200 * Math.pow(2, attempt) + Math.floor(Math.random() * 100);
      await new Promise((res) => setTimeout(res, delay));
    }
  }
  return last!;
}

async function searchITunesCatalog(q: string): Promise<CatalogSongHit[]> {
  const r = await fetchITunes(buildItunesUrl(q));
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new Error(`iTunes search ${r.status}: ${body.slice(0, 200)}`);
  }
  const json = (await r.json()) as ITunesResponse;
  const out: CatalogSongHit[] = [];
  for (const t of json.results || []) {
    if (!t.previewUrl) continue;
    if (!t.trackId || !t.trackName) continue;
    out.push({
      id: String(t.trackId),
      title: t.trackName,
      artist: t.artistName || "Unknown",
      album: t.collectionName || "",
      cover: upsizeArtwork(t.artworkUrl100 || t.artworkUrl60),
      previewUrl: t.previewUrl,
      duration: Math.round((t.trackTimeMillis ?? 30_000) / 1000),
    });
    if (out.length >= 12) break;
  }
  return out;
}

// ── Deezer (fallback) ────────────────────────────────────────

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
 * - `auto`: iTunes first; fall back to Deezer if iTunes returns 0 / errors.
 * - `itunes`: iTunes only (empty + hint if nothing has a preview).
 * - `deezer`: Deezer only.
 */
export async function searchSongCatalog(
  q: string,
  mode: SearchCatalogMode = "auto",
): Promise<{
  data: CatalogSongHit[];
  source: "itunes" | "deezer" | null;
  hint?: string;
}> {
  const trimmed = q.trim();
  if (!trimmed) return { data: [], source: null };

  if (mode === "deezer") {
    const deezer = await searchDeezerCatalog(trimmed);
    return { data: deezer, source: "deezer" };
  }

  if (mode === "itunes") {
    try {
      const hits = await searchITunesCatalog(trimmed);
      return {
        data: hits,
        source: "itunes",
        hint: hits.length === 0 ? "itunes_no_previews" : undefined,
      };
    } catch (e) {
      // iTunes Search API is notoriously flaky (`[newNullResponse]` 404s).
      // In itunes-only mode, degrade to empty + hint instead of a 500 so the
      // UI can show a clear "temporarily unavailable" message.
      console.error("[iTunes] Search failed (itunes-only mode):", e);
      return {
        data: [],
        source: "itunes",
        hint: "itunes_unavailable",
      };
    }
  }

  // auto
  try {
    const hits = await searchITunesCatalog(trimmed);
    if (hits.length > 0) {
      return { data: hits, source: "itunes" };
    }
  } catch (e) {
    console.error("[iTunes] Search failed, falling back to Deezer:", e);
  }

  const deezer = await searchDeezerCatalog(trimmed);
  return { data: deezer, source: "deezer" };
}
