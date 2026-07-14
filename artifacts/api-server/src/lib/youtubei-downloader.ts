import { Innertube } from "youtubei.js";
import { withTimeout } from "./dedup";

// ── Public types ──────────────────────────────────────────────────────────────

export interface S3Quality {
  itag: number;
  mimeType: string;
  quality: string;
  url: string; // proxied through this project's domain
  /** True only for muxed streams (from `formats`) or audio-only streams */
  hasAudio: boolean;
  /** True for muxed streams (from `formats`) or video-only adaptive streams */
  hasVideo: boolean;
  width?: number;
  height?: number;
  fps?: number;
  bitrate?: number;
}

export interface S3Result {
  title: string | null;
  description: string | null;
  thumbnail: string | null;
  author: string | null;
  duration: number | null;
  views: number | null;
  mp4: string | null;  // best muxed or video-only stream (proxy URL)
  mp3: string | null;  // best audio-only stream (proxy URL)
  qualities: S3Quality[];
  server: 3;
}

// ── Singleton Innertube instance ──────────────────────────────────────────────

let _yt: Innertube | null = null;
let _ytInitializing: Promise<Innertube> | null = null;

async function getYt(): Promise<Innertube> {
  if (_yt) return _yt;
  if (_ytInitializing) return _ytInitializing;
  _ytInitializing = Innertube.create().then(yt => {
    _yt = yt;
    _ytInitializing = null;
    return yt;
  });
  return _ytInitializing;
}

// ── URL store: "videoId:itag" → { realUrl, expiry } ──────────────────────────
// YouTube streaming URLs are IP-session-bound; browsers get "Access Denied"
// because they lack the server-side session context.  We proxy through this
// server so the download uses the same process that fetched the info.
// URLs are stored for 4 hours (YouTube typically signs them for 6 h).

const URL_TTL_MS = 4 * 60 * 60 * 1000;
const urlStore = new Map<string, { url: string; expiry: number }>();

export function storeProxyUrl(videoId: string, itag: number, url: string): void {
  urlStore.set(`${videoId}:${itag}`, { url, expiry: Date.now() + URL_TTL_MS });
}

