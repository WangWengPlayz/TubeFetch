import { Router, type IRouter, type Request, type Response } from "express";
import yts from "yt-search";
import { TtlCache } from "../lib/cache";
import { BoundedMap } from "../lib/bounded-map";
import { VERSION } from "../lib/version";
import { increment, recordSuccess, recordError } from "../lib/counter";
import { dedup, withTimeout } from "../lib/dedup";
import { validateQuery, sanitizeError } from "../lib/validate";
import { downloadRateLimit } from "../middleware/rate-limit";
import { fetchDownloadLinks, type ServerNum, type S3Quality } from "../lib/downloader";
import { isShutdown, emitAdminLog, recordApiCall, recordServerResult } from "../lib/admin-state";

const router: IRouter = Router();

// ── Types ─────────────────────────────────────────────────────────────────────

interface V2Payload {
  credit: "MJL";
  version: string;
  title: string | null;
  media: {
    mp4: string | null;
    mp3: string | null;
    server: 1 | 2 | 3 | null;
    qualities?: S3Quality[]; // present when server === 3
  };
}

interface V2Response extends V2Payload {
  ApiCount: number;
  cached: boolean;
  ms: number;
}

// ── Cache (auto-mode route only) ──────────────────────────────────────────────
// Fresh 5 min, stale-served up to 20 min (SWR), max 500 entries.
const cache = new TtlCache<V2Payload>(300_000, 1_200_000, 500);

// Keyword → videoId (LRU, max 1000)
const queryToId = new BoundedMap<string, string>(1_000);
// videoId → title (LRU, max 1000) — caches titles for URL inputs
const videoIdToTitle = new BoundedMap<string, string>(1_000);

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

function proxyBaseFrom(req: Request): string {
  return `${req.protocol}://${req.get("host")}`;
}

// ── Payload builder ───────────────────────────────────────────────────────────

/**
 * Fetch title + download links for a video.
 *
 * knownTitle = string → keyword path: title already known; only fetches download links.
 * knownTitle = null   → URL path: title comes from the downloader response if available,
 *                        or falls back to yts({ videoId }) when Server 2 (nayan) ran
 *                        (nayan doesn't return titles).
 */
async function fetchPayload(
  videoId: string,
  youtubeUrl: string,
  knownTitle: string | null,
  server: ServerNum = "auto",
  proxyBase = "",
): Promise<V2Payload> {
  const links = await dedup(`dl:${videoId}:${server}`, () =>
    fetchDownloadLinks(youtubeUrl, videoId, proxyBase, server),
  );

  let title = knownTitle ?? links?.title ?? null;

  // Title fallback via yts({ videoId }) — only needed when Server 2 (nayan) ran
  // since nayan doesn't return a title. Servers 1 and 3 both return titles.
  if (!title && links?.server === 2) {
    try {
      const info = await dedup(`yts-id:${videoId}`, () =>
        withTimeout(yts({ videoId }), 12_000, "yt-search-id"),
      );
      title = (info as unknown as { title?: string }).title ?? null;
      if (title) videoIdToTitle.set(videoId, title);
    } catch { /* best-effort */ }
  }

  const media: V2Payload["media"] = {
    mp4: links?.mp4 ?? null,
    mp3: links?.mp3 ?? null,
    server: links?.server ?? null,
  };

  // Include quality list when Server 3 was used
  if (links?.server === 3 && links.qualities?.length) {
    media.qualities = links.qualities;
  }

  return {
    credit: "MJL",
    version: VERSION,
    title,
    media,
  };
}

// ── Shared request handler ────────────────────────────────────────────────────

