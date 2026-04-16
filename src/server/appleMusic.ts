import { SignJWT, importPKCS8, decodeJwt } from "jose";

/** Unified hit shape for `/api/songs/search` (matches Deezer mapping). */
export type CatalogSongHit = {
  id: string;
  title: string;
  artist: string;
  album: string;
  cover: string;
  previewUrl: string;
  duration: number;
};

let cachedToken: { token: string; exp: number } | null = null;

export function isAppleMusicConfigured(): boolean {
  const team = (process.env.APPLE_MUSIC_TEAM_ID || "").trim();
  const kid = (process.env.APPLE_MUSIC_KEY_ID || "").trim();
  const key = (process.env.APPLE_MUSIC_PRIVATE_KEY || "").trim();
  return Boolean(team && kid && key);
}

function storefront(): string {
  const s = (process.env.APPLE_MUSIC_STOREFRONT || "us").trim().toLowerCase();
  return s || "us";
}

async function mintDeveloperToken(): Promise<string> {
  const teamId = (process.env.APPLE_MUSIC_TEAM_ID || "").trim();
  const keyId = (process.env.APPLE_MUSIC_KEY_ID || "").trim();
  const raw = (process.env.APPLE_MUSIC_PRIVATE_KEY || "").trim();
  const pem = raw.replace(/\\n/g, "\n");

  const privateKey = await importPKCS8(pem, "ES256");
  const jwt = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId })
    .setIssuer(teamId)
    .setIssuedAt()
    .setExpirationTime("150d")
    .sign(privateKey);

  const { exp } = decodeJwt(jwt);
  if (typeof exp !== "number") {
    cachedToken = { token: jwt, exp: Math.floor(Date.now() / 1000) + 86400 };
  } else {
    cachedToken = { token: jwt, exp };
  }
  return jwt;
}

async function getDeveloperToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 300 > now) {
    return cachedToken.token;
  }
  return mintDeveloperToken();
}

function artworkUrl(template: string | undefined, size: number): string {
  if (!template) return "";
  return template
    .replace("{w}", String(size))
    .replace("{h}", String(size));
}

type AppleSongResource = {
  id: string;
  attributes?: {
    name?: string;
    artistName?: string;
    albumName?: string;
    durationInMillis?: number;
    artwork?: { url?: string };
    previews?: { url: string }[];
    /** Legacy field — prefer `previews` */
    previewUrl?: string;
  };
};

type AppleSearchResponse = {
  results?: {
    songs?: {
      data?: AppleSongResource[];
    };
  };
};

/**
 * Catalog search (developer token). Tracks without a preview URL are skipped.
 * @see https://developer.apple.com/documentation/applemusicapi/get_catalog_search
 */
export async function searchAppleMusicCatalog(
  q: string,
): Promise<CatalogSongHit[]> {
  const term = encodeURIComponent(q);
  const sf = storefront();
  const url = `https://api.music.apple.com/v1/catalog/${sf}/search?term=${term}&types=songs&limit=15`;
  const token = await getDeveloperToken();
  const r = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new Error(
      `Apple Music search ${r.status}: ${body.slice(0, 200)}`,
    );
  }

  const json = (await r.json()) as AppleSearchResponse;
  const songs = json.results?.songs?.data || [];
  const out: CatalogSongHit[] = [];

  for (const s of songs) {
    const a = s.attributes;
    if (!a) continue;
    const previewUrl =
      a.previews?.[0]?.url ||
      (typeof a.previewUrl === "string" ? a.previewUrl : "");
    if (!previewUrl) continue;

    const durationSec = Math.round((a.durationInMillis ?? 30_000) / 1000);
    out.push({
      id: s.id,
      title: a.name || "Unknown",
      artist: a.artistName || "Unknown",
      album: a.albumName || "",
      cover: artworkUrl(a.artwork?.url, 120),
      previewUrl,
      duration: durationSec,
    });
    if (out.length >= 12) break;
  }

  return out;
}
