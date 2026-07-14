import { Router, type IRouter, type Request, type Response } from "express";
import yts from "yt-search";
import { TtlCache } from "../lib/cache";
import { BoundedMap } from "../lib/bounded-map";
import { VERSION } from "../lib/version";
import { increment, recordSuccess, recordError } from "../lib/counter";
import { inferCategory } from "../lib/category";
import { dedup, withTimeout } from "../lib/dedup";
import { validateQuery, sanitizeError } from "../lib/validate";
import { downloadRateLimit } from "../middleware/rate-limit";
import { fetchDownloadLinks, type ServerNum, type S3Quality } from "../lib/downloader";
import { isShutdown, emitAdminLog, recordApiCall, recordServerResult } from "../lib/admin-state";

const router: IRouter = Router();

// ── Types ─────────────────────────────────────────────────────────────────────

interface VideoPayload {
  version: string;
  success: true;
  creditTo: "MJL";
  video_id: string;
  url: string;
  short_url: string;
  category: string;
  info: Record<string, unknown>;
  media: {
    mp4: { url: string; quality: "HD" } | null;
    mp3: { url: string } | null;
    server: 1 | 2 | 3 | null;
    qualities?: S3Quality[]; // present when server === 3
  };
}

interface VideoResponse extends VideoPayload {
  ApiCount: number;
  cached: boolean;
  ms: number;
}

// ── Cache (auto-mode route only) ──────────────────────────────────────────────
// Fresh 5 min, stale-served up to 20 min (SWR), max 500 entries.
const cache = new TtlCache<VideoPayload>(300_000, 1_200_000, 500);

// Title → videoId lookup cache (LRU, max 1000).
const queryToId = new BoundedMap<string, string>(1_000);

// ── Helpers ───────────────────────────────────────────────────────────────────

const YT_URL_RE =
  /(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;

function extractVideoId(input: string): string | null {
  const m = input.match(YT_URL_RE);
  return m ? m[1] : null;
}

function isUrl(input: string): boolean {
  return /^https?:\/\//i.test(input);
}

function resolveAuthor(author: yts.VideoAuthor | string | undefined): {
  name: string | null;
  url: string | null;
} {
  if (!author) return { name: null, url: null };
  if (typeof author === "string") return { name: author, url: null };
  return { name: author.name ?? null, url: author.url ?? null };
}

function clean(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => {
      if (v === null || v === undefined) return false;
      if (Array.isArray(v) && v.length === 0) return false;
      return true;
    }),
  );
}