export function getProxyUrl(videoId: string, itag: number): string | null {
  const entry = urlStore.get(`${videoId}:${itag}`);
  if (!entry || Date.now() > entry.expiry) return null;
  return entry.url;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

type RawFmt = Record<string, unknown>;

/** Pull a typed value from a raw format object, returning undefined if missing. */
function get<T>(fmt: RawFmt, key: string): T | undefined {
  return key in fmt ? (fmt[key] as T) : undefined;
}

/**
 * Convert a raw youtubei.js format object into an S3Quality entry.
 *
 * @param isMuxed  – true when the format came from `streaming_data.formats`
 *                   (combined video+audio); false for `adaptive_formats`
 *                   (separate video-only or audio-only streams).
 *
 * YouTube's adaptive stream split:
 *   adaptive_formats + mime "video/*" → video-only (NO audio)
 *   adaptive_formats + mime "audio/*" → audio-only  (NO video)
 *   formats           (muxed)         → video + audio (lower resolution)
 */
function toQuality(
  fmt: RawFmt,
  isMuxed: boolean,
  videoId: string,
  proxyBase: string,
): S3Quality | null {
  const rawUrl = get<string>(fmt, "url");
  if (!rawUrl) return null;

  const itag = get<number>(fmt, "itag");
  if (itag === undefined) return null;

  const mime = get<string>(fmt, "mime_type") ?? "";
  const mimeBase = mime.split(";")[0].trim(); // strip codec suffix

  const isVideoMime = mimeBase.startsWith("video/");
  const isAudioMime = mimeBase.startsWith("audio/");

  // Capability is determined by the source array, not just MIME type:
  // - muxed "formats" carry both video and audio regardless of MIME
  // - adaptive video streams are video-only even though MIME is "video/*"
  // - adaptive audio streams are audio-only
  const hasVideo = isMuxed || isVideoMime;
  const hasAudio = isMuxed || isAudioMime;

  const quality =
    get<string>(fmt, "quality_label") ??
    get<string>(fmt, "quality") ??
    "unknown";

  storeProxyUrl(videoId, itag, rawUrl);

  return {
    itag,
    mimeType: mime,
    quality,
    url: `${proxyBase}/api/proxy/${videoId}/${itag}`,
    hasVideo,
    hasAudio,
    width:   get<number>(fmt, "width"),
    height:  get<number>(fmt, "height"),
    fps:     get<number>(fmt, "fps"),
    bitrate: get<number>(fmt, "bitrate"),
  };
}

/** Parse a quality label like "1080p60" or "720p" into a numeric sort key. */
function qualitySortKey(q: S3Quality): number {
  // Prefer muxed (both) > video-only > audio-only for video selection
  const cap = q.hasVideo && q.hasAudio ? 2 : q.hasVideo ? 1 : 0;
  const res = q.height ?? 0;
  const br  = q.bitrate ?? 0;
  return cap * 1e12 + res * 1e6 + br;
}

// ── Core fetch ────────────────────────────────────────────────────────────────

/**
 * Fetch full video metadata + all streaming quality options via youtubei.js.
 *
 * Every format URL is rewritten to flow through `/api/proxy/{videoId}/{itag}`
 * on this server so clients can actually download the stream without hitting
 * YouTube's "Access Denied" that blocks direct browser access.
 *
 * @param videoId    – 11-char YouTube video ID.
 * @param proxyBase  – Base URL of this server (e.g. "https://xxx.replit.app").
 */
export async function fetchWithYoutubei(
  videoId: string,
  proxyBase: string,
): Promise<S3Result> {
  const yt = await getYt();
  const info = await withTimeout(yt.getInfo(videoId), 25_000, "youtubei-getInfo");

  // ── Basic metadata ────────────────────────────────────────────────────────
  const basic = info.basic_info as RawFmt;

  const title       = get<string>(basic, "title")             ?? null;
  const description = get<string>(basic, "short_description") ?? null;
  const thumbArr    = get<Array<{ url: string }>>(basic, "thumbnail");
  const thumbnail   = thumbArr?.[0]?.url ?? null;
  const authorRaw   = get<unknown>(basic, "author");
  const author      = typeof authorRaw === "string" ? authorRaw : null;
  const duration    = get<number>(basic, "duration")          ?? null;
  const views       = get<number>(basic, "view_count")        ?? null;

  // ── Streaming formats ─────────────────────────────────────────────────────
  const sd = info.streaming_data as {
    adaptive_formats?: unknown[];
    formats?: unknown[];
  } | undefined;

  if (!sd || (!sd.adaptive_formats?.length && !sd.formats?.length)) {
    // No streaming data (age-restricted, DRM, unavailable)
    return { title, description, thumbnail, author, duration, views, mp4: null, mp3: null, qualities: [], server: 3 };
  }

  const qualities: S3Quality[] = [];

  // Process muxed streams (video+audio, typically 360p/720p)
  for (const raw of sd.formats ?? []) {
    const q = toQuality(raw as RawFmt, true, videoId, proxyBase);
    if (q) qualities.push(q);
  }

  // Process adaptive streams (video-only or audio-only, higher resolutions)
  for (const raw of sd.adaptive_formats ?? []) {
    const q = toQuality(raw as RawFmt, false, videoId, proxyBase);
    if (q) qualities.push(q);
  }

  // ── Select best defaults ──────────────────────────────────────────────────
  // Best mp4 with audio: prefer muxed, then video-only adaptive (highest res)
  // Sorted descending by: muxed-flag, height, bitrate
  const videoStreams = qualities
    .filter(q => q.hasVideo && q.mimeType.includes("mp4"))
    .sort((a, b) => qualitySortKey(b) - qualitySortKey(a));

  const bestMp4 = videoStreams[0] ?? null;

  // Best audio-only stream: prefer mp4 (aac) container, then by bitrate
  const audioStreams = qualities
    .filter(q => !q.hasVideo && q.hasAudio)
    .sort((a, b) => {
      // Prefer mp4 container
      const mp4a = a.mimeType.includes("mp4") ? 1 : 0;
      const mp4b = b.mimeType.includes("mp4") ? 1 : 0;
      if (mp4b !== mp4a) return mp4b - mp4a;
      return (b.bitrate ?? 0) - (a.bitrate ?? 0);
    });

  const bestAudio = audioStreams[0] ?? null;

  return {
    title,
    description,
    thumbnail,
    author,
    duration,
    views,
    mp4: bestMp4?.url ?? null,
    mp3: bestAudio?.url ?? null,
    qualities,
    server: 3,
  };
}
