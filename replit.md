# TubeFetch — YouTube Downloader API

REST API that accepts a YouTube URL **or a plain title/keyword** and returns direct MP4 and MP3 download links, metadata, and top search results.

## Current Version: 1.4.0

## Stack

- **Monorepo**: pnpm workspaces
- **Node.js**: 24
- **Framework**: Express 5
- **Search**: `yt-search` — resolves title queries to YouTube video IDs and metadata
- **Downloads (Server 1)**: `btch-downloader` — primary MP4/MP3 source
- **Downloads (Server 2)**: `nayan-media-downloaders` — automatic fallback when Server 1 fails
- **Downloads (Server 3)**: `youtubei.js` — full YouTube client; returns full quality list; URLs proxied through this server
- **Logging**: pino + pino-http (pretty in dev, JSON in production)
- **Build**: esbuild (via `build.mjs`)
- **TypeScript**: 5.9, strict

## Key Source Files

- `artifacts/api-server/src/routes/home.ts` — server-rendered HTML frontend
- `artifacts/api-server/src/routes/download.ts` — v1 endpoint (full metadata + downloads); auto + server-specific routes
- `artifacts/api-server/src/routes/download-v2.ts` — v2 endpoint (fast, links only); auto + server-specific routes
- `artifacts/api-server/src/routes/download-v3.ts` — v3 endpoint (top 10 search results)
- `artifacts/api-server/src/routes/proxy.ts` — proxy endpoint for Server 3 (youtubei.js) streams
- `artifacts/api-server/src/lib/downloader.ts` — multi-server download logic (1→2→3 auto chain)
- `artifacts/api-server/src/lib/youtubei-downloader.ts` — Server 3 implementation + URL store for proxy
- `artifacts/api-server/src/lib/counter.ts` — global API call counter singleton
- `artifacts/api-server/src/lib/category.ts` — YouTube content category inference
- `artifacts/api-server/src/lib/cache.ts` — TtlCache (SWR in-memory)
- `artifacts/api-server/src/lib/version.ts` — VERSION constant

## API Endpoints

### Download — Auto mode (tries servers 1→2→3)

| Endpoint | Description |
|---|---|
| `GET /api/v1/q?=(url or title)` | Full metadata + MP4/MP3 links (auto server) |
| `GET /api/v2/q?=(url or title)` | Fast: title + MP4/MP3 links (auto server) |
| `GET /api/v3/q?=(search query)` | YouTube search results |

### Download — Specific server

| Endpoint | Description |
|---|---|
| `GET /api/v1/server=1/q?=(url or title)` | v1 via Server 1 (btch-downloader) |
| `GET /api/v1/server=2/q?=(url or title)` | v1 via Server 2 (nayan) |
| `GET /api/v1/server=3/q?=(url or title)` | v1 via Server 3 (youtubei.js) — full quality list |
| `GET /api/v1/server=auto/q?=(url or title)` | v1 explicit auto |
| `GET /api/v2/server=1/q?=(url or title)` | v2 via Server 1 |
| `GET /api/v2/server=2/q?=(url or title)` | v2 via Server 2 |
| `GET /api/v2/server=3/q?=(url or title)` | v2 via Server 3 — full quality list |
| `GET /api/v2/server=auto/q?=(url or title)` | v2 explicit auto |

### Server 3 (youtubei.js) specifics

When `server=3` is used the response includes:
- All standard fields (title, mp4, mp3)
- `media.qualities[]` — full list of every available format with `itag`, `mimeType`, `quality`, `url`, `hasVideo`, `hasAudio`, `width`, `height`, `fps`, `bitrate`
- `info.description` — full video description (v1 only)
- All format `url` values point to `/api/proxy/{videoId}/{itag}` on this server (direct YouTube URLs return "access denied" in browsers; the proxy adds the required session headers)

### Proxy (Server 3 streams)

`GET /api/proxy/:videoId/:itag` — streams a YouTube format through the server. Only valid after a `server=3` fetch for the same `videoId` (URLs expire after 4 hours). Supports `Range` header for seeking.

### Utility

| Endpoint | Description |
|---|---|
| `GET /api/stats` | Total API call count |
| `GET /api/uptime` | Server uptime |
| `GET /api/healthz` | Liveness probe |

## Download Servers

| # | Package | Notes |
|---|---|---|
| 1 | `btch-downloader` | Primary; returns title + thumbnail |
| 2 | `nayan-media-downloaders` | Fallback (ymcdn.org relay); no title returned |
| 3 | `youtubei.js` | Full YouTube client; returns quality list; URLs proxied |
| auto | All | Tries 1 → 2 → 3 in order; stops at first success |

## Rate Limits

| Scope | Limit |
|---|---|
| Global | 300 requests / 15 minutes |
| Download endpoints | 60 requests / minute |

## Caching

SWR strategy: **5 minutes fresh**, up to **20 minutes stale** (background refresh). Cache applies to auto-mode routes only; server-specific routes always fetch fresh.

## Environment Variables

| Variable | Required | Notes |
|---|---|---|
| `PORT` | Yes | Defaults to 5000 on Replit |
| `MONGODB_URI` | No | Persistent ApiCount; falls back to in-memory |
| `NODE_ENV` | Recommended | Set to `production` in production |

## Key Commands

- `pnpm install` — install all workspace dependencies
- `pnpm run typecheck` — full typecheck across all packages
- `PORT=5000 pnpm --filter @workspace/api-server run dev` — run API server in dev mode
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle

## Deployment

- **Dev (Replit):** `PORT=5000 pnpm --filter @workspace/api-server run dev`
- **Render:** Build: `pnpm install && pnpm --filter @workspace/api-server run build` | Start: `node --enable-source-maps artifacts/api-server/dist/index.mjs`
- **Health check:** `GET /api/healthz`
