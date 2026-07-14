import { createRequire } from "module";
import { withTimeout } from "./dedup";
import { fetchWithYoutubei, type S3Quality } from "./youtubei-downloader";

const _require = createRequire(import.meta.url);

export type { S3Quality };

export type ServerNum = 1 | 2 | 3 | "auto";

export interface DownloadLinks {
  mp4: string | null;
  mp3: string | null;
  thumbnail: string | null;
  title: string | null;
  server: 1 | 2 | 3;
  // Server 3 extras
  qualities?: S3Quality[];
  description?: string | null;
  author?: string | null;
  duration?: number | null;
  views?: number | null;
}

// ── Server 1: btch-downloader ─────────────────────────────────────────────────
async function fetchServer1(youtubeUrl: string): Promise<DownloadLinks> {
  const { youtube } = _require("btch-downloader") as {
    youtube: (url: string) => Promise<{
      status: boolean;
      title?: string;
      author?: string;
      thumbnail?: string;
      mp3?: string;
      mp4?: string;
    }>;
  };

  const data = await withTimeout(youtube(youtubeUrl), 20_000, "btch-youtube");
  if (!data?.status || (!data.mp4 && !data.mp3)) {
    throw new Error("btch-downloader: no usable data");
  }
  return {
    mp4: data.mp4 ?? null,
    mp3: data.mp3 ?? null,
    thumbnail: data.thumbnail ?? null,
    title: data.title ?? null,
    server: 1,
  };
}

// ── Server 2: nayan-media-downloaders ─────────────────────────────────────────
async function fetchServer2(youtubeUrl: string): Promise<DownloadLinks> {
  const { ytdown } = _require("nayan-media-downloaders") as typeof import("nayan-media-downloaders");
  const dl = await withTimeout(ytdown(youtubeUrl), 20_000, "ytdown");
  const data = (dl?.status ? dl.data : null) ?? null;

  return {
    mp4: data?.video_hd ?? data?.video ?? data?.high ?? null,
    mp3: data?.audio ?? data?.low ?? null,
    thumbnail: data?.thumbnail ?? data?.thumb ?? null,
    title: null,
    server: 2,
  };
}

// ── Server 3: youtubei.js ─────────────────────────────────────────────────────
async function fetchServer3(videoId: string, proxyBase: string): Promise<DownloadLinks> {
  const result = await fetchWithYoutubei(videoId, proxyBase);
  return {
    mp4: result.mp4,
    mp3: result.mp3,
    thumbnail: result.thumbnail,
    title: result.title,
    server: 3,
    qualities: result.qualities,
    description: result.description,
    author: result.author,
    duration: result.duration,
    views: result.views,
  };
}

/** Returns true when a DownloadLinks result has at least one usable media URL. */
function hasUsableLinks(links: DownloadLinks): boolean {
  return !!(links.mp4 || links.mp3);
}

// ── Auto: try 1 → 2 → 3 ──────────────────────────────────────────────────────
async function fetchAuto(
  youtubeUrl: string,
  videoId?: string,
  proxyBase?: string,
): Promise<DownloadLinks> {
  // Server 1 — throws on failure, returns usable links on success
  try {
    const r = await fetchServer1(youtubeUrl);
    if (hasUsableLinks(r)) return r;
  } catch { /* fall through */ }

  // Server 2 — catches internally and returns null links when upstream fails;
  // check explicitly so we continue to Server 3 instead of returning empty.
  try {
    const r = await fetchServer2(youtubeUrl);
    if (hasUsableLinks(r)) return r;
  } catch { /* fall through */ }

  // Server 3 — requires videoId + proxyBase (proxy URLs)
  if (videoId && proxyBase) {
    try {
      const r = await fetchServer3(videoId, proxyBase);
      if (hasUsableLinks(r)) return r;
    } catch { /* fall through */ }
  }

  // All servers exhausted — return empty result so callers get a graceful response
  return { mp4: null, mp3: null, thumbnail: null, title: null, server: 2 };
}

/**
 * Fetch MP4 + audio download links for a YouTube video.
 *
 * @param youtubeUrl - Full YouTube watch URL.
 * @param videoId    - 11-char video ID (required for Server 3).
 * @param proxyBase  - This server's base URL, e.g. "https://xxx.replit.app"
 *                     (required for Server 3 — format URLs are proxied through it).
 * @param server     - "auto" tries 1→2→3 in order; 1|2|3 forces a specific server.
 *
 * Server overview:
 *   1 → btch-downloader   (primary; returns title+thumbnail)
 *   2 → nayan-media-downloaders (fallback; ymcdn.org relay)
 *   3 → youtubei.js       (full YouTube client; returns quality list + metadata;
 *                           URLs proxied through this server to avoid Access Denied)
 */
export async function fetchDownloadLinks(
  youtubeUrl: string,
  videoId?: string,
  proxyBase?: string,
  server: ServerNum = "auto",
): Promise<DownloadLinks> {
  switch (server) {
    case "auto": return fetchAuto(youtubeUrl, videoId, proxyBase);
    case 1:      return fetchServer1(youtubeUrl);
    case 2:      return fetchServer2(youtubeUrl);
    case 3: {
      if (!videoId || !proxyBase) throw new Error("Server 3 requires videoId and proxyBase");
      return fetchServer3(videoId, proxyBase);
    }
    default:
      throw new Error(`Unknown server: ${String(server)}`);
  }
}
