/**
 * /api/proxy/:videoId/:itag
 *
 * Streams a YouTube format through this server so the client doesn't
 * hit YouTube's "Access Denied" response. The real URL is only valid
 * after calling an endpoint that used Server 3 (youtubei.js) — it must
 * have been fetched and stored within the last 4 hours.
 *
 * Supports the Range header so browsers and media players can seek.
 */
import { Router, type IRouter, type Request, type Response } from "express";
import { getProxyUrl } from "../lib/youtubei-downloader";
import { Readable } from "stream";

const router: IRouter = Router();

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

router.get("/proxy/:videoId/:itag", async (req: Request, res: Response) => {
  const videoId = String(req.params.videoId);
  const itag    = String(req.params.itag);
  const itagNum = parseInt(itag, 10);

  // ── Validate params ──────────────────────────────────────────────────────
  if (!VIDEO_ID_RE.test(videoId) || isNaN(itagNum)) {
    res.status(400).json({ error: "Invalid proxy parameters." });
    return;
  }

  // ── Look up the stored URL ────────────────────────────────────────────────
  const realUrl = getProxyUrl(videoId, itagNum);
  if (!realUrl) {
    res.status(404).json({
      error: "URL not found or expired.",
      hint: "Re-fetch the video using /api/v1/q or /api/v2/q with server=3 to refresh the proxy URLs.",
    });
    return;
  }

  // ── Proxy the request to YouTube ─────────────────────────────────────────
  try {
    const upstreamHeaders: Record<string, string> = {
      "Referer": "https://www.youtube.com/",
      "Origin":  "https://www.youtube.com",
    };

    // Forward Range header so clients can seek/resume downloads
    const rangeHeader = req.headers["range"];
    if (rangeHeader) upstreamHeaders["Range"] = rangeHeader;

    const upstream = await fetch(realUrl, { headers: upstreamHeaders });

    // Forward relevant headers to the client
    const forwardHeaders = [
      "content-type",
      "content-length",
      "content-range",
      "accept-ranges",
    ];
    for (const h of forwardHeaders) {
      const val = upstream.headers.get(h);
      if (val) res.setHeader(h, val);
    }

    // 206 Partial Content when Range was requested, otherwise 200
    res.status(upstream.status);

    if (!upstream.body) {
      res.end();
      return;
    }

    // Stream from upstream to client
    Readable.fromWeb(upstream.body as Parameters<typeof Readable.fromWeb>[0]).pipe(res);
  } catch {
    if (!res.headersSent) {
      res.status(502).json({ error: "Upstream proxy error. Try again." });
    }
  }
});

export default router;
