export type MusicTrack = { id: string; title: string; artist: string; album: string; artworkUrl: string | null; externalUrl: string; provider: string };

let tokenCache: { token: string; expiresAt: number } | null = null;

export function musicConfigured() {
  return Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
}

async function spotifyToken() {
  if (!musicConfigured()) throw new Error("Music provider is not configured");
  if (tokenCache && tokenCache.expiresAt > Date.now() + 30_000) return tokenCache.token;
  const basic = Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString("base64");
  const res = await fetch("https://accounts.spotify.com/api/token", { method: "POST", headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials", cache: "no-store" });
  if (!res.ok) throw new Error("Music provider authentication failed");
  const data = await res.json() as { access_token: string; expires_in: number };
  tokenCache = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

export async function searchMusic(query: string, limit = 10): Promise<MusicTrack[]> {
  const token = await spotifyToken();
  const params = new URLSearchParams({ q: query, type: "track", limit: String(Math.min(Math.max(limit, 1), 20)) });
  const res = await fetch(`https://api.spotify.com/v1/search?${params}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!res.ok) throw new Error("Music search failed");
  const data = await res.json() as { tracks?: { items?: Array<{ id: string; name: string; artists: Array<{ name: string }>; album: { name: string; images?: Array<{ url: string }> }; external_urls?: { spotify?: string } }> } };
  return (data.tracks?.items ?? []).map((t) => ({ id: t.id, title: t.name, artist: t.artists.map(a => a.name).join(", "), album: t.album.name, artworkUrl: t.album.images?.[0]?.url ?? null, externalUrl: t.external_urls?.spotify ?? `https://open.spotify.com/track/${t.id}`, provider: "spotify" }));
}