function resolveThumbnail(
  videoId: string,
  info: yts.VideoResult | null,
  dlThumbnail?: string,
): string {
  const fromYts = info?.thumbnail || info?.image || null;
  if (fromYts) return fromYts;
  if (dlThumbnail) return dlThumbnail;
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

/** Derive the server's public base URL from the request (used for Server 3 proxy URLs). */
function proxyBaseFrom(req: Request): string {
  return `${req.protocol}://${req.get("host")}`;
}

// ── Payload builder ───────────────────────────────────────────────────────────

/**
 * Fetch and assemble the full v1 video payload.
 *
 * @param preInfo   - Pre-loaded yts.VideoResult from a keyword search.
 *                    Pass null for URL-based requests (runs yts + download in parallel).
 * @param server    - Which download server to use (default: "auto").
 * @param proxyBase - This server's base URL; required when server === 3.
 */
async function fetchPayload(
  videoId: string,
  youtubeUrl: string,
  preInfo: yts.VideoResult | null = null,
  server: ServerNum = "auto",
  proxyBase = "",
): Promise<VideoPayload> {
  let info: yts.VideoResult | null = preInfo;
  let links: Awaited<ReturnType<typeof fetchDownloadLinks>> | null = null;

  if (info) {
    // Keyword path — metadata already in hand; only fetch download links.
    links = await dedup(`dl:${videoId}:${server}`, () =>
      fetchDownloadLinks(youtubeUrl, videoId, proxyBase, server),
    );
  } else {
    // URL path — run metadata lookup and download fetch in parallel.
    const [infoResult, dlResult] = await Promise.allSettled([
      dedup(`yts-vid:${videoId}`, () =>
        withTimeout(yts({ videoId }), 15_000, "yt-search-id"),
      ),
      dedup(`dl:${videoId}:${server}`, () =>
        fetchDownloadLinks(youtubeUrl, videoId, proxyBase, server),
      ),
    ]);
    info = infoResult.status === "fulfilled"
      ? (infoResult.value as unknown as yts.VideoResult)
      : null;
    links = dlResult.status === "fulfilled" ? dlResult.value : null;
  }

  const { name: authorName, url: channelUrl } = resolveAuthor(info?.author);
  const thumbnail = resolveThumbnail(videoId, info, links?.thumbnail ?? undefined);
  const category = inferCategory(
    info?.keywords ?? [],
    info?.title ?? "",
    info?.description ?? "",
  );

  // Server 3 provides richer metadata — merge what yt-search may have missed
  const s3author = links?.author ?? null;
  const s3desc   = links?.description ?? null;

  const rawInfo: Record<string, unknown> = {
    title:            info?.title ?? links?.title ?? null,
    author:           authorName ?? s3author,
    channel_url:      channelUrl,
    thumbnail,
    duration:         info?.duration?.timestamp ?? null,
    duration_seconds: info?.duration?.seconds ?? (links?.duration ?? null),
    views:            info?.views ?? (links?.views ?? null),
    likes:            info?.likes ?? null,
    published:        info?.ago ?? null,
    description:      info?.description ?? s3desc,
    keywords:         info?.keywords ?? [],
  };

  const mp4Url = links?.mp4 ?? null;
  const mp3Url = links?.mp3 ?? null;

  const media: VideoPayload["media"] = {
    mp4: mp4Url ? { url: mp4Url, quality: "HD" } : null,
    mp3: mp3Url ? { url: mp3Url } : null,
    server: links?.server ?? null,
  };

  // Include quality list when Server 3 was used
  if (links?.server === 3 && links.qualities?.length) {
    media.qualities = links.qualities;
  }

  return {
    version: VERSION,
    success: true,
    creditTo: "MJL",
    video_id: videoId,
    url: youtubeUrl,
    short_url: `https://youtu.be/${videoId}`,
    category,
    info: clean(rawInfo),
    media,
  };
}

// ── Shared request handler ────────────────────────────────────────────────────

async function handleV1(
  req: Request,
  res: Response,
  server: ServerNum,
  useCache: boolean,
): Promise<void> {
  const t0 = Date.now();

  if (isShutdown()) {
    emitAdminLog("warn", "[v1] Request blocked — server in shutdown mode");
    res.status(503).json({
      version: VERSION, creditTo: "MJL", status: "shutdown",
      message: "Temporary Shutdown — Admins are currently fixing or improving things. We'll be back in a little while — please be patient.",
    });
    return;
  }

  const validation = validateQuery(req.query[""]);
  if (!validation.ok) {
    res.status(400).json({
      version: VERSION,
      success: false,
      creditTo: "MJL",
      ms: Date.now() - t0,
      error: validation.reason,
      usage: "/api/v1/q?=(YouTube URL or song/video title)",
      examples: [
        "/api/v1/q?=lay me down sam smith",
        "/api/v1/q?=https://youtu.be/dQw4w9WgXcQ",
        "/api/v1/server=3/q?=https://youtu.be/dQw4w9WgXcQ",
      ],
    });
    return;
  }

  const input = validation.value;

  if (isUrl(input) && !extractVideoId(input)) {
    res.status(400).json({
      version: VERSION,
      success: false,
      creditTo: "MJL",
      ms: Date.now() - t0,
      error: "URL not supported. Only YouTube URLs are accepted.",
      supported: [
        "https://youtu.be/VIDEO_ID",
        "https://www.youtube.com/watch?v=VIDEO_ID",
        "https://www.youtube.com/shorts/VIDEO_ID",
      ],
      tip: "You can also search by title — e.g. /api/v1/q?=bohemian rhapsody",
    });
    return;
  }

  const ApiCount = increment();
  recordApiCall();
  emitAdminLog("info", `[v1${server !== "auto" ? `/s${server}` : ""}] ${input.slice(0, 80)}`);
  res.on("finish", () => {
    if (res.statusCode >= 200 && res.statusCode < 400) recordSuccess();
    else recordError();
  });

  try {
    let videoId: string | null = null;
    let youtubeUrl: string;
    let preInfo: yts.VideoResult | null = null;
    const proxyBase = proxyBaseFrom(req);

    if (isUrl(input)) {
      videoId = extractVideoId(input);
      youtubeUrl = `https://www.youtube.com/watch?v=${videoId!}`;
    } else {
      const known = queryToId.get(input);
      if (known) {
        videoId = known;
        youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
      } else {
        const searchResult = await dedup(
          `yts:${input}`,
          () => withTimeout(yts(input), 15_000, "yt-search"),
        );
        const first = searchResult.videos[0];
        if (!first) {
          res.status(404).json({
            version: VERSION, success: false, creditTo: "MJL",
            ApiCount, ms: Date.now() - t0,
            error: "No YouTube results found for this query.",
          });
          return;
        }
        videoId = first.videoId;
        youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
        queryToId.set(input, videoId);
        preInfo = first;
      }
    }

    // Cache only used in auto mode
    if (useCache) {
      const hit = cache.getWithMeta(videoId!);
      if (hit) {
        res.setHeader("Cache-Control", "private, no-store");
        res.json({ ...hit.value, ApiCount, cached: true, ms: Date.now() - t0 } satisfies VideoResponse);
        if (hit.stale) {
          setImmediate(() => {
            dedup(`swr:${videoId}`, () => fetchPayload(videoId!, youtubeUrl, null, "auto", proxyBase))
              .then(payload => cache.set(videoId!, payload))
              .catch(() => {});
          });
        }
        return;
      }
    }

    const payload = await dedup(
      `fetch:${videoId}:${server}`,
      () => fetchPayload(videoId!, youtubeUrl, preInfo, server, proxyBase),
    );

    if (useCache) cache.set(videoId!, payload);

    res.setHeader("Cache-Control", "private, no-store");
    const srv = payload.media.server;
    if (srv === 1 || srv === 2 || srv === 3) {
      recordServerResult(srv, !!(payload.media.mp4 || payload.media.mp3));
    }
    emitAdminLog("success", `[v1${server !== "auto" ? `/s${server}` : ""}] ✓ ${videoId} server:${srv ?? "?"} ${Date.now()-t0}ms`);
    res.json({ ...payload, ApiCount, cached: false, ms: Date.now() - t0 } satisfies VideoResponse);
  } catch (err: unknown) {
    req.log.error({ err, input }, "v1 YouTube download error");
    emitAdminLog("error", `[v1] ✗ ${sanitizeError(err)}`);
    res.status(500).json({
      version: VERSION, success: false, creditTo: "MJL",
      ApiCount, ms: Date.now() - t0, error: sanitizeError(err),
    });
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

/** GET /api/v1/q?=<url or title>  —  auto mode (tries servers 1→2→3) */
router.get("/v1/q", downloadRateLimit, (req, res) => handleV1(req, res, "auto", true));

/** GET /api/v1/server=:server/q?=<url or title>  —  specific server */
router.get("/v1/server=:server/q", downloadRateLimit, (req: Request, res: Response) => {
  const raw = String(req.params.server);
  if (raw === "auto") return handleV1(req, res, "auto", false);
  const n = parseInt(raw, 10);
  if (n !== 1 && n !== 2 && n !== 3) {
    res.status(400).json({
      version: VERSION, success: false, creditTo: "MJL",
      error: `Invalid server "${raw}". Valid options: 1, 2, 3, auto`,
      examples: [
        "/api/v1/server=1/q?=never gonna give you up",
        "/api/v1/server=2/q?=https://youtu.be/dQw4w9WgXcQ",
        "/api/v1/server=3/q?=https://youtu.be/dQw4w9WgXcQ",
        "/api/v1/server=auto/q?=bohemian rhapsody",
      ],
    });
    return;
  }
  return handleV1(req, res, n as ServerNum, false);
});

export default router;