async function handleV2(
  req: Request,
  res: Response,
  server: ServerNum,
  useCache: boolean,
): Promise<void> {
  const t0 = Date.now();

  if (isShutdown()) {
    emitAdminLog("warn", "[v2] Request blocked — server in shutdown mode");
    res.status(503).json({
      credit: "MJL", version: VERSION, status: "shutdown",
      message: "Temporary Shutdown — Admins are currently fixing or improving things. We'll be back in a little while — please be patient.",
    });
    return;
  }

  const validation = validateQuery(req.query[""]);
  if (!validation.ok) {
    res.status(400).json({
      credit: "MJL",
      version: VERSION,
      ms: Date.now() - t0,
      error: validation.reason,
      usage: "/api/v2/q?=(YouTube URL or title)",
      examples: [
        "/api/v2/q?=bohemian rhapsody",
        "/api/v2/server=1/q?=https://youtu.be/dQw4w9WgXcQ",
        "/api/v2/server=3/q?=https://youtu.be/dQw4w9WgXcQ",
      ],
    });
    return;
  }

  const input = validation.value;

  if (isUrl(input) && !extractVideoId(input)) {
    res.status(400).json({
      credit: "MJL",
      version: VERSION,
      ms: Date.now() - t0,
      error: "URL not supported. Only YouTube URLs are accepted.",
      supported: [
        "https://youtu.be/VIDEO_ID",
        "https://www.youtube.com/watch?v=VIDEO_ID",
        "https://www.youtube.com/shorts/VIDEO_ID",
      ],
      tip: "You can also search by title — e.g. /api/v2/q?=bohemian rhapsody",
    });
    return;
  }

  const ApiCount = increment();
  recordApiCall();
  emitAdminLog("info", `[v2${server !== "auto" ? `/s${server}` : ""}] ${input.slice(0, 80)}`);
  res.on("finish", () => {
    if (res.statusCode >= 200 && res.statusCode < 400) recordSuccess();
    else recordError();
  });

  try {
    let videoId: string | null = null;
    let youtubeUrl: string;
    let knownTitle: string | null = null;
    const proxyBase = proxyBaseFrom(req);

    if (isUrl(input)) {
      videoId = extractVideoId(input);
      youtubeUrl = `https://www.youtube.com/watch?v=${videoId!}`;
      knownTitle = videoIdToTitle.get(videoId!) ?? null;
    } else {
      const known = queryToId.get(input);
      if (known) {
        videoId = known;
        youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
        knownTitle = videoIdToTitle.get(videoId!) ?? null;
      } else {
        const searchResult = await dedup(
          `yts:${input}`,
          () => withTimeout(yts(input), 15_000, "yt-search"),
        );
        const first = searchResult.videos[0];
        if (!first) {
          res.status(404).json({
            credit: "MJL", version: VERSION,
            ApiCount, ms: Date.now() - t0,
            error: "No YouTube results found for this query.",
          });
          return;
        }
        videoId = first.videoId;
        youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
        knownTitle = first.title ?? null;
        queryToId.set(input, videoId);
        if (knownTitle) videoIdToTitle.set(videoId, knownTitle);
      }
    }

    // Cache only used in auto mode
    if (useCache) {
      const hit = cache.getWithMeta(videoId!);
      if (hit) {
        res.setHeader("Cache-Control", "private, no-store");
        res.json({ ...hit.value, ApiCount, cached: true, ms: Date.now() - t0 } satisfies V2Response);
        if (hit.stale) {
          setImmediate(() => {
            dedup(`swr-v2:${videoId}`, () => fetchPayload(videoId!, youtubeUrl, null, "auto", proxyBase))
              .then(payload => cache.set(videoId!, payload))
              .catch(() => {});
          });
        }
        return;
      }
    }

    const payload = await dedup(
      `fetch-v2:${videoId}:${server}`,
      () => fetchPayload(videoId!, youtubeUrl, knownTitle, server, proxyBase),
    );

    if (useCache) cache.set(videoId!, payload);

    res.setHeader("Cache-Control", "private, no-store");
    const srv = payload.media.server;
    if (srv === 1 || srv === 2 || srv === 3) {
      recordServerResult(srv, !!(payload.media.mp4 || payload.media.mp3));
    }
    emitAdminLog("success", `[v2${server !== "auto" ? `/s${server}` : ""}] ✓ ${videoId} server:${srv ?? "?"} ${Date.now()-t0}ms`);
    res.json({ ...payload, ApiCount, cached: false, ms: Date.now() - t0 } satisfies V2Response);
  } catch (err: unknown) {
    req.log.error({ err, input }, "v2 YouTube download error");
    emitAdminLog("error", `[v2] ✗ ${sanitizeError(err)}`);
    res.status(500).json({
      credit: "MJL", version: VERSION,
      ApiCount, ms: Date.now() - t0, error: sanitizeError(err),
    });
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

/** GET /api/v2/q?=<url or title>  —  auto mode (tries servers 1→2→3) */
router.get("/v2/q", downloadRateLimit, (req, res) => handleV2(req, res, "auto", true));

/** GET /api/v2/server=:server/q?=<url or title>  —  specific server */
router.get("/v2/server=:server/q", downloadRateLimit, (req: Request, res: Response) => {
  const raw = String(req.params.server);
  if (raw === "auto") return handleV2(req, res, "auto", false);
  const n = parseInt(raw, 10);
  if (n !== 1 && n !== 2 && n !== 3) {
    res.status(400).json({
      credit: "MJL",
      version: VERSION,
      error: `Invalid server "${raw}". Valid options: 1, 2, 3, auto`,
      examples: [
        "/api/v2/server=1/q?=never gonna give you up",
        "/api/v2/server=2/q?=https://youtu.be/dQw4w9WgXcQ",
        "/api/v2/server=3/q?=https://youtu.be/dQw4w9WgXcQ",
        "/api/v2/server=auto/q?=bohemian rhapsody",
      ],
    });
    return;
  }
  return handleV2(req, res, n as ServerNum, false);
});

export default router;
