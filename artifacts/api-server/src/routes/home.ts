import { Router, type IRouter } from "express";
import { VERSION } from "../lib/version";
import { isShutdown } from "../lib/admin-state";

const router: IRouter = Router();

const CHANGELOG: { version: string; date: string; tag: string; notes: string[] }[] = [
  {
    version: "1.3.1",
    date: "2026-07-14",
    tag: "current",
    notes: [
      "<strong>Server 3 — youtubei.js</strong>: new third download source using YouTube's native client; returns full-quality metadata alongside the standard best MP4 &amp; MP3 links",
      "Server 3 quality list — when <code>server=3</code> is used, <code>media.qualities[]</code> is included in the response with every available stream: <code>itag</code>, <code>mimeType</code>, <code>quality</code>, <code>url</code>, <code>hasVideo</code>, <code>hasAudio</code>, <code>width</code>, <code>height</code>, <code>fps</code>, <code>bitrate</code>",
      "Server-select routes — pin any request to a specific server: <code>/api/v1/server=1/q?=…</code>, <code>/api/v1/server=2/q?=…</code>, <code>/api/v1/server=3/q?=…</code> and the equivalent for v2 (<code>/api/v2/server=N/q?=…</code>). Both v1 and v2 share the same <code>server=</code> URL structure",
      "Auto fallback upgraded to 1→2→3 — when Server 1 (btch) and Server 2 (nayan) both return no usable links, Server 3 is tried automatically before giving up; omit <code>server=</code> or use <code>server=auto</code> for this behaviour",
      "Proxy endpoint — Server 3 format URLs are routed through <code>/api/proxy/{videoId}/{itag}</code> on this server (direct YouTube streaming URLs return &ldquo;Access Denied&rdquo; in browsers; the proxy adds the required session context). Supports the <code>Range</code> header for seeking and resuming downloads",
      "<code>media.server</code> now returns <code>1 | 2 | 3 | null</code> — indicating which download server delivered the result",
      "v1 extended with Server 3 metadata — when server 3 is used, <code>info.description</code> is also populated from YouTube's native client",
    ],
  },
  {
    version: "1.3.0",
    date: "2026-06-08",
    tag: "",
    notes: [
      "New secured <code>/admin</code> route — administrative console for monitoring and controlling the API server",
      "Real-time dashboard via SSE: live API stats (total calls, success, errors, uptime), Chart.js visualisations (success/error doughnut + calls-per-minute line chart), and package status for both download servers",
      "3-tab live console streams every v1/v2/v3 request, success, and error directly to the admin panel in real time",
      "Admin controls: <strong>Temporary Shutdown</strong> suspends all v1/v2/v3 endpoints and pauses ApiCount; <strong>Run</strong> restores service; <strong>Restart</strong> performs a clean server restart",
      "During Temporary Shutdown: all API endpoints return HTTP 503 with a maintenance notice; the public website shows a prominent shutdown banner",
      "ApiCount is frozen during shutdown — counts only resume once service is restored",
    ],
  },
  {
    version: "1.2.9",
    date: "2026-06-08",
    tag: "",
    notes: [
      "Bug fix (v3): requesting 20 results now returns 20 results — previous behaviour returned 19 due to insufficient raw results from the search provider; v3 now fetches two pages to guarantee a full set",
      "Bug fix (v2): removed unused fields <code>video_id</code>, <code>duration</code>, and <code>thumbnail</code> from the v2 response — these fields were never part of the intended v2 schema",
    ],
  },
  {
    version: "1.2.8",
    date: "2026-06-08",
    tag: "",
    notes: [
      "v3: configurable result limit — add <code>&amp;?=N</code> to control how many results are returned (1–20); omit for the default of 10",
      "v3: URL format: <code>/api/v3/q?=QUERY&amp;?=LIMIT</code> — e.g. <code>/api/v3/q?=taylor swift&amp;?=20</code>",
      "v3: web UI now has <strong>two input boxes</strong> — one for your search title, one for the rank limit (1–20, optional)",
      "v3: web UI copy URL strip is context-aware — shows the plain URL when no limit is set, or the URL with limit appended when a limit is entered (never both at once)",
      "v3: response now includes <code>limit</code> and <code>total_results</code> fields",
      "v3: cache now stores up to 20 results per query — any limit from 1–20 is served from the same cache entry without a refetch (more efficient)",
      "v3: invalid limit (not 1–20, or non-integer) returns 400 with a clear error message before touching ApiCount",
      "v2: web UI now shows a <strong>thumbnail preview</strong> with a clickable YouTube player — same play-on-click experience as v1",
      "Web: all endpoint descriptions, the About section, and FAQ updated to reflect the latest v2 and v3 capabilities",
    ],
  },
  {
    version: "1.2.7",
    date: "2026-06-08",
    tag: "big-update",
    notes: [
      "New primary downloader: <strong>btch-downloader</strong> is now <strong>Server 1</strong> — the main source for all MP4 &amp; MP3 download links",
      "<strong>nayan-media-downloaders</strong> is now <strong>Server 2</strong> — automatic fallback used only when Server 1 fails; functions exactly as before",
      "v1 &amp; v2 responses now include <code>media.server: 1 | 2</code> — indicates which server delivered the download links for that request",
      "Fallback is fully automatic and transparent: if btch fails, nayan kicks in and the response reflects <code>server: 2</code> with no extra latency for the retry",
      "Both servers have a 20-second timeout; null links are returned only if both servers fail",
      "<code>@distube/ytdl-core</code> removed from the active download chain — replaced entirely by btch-downloader as Server 1",
    ],
  },
  {
    version: "1.2.6",
    date: "2026-06-06",
    tag: "hotfix",
    notes: [
      "HOTFIX: v2 <code>title</code> was returning <code>null</code> on URL inputs — fixed by extracting title directly from <code>ytdl.getInfo().videoDetails.title</code>, which is already fetched for download links (zero extra network call)",
      "Root cause: the previous parallel <code>yts({ videoId })</code> call fetches YouTube's raw video page, which is frequently blocked on server IPs; <code>Promise.allSettled</code> silently swallowed the rejection leaving title as <code>null</code>",
      "<code>DownloadLinks</code> interface now includes <code>title: string | null</code> — captured from <code>info.videoDetails.title</code> in the ytdl (Source 1) path; nayan (Source 2) returns <code>null</code> for title",
      "v2 title fallback chain: (1) <code>links.title</code> from ytdl at zero extra cost, (2) <code>yts({ videoId })</code> only when ytdl fails (nayan path, rare) — title is always returned when possible",
      "v2 reverted to minimal response shape: <code>credit</code>, <code>version</code>, <code>title</code>, <code>media.mp4</code>, <code>media.mp3</code>, <code>ApiCount</code>, <code>cached</code>, <code>ms</code>",
      "FAQ expanded to 20 Q&amp;As covering caching, link expiry, fallback behaviour, rate limiting, field reference, playlists, mobile use, and more",
      "FAQ: show-more / auto-collapse — default 5 visible; click to expand all; auto-collapses after 5 minutes",
      "Added <code>README.md</code> with full project overview, API reference, and Render hosting guide",
      "Added <code>DISCLAIMER.md</code> with full copyright notice under Philippine IP Code (RA 8293), Berne Convention, WIPO Copyright Treaty, TRIPS, DMCA, and equivalent laws worldwide",
    ],
  },
  {
    version: "1.2.5",
    date: "2026-06-02",
    tag: "",
    notes: [
      "Performance: v2 URL requests now fetch metadata and download links in parallel — cuts response time roughly in half vs the previous sequential approach",
      "Performance: v1 keyword queries now reuse the search result metadata instead of making a redundant second <code>yts({ videoId })</code> lookup — eliminates an extra network round-trip",
      "v2 upgraded from a links-only response to a full metadata response — now returns <code>video_id</code>, <code>video_url</code>, <code>short_url</code>, <code>channel_name</code>, <code>channel_url</code>, <code>thumbnail</code>, <code>duration</code>, <code>views</code>, <code>published</code>, and <code>category</code> alongside download links",
      "v2: response now includes <code>cached</code> flag — indicates whether the result was served from the in-memory SWR cache",
      "v1: response now includes <code>short_url</code> (<code>https://youtu.be/…</code>) at the top level alongside the full canonical URL",
      "v3: each result now includes <code>short_url</code> (<code>https://youtu.be/…</code>) and a <code>keywords</code> array",
      "v3: response now includes <code>cached</code> flag",
    ],
  },
  {
    version: "1.2.4",
    date: "2026-06-02",
    tag: "",
    notes: [
      "UI/UX: complete visual redesign — refined color system, improved typography, spacing, and layout consistency across all pages",
      "UI/UX: hero section upgraded with ★★★★★ premium badge, larger title, and enhanced stats bar with bigger numbers and inner shimmer",
      "UI/UX: v2 result card now displays the video title above download links when available",
      "VFX: improved micro-interactions across buttons, cards, inputs, and modals — more refined easing and glow effects throughout",
      "VFX: accent shifted to premium <code>#E50914</code> — consistent across all elements including cursor, aurora, buttons, borders, and badges",
      "Performance: animations optimised — breathing glow cycle extended to 3 s, aurora orbs slightly reduced, reduced aurora intensity for lower GPU load",
      "Reliability: v2 downloader now recovers gracefully when both sources fail — returns <code>null</code> media links instead of a 500 error",
      "Bug fix: v2 no longer crashes with <em>Cannot read properties of undefined</em> when the nayan fallback source returns an unexpected response shape",
    ],
  },
  {
    version: "1.2.3",
    date: "2026-06-02",
    tag: "",
    notes: [
      "v2: response now includes <code>title</code> — the video title is returned alongside the MP4 &amp; MP3 download links",
      "v3: now rejects YouTube URLs with a 400 error — only titles and keywords are accepted; use v1 or v2 for URL-based lookups",
      "v3: URL rejection does not increment ApiCount or the error tally — only real search queries are tracked",
    ],
  },
  {
    version: "1.2.2",
    date: "2026-05-23",
    tag: "",
    notes: [
      "Security: global rate limiting (300 req / 15 min) and per-endpoint download rate limiting (60 req / min) via express-rate-limit — protects upstream APIs from abuse",
      "Security: HTTP security headers hardened with Helmet — HSTS, X-Content-Type-Options, Referrer-Policy, X-Frame-Options enforced on all responses",
      "Security: query input validation added — 500-character max length and control-character stripping before any upstream call",
      "Security: error responses sanitised — internal file paths, dependency names and timeout labels are never sent to clients",
      "Security: BoundedMap (LRU, max 1 000) replaces unbounded Maps — eliminates heap-exhaustion from unique-query flooding",
      "Security: TtlCache capped at 500 entries — prevents memory growth under sustained unique-URL traffic",
      "Reliability: downloader replaced with a two-source fallback chain — @distube/ytdl-core (direct YouTube CDN, no third-party relay) is tried first; nayan-media-downloaders is used automatically if the primary fails — API stays up even when either source goes down",
    ],
  },
  {
    version: "1.2.1",
    date: "2026-05-16",
    tag: "",
    notes: [
      "Removed Skip button from intro — sequence plays through cleanly without the option to skip",
      "Removed YouTube video preview from V1 result card — thumbnail still shows, iframe player removed for performance",
      "Performance: noise grain texture is now static — eliminates constant full-viewport repaint that caused lag on low-end devices",
      "Performance: hero particle count reduced from 60 to 35; canvas capped at 30 fps; line connections disabled on narrow screens",
      "Performance: card 3D tilt handler throttled with requestAnimationFrame — eliminates layout thrash on every mousemove",
    ],
  },
  {
    version: "1.2.0",
    date: "2026-05-16",
    tag: "",
    notes: [
      "VFX: layered noise grain texture breathes over the aurora at all times — background feels alive even when idle",
      "VFX: intro letters materialise one by one left-to-right; a 0→100% counter fills in sync; screen splits on exit — top half rises, bottom half drops — revealing the site like a curtain",
      "VFX: navbar starts fully transparent and gains frosted-glass backdrop + border as the user scrolls; nav links get a center-outward underline on hover; primary CTA pulses with a soft breathing glow on idle",
      "VFX: scroll-reveal cards scale up from 96% and stagger in one after another; aurora hue shifts subtly as the user scrolls for a sense of journey",
      "VFX: endpoint cards tilt in 3D toward the cursor on hover; buttons glow, rise, and press down with spring physics",
      "VFX: hero-to-content transition uses a gradient fade — no hard section edge",
      "VFX: full prefers-reduced-motion support — all CSS transitions and JS animations disabled cleanly for users who opt out",
    ],
  },
  {
    version: "1.1.4",
    date: "2026-05-06",
    tag: "",
    notes: [
      "Performance: stale-while-revalidate (SWR) caching — repeat requests are served instantly from cache while a background refresh runs silently; only the very first request for any video is slow",
      "Performance: fresh cache TTL extended from 90 s to 5 min; stale window up to 20 min — dramatically reduces upstream API calls under real traffic",
      "Performance: fetch logic factored into reusable functions (v1/v2/v3) enabling clean SWR background refresh without code duplication",
    ],
  },
  {
    version: "1.1.3",
    date: "2026-05-06",
    tag: "",
    notes: [
      "Concurrency: in-flight request deduplication — duplicate queries share one upstream call instead of each hitting the external API independently",
      "Reliability: hard 20 s timeout on all download calls and 15 s on search — eliminates indefinite hangs that caused 502 errors under load",
      "MongoDB: stats result cached in-memory for 4 s — reduces database round-trips by ~97% (stats bar now responds in <1 ms instead of 140+ ms)",
      "MongoDB: automatic reconnect retry after 60 s if initial connection fails — no longer stays permanently disconnected after a transient error",
      "MongoDB: connection pool tuned (min 1, max 5, idle timeout 30 s) for efficient multi-user throughput",
      "API errors now return structured JSON with timeout message instead of a silent 502",
    ],
  },
  {
    version: "1.1.2",
    date: "2026-05-06",
    tag: "",
    notes: [
      "V1 result card: video preview now full-width 16:9 — no longer a narrow side column",
      "V1 Preview plays YouTube via the IFrame Player API — reliable autoplay, no CORS issues",
      "Terms & Conditions popup on first visit — Decline redirects to google.com",
      "Open Graph & Twitter Card meta tags — rich link previews on Messenger, WhatsApp, Discord etc.",
      "Favicon added — tab icon now shows the TubeFetch play button logo",
      "Build: mockup-sandbox excluded from production typecheck and build",
    ],
  },
  {
    version: "1.1.1",
    date: "2026-05-06",
    tag: "",
    notes: [
      "V1 Preview plays YouTube via the IFrame Player API — reliable autoplay, no CORS issues",
      "MongoDB: detailed error logging (name, message, code, stack) on connection failure",
      "MongoDB: logs URI host (credentials redacted) so misconfigured URIs are easy to spot",
      "MongoDB: increased connection timeouts to 8 s and socket timeout to 10 s",
      "render.yaml: MONGODB_URI now declared as a required env var (set it in Render dashboard)",
      "Build: mockup-sandbox excluded from production typecheck and build",
    ],
  },
  {
    version: "1.0.8",
    date: "2026-05-05",
    tag: "",
    notes: [
      "Global ApiCount — every response now includes the total request counter",
      "Live stats bar in hero: total calls, version, cache TTL",
      "New /api/v3/q — returns top 10 search results with full metadata",
      "New /api/stats — monitor total API calls in real time",
      "V1 response now includes category (Music, Gaming, Education, etc.)",
      "FAQ section with 10 professional Q&As",
      "Disabled browser zoom for consistent mobile UX",
    ],
  },
  {
    version: "1.0.7",
    date: "2026-05-04",
    tag: "",
    notes: [
      "Full UI redesign — glassmorphism 2.0, particle VFX hero, 2026 web aesthetics",
      "Cinematic intro with scanlines, split-word reveal and glitch text effect",
      "Scroll-triggered reveal animations on all sections",
      "V1: thumbnail shows for 5s with SVG countdown ring, then fades to inline YouTube embed",
      "YouTube preview: seek/play/pause/fullscreen available — download only via page buttons",
    ],
  },
  {
    version: "1.0.6",
    date: "2026-05-04",
    tag: "",
    notes: [
      "Fixed 'Read more' overflow — long text scrolls in bounded area, 'Read less' always reachable",
      "API v2 revamp: credit, version, ms and flat media.mp4/mp3 URLs — no title or video_id",
      "Guaranteed thumbnail fallback chain in v1",
    ],
  },
  {
    version: "1.0.5",
    date: "2026-05-04",
    tag: "",
    notes: [
      "New /api/v2/q — fast endpoint: title + download links only",
      "Fixed 'Show less' scroll snap",
    ],
  },
  {
    version: "1.0.4",
    date: "2026-05-04",
    tag: "",
    notes: [
      "Rebranded to TubeFetch (TF)",
      "YouTube Dark Mode theme",
      "Copy endpoint URL button",
      "Smooth accordion & bell animations",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-05-01",
    tag: "initial",
    notes: [
      "YouTube URL and title/keyword search",
      "MP4 HD + MP3 direct download links",
      "90-second in-memory cache, Replit/Render/Vercel ready",
    ],
  },
];

const FAQS: { q: string; a: string }[] = [
  {
    q: "What is TubeFetch?",
    a: "TubeFetch is a free, open REST API that lets developers search YouTube and retrieve direct download links for <code>MP4</code> (HD video) and <code>MP3</code> (audio). Pass any YouTube URL or a plain search query and get back structured JSON with metadata and media URLs — <strong>no API key required</strong>.",
  },
  {
    q: "Do I need an API key or account?",
    a: "No. TubeFetch is completely free with <strong>zero authentication</strong> required. Simply call the endpoints from any HTTP client — a browser, curl, Postman, or your own app — and get results instantly.",
  },
  {
    q: "What is the difference between v1, v2, and v3?",
    a: "<strong>v1</strong> returns the richest response — full metadata (title, author, thumbnail, duration, views, likes, description, keywords, category, short_url) plus MP4 HD &amp; MP3 download links. <strong>v2</strong> is the fastest and lightest — returns the video <code>title</code>, <code>thumbnail</code>, <code>video_id</code>, and direct MP4 &amp; MP3 download links with minimal overhead; ideal for bots and scripts that only need the links. <strong>v3</strong> is search-only — pass a keyword or title and get 1–20 ranked YouTube results (default 10; add <code>&amp;?=N</code> to set the limit); YouTube URLs are rejected by v3.",
  },
  {
    q: "How long are responses cached?",
    a: "All successful responses are cached <strong>in-memory for 5 minutes</strong> (fresh), then served stale for up to <strong>20 minutes</strong> while a background refresh runs (stale-while-revalidate). When a cached result is returned the response will include <code>\"cached\": true</code>. The <code>ApiCount</code> counter increments on every request regardless of cache status.",
  },
  {
    q: "Can I search by title instead of a URL?",
    a: "Yes — v1 and v2 accept both a full YouTube URL (e.g. <code>https://youtu.be/dQw4w9WgXcQ</code>) and a plain-text search query (e.g. <code>never gonna give you up</code>); the top result is used. v3 <strong>only accepts titles or keywords</strong> — passing a URL to v3 returns a 400 error. Use v1 or v2 for URL-based lookups.",
  },
  {
    q: "What formats are available?",
    a: "TubeFetch provides a direct <strong>MP4</strong> link (HD quality where available) and a direct <strong>MP3</strong> link (audio only). Links are sourced in real-time and may expire after a period of time, so they should be consumed promptly after fetching.",
  },
  {
    q: "What is ApiCount?",
    a: "<code>ApiCount</code> is a global request counter that increments by 1 on every download or search call to TubeFetch (<code>/api/v1/q</code>, <code>/api/v2/q</code>, <code>/api/v3/q</code>). Health checks (<code>/api/healthz</code>) and uptime pings (<code>/api/uptime</code>) do <strong>not</strong> increment it. View the live count at <code>/api/stats</code> or in the stats bar above.",
  },
  {
    q: "What categories does TubeFetch detect?",
    a: "TubeFetch automatically classifies content into: <strong>Music, Gaming, Education, News &amp; Politics, Comedy, Sports, Film &amp; Entertainment, Science &amp; Technology, Travel &amp; Vlogs, Food &amp; Cooking, Health &amp; Fitness, Beauty &amp; Fashion,</strong> and <strong>Entertainment</strong> (default). Classification is based on title, description, and keywords.",
  },
  {
    q: "Is there a rate limit?",
    a: "Yes. A <strong>global rate limit of 300 requests per 15 minutes</strong> applies across all endpoints. Download endpoints (<code>/api/v1/q</code>, <code>/api/v2/q</code>, <code>/api/v3/q</code>) have an additional stricter limit of <strong>60 requests per minute</strong> to protect upstream services. Exceeding either limit returns a <code>429 Too Many Requests</code> response.",
  },
  {
    q: "Is TubeFetch free for commercial use?",
    a: "TubeFetch is free for personal and educational use. Commercial use is at your own discretion — please ensure compliance with <strong>YouTube's Terms of Service</strong> and applicable copyright laws. The developer (MJL) accepts no liability for any misuse. All content belongs to its respective owners.",
  },
  {
    q: "What does `cached: true` mean in the response?",
    a: "When <code>\"cached\": true</code> appears in a response, it means the result was served directly from TubeFetch's in-memory cache — no upstream network call was made. Cached responses are near-instant. The cache stays fresh for <strong>5 minutes</strong>; after that, a stale copy is returned immediately while a background refresh updates the cache (stale-while-revalidate). <code>ApiCount</code> still increments on every request, cached or not.",
  },
  {
    q: "Why do download links expire?",
    a: "The MP4 and MP3 URLs returned by TubeFetch are direct CDN links generated by YouTube's own servers. These links are <strong>time-limited</strong> (typically expiring within a few hours to a day). TubeFetch does not control link expiry — it fetches the link fresh when you make a request. To avoid stale links, consume the URL promptly after receiving it and avoid caching it on your end for more than an hour.",
  },
  {
    q: "What happens if both download sources fail?",
    a: "TubeFetch uses a three-server fallback chain. <strong>Server 1</strong> is <code>btch-downloader</code> (primary; returns title + thumbnail). <strong>Server 2</strong> is <code>nayan-media-downloaders</code> (routes through ymcdn.org; fallback when Server 1 fails). <strong>Server 3</strong> is <code>youtubei.js</code> (YouTube's native client; tried last in auto mode; also returns a full quality list). If all three fail, the API returns <code>\"mp4\": null, \"mp3\": null</code> rather than a 500 error — your app never crashes, it simply handles null links. You can also target a specific server directly using <code>/api/v1/server=3/q?=…</code> (or v2).",
  },
  {
    q: "Can I download age-restricted or private videos?",
    a: "No. TubeFetch cannot access <strong>age-restricted</strong>, <strong>private</strong>, or <strong>members-only</strong> videos. These require authenticated sessions that TubeFetch does not support. Attempting to fetch such videos will result in an error or null media links.",
  },
  {
    q: "What is the `ms` field in the response?",
    a: "The <code>ms</code> field is the <strong>server-side response time in milliseconds</strong> — measured from when TubeFetch received your request to when the response was sent. It reflects actual processing time including any upstream fetches. Cached responses show a very low <code>ms</code> value (typically under 5 ms). Use it to benchmark latency.",
  },
  {
    q: "What is `short_url` in the response?",
    a: "<code>short_url</code> is the compact YouTube share link format: <code>https://youtu.be/&lt;videoId&gt;</code>. It is functionally identical to the full <code>https://www.youtube.com/watch?v=&lt;videoId&gt;</code> URL. It is included in v1 responses (top-level) and in each v3 search result item for convenience.",
  },
  {
    q: "How do I handle 429 Too Many Requests errors?",
    a: "A <code>429</code> response means you have exceeded a rate limit. Implement <strong>exponential backoff</strong> — wait before retrying, doubling the delay on each subsequent failure (e.g. 1 s → 2 s → 4 s → 8 s). The global limit resets every 15 minutes; the download limit resets every minute. If you need higher throughput for a legitimate use case, consider self-hosting a private instance.",
  },
  {
    q: "Does TubeFetch support playlists?",
    a: "No. TubeFetch works on <strong>individual videos</strong> only. Playlist URLs are not supported — passing a playlist URL will either fail or return results for the first video in the playlist depending on how the URL is parsed. Use v3 with a search keyword to discover multiple videos.",
  },
  {
    q: "Can I use TubeFetch from a mobile app or browser extension?",
    a: "Yes. TubeFetch is a standard REST API accessible from any HTTP client. You can call it from <strong>Android</strong> (Retrofit, OkHttp), <strong>iOS</strong> (URLSession, Alamofire), <strong>React Native</strong>, <strong>Flutter</strong>, browser extensions, or any server-side backend. Note: calling TubeFetch directly from a browser page may trigger CORS restrictions — consider proxying through your own backend.",
  },
  {
    q: "Who built TubeFetch and is it open source?",
    a: "TubeFetch was built by <strong>MJL</strong>. The source code is available on the project repository for educational and personal use. See the <strong>Copyright Disclaimer</strong> section for full legal terms. Commercial use, redistribution, or removal of attribution is prohibited without written permission. All rights reserved &copy; 2024–2026 MJL.",
  },
];

function buildHtml(version: string, baseUrl: string): string {
  const clItems = CHANGELOG.map((e) => {
    const tagHtml =
      e.tag === "current"
        ? `<span class="cl-tag current">Latest</span>`
        : e.tag === "current-hotfix"
        ? `<span class="cl-tag current">Latest</span><span class="cl-tag hotfix">Hotfix</span>`
        : e.tag === "big-update"
        ? `<span class="cl-tag big-update">Big Update</span>`
        : e.tag === "hotfix"
        ? `<span class="cl-tag hotfix">Hotfix</span>`
        : e.tag === "initial"
        ? `<span class="cl-tag init">Initial</span>`
        : "";
    const notes = e.notes.map((n) => `<li>${n}</li>`).join("");
    return `<div class="cl-item">
      <div class="cl-row"><div class="cl-left"><span class="cl-ver">v${e.version}</span>${tagHtml}</div><span class="cl-date">${e.date}</span></div>
      <ul class="cl-notes">${notes}</ul>
    </div>`;
  }).join("");

  const faqItems = FAQS.map((f, i) => `
    <div class="faq-item${i >= 5 ? " faq-hidden" : ""}" id="faq${i}">
      <div class="faq-q" onclick="toggleFaq(${i})">
        <span>${f.q}</span>
        <span class="faq-icon">+</span>
      </div>
      <div class="faq-a">
        <div class="faq-a-inner">${f.a}</div>
      </div>
    </div>`).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no"/>
  <meta name="robots" content="noindex,nofollow,noarchive,nosnippet,noimageindex"/>
  <meta name="googlebot" content="noindex,nofollow"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <title>TubeFetch — MJL</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg"/>
  <link rel="shortcut icon" href="/favicon.svg"/>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet"/>
  <meta property="og:type" content="website"/>
  <meta property="og:site_name" content="TubeFetch"/>
  <meta property="og:title" content="TubeFetch — YouTube Download API"/>
  <meta property="og:description" content="Free REST API — pass any YouTube URL or title and get direct MP4 &amp; MP3 download links. No API key required."/>
  <meta property="og:image" content="${baseUrl}/og-image.svg"/>
  <meta property="og:image:width" content="1200"/>
  <meta property="og:image:height" content="630"/>
  <meta property="og:url" content="${baseUrl}/"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="TubeFetch — YouTube Download API"/>
  <meta name="twitter:description" content="Free REST API — pass any YouTube URL or title and get direct MP4 &amp; MP3 download links. No API key required."/>
  <meta name="twitter:image" content="${baseUrl}/og-image.svg"/>
  <style>
    :root {
      --red: #E50914;
      --red-dark: #B20710;
      --red-dim: rgba(229,9,20,.1);
      --red-glow: rgba(229,9,20,.28);
      --bg: #050505;
      --bg2: #090909;
      --bg3: #0E0E0E;
      --surface: rgba(255,255,255,.032);
      --surface2: rgba(255,255,255,.058);
      --border: rgba(255,255,255,.068);
      --border2: rgba(255,255,255,.13);
      --text: #F5F5F5;
      --text2: #9A9A9A;
      --text3: #4E4E4E;
      --text4: #272727;
      --green: #22c55e;
      --blue: #3b82f6;
      --amber: #f59e0b;
      --purple: #8b5cf6;
      --font: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      --mono: 'JetBrains Mono', 'Menlo', 'Consolas', monospace;
      --ease-spring: cubic-bezier(.34,1.56,.64,1);
      --ease-out: cubic-bezier(.25,.46,.45,.94);
      --ease-in-out: cubic-bezier(.4,0,.2,1);
      --radius: 18px;
      --radius-sm: 12px;
      --radius-xs: 7px;
    }

    *,*::before,*::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }
    body {
      font-family: var(--font);
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      overflow-x: hidden;
      user-select: none;
      -webkit-user-select: none;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    pre,code,input,textarea,.jbox { user-select: text; -webkit-user-select: text; }

    /* ══════════════════════════════════════
       CURSOR
    ══════════════════════════════════════ */
    #tf-cursor {
      position: fixed; pointer-events: none; z-index: 99999;
      width: 18px; height: 18px;
      border-radius: 50%;
      background: rgba(229,9,20,.12);
      border: 1.5px solid rgba(229,9,20,.45);
      transform: translate(-50%,-50%);
      transition: width .18s var(--ease-out), height .18s var(--ease-out), background .18s, border-color .18s, opacity .3s;
      mix-blend-mode: screen;
      will-change: transform;
    }
    #tf-cursor.hovering {
      width: 38px; height: 38px;
      background: rgba(229,9,20,.06);
      border-color: rgba(229,9,20,.65);
    }
    @media (hover: none) { #tf-cursor { display: none; } }

    /* ══════════════════════════════════════
       AURORA BACKGROUND
    ══════════════════════════════════════ */
    #aurora {
      position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden;
    }
    .aurora-orb {
      position: absolute; border-radius: 50%;
      filter: blur(80px); will-change: transform;
      animation: aurora-drift 20s ease-in-out infinite alternate;
    }
    .ao1 { width: 640px; height: 640px; background: radial-gradient(circle, rgba(160,0,0,.16) 0%, transparent 70%); top: -200px; left: -100px; animation-duration: 18s; }
    .ao2 { width: 520px; height: 520px; background: radial-gradient(circle, rgba(100,0,0,.10) 0%, transparent 70%); top: 20%; right: -150px; animation-duration: 24s; animation-delay: -8s; }
    .ao3 { width: 420px; height: 420px; background: radial-gradient(circle, rgba(60,0,0,.08) 0%, transparent 70%); bottom: 10%; left: 20%; animation-duration: 30s; animation-delay: -15s; }
    @keyframes aurora-drift {
      0%   { transform: translate(0, 0) scale(1); }
      33%  { transform: translate(60px, -40px) scale(1.1); }
      66%  { transform: translate(-30px, 50px) scale(.95); }
      100% { transform: translate(40px, 20px) scale(1.05); }
    }

    /* ══════════════════════════════════════
       NOISE GRAIN
    ══════════════════════════════════════ */
    #grain {
      position: fixed; inset: 0; z-index: 1; pointer-events: none;
      opacity: .04; mix-blend-mode: overlay;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
      background-repeat: repeat; background-size: 200px 200px;
    }

    /* ══════════════════════════════════════
       GRID OVERLAY
    ══════════════════════════════════════ */
    #grid-overlay {
      position: fixed; inset: 0; z-index: 0; pointer-events: none;
      background-image:
        linear-gradient(rgba(255,255,255,.018) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,.018) 1px, transparent 1px);
      background-size: 44px 44px;
      mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%);
      -webkit-mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%);
    }

    /* ══════════════════════════════════════
       SCROLL REVEAL
    ══════════════════════════════════════ */
    .reveal { opacity: 0; transform: translateY(28px) scale(.97); transition: opacity .65s var(--ease-out), transform .65s var(--ease-out); }
    .reveal.in-view { opacity: 1; transform: none; }
    .reveal-d1 { transition-delay: .1s; }
    .reveal-d2 { transition-delay: .2s; }
    .reveal-d3 { transition-delay: .3s; }
    .reveal-d4 { transition-delay: .4s; }

    /* ══════════════════════════════════════
       INTRO
    ══════════════════════════════════════ */
    #intro {
      position: fixed; inset: 0; z-index: 9999;
      background: transparent;
      display: flex; align-items: center; justify-content: center;
      overflow: hidden;
    }
    #intro-grid {
      position: absolute; inset: 0;
      background-image:
        linear-gradient(rgba(255,255,255,.04) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,.04) 1px, transparent 1px);
      background-size: 40px 40px;
      animation: intro-grid-fade 1.2s ease both;
    }
    @keyframes intro-grid-fade { from { opacity: 0; } to { opacity: 1; } }
    #intro-aurora {
      position: absolute; inset: 0; pointer-events: none;
    }
    .ia1 {
      position: absolute; width: 700px; height: 700px; border-radius: 50%;
      background: radial-gradient(circle, rgba(200,0,0,.22) 0%, transparent 65%);
      top: 50%; left: 50%; transform: translate(-50%,-50%);
      filter: blur(60px); animation: ia-pulse 3s ease-in-out infinite;
    }
    .ia2 {
      position: absolute; width: 400px; height: 400px; border-radius: 50%;
      background: radial-gradient(circle, rgba(255,40,40,.1) 0%, transparent 65%);
      top: 30%; left: 60%; transform: translate(-50%,-50%);
      filter: blur(80px); animation: ia-pulse 4s ease-in-out infinite reverse;
    }
    @keyframes ia-pulse {
      0%,100% { transform: translate(-50%,-50%) scale(1); opacity: .6; }
      50% { transform: translate(-50%,-50%) scale(1.15); opacity: 1; }
    }
    #intro-scanline {
      position: absolute; left: 0; right: 0; height: 2px; top: -4px;
      background: linear-gradient(90deg, transparent, rgba(255,60,60,.8) 30%, rgba(255,255,255,.4) 50%, rgba(255,60,60,.8) 70%, transparent);
      animation: intro-scan 2.8s ease-in-out forwards;
      z-index: 3; box-shadow: 0 0 20px rgba(255,0,0,.5);
    }
    @keyframes intro-scan { 0% { top: -4px; opacity: 1; } 100% { top: 100%; opacity: 0; } }
    .i-wrap { text-align: center; position: relative; z-index: 4; }
    .i-icon {
      width: 96px; height: 96px; border-radius: 26px; margin: 0 auto 28px;
      background: linear-gradient(135deg, #6B0000, #E50914, #C00010);
      display: flex; align-items: center; justify-content: center;
      animation: intro-icon-in .7s var(--ease-spring) both .4s;
      position: relative; overflow: hidden;
    }
    .i-icon::before {
      content: ''; position: absolute; inset: 0;
      background: linear-gradient(135deg, rgba(255,255,255,.22) 0%, transparent 55%);
    }
    .i-icon::after {
      content: ''; position: absolute; inset: -2px;
      border-radius: 28px;
      background: transparent;
      border: 2px solid transparent;
      background-clip: padding-box;
      box-shadow: 0 0 0 2px rgba(229,9,20,.35), 0 0 55px rgba(229,9,20,.55), 0 0 110px rgba(229,9,20,.18);
    }
    .i-icon svg { width: 42px; height: 42px; fill: #fff; position: relative; z-index: 1; drop-shadow: 0 0 10px rgba(255,255,255,.5); }
    @keyframes intro-icon-in {
      from { opacity: 0; transform: scale(.3) rotate(-20deg); filter: blur(10px); }
      to   { opacity: 1; transform: scale(1) rotate(0); filter: blur(0); }
    }
    .i-title {
      font-size: clamp(2.8rem, 9vw, 3.8rem); font-weight: 900;
      letter-spacing: -3px; display: flex; align-items: center; justify-content: center;
      line-height: 1;
    }
    .i-word { overflow: hidden; display: inline-block; }
    .i-word span { display: inline-block; animation: word-rise .6s var(--ease-spring) both; }
    .i-word:nth-child(1) span { animation-delay: .8s; }
    .i-word:nth-child(2) span { animation-delay: .95s; color: transparent; background: linear-gradient(135deg, #FF4040, #E50914, #A00000); -webkit-background-clip: text; background-clip: text; }
    @keyframes word-rise { from { transform: translateY(110%); opacity: 0; } to { transform: none; opacity: 1; } }
    .i-sub {
      font-size: .7rem; font-weight: 700; color: var(--text3);
      letter-spacing: 3.5px; text-transform: uppercase;
      margin-top: 14px;
      animation: fade-up-soft .5s ease both 1.4s;
    }
    .i-badges {
      display: flex; gap: 8px; justify-content: center; margin-top: 20px;
      animation: fade-up-soft .5s ease both 1.55s;
    }
    .i-badge {
      font-size: .6rem; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase;
      padding: 3px 10px; border-radius: 20px;
      background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08);
      color: var(--text3);
    }
    .i-bar-track {
      width: 200px; height: 1.5px; background: rgba(255,255,255,.06);
      border-radius: 2px; margin: 28px auto 0; overflow: hidden;
    }
    .i-bar {
      height: 100%; width: 0;
      background: linear-gradient(90deg, #5A0000, #E50914, #FF3030);
      border-radius: 2px; box-shadow: 0 0 10px #E50914, 0 0 20px rgba(229,9,20,.4);
      transition: width 3.8s cubic-bezier(.12,.8,.4,1);
    }
    .i-ver {
      color: var(--text4); font-size: .6rem; font-family: var(--mono);
      margin-top: 12px; animation: fade-up-soft .5s ease both 1.65s;
      letter-spacing: 1px;
    }
    @keyframes fade-up-soft { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
    #intro.out { animation: intro-exit .65s var(--ease-in-out) forwards; }
    @keyframes intro-exit {
      0%   { opacity: 1; filter: blur(0) brightness(1); transform: scale(1); }
      50%  { opacity: 1; filter: blur(0) brightness(2.5); transform: scale(1.03); }
      100% { opacity: 0; filter: blur(16px) brightness(0); transform: scale(1.06); }
    }

    /* ── INTRO SPLIT CURTAIN ── */
    #intro-split-top, #intro-split-bottom {
      position: absolute; left: 0; right: 0; z-index: 0;
      background: #050505;
      transition: transform .72s cubic-bezier(.76,0,.24,1);
    }
    #intro-split-top { top: 0; height: 50%; transform: translateY(0); }
    #intro-split-bottom { bottom: 0; height: 50%; transform: translateY(0); }
    #intro.splitting #intro-split-top { transform: translateY(-100%); }
    #intro.splitting #intro-split-bottom { transform: translateY(100%); }

    /* ── INTRO LETTERS ── */
    .i-l {
      display: inline-block;
      animation: letter-rise .44s var(--ease-spring) both;
      animation-delay: calc(.75s + var(--di) * .065s);
    }
    .i-l-red {
      color: transparent;
      background: linear-gradient(135deg, #FF6666, #FF0000, #CC0000);
      -webkit-background-clip: text; background-clip: text;
    }
    @keyframes letter-rise {
      from { transform: translateY(105%) scaleY(1.15); opacity: 0; }
      to   { transform: none; opacity: 1; }
    }

    /* ── INTRO COUNTER ── */
    .i-counter {
      font-size: .64rem; font-weight: 900; color: rgba(255,80,80,.55);
      font-family: var(--mono); letter-spacing: 2px;
      margin-top: 6px; animation: fade-up-soft .4s ease both 1.4s;
    }

    /* ══════════════════════════════════════
       TERMS OVERLAY
    ══════════════════════════════════════ */
    #terms-overlay {
      position: fixed; inset: 0; z-index: 10000;
      background: rgba(0,0,0,.9); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
      display: none; align-items: center; justify-content: center; padding: 16px;
    }
    #terms-overlay.show { display: flex; animation: fade-in-ov .4s ease both; }
    #terms-overlay.out  { display: flex; animation: fade-out-ov .3s ease forwards; }
    @keyframes fade-in-ov  { from { opacity: 0; } to { opacity: 1; } }
    @keyframes fade-out-ov { from { opacity: 1; } to { opacity: 0; } }
    .terms-modal {
      background: rgba(12,12,12,.98); border: 1px solid rgba(255,255,255,.1);
      border-radius: 24px; max-width: 460px; width: 100%;
      box-shadow: 0 60px 120px rgba(0,0,0,.9), 0 0 0 1px rgba(255,0,0,.06), 0 0 60px rgba(255,0,0,.04);
      overflow: hidden; animation: modal-up .45s var(--ease-spring) both .1s;
    }
    @keyframes modal-up { from { opacity: 0; transform: translateY(28px) scale(.94); } to { opacity: 1; transform: none; } }
    .terms-head { padding: 28px 26px 0; display: flex; flex-direction: column; align-items: center; gap: 12px; text-align: center; }
    .terms-icon {
      width: 56px; height: 56px; border-radius: 16px;
      background: linear-gradient(135deg, #8B0000, #E50914);
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 0 28px rgba(229,9,20,.32), 0 0 56px rgba(229,9,20,.1);
    }
    .terms-icon svg { width: 24px; height: 24px; fill: none; stroke: #fff; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
    .terms-title { font-size: 1.08rem; font-weight: 800; color: var(--text); letter-spacing: -.3px; }
    .terms-sub { font-size: .62rem; color: var(--text4); font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; }
    .terms-body { padding: 18px 26px; max-height: 240px; overflow-y: auto; scrollbar-width: thin; scrollbar-color: #2a2a2a transparent; }
    .terms-body::-webkit-scrollbar { width: 3px; }
    .terms-body::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 2px; }
    .terms-section { margin-bottom: 16px; }
    .terms-section:last-child { margin-bottom: 0; }
    .terms-section-title { font-size: .6rem; font-weight: 800; color: #FF4444; text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 6px; }
    .terms-text { font-size: .74rem; color: #666; line-height: 1.75; }
    .terms-text strong { color: #999; font-weight: 700; }
    .terms-footer { padding: 14px 26px 24px; border-top: 1px solid rgba(255,255,255,.06); }
    .terms-notice { font-size: .62rem; color: #2a2a2a; text-align: center; line-height: 1.6; margin-bottom: 14px; }
    .terms-btns { display: flex; gap: 8px; }
    .terms-accept {
      flex: 1; background: linear-gradient(135deg, #8B0000, #E50914); color: #fff; border: none;
      padding: 13px; border-radius: 12px; font-size: .84rem; font-weight: 700; cursor: pointer;
      transition: all .2s; box-shadow: 0 4px 20px rgba(229,9,20,.28); font-family: var(--font);
      position: relative; overflow: hidden;
    }
    .terms-accept::before {
      content: ''; position: absolute; inset: 0;
      background: linear-gradient(135deg, rgba(255,255,255,.15) 0%, transparent 55%);
    }
    .terms-accept:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(229,9,20,.42); }
    .terms-decline {
      flex: 0 0 auto; background: rgba(255,255,255,.04); color: #444; border: 1px solid rgba(255,255,255,.08);
      padding: 13px 18px; border-radius: 12px; font-size: .84rem; font-weight: 600; cursor: pointer;
      transition: all .2s; font-family: var(--font);
    }
    .terms-decline:hover { background: rgba(255,255,255,.08); color: #666; border-color: rgba(255,255,255,.14); }

    /* ── DECLINE OVERLAY ── */
    #decline-overlay {
      position: fixed; inset: 0; z-index: 10001;
      background: rgba(0,0,0,.97); backdrop-filter: blur(20px);
      display: none; align-items: center; justify-content: center; padding: 16px;
    }
    #decline-overlay.show { display: flex; animation: fade-in-ov .3s ease both; }
    .decline-modal {
      background: rgba(10,10,10,.99); border: 1px solid rgba(255,255,255,.07);
      border-radius: 24px; max-width: 340px; width: 100%; padding: 40px 30px;
      text-align: center; box-shadow: 0 60px 100px rgba(0,0,0,.95);
      animation: modal-up .35s var(--ease-spring) both;
    }
    .decline-icon {
      width: 48px; height: 48px; border-radius: 50%;
      background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08);
      display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;
    }
    .decline-icon svg { width: 20px; height: 20px; stroke: #444; fill: none; stroke-width: 2; stroke-linecap: round; }
    .decline-title { font-size: .95rem; font-weight: 800; color: var(--text); margin-bottom: 10px; }
    .decline-msg { font-size: .76rem; color: #444; line-height: 1.7; margin-bottom: 24px; }
    .decline-bar-track { width: 100%; height: 1.5px; background: #1a1a1a; border-radius: 2px; overflow: hidden; }
    .decline-bar { height: 100%; width: 0; background: linear-gradient(90deg, #2a2a2a, #555); border-radius: 2px; transition: width 3s linear; }
    .decline-redirect { font-size: .62rem; color: #2a2a2a; margin-top: 10px; font-family: var(--mono); letter-spacing: .5px; }

    /* ══════════════════════════════════════
       TOPBAR
    ══════════════════════════════════════ */
    .topbar {
      position: sticky; top: 0; z-index: 100; height: 60px;
      background: transparent; backdrop-filter: none; -webkit-backdrop-filter: none;
      border-bottom: 1px solid transparent;
      display: flex; align-items: center; justify-content: space-between; padding: 0 24px;
      transition: background .45s var(--ease-in-out), border-color .45s var(--ease-in-out), backdrop-filter .45s var(--ease-in-out);
    }
    .topbar.scrolled {
      background: rgba(5,5,5,.92); backdrop-filter: blur(28px); -webkit-backdrop-filter: blur(28px);
      border-bottom-color: rgba(255,255,255,.065);
    }
    .topbar::after {
      content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 1px;
      background: linear-gradient(90deg, transparent 0%, rgba(229,9,20,.22) 30%, rgba(229,9,20,.12) 50%, rgba(229,9,20,.22) 70%, transparent 100%);
      opacity: 0; transition: opacity .45s var(--ease-in-out);
    }
    .topbar.scrolled::after { opacity: 1; }
    .topbar-logo {
      display: flex; align-items: center; gap: 10px; text-decoration: none;
      transition: opacity .2s; cursor: pointer;
    }
    .topbar-logo:hover { opacity: .8; }
    .topbar-icon {
      width: 32px; height: 32px; border-radius: 9px;
      background: linear-gradient(135deg, #8B0000, #E50914);
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 0 12px rgba(229,9,20,.3), 0 2px 8px rgba(0,0,0,.5);
      position: relative; overflow: hidden; flex-shrink: 0;
    }
    .topbar-icon::before { content: ''; position: absolute; inset: 0; background: linear-gradient(135deg, rgba(255,255,255,.2) 0%, transparent 60%); }
    .topbar-icon svg { width: 15px; height: 15px; fill: #fff; position: relative; z-index: 1; }
    .topbar-name { font-weight: 800; font-size: .97rem; color: var(--text); letter-spacing: -.4px; }
    .topbar-tf { font-size: .58rem; font-weight: 800; color: var(--red); letter-spacing: 1.8px; margin-left: 4px; vertical-align: middle; }
    .topbar-ver { font-size: .6rem; color: var(--text4); font-family: var(--mono); margin-left: 6px; }
    .topbar-right { display: flex; align-items: center; gap: 6px; }
    .nav-links { display: flex; gap: 2px; }
    .nav-links a {
      color: var(--text3); text-decoration: none; font-size: .78rem; font-weight: 600;
      padding: 6px 12px; border-radius: var(--radius-xs); transition: color .2s, background .2s; white-space: nowrap;
      position: relative;
    }
    .nav-links a::after {
      content: ''; position: absolute; bottom: 3px; left: 50%; right: 50%;
      height: 1px; background: var(--red); border-radius: 1px;
      transition: left .25s var(--ease-out), right .25s var(--ease-out);
    }
    .nav-links a:hover { color: var(--text); background: rgba(255,255,255,.04); }
    .nav-links a:hover::after { left: 12px; right: 12px; }
    @media (max-width: 540px) { .nav-links { display: none; } }

    /* ── BELL ── */
    .bell-wrap { position: relative; }
    .bell-btn {
      background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08);
      border-radius: var(--radius-xs); width: 40px; height: 40px;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; color: var(--text3); transition: all .2s; position: relative;
    }
    .bell-btn:hover { background: rgba(255,255,255,.08); color: var(--text); border-color: var(--border2); }
    .bell-btn.active { background: rgba(229,9,20,.08); color: #FF4444; border-color: rgba(229,9,20,.25); }
    .bell-btn svg { width: 15px; height: 15px; }
    .bell-dot {
      position: absolute; top: 6px; right: 6px; width: 7px; height: 7px;
      background: var(--red); border-radius: 50%; border: 1.5px solid var(--bg);
      animation: dot-pulse 2s ease infinite;
    }
    @keyframes dot-pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: .5; transform: scale(.7); } }
    .bell-panel {
      display: none; position: absolute; top: calc(100% + 14px); right: 0; width: 320px;
      background: rgba(14,14,14,.97); backdrop-filter: blur(28px); -webkit-backdrop-filter: blur(28px);
      border: 1px solid rgba(255,255,255,.09); border-radius: 18px;
      box-shadow: 0 32px 80px rgba(0,0,0,.95), 0 0 0 1px rgba(255,255,255,.03);
      z-index: 200; overflow: hidden; transform-origin: top right;
    }
    .bell-panel.opening { display: block; animation: bell-in .24s var(--ease-spring) both; }
    .bell-panel.open    { display: block; }
    .bell-panel.closing { display: block; animation: bell-out .18s ease forwards; }
    @keyframes bell-in  { from { opacity: 0; transform: scale(.88) translateY(-12px); } to { opacity: 1; transform: none; } }
    @keyframes bell-out { from { opacity: 1; transform: none; } to { opacity: 0; transform: scale(.88) translateY(-12px); } }
    .bell-head {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 18px 14px; border-bottom: 1px solid rgba(255,255,255,.06);
    }
    .bell-head-title {
      font-size: .7rem; font-weight: 800; color: var(--text); letter-spacing: 1px; text-transform: uppercase;
      display: flex; align-items: center; gap: 8px;
    }
    .bell-head-title::before { content: ''; width: 7px; height: 7px; background: var(--red); border-radius: 50%; display: inline-block; box-shadow: 0 0 8px var(--red); }
    .bell-close { background: none; border: none; color: var(--text3); cursor: pointer; padding: 4px 8px; border-radius: 5px; transition: all .15s; font-size: .85rem; }
    .bell-close:hover { color: var(--text); background: rgba(255,255,255,.08); }
    .bell-list { max-height: 360px; overflow-y: auto; padding: 8px 0; }
    .bell-list::-webkit-scrollbar { width: 3px; }
    .bell-list::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 2px; }
    .cl-item { padding: 12px 18px; border-bottom: 1px solid rgba(255,255,255,.04); }
    .cl-item:last-child { border-bottom: none; }
    .cl-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
    .cl-left { display: flex; align-items: center; gap: 8px; }
    .cl-ver { font-size: .76rem; font-weight: 800; color: var(--text); font-family: var(--mono); }
    .cl-tag { font-size: .56rem; font-weight: 800; padding: 2px 9px; border-radius: 20px; letter-spacing: .5px; text-transform: uppercase; }
    .cl-tag.current { background: rgba(255,0,0,.1); color: #FF4444; border: 1px solid rgba(255,0,0,.2); }
    .cl-tag.init { background: rgba(255,255,255,.05); color: var(--text3); }
    .cl-tag.hotfix { background: rgba(255,165,0,.12); color: #FFA500; border: 1px solid rgba(255,165,0,.3); }
    .cl-tag.big-update { background: rgba(139,92,246,.15); color: #a78bfa; border: 1px solid rgba(139,92,246,.35); }
    .cl-date { font-size: .64rem; color: var(--text4); font-family: var(--mono); }
    .cl-notes { list-style: none; display: flex; flex-direction: column; gap: 4px; }
    .cl-notes li { font-size: .7rem; color: var(--text3); padding-left: 14px; position: relative; line-height: 1.5; }
    .cl-notes li::before { content: '·'; position: absolute; left: 0; color: var(--red); font-weight: 900; }

    /* ══════════════════════════════════════
       HERO
    ══════════════════════════════════════ */
    .hero {
      position: relative; overflow: hidden;
      padding: clamp(72px, 12vw, 120px) 24px clamp(56px, 9vw, 96px);
      text-align: center;
      background: radial-gradient(ellipse 80% 60% at 50% -5%, rgba(140,0,0,.28) 0%, transparent 62%);
    }
    .hero::before {
      content: ''; position: absolute; inset: 0; pointer-events: none;
      background: radial-gradient(ellipse 55% 45% at 50% 0%, rgba(229,9,20,.06) 0%, transparent 68%);
    }
    #hero-canvas { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
    .hero-content { position: relative; z-index: 2; }
    .hero-eyebrow {
      display: inline-flex; align-items: center; gap: 10px;
      background: rgba(229,9,20,.06); border: 1px solid rgba(229,9,20,.16);
      border-radius: 28px; padding: 6px 20px;
      font-size: .6rem; font-weight: 800; color: rgba(255,110,110,.85);
      letter-spacing: 2px; text-transform: uppercase; margin-bottom: 26px;
      animation: fade-up-soft .6s ease both .1s; backdrop-filter: blur(8px);
    }
    .hero-eyebrow-stars { color: #FFB800; letter-spacing: 2px; font-size: .68rem; }
    .hero h1 {
      font-size: clamp(3.2rem, 10vw, 5.6rem); font-weight: 900; color: var(--text);
      letter-spacing: -4px; line-height: .93;
      animation: fade-up-soft .7s ease both .2s;
    }
    .hero-tf {
      color: transparent;
      background: linear-gradient(135deg, #FF5555 0%, #E50914 45%, #A00000 100%);
      -webkit-background-clip: text; background-clip: text;
      position: relative;
    }
    .hero-tf::after {
      content: attr(data-text);
      position: absolute; inset: 0;
      background: linear-gradient(135deg, #FF5555, #E50914);
      -webkit-background-clip: text; background-clip: text;
      color: transparent;
      filter: blur(14px); opacity: .35;
      z-index: -1;
    }
    .hero-sub {
      margin-top: 22px; color: rgba(240,240,240,.42);
      font-size: clamp(.85rem, 2vw, .96rem); line-height: 1.75;
      animation: fade-up-soft .7s ease both .32s;
      font-weight: 400; letter-spacing: .01em;
    }
    .hero-badges {
      display: flex; gap: 7px; justify-content: center; margin-top: 32px;
      flex-wrap: wrap; animation: fade-up-soft .7s ease both .44s;
    }
    .hbadge {
      background: rgba(255,255,255,.035); backdrop-filter: blur(10px);
      color: rgba(240,240,240,.5); padding: 6px 16px; border-radius: 28px;
      font-size: .64rem; font-weight: 700; letter-spacing: .5px;
      border: 1px solid rgba(255,255,255,.065); transition: all .25s var(--ease-out);
      cursor: default;
    }
    .hbadge:hover { background: rgba(255,255,255,.075); color: var(--text); border-color: rgba(255,255,255,.13); transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,.4); }

    /* ── STATS BAR ── */
    .stats-bar {
      display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;
      margin-top: 36px; animation: fade-up-soft .7s ease both .56s;
    }
    .stat-item {
      display: flex; flex-direction: column; align-items: center; gap: 5px;
      background: rgba(255,255,255,.028); border: 1px solid rgba(255,255,255,.065);
      border-radius: var(--radius); padding: 16px 24px; min-width: 92px;
      backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
      transition: all .3s var(--ease-out); position: relative; overflow: hidden;
    }
    .stat-item::before { content: ''; position: absolute; inset: 0; background: linear-gradient(135deg, rgba(255,255,255,.025) 0%, transparent 60%); pointer-events: none; }
    .stat-item:hover { border-color: rgba(255,255,255,.11); transform: translateY(-4px); box-shadow: 0 16px 48px rgba(0,0,0,.55); }
    .stat-num { font-size: 1.55rem; font-weight: 900; color: var(--text); font-family: var(--mono); line-height: 1; letter-spacing: -1.5px; }
    .stat-num.red { color: #FF4040; text-shadow: 0 0 24px rgba(229,9,20,.25); }
    .stat-lbl { font-size: .54rem; font-weight: 700; color: var(--text3); text-transform: uppercase; letter-spacing: 1.4px; }

    /* ══════════════════════════════════════
       LAYOUT
    ══════════════════════════════════════ */
    .wrap { max-width: 860px; margin: 0 auto; padding: clamp(32px, 5vw, 56px) 20px 100px; position: relative; z-index: 1; }
    .sec-label {
      font-size: .62rem; font-weight: 800; color: var(--text4);
      text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 14px; padding-left: 2px;
      display: flex; align-items: center; gap: 12px;
    }
    .sec-label::after { content: ''; flex: 1; height: 1px; background: linear-gradient(90deg, rgba(255,255,255,.07), transparent); }

    /* ══════════════════════════════════════
       ENDPOINT ACCORDION
    ══════════════════════════════════════ */
    .ep-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 36px; }
    .ep-card {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: var(--radius); overflow: hidden;
      transition: border-color .28s, box-shadow .28s, transform .22s var(--ease-out);
      backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
      position: relative;
    }
    .ep-card::before {
      content: ''; position: absolute; inset: 0; border-radius: var(--radius);
      background: linear-gradient(135deg, rgba(255,255,255,.03) 0%, transparent 60%);
      pointer-events: none;
    }
    .ep-card:hover { border-color: rgba(255,255,255,.12); transform: translateY(-2px); box-shadow: 0 14px 44px rgba(0,0,0,.55); }
    .ep-card.open { border-color: rgba(229,9,20,.3); box-shadow: 0 0 0 1px rgba(229,9,20,.07), 0 20px 56px rgba(0,0,0,.65); transform: none; }
    .ep-header {
      display: flex; align-items: center; gap: 12px; padding: 16px 20px;
      cursor: pointer; transition: background .2s; user-select: none;
    }
    .ep-header:hover { background: rgba(255,255,255,.025); }
    .ep-method {
      font-size: .6rem; font-weight: 900; padding: 3px 10px; border-radius: var(--radius-xs);
      background: rgba(74,222,128,.07); color: var(--green); letter-spacing: .6px;
      flex-shrink: 0; border: 1px solid rgba(74,222,128,.14); font-family: var(--mono);
    }
    .ep-method.v2 { background: rgba(96,165,250,.07); color: var(--blue); border-color: rgba(96,165,250,.14); }
    .ep-method.v3 { background: rgba(251,191,36,.07); color: var(--amber); border-color: rgba(251,191,36,.14); }
    .ep-path { font-family: var(--mono); font-size: .78rem; color: var(--blue); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; user-select: text; -webkit-user-select: text; }
    .ep-desc-label { font-size: .7rem; color: var(--text4); white-space: nowrap; margin-right: 4px; }
    @media (max-width: 500px) { .ep-desc-label { display: none; } }
    .ep-chevron { color: var(--text4); flex-shrink: 0; transition: transform .35s var(--ease-spring), color .2s; }
    .ep-chevron svg { width: 14px; height: 14px; }
    .ep-card.open .ep-chevron { transform: rotate(180deg); color: var(--red); }
    .ep-body { max-height: 0; overflow: hidden; transition: max-height .4s var(--ease-in-out); border-top: 0 solid rgba(255,255,255,.07); }
    .ep-card.open .ep-body { max-height: 3000px; border-top-width: 1px; }
    .ep-body-inner { padding: 20px; }
    .ep-info { font-size: .8rem; color: var(--text3); line-height: 1.75; margin-bottom: 18px; }
    .ep-info code { background: rgba(255,255,255,.07); color: var(--text); padding: 1px 7px; border-radius: 4px; font-size: .84em; font-family: var(--mono); }
    .ep-info strong { color: var(--text2); }
    .ep-badge-fast {
      display: inline-flex; align-items: center; gap: 4px;
      background: rgba(96,165,250,.07); color: var(--blue); border: 1px solid rgba(96,165,250,.14);
      border-radius: 4px; font-size: .64rem; font-weight: 800; padding: 2px 8px; letter-spacing: .5px; margin-left: 6px; vertical-align: middle;
    }
    .ep-badge-new {
      display: inline-flex; align-items: center;
      background: rgba(251,191,36,.08); color: var(--amber); border: 1px solid rgba(251,191,36,.18);
      border-radius: 4px; font-size: .64rem; font-weight: 800; padding: 2px 8px; letter-spacing: .5px; margin-left: 6px; vertical-align: middle;
    }
    .ep-input-row { display: flex; gap: 8px; margin-bottom: 14px; }
    .ep-input {
      flex: 1; min-width: 0; background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.09);
      border-radius: var(--radius-sm); color: var(--text); padding: 12px 16px;
      font-size: .84rem; outline: none; transition: border-color .22s, box-shadow .22s, background .22s;
      font-family: var(--font);
    }
    .ep-input:focus { border-color: rgba(229,9,20,.4); box-shadow: 0 0 0 3px rgba(229,9,20,.06); background: rgba(255,255,255,.05); }
    .ep-input::placeholder { color: var(--text4); }
    .ep-fetch-btn {
      background: linear-gradient(135deg, #8B0000, #E50914);
      color: #fff; border: none; padding: 12px 24px; border-radius: var(--radius-sm);
      cursor: pointer; font-size: .82rem; font-weight: 700; transition: all .22s;
      white-space: nowrap; display: flex; align-items: center; gap: 8px;
      box-shadow: 0 4px 18px rgba(229,9,20,.26); position: relative; overflow: hidden;
      font-family: var(--font);
    }
    .ep-fetch-btn::before {
      content: ''; position: absolute; inset: 0;
      background: linear-gradient(135deg, rgba(255,255,255,.16) 0%, transparent 55%);
    }
    .ep-fetch-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(229,9,20,.38); background: linear-gradient(135deg, #A00000, #FF1020); animation: none; }
    .ep-fetch-btn:active:not(:disabled) { transform: translateY(1px); box-shadow: 0 2px 10px rgba(229,9,20,.22); }
    .ep-fetch-btn:disabled { background: rgba(255,255,255,.05); color: var(--text4); cursor: not-allowed; transform: none; box-shadow: none; animation: none; }
    .ep-fetch-btn:not(:disabled):not(:active) { animation: btn-breathe 3s ease-in-out infinite; }
    @keyframes btn-breathe {
      0%,100% { box-shadow: 0 4px 18px rgba(229,9,20,.26); }
      50%      { box-shadow: 0 6px 34px rgba(229,9,20,.5), 0 0 48px rgba(229,9,20,.08); }
    }
    .ep-fetch-btn svg { width: 13px; height: 13px; flex-shrink: 0; position: relative; z-index: 1; }
    .ep-fetch-btn span { position: relative; z-index: 1; }
    @media (max-width: 440px) { .ep-input-row { flex-direction: column; } }

    /* ── RIPPLE ── */
    .ripple-container { position: relative; overflow: hidden; }
    .ripple-el {
      position: absolute; border-radius: 50%;
      background: rgba(255,255,255,.3); transform: scale(0);
      animation: ripple .6s linear; pointer-events: none;
    }
    @keyframes ripple { to { transform: scale(4); opacity: 0; } }

    /* ── EP RESULT META ── */
    .ep-result { display: none; margin-top: 6px; }
    .ep-result-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
    .ep-status { font-size: .65rem; font-weight: 800; padding: 3px 10px; border-radius: var(--radius-xs); letter-spacing: .4px; font-family: var(--mono); }
    .ep-status.ok  { background: rgba(74,222,128,.07); color: var(--green); border: 1px solid rgba(74,222,128,.14); }
    .ep-status.err { background: rgba(229,9,20,.07); color: #FF4444; border: 1px solid rgba(229,9,20,.16); }
    .ep-ms { font-size: .65rem; color: var(--text4); font-family: var(--mono); }
    .ep-cached { font-size: .65rem; color: var(--amber); background: rgba(245,158,11,.07); padding: 3px 9px; border-radius: 5px; font-weight: 700; border: 1px solid rgba(245,158,11,.14); }
    .ep-apicount { font-size: .65rem; color: var(--purple); background: rgba(167,139,250,.07); padding: 3px 9px; border-radius: 5px; font-weight: 700; border: 1px solid rgba(167,139,250,.14); display: none; }

    /* ── COPY URL STRIP ── */
    .copy-url-strip {
      display: flex; align-items: center; gap: 10px;
      background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.07);
      border-radius: var(--radius-sm); padding: 10px 14px; margin-bottom: 14px; overflow: hidden;
    }
    .copy-url-strip code { flex: 1; font-family: var(--mono); font-size: .7rem; color: var(--blue); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .copy-url-btn {
      background: rgba(255,255,255,.06); color: var(--text2); border: none;
      border-radius: 6px; padding: 4px 12px; font-size: .65rem; font-weight: 700;
      cursor: pointer; white-space: nowrap; transition: all .18s;
      flex-shrink: 0; display: flex; align-items: center; gap: 5px; font-family: var(--font);
    }
    .copy-url-btn:hover { background: rgba(255,255,255,.12); color: var(--text); }
    .copy-url-btn svg { width: 11px; height: 11px; }

    /* ── V1 RICH RESULT ── */
    .r-card {
      background: rgba(255,255,255,.022); border: 1px solid rgba(255,255,255,.08);
      border-radius: var(--radius); overflow: hidden; margin-bottom: 14px;
      animation: slide-up .32s var(--ease-spring) both;
      backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
    }
    @keyframes slide-up { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
    .r-inner { display: flex; flex-direction: column; }
    .r-thumb { position: relative; background: #0a0a0a; width: 100%; aspect-ratio: 16/9; overflow: hidden; }
    .r-thumb-img { width: 100%; height: 100%; object-fit: cover; display: block; position: absolute; inset: 0; transition: opacity .55s ease; }
    .r-dur {
      position: absolute; bottom: 8px; right: 8px; z-index: 4;
      background: rgba(0,0,0,.88); color: var(--text); font-size: .62rem; font-weight: 700;
      padding: 3px 7px; border-radius: 5px; font-family: var(--mono);
      backdrop-filter: blur(6px);
    }
    .r-cached-badge {
      position: absolute; top: 8px; left: 8px; z-index: 4; display: none;
      background: rgba(255,0,0,.14); color: #FF4444; font-size: .58rem; font-weight: 800;
      padding: 2px 8px; border-radius: 4px; letter-spacing: .5px; text-transform: uppercase;
      border: 1px solid rgba(255,0,0,.2); backdrop-filter: blur(6px);
    }
    .r-play-overlay {
      position: absolute; inset: 0; z-index: 3;
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;
      background: rgba(0,0,0,.32); cursor: pointer; transition: background .25s;
    }
    .r-play-overlay:hover { background: rgba(0,0,0,.5); }
    .r-play-circle {
      width: 58px; height: 58px; border-radius: 50%;
      background: rgba(220,0,0,.92); display: flex; align-items: center; justify-content: center;
      box-shadow: 0 0 30px rgba(255,0,0,.55), 0 8px 24px rgba(0,0,0,.5);
      transition: transform .25s var(--ease-spring), box-shadow .25s;
    }
    .r-play-overlay:hover .r-play-circle { transform: scale(1.12); box-shadow: 0 0 45px rgba(255,0,0,.75), 0 12px 32px rgba(0,0,0,.6); }
    .r-play-circle svg { width: 22px; height: 22px; fill: #fff; margin-left: 4px; }
    .r-play-label { font-size: .64rem; font-weight: 800; color: rgba(255,255,255,.7); letter-spacing: 1.5px; text-transform: uppercase; }
    .r-countdown-wrap { position: absolute; inset: 0; z-index: 3; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(0,0,0,.55); }
    .r-ring-svg { width: 90px; height: 90px; transform: rotate(-90deg); }
    .r-ring-bg { fill: none; stroke: rgba(255,255,255,.1); stroke-width: 4; }
    .r-ring-arc { fill: none; stroke: var(--red); stroke-width: 4; stroke-linecap: round; stroke-dasharray: 201; stroke-dashoffset: 201; transition: stroke-dashoffset 5s linear; filter: drop-shadow(0 0 6px var(--red)); }
    .r-countdown-n { position: absolute; font-size: 1.9rem; font-weight: 900; color: var(--text); text-shadow: 0 0 24px rgba(255,0,0,.6); }
    .r-yt-wrap { position: absolute; inset: 0; z-index: 5; display: none; animation: yt-fade-in .5s ease both; }
    @keyframes yt-fade-in { from { opacity: 0; } to { opacity: 1; } }
    .r-yt-wrap > div, .r-yt-wrap iframe { width: 100% !important; height: 100% !important; border: none; display: block; }
    .r-body { padding: 16px 20px; display: flex; flex-direction: column; gap: 10px; min-width: 0; }
    .r-title { font-size: .9rem; font-weight: 700; color: var(--text); line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .r-author { font-size: .74rem; color: var(--blue); text-decoration: none; font-weight: 600; transition: color .18s; }
    .r-author:hover { color: #93c5fd; }
    .r-stats { display: flex; flex-wrap: wrap; gap: 4px 12px; align-items: center; }
    .r-stat { font-size: .68rem; color: var(--text3); display: flex; align-items: center; gap: 4px; }
    .cat-badge {
      display: none; align-items: center;
      background: rgba(251,191,36,.07); color: var(--amber); border: 1px solid rgba(251,191,36,.14);
      border-radius: 5px; font-size: .6rem; font-weight: 800; padding: 2px 9px; letter-spacing: .5px;
    }
    .r-desc-wrap { font-size: .73rem; color: var(--text3); line-height: 1.6; display: none; }
    .r-desc-text { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; white-space: pre-line; }
    .r-desc-text.exp { -webkit-line-clamp: unset; display: block; max-height: 200px; overflow-y: auto; padding-right: 4px; }
    .r-desc-text.exp::-webkit-scrollbar { width: 3px; }
    .r-desc-text.exp::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 2px; }
    .r-more { background: none; border: none; color: var(--red); font-size: .68rem; font-weight: 700; cursor: pointer; padding: 2px 0; margin-top: 3px; display: block; transition: color .15s; font-family: var(--font); }
    .r-more:hover { color: #FF4444; }
    .r-dl { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px; }

    /* ── V2 RESULT ── */
    .v2-card {
      background: rgba(255,255,255,.022); border: 1px solid rgba(255,255,255,.08);
      border-radius: var(--radius); padding: 20px 22px; margin-bottom: 14px;
      animation: slide-up .32s var(--ease-spring) both;
    }
    .v2-title { font-size: .88rem; font-weight: 700; color: var(--text); line-height: 1.35; margin-bottom: 14px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .v2-label { font-size: .6rem; font-weight: 800; color: var(--text4); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; }
    .v2-dl { display: flex; gap: 8px; flex-wrap: wrap; }

    /* ── V3 RESULT LIST ── */
    .v3-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px; animation: slide-up .32s var(--ease-spring) both; }
    .v3-item {
      display: flex; gap: 12px; background: rgba(255,255,255,.02); border: 1px solid rgba(255,255,255,.06);
      border-radius: var(--radius-sm); padding: 12px; transition: border-color .22s, transform .22s, box-shadow .22s; overflow: hidden;
    }
    .v3-item:hover { border-color: rgba(255,255,255,.13); transform: translateY(-2px); box-shadow: 0 8px 28px rgba(0,0,0,.4); }
    .v3-num { font-size: .62rem; font-weight: 900; color: var(--text4); min-width: 14px; padding-top: 2px; text-align: right; flex-shrink: 0; font-family: var(--mono); }
    .v3-thumb-wrap { position: relative; flex-shrink: 0; width: 100px; height: 56px; border-radius: 7px; overflow: hidden; background: #111; }
    .v3-thumb-img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .v3-dur-badge { position: absolute; bottom: 3px; right: 3px; background: rgba(0,0,0,.9); color: var(--text); font-size: .54rem; font-weight: 700; padding: 1px 5px; border-radius: 3px; font-family: var(--mono); }
    .v3-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
    .v3-title { font-size: .78rem; font-weight: 700; color: var(--text); line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-decoration: none; transition: color .18s; }
    .v3-title:hover { color: var(--blue); }
    .v3-channel { font-size: .67rem; color: var(--blue); font-weight: 600; text-decoration: none; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transition: color .18s; }
    .v3-channel:hover { color: #93c5fd; }
    .v3-meta-row { display: flex; gap: 7px; flex-wrap: wrap; align-items: center; margin-top: 1px; }
    .v3-views, .v3-date { font-size: .62rem; color: var(--text4); font-family: var(--mono); }
    .v3-cat-badge { font-size: .56rem; font-weight: 800; color: var(--amber); background: rgba(251,191,36,.06); border: 1px solid rgba(251,191,36,.12); border-radius: 4px; padding: 1px 6px; letter-spacing: .4px; }
    .v3-desc { font-size: .68rem; color: #444; line-height: 1.45; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; margin-top: 2px; }
    @media (max-width: 480px) { .v3-thumb-wrap { width: 76px; height: 44px; } .v3-title { font-size: .74rem; } }

    /* ── DOWNLOAD BUTTONS ── */
    .dl-btn {
      display: inline-flex; align-items: center; gap: 7px; padding: 9px 18px;
      border-radius: var(--radius-sm); font-size: .78rem; font-weight: 700;
      text-decoration: none; transition: all .22s; border: 1px solid transparent;
      position: relative; overflow: hidden;
    }
    .dl-btn::before { content: ''; position: absolute; inset: 0; background: linear-gradient(135deg, rgba(255,255,255,.1) 0%, transparent 60%); opacity: 0; transition: opacity .22s; }
    .dl-btn:hover::before { opacity: 1; }
    .dl-mp4 { background: rgba(229,9,20,.07); color: #FF4444; border-color: rgba(229,9,20,.15); }
    .dl-mp4:hover { background: rgba(229,9,20,.15); color: #FF6060; transform: translateY(-2px); box-shadow: 0 6px 20px rgba(229,9,20,.16); }
    .dl-mp3 { background: rgba(96,165,250,.08); color: var(--blue); border-color: rgba(96,165,250,.16); }
    .dl-mp3:hover { background: rgba(96,165,250,.16); color: #93c5fd; transform: translateY(-2px); box-shadow: 0 6px 20px rgba(96,165,250,.15); }
    .dl-btn svg { width: 13px; height: 13px; flex-shrink: 0; }
    .dl-none { font-size: .78rem; color: var(--text4); font-style: italic; }

    /* ── SKELETON ── */
    .ep-skel { display: none; flex-direction: column; gap: 10px; padding: 4px 0 8px; }
    .skel-line {
      background: linear-gradient(90deg, rgba(255,255,255,.03) 25%, rgba(255,255,255,.065) 50%, rgba(255,255,255,.03) 75%);
      background-size: 200% 100%; animation: shim 1.4s infinite; border-radius: 7px; height: 12px;
    }
    @keyframes shim { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

    /* ── JSON BOX ── */
    .json-actions { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
    .json-label { font-size: .6rem; font-weight: 800; color: var(--text4); text-transform: uppercase; letter-spacing: 1px; }
    .copy-btn {
      background: rgba(255,255,255,.05); color: var(--text3); border: 1px solid rgba(255,255,255,.08);
      border-radius: 6px; padding: 3px 11px; font-size: .64rem; cursor: pointer; font-weight: 700;
      transition: all .18s; font-family: var(--font);
    }
    .copy-btn:hover { background: rgba(255,255,255,.1); color: var(--text); }
    pre.jbox {
      background: rgba(0,0,0,.4); border: 1px solid rgba(255,255,255,.07); border-radius: var(--radius-sm);
      padding: 16px 18px; font-family: var(--mono); font-size: .7rem; line-height: 1.8;
      overflow-x: auto; max-height: 320px; overflow-y: auto; color: var(--text3); white-space: pre;
    }
    pre.jbox::-webkit-scrollbar { width: 4px; height: 4px; }
    pre.jbox::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 2px; }
    .jk { color: #FF4444; } .js { color: #86efac; } .jn { color: var(--amber); } .jb { color: #818cf8; }

    /* ── MISC CARDS ── */
    .card {
      background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
      padding: clamp(22px, 4vw, 32px); margin-bottom: 22px;
      backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
      transition: border-color .28s, box-shadow .28s; position: relative; overflow: hidden;
    }
    .card::before { content: ''; position: absolute; inset: 0; background: linear-gradient(135deg, rgba(255,255,255,.025) 0%, transparent 60%); pointer-events: none; }
    .card:hover { border-color: rgba(255,255,255,.12); box-shadow: 0 12px 40px rgba(0,0,0,.4); }
    .card-title { font-size: .62rem; font-weight: 800; color: var(--text4); text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 16px; display: flex; align-items: center; gap: 9px; }
    .card-title::before { content: ''; width: 3px; height: 12px; background: var(--red); border-radius: 2px; display: inline-block; box-shadow: 0 0 8px rgba(229,9,20,.45); }
    .about p { color: var(--text2); line-height: 1.9; font-size: .87rem; }
    .about code { background: rgba(255,255,255,.07); color: var(--text); padding: 1px 7px; border-radius: 4px; font-size: .88em; font-family: var(--mono); }
    .about strong { color: var(--text); }
    .disc p { color: var(--text2); line-height: 1.9; font-size: .86rem; }
    .disc strong { color: var(--amber); }

    /* ── FAQ ── */
    .faq-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 24px; }
    .faq-item {
      background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm);
      overflow: hidden; transition: border-color .22s, box-shadow .22s;
    }
    .faq-item.open { border-color: rgba(229,9,20,.22); box-shadow: 0 6px 24px rgba(0,0,0,.35); }
    .faq-q {
      display: flex; align-items: center; justify-content: space-between; gap: 14px;
      padding: 18px 22px; cursor: pointer; font-size: .86rem; font-weight: 600; color: var(--text);
      transition: background .2s; line-height: 1.4;
    }
    .faq-q:hover { background: rgba(255,255,255,.022); }
    .faq-icon { font-size: 1.2rem; color: var(--text3); flex-shrink: 0; transition: transform .35s var(--ease-spring), color .2s; line-height: 1; font-weight: 300; }
    .faq-item.open .faq-icon { transform: rotate(45deg); color: var(--red); }
    .faq-a { max-height: 0; overflow: hidden; transition: max-height .38s var(--ease-in-out); }
    .faq-item.open .faq-a { max-height: 500px; }
    .faq-a-inner { padding: 4px 22px 20px; font-size: .81rem; color: var(--text2); line-height: 1.9; border-top: 1px solid rgba(255,255,255,.055); }
    .faq-a-inner code { background: rgba(255,255,255,.07); color: var(--text); padding: 1px 7px; border-radius: 4px; font-size: .88em; font-family: var(--mono); }
    .faq-a-inner strong { color: var(--text); }
    .faq-item.faq-hidden { display: none; }
    .faq-showmore-btn {
      display: block; width: 100%; padding: 12px 0;
      background: rgba(255,255,255,.025); border: 1px solid rgba(255,255,255,.075);
      border-radius: var(--radius); color: var(--text4); font-size: .65rem; font-weight: 800;
      cursor: pointer; font-family: var(--font); letter-spacing: 1.5px; text-transform: uppercase;
      transition: background .2s, color .2s, border-color .2s; margin-bottom: 24px;
    }
    .faq-showmore-btn:hover { background: rgba(229,9,20,.07); border-color: rgba(229,9,20,.18); color: var(--red); }
    .disc-link { color: var(--red); text-decoration: none; font-weight: 700; font-size: .78em; }
    .disc-link:hover { text-decoration: underline; }

    /* ── STATS MODAL ── */
    .sm-overlay {
      position: fixed; inset: 0; z-index: 9997;
      background: rgba(0,0,0,.82); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
      display: none; align-items: center; justify-content: center; padding: 20px;
    }
    .sm-overlay.open { display: flex; animation: sm-fade .2s ease both; }
    @keyframes sm-fade { from { opacity: 0; } to { opacity: 1; } }
    .sm-modal {
      background: rgba(10,10,10,.99); border: 1px solid rgba(255,255,255,.1);
      border-radius: 24px; padding: 28px 24px 24px; width: min(360px, 100%);
      box-shadow: 0 50px 120px rgba(0,0,0,.97), 0 0 0 1px rgba(255,255,255,.04);
      animation: sm-pop .3s var(--ease-spring) both;
    }
    @keyframes sm-pop { from { opacity: 0; transform: scale(.84) translateY(18px); } to { opacity: 1; transform: none; } }
    .sm-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
    .sm-title { font-size: .84rem; font-weight: 800; color: var(--text); letter-spacing: .3px; }
    .sm-close {
      background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1); border-radius: 8px;
      color: var(--text3); width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
      cursor: pointer; transition: all .18s; font-size: .75rem; flex-shrink: 0;
    }
    .sm-close:hover { background: rgba(255,255,255,.12); color: var(--text); }
    .sm-circles { display: flex; align-items: flex-start; gap: 14px; justify-content: center; }
    .sm-circle-wrap { display: flex; flex-direction: column; align-items: center; gap: 10px; flex: 1; max-width: 145px; }
    .sm-ring-wrap { position: relative; width: 112px; height: 112px; }
    .sm-ring-svg { width: 112px; height: 112px; transform: rotate(-90deg); display: block; }
    .sm-ring-bg { fill: none; stroke-width: 9; }
    .sm-ring-arc { fill: none; stroke-width: 9; stroke-linecap: round; stroke-dasharray: 289; stroke-dashoffset: 289; transition: stroke-dashoffset 1s var(--ease-in-out); }
    .sm-ring-center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; }
    .sm-pct { font-size: 1.28rem; font-weight: 900; font-family: var(--mono); line-height: 1; letter-spacing: -1px; }
    .sm-count { font-size: .6rem; font-weight: 700; color: #555; line-height: 1; }
    .sm-circle-lbl { font-size: .72rem; font-weight: 700; text-align: center; letter-spacing: .2px; }
    .sm-divider { width: 1px; background: rgba(255,255,255,.06); align-self: stretch; margin: 6px 0; }
    .sm-footer { font-size: .6rem; color: #333; text-align: center; margin-top: 22px; font-family: var(--mono); padding-top: 18px; border-top: 1px solid rgba(255,255,255,.05); }
    .stat-clickable { cursor: pointer; transition: all .25s; }
    .stat-clickable:hover { border-color: rgba(255,0,0,.28) !important; background: rgba(255,0,0,.05) !important; transform: translateY(-3px); box-shadow: 0 8px 28px rgba(0,0,0,.5); }
    .stat-clickable:active { transform: translateY(0); }
    .db-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; margin-left: 6px; vertical-align: middle; flex-shrink: 0; }
    .db-dot.connected { background: var(--green); box-shadow: 0 0 6px rgba(74,222,128,.6); }
    .db-dot.fallback   { background: var(--amber); box-shadow: 0 0 6px rgba(245,158,11,.6); }
    .db-dot.failed     { background: #FF4444; box-shadow: 0 0 6px rgba(255,68,68,.6); }
    .sm-mongo-row { display: flex; align-items: center; justify-content: center; gap: 7px; font-size: .6rem; font-family: var(--mono); margin-top: 8px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,.05); }
    .sm-mongo-badge { display: inline-flex; align-items: center; gap: 5px; padding: 2px 9px; border-radius: 20px; font-size: .58rem; font-weight: 800; letter-spacing: .4px; text-transform: uppercase; }
    .sm-mongo-badge.connected { background: rgba(74,222,128,.07); color: var(--green); border: 1px solid rgba(74,222,128,.17); }
    .sm-mongo-badge.fallback  { background: rgba(245,158,11,.07); color: var(--amber); border: 1px solid rgba(245,158,11,.17); }
    .sm-mongo-badge.failed    { background: rgba(255,68,68,.07); color: #FF4444; border: 1px solid rgba(255,68,68,.17); }

    /* ── HOST BADGE ── */
    .host-badge { margin-top: 14px; display: flex; align-items: center; justify-content: center; }
    .host-pill {
      display: inline-flex; align-items: center; gap: 8px;
      background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.07);
      border-radius: 24px; padding: 5px 16px; font-size: .66rem; font-weight: 700;
      color: var(--text4); text-decoration: none; transition: all .22s; letter-spacing: .3px;
    }
    .host-pill:hover { background: rgba(255,255,255,.06); color: var(--text3); border-color: var(--border2); }
    .host-dot { width: 7px; height: 7px; border-radius: 50%; display: inline-block; flex-shrink: 0; box-shadow: 0 0 6px currentColor; }

    /* ── FOOTER ── */
    footer {
      text-align: center; padding: 36px 24px 32px;
      color: var(--text4); font-size: .72rem;
      border-top: 1px solid rgba(255,255,255,.05);
      position: relative; z-index: 1;
    }
    footer strong { color: var(--text3); }
    footer .tf { color: var(--red); font-weight: 800; }

    /* ══════════════════════════════════════
       HERO GRADIENT BLEED
    ══════════════════════════════════════ */
    .hero::after {
      content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 100px;
      background: linear-gradient(to bottom, transparent, var(--bg));
      pointer-events: none; z-index: 2;
    }

    /* ══════════════════════════════════════
       CARD 3D TILT
    ══════════════════════════════════════ */
    .ep-card {
      transform-style: preserve-3d; will-change: transform;
    }

    /* ══════════════════════════════════════
       MOBILE
    ══════════════════════════════════════ */
    @media (max-width: 640px) {
      .topbar { padding: 0 16px; height: 56px; }
      .hero { padding: 52px 18px 40px; }
      .wrap { padding: clamp(24px, 4vw, 40px) 14px 80px; }
      .ep-header { padding: 14px 16px; }
      .ep-body-inner { padding: 16px; }
      .r-body { padding: 14px 16px; }
    }

    /* ══════════════════════════════════════
       REDUCED MOTION
    ══════════════════════════════════════ */
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: .01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: .01ms !important;
        animation-delay: .01ms !important;
      }
      .reveal { opacity: 1 !important; transform: none !important; }
      #grain { animation: none !important; }
    }
  </style>
</head>
<body>

<!-- CURSOR -->
<div id="tf-cursor"></div>

<!-- AURORA -->
<div id="aurora" aria-hidden="true">
  <div class="aurora-orb ao1"></div>
  <div class="aurora-orb ao2"></div>
  <div class="aurora-orb ao3"></div>
</div>
<div id="grid-overlay" aria-hidden="true"></div>
<div id="grain" aria-hidden="true"></div>

<!-- ══════════════════════════════════════
     INTRO
══════════════════════════════════════ -->
<div id="intro" role="status" aria-label="Loading TubeFetch">
  <div id="intro-split-top"></div>
  <div id="intro-split-bottom"></div>
  <div id="intro-grid"></div>
  <div id="intro-aurora">
    <div class="ia1"></div>
    <div class="ia2"></div>
  </div>
  <div id="intro-scanline"></div>
  <div class="i-wrap">
    <div class="i-icon" id="i-icon">
      <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
    </div>
    <div class="i-title">
      <div class="i-word"><span class="i-l" style="--di:0">T</span><span class="i-l" style="--di:1">u</span><span class="i-l" style="--di:2">b</span><span class="i-l" style="--di:3">e</span></div><div class="i-word"><span class="i-l i-l-red" style="--di:4">F</span><span class="i-l i-l-red" style="--di:5">e</span><span class="i-l i-l-red" style="--di:6">t</span><span class="i-l i-l-red" style="--di:7">c</span><span class="i-l i-l-red" style="--di:8">h</span></div>
    </div>
    <div class="i-sub">YouTube Downloader API</div>
    <div class="i-badges">
      <span class="i-badge">No Key Required</span>
      <span class="i-badge">MP4 &amp; MP3</span>
      <span class="i-badge">by MJL</span>
    </div>
    <div class="i-bar-track"><div class="i-bar" id="i-bar"></div></div>
    <div class="i-counter" id="i-counter">0%</div>
    <div class="i-ver">v${version}</div>
  </div>
</div>

<!-- ══════════════════════════════════════
     TERMS OVERLAY
══════════════════════════════════════ -->
<div id="terms-overlay" role="dialog" aria-modal="true" aria-label="Terms and Conditions">
  <div class="terms-modal">
    <div class="terms-head">
      <div class="terms-icon">
        <svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      </div>
      <div class="terms-title">Terms &amp; Conditions</div>
      <div class="terms-sub">TubeFetch · Educational Use Only</div>
    </div>
    <div class="terms-body">
      <div class="terms-section">
        <div class="terms-section-title">Usage</div>
        <p class="terms-text">TubeFetch is provided <strong>for educational and personal use only</strong>. This service fetches publicly available YouTube metadata and download links.</p>
      </div>
      <div class="terms-section">
        <div class="terms-section-title">Copyright</div>
        <p class="terms-text">Downloading copyrighted content may violate <strong>YouTube's Terms of Service</strong> and applicable copyright laws. You are solely responsible for how you use any links obtained through TubeFetch.</p>
      </div>
      <div class="terms-section">
        <div class="terms-section-title">Liability</div>
        <p class="terms-text">The developer (<strong>MJL</strong>) accepts <strong>no responsibility</strong> for any misuse of this service. All content belongs to its respective owners.</p>
      </div>
      <div class="terms-section">
        <div class="terms-section-title">No Warranty</div>
        <p class="terms-text">This service is provided <strong>"as is"</strong> without warranty of any kind. Download links may expire. Service availability is not guaranteed.</p>
      </div>
    </div>
    <div class="terms-footer">
      <p class="terms-notice">By clicking Accept, you agree to these terms and confirm you understand the educational nature of this service.</p>
      <div class="terms-btns">
        <button class="terms-accept" onclick="acceptTerms()">Accept &amp; Continue</button>
        <button class="terms-decline" onclick="declineTerms()">Decline</button>
      </div>
    </div>
  </div>
</div>

<!-- ── DECLINE OVERLAY ── -->
<div id="decline-overlay" role="alert">
  <div class="decline-modal">
    <div class="decline-icon">
      <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </div>
    <div class="decline-title">Access Denied</div>
    <p class="decline-msg">You must accept the Terms &amp; Conditions to use TubeFetch. Redirecting you to Google.</p>
    <div class="decline-bar-track"><div class="decline-bar" id="decline-bar"></div></div>
    <div class="decline-redirect" id="decline-redirect">Redirecting in 3s…</div>
  </div>
</div>

<!-- ══════════════════════════════════════
     STATS MODAL
══════════════════════════════════════ -->
<div class="sm-overlay" id="sm-overlay" onclick="smOutsideClick(event)">
  <div class="sm-modal" id="sm-modal">
    <div class="sm-head">
      <span class="sm-title">📊 API Call Analytics</span>
      <button class="sm-close" onclick="closeStatsPopup()">✕</button>
    </div>
    <div class="sm-circles">
      <div class="sm-circle-wrap">
        <div class="sm-ring-wrap">
          <svg class="sm-ring-svg" viewBox="0 0 112 112">
            <circle class="sm-ring-bg" cx="56" cy="56" r="46" stroke="rgba(74,222,128,.12)"/>
            <circle class="sm-ring-arc" id="sm-arc-s" cx="56" cy="56" r="46" stroke="#4ade80"/>
          </svg>
          <div class="sm-ring-center">
            <span class="sm-pct" id="sm-pct-s" style="color:#4ade80">—</span>
            <span class="sm-count" id="sm-cnt-s">success</span>
          </div>
        </div>
        <div class="sm-circle-lbl" style="color:#4ade80">Success</div>
      </div>
      <div class="sm-divider"></div>
      <div class="sm-circle-wrap">
        <div class="sm-ring-wrap">
          <svg class="sm-ring-svg" viewBox="0 0 112 112">
            <circle class="sm-ring-bg" cx="56" cy="56" r="46" stroke="rgba(255,68,68,.12)"/>
            <circle class="sm-ring-arc" id="sm-arc-e" cx="56" cy="56" r="46" stroke="#FF4444"/>
          </svg>
          <div class="sm-ring-center">
            <span class="sm-pct" id="sm-pct-e" style="color:#FF4444">—</span>
            <span class="sm-count" id="sm-cnt-e">errors</span>
          </div>
        </div>
        <div class="sm-circle-lbl" style="color:#FF4444">Errors</div>
      </div>
    </div>
    <div class="sm-mongo-row">
      <span id="sm-mongo-badge" class="sm-mongo-badge fallback">Connecting…</span>
    </div>
    <div class="sm-footer" id="sm-footer">— / — total · updated live</div>
  </div>
</div>

<!-- ══════════════════════════════════════
     TOPBAR
══════════════════════════════════════ -->
<nav class="topbar">
  <a class="topbar-logo" href="#">
    <div class="topbar-icon">
      <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
    </div>
    <span class="topbar-name">TubeFetch</span>
    <span class="topbar-tf">TF</span>
    <span class="topbar-ver">v${version}</span>
  </a>
  <div class="topbar-right">
    <div class="nav-links">
      <a href="#endpoints">Endpoints</a>
      <a href="#faq">FAQ</a>
      <a href="#about">About</a>
    </div>
    <div class="bell-wrap">
      <button class="bell-btn" id="bell-btn" onclick="toggleBell()" title="Changelog" aria-label="Open changelog">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        <span class="bell-dot" id="bell-dot"></span>
      </button>
      <div class="bell-panel" id="bell-panel" role="dialog" aria-label="Changelog">
        <div class="bell-head">
          <span class="bell-head-title">Changelog</span>
          <button class="bell-close" onclick="closeBell()" aria-label="Close changelog">✕</button>
        </div>
        <div class="bell-list">${clItems}</div>
      </div>
    </div>
  </div>
</nav>

<!-- ══════════════════════════════════════
     HERO
══════════════════════════════════════ -->
<div class="hero">
  <canvas id="hero-canvas" aria-hidden="true"></canvas>
  <div class="hero-content">
    <div class="hero-eyebrow"><span class="hero-eyebrow-stars">★★★★★</span> YouTube Downloader API</div>
    <h1>Tube<span class="hero-tf" data-text="Fetch">Fetch</span></h1>
    <div class="hero-sub">Real-time metadata &middot; MP4 HD &amp; MP3 download links &middot; Top 10 search results &middot; by MJL</div>
    <div class="hero-badges">
      <span class="hbadge">v${version}</span>
      <span class="hbadge">by MJL</span>
      <span class="hbadge">YouTube Only</span>
      <span class="hbadge">No Key Required</span>
    </div>
    <div class="stats-bar">
      <div class="stat-item stat-clickable" onclick="openStatsPopup()" title="View success &amp; error breakdown">
        <span class="stat-num red" id="stat-count">—<span class="db-dot fallback" id="db-dot" title="Connecting to MongoDB…"></span></span>
        <span class="stat-lbl">API Calls ↗</span>
      </div>
      <div class="stat-item">
        <span class="stat-num">v${version}</span>
        <span class="stat-lbl">Version</span>
      </div>
      <div class="stat-item">
        <span class="stat-num">5m</span>
        <span class="stat-lbl">Cache TTL</span>
      </div>
      <div class="stat-item">
        <span class="stat-num">3</span>
        <span class="stat-lbl">Endpoints</span>
      </div>
    </div>
  </div>
</div>

<!-- ══════════════════════════════════════
     MAIN
══════════════════════════════════════ -->
<div class="wrap">

  <div class="sec-label reveal" id="endpoints">⚡ Endpoints — click to expand &amp; test</div>
  <div class="ep-list">

    <!-- V1 -->
    <div class="ep-card reveal reveal-d1" id="ep0">
      <div class="ep-header" onclick="toggleEp(0)">
        <span class="ep-method">GET</span>
        <span class="ep-path">/api/v1/q?=(url or title)</span>
        <span class="ep-desc-label">Full metadata + downloads <span class="ep-badge-fast">auto</span></span>
        <span class="ep-chevron"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg></span>
      </div>
      <div class="ep-body">
        <div class="ep-body-inner">
          <p class="ep-info">Pass any YouTube <code>URL</code> or plain search title. Returns full metadata — <code>title</code>, <code>author</code>, <code>thumbnail</code>, <code>duration</code>, <code>views</code>, <code>likes</code>, <code>description</code>, <code>keywords</code>, <code>category</code>, <code>short_url</code> — plus direct <code>MP4 HD</code> &amp; <code>MP3</code> download links. Response includes <code>video_id</code>, <code>url</code>, <code>short_url</code>, <code>media.server</code>, <code>cached</code>, <code>ApiCount</code>, and <code>ms</code>. Uses <strong>auto mode</strong> (tries Server 1 → 2 → 3 in order). Pin to a specific server with <code>/api/v1/server=1/q?=…</code>, <code>/api/v1/server=2/q?=…</code>, or <code>/api/v1/server=3/q?=…</code> — Server 3 also returns <code>media.qualities[]</code> with every available stream.</p>
          <div class="ep-input-row">
            <input class="ep-input" id="q0" type="text" placeholder="e.g. bohemian rhapsody  or  https://youtu.be/…" onkeydown="if(event.key==='Enter')fetchEp(0)" autocomplete="off"/>
            <button class="ep-fetch-btn ripple-container" id="btn0" onclick="addRipple(event);fetchEp(0)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><span>Search</span>
            </button>
          </div>
          <div class="ep-skel" id="skel0">
            <div class="skel-line" style="width:55%;height:14px"></div>
            <div class="skel-line" style="width:30%"></div>
            <div class="skel-line" style="width:75%"></div>
            <div class="skel-line" style="width:68%"></div>
            <div class="skel-line" style="width:42%;height:30px;border-radius:8px;margin-top:4px"></div>
          </div>
          <div class="ep-result" id="res0">
            <div class="ep-result-meta">
              <span class="ep-status" id="stat0"></span>
              <span class="ep-ms" id="ms0"></span>
              <span class="ep-cached" id="cac0" style="display:none">⚡ Cached</span>
              <span class="ep-apicount" id="apc0"></span>
            </div>
            <div class="copy-url-strip" id="curl0" style="display:none">
              <code id="curl0-text"></code>
              <button class="copy-url-btn" onclick="copyUrl(0)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy URL
              </button>
            </div>
            <div class="r-card" id="rcard0" style="display:none">
              <div class="r-inner">
                <div class="r-thumb" id="r-thumb-wrap">
                  <img id="r-thumb-img" src="" alt="" class="r-thumb-img"/>
                  <span class="r-dur" id="r-dur" style="display:none"></span>
                  <span class="r-cached-badge" id="r-cached-b"></span>
                  <div class="r-play-overlay" id="r-play-overlay" onclick="startPreview()">
                    <div class="r-play-circle"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>
                    <span class="r-play-label">Preview</span>
                  </div>
                  <div class="r-countdown-wrap" id="r-countdown-wrap" style="display:none">
                    <svg class="r-ring-svg" viewBox="0 0 80 80">
                      <circle class="r-ring-bg" cx="40" cy="40" r="32"/>
                      <circle class="r-ring-arc" id="r-ring-arc" cx="40" cy="40" r="32"/>
                    </svg>
                    <span class="r-countdown-n" id="r-countdown-n">5</span>
                  </div>
                  <div class="r-yt-wrap" id="r-yt-wrap">
                    <div id="r-yt-player"></div>
                  </div>
                </div>
                <div class="r-body">
                  <div class="r-title" id="r-title"></div>
                  <a class="r-author" id="r-author" href="#" target="_blank" rel="noopener"></a>
                  <div class="r-stats" id="r-stats">
                    <span class="cat-badge" id="r-cat"></span>
                  </div>
                  <div class="r-desc-wrap" id="r-desc-wrap">
                    <div class="r-desc-text" id="r-desc"></div>
                    <button class="r-more" id="r-more" onclick="toggleDesc()">Read more</button>
                  </div>
                  <div class="r-dl" id="r-dl"></div>
                </div>
              </div>
            </div>
            <div class="json-actions">
              <span class="json-label">Raw Response</span>
              <button class="copy-btn" onclick="copyRaw(0)">Copy JSON</button>
            </div>
            <pre class="jbox" id="raw0"></pre>
          </div>
        </div>
      </div>
    </div>

    <!-- V2 -->
    <div class="ep-card reveal reveal-d2" id="ep3">
      <div class="ep-header" onclick="toggleEp(3)">
        <span class="ep-method v2">GET</span>
        <span class="ep-path">/api/v2/q?=(url or title)</span>
        <span class="ep-desc-label">Fast — title + links <span class="ep-badge-fast">⚡ auto</span></span>
        <span class="ep-chevron"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg></span>
      </div>
      <div class="ep-body">
        <div class="ep-body-inner">
          <p class="ep-info">The fastest download endpoint — returns the video <code>title</code> and direct <code>MP4</code> &amp; <code>MP3</code> download links with minimal overhead. Uses <strong>auto mode</strong> (tries Server 1 → 2 → 3 in order). Pin to a specific server with <code>/api/v2/server=1/q?=…</code>, <code>/api/v2/server=2/q?=…</code>, or <code>/api/v2/server=3/q?=…</code> — Server 3 also returns <code>media.qualities[]</code> with every available stream. Response: <code>credit</code>, <code>version</code>, <code>title</code>, <code>media.mp4</code>, <code>media.mp3</code>, <code>media.server</code>, <code>ApiCount</code>, <code>cached</code>, <code>ms</code>.</p>
          <div class="ep-input-row">
            <input class="ep-input" id="q3" type="text" placeholder="e.g. never gonna give you up  or  https://youtu.be/…" onkeydown="if(event.key==='Enter')fetchEp(3)" autocomplete="off"/>
            <button class="ep-fetch-btn ripple-container" id="btn3" onclick="addRipple(event);fetchEp(3)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><span>Search</span>
            </button>
          </div>
          <div class="ep-skel" id="skel3">
            <div class="skel-line" style="width:60%;height:14px"></div>
            <div class="skel-line" style="width:42%;height:30px;border-radius:8px;margin-top:4px"></div>
          </div>
          <div class="ep-result" id="res3">
            <div class="ep-result-meta">
              <span class="ep-status" id="stat3"></span>
              <span class="ep-ms" id="ms3"></span>
              <span class="ep-cached" id="cac3" style="display:none">⚡ Cached</span>
              <span class="ep-apicount" id="apc3"></span>
            </div>
            <div class="copy-url-strip" id="curl3" style="display:none">
              <code id="curl3-text"></code>
              <button class="copy-url-btn" onclick="copyUrl(3)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy URL
              </button>
            </div>
            <div class="v2-card" id="v2card" style="display:none">
              <div class="r-thumb" id="v2-thumb-wrap" style="display:none;margin-bottom:14px">
                <img id="v2-thumb-img" src="" alt="" class="r-thumb-img"/>
                <span class="r-dur" id="v2-dur" style="display:none"></span>
                <div class="r-play-overlay" id="v2-play-overlay" onclick="startV2Preview()">
                  <div class="r-play-circle"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>
                  <span class="r-play-label">Preview</span>
                </div>
                <div class="r-yt-wrap" id="v2-yt-wrap">
                  <div id="v2-yt-player"></div>
                </div>
              </div>
              <div class="v2-title" id="v2-title-el" style="display:none"></div>
              <div class="v2-label">Download Links</div>
              <div class="v2-dl" id="v2-dl"></div>
            </div>
            <div class="json-actions">
              <span class="json-label">Raw Response</span>
              <button class="copy-btn" onclick="copyRaw(3)">Copy JSON</button>
            </div>
            <pre class="jbox" id="raw3"></pre>
          </div>
        </div>
      </div>
    </div>

    <!-- V3 -->
    <div class="ep-card reveal reveal-d3" id="ep4">
      <div class="ep-header" onclick="toggleEp(4)">
        <span class="ep-method v3">GET</span>
        <span class="ep-path">/api/v3/q?=(title)&amp;?=(1–20)</span>
        <span class="ep-desc-label">Search results — 1 to 20 ranked <span class="ep-badge-new">★ New</span></span>
        <span class="ep-chevron"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg></span>
      </div>
      <div class="ep-body">
        <div class="ep-body-inner">
          <p class="ep-info">Returns <strong>1–20 ranked YouTube search results</strong> — default is 10. Add <code>&amp;?=N</code> to control how many you get (e.g. <code>/api/v3/q?=top hits&amp;?=20</code>). Each result includes <code>rank</code>, <code>video_id</code>, <code>url</code>, <code>short_url</code>, <code>title</code>, <code>description</code>, <code>channel_name</code>, <code>channel_url</code>, <code>published</code>, <code>duration</code>, <code>thumbnail</code>, <code>views</code>, <code>keywords</code>, and <code>category</code>. Response also includes <code>limit</code>, <code>total_results</code>, <code>cached</code>, <code>ApiCount</code>, and <code>ms</code>. YouTube URLs are rejected — use v1 or v2 for those.</p>
          <div class="ep-input-row">
            <input class="ep-input" id="q4" type="text" placeholder="e.g. top hits 2025  or  relaxing lofi music" onkeydown="if(event.key==='Enter')fetchEp(4)" autocomplete="off"/>
            <input class="ep-input" id="q4limit" type="number" min="1" max="20" placeholder="Limit (1–20)" style="max-width:130px;flex-shrink:0" onkeydown="if(event.key==='Enter')fetchEp(4)" autocomplete="off"/>
            <button class="ep-fetch-btn ripple-container" id="btn4" onclick="addRipple(event);fetchEp(4)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><span>Search</span>
            </button>
          </div>
          <div class="ep-skel" id="skel4">
            <div class="skel-line" style="width:70%;height:14px"></div>
            <div class="skel-line" style="width:55%"></div>
            <div class="skel-line" style="width:60%;height:14px"></div>
            <div class="skel-line" style="width:45%"></div>
          </div>
          <div class="ep-result" id="res4">
            <div class="ep-result-meta">
              <span class="ep-status" id="stat4"></span>
              <span class="ep-ms" id="ms4"></span>
              <span class="ep-apicount" id="apc4"></span>
            </div>
            <div class="copy-url-strip" id="curl4a" style="display:none">
              <code id="curl4a-text"></code>
              <button class="copy-url-btn" onclick="copyUrlV3('a')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy URL
              </button>
            </div>
            <div class="copy-url-strip" id="curl4b" style="display:none">
              <code id="curl4b-text"></code>
              <button class="copy-url-btn" onclick="copyUrlV3('b')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy with Limit
              </button>
            </div>
            <div class="v3-list" id="v3list" style="display:none"></div>
            <div class="json-actions">
              <span class="json-label">Raw Response</span>
              <button class="copy-btn" onclick="copyRaw(4)">Copy JSON</button>
            </div>
            <pre class="jbox" id="raw4"></pre>
          </div>
        </div>
      </div>
    </div>

    <!-- Uptime -->
    <div class="ep-card reveal reveal-d4" id="ep1">
      <div class="ep-header" onclick="toggleEp(1)">
        <span class="ep-method">GET</span>
        <span class="ep-path">/api/uptime</span>
        <span class="ep-desc-label">Server uptime &amp; status</span>
        <span class="ep-chevron"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg></span>
      </div>
      <div class="ep-body">
        <div class="ep-body-inner">
          <p class="ep-info">Returns the server uptime in seconds plus a status string. Includes <code>ApiCount</code>. Useful for monitoring or health dashboards.</p>
          <div class="ep-input-row">
            <button class="ep-fetch-btn ripple-container" id="btn1" onclick="addRipple(event);fetchEp(1)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg><span>Fetch</span>
            </button>
          </div>
          <div class="ep-skel" id="skel1"><div class="skel-line" style="width:55%"></div><div class="skel-line" style="width:38%"></div></div>
          <div class="ep-result" id="res1">
            <div class="ep-result-meta">
              <span class="ep-status" id="stat1"></span>
              <span class="ep-ms" id="ms1"></span>
              <span class="ep-apicount" id="apc1"></span>
            </div>
            <div class="copy-url-strip" id="curl1"><code id="curl1-text">/api/uptime</code><button class="copy-url-btn" onclick="copyUrl(1)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy URL</button></div>
            <div class="json-actions"><span class="json-label">Raw Response</span><button class="copy-btn" onclick="copyRaw(1)">Copy JSON</button></div>
            <pre class="jbox" id="raw1"></pre>
          </div>
        </div>
      </div>
    </div>

    <!-- Health -->
    <div class="ep-card reveal" id="ep2">
      <div class="ep-header" onclick="toggleEp(2)">
        <span class="ep-method">GET</span>
        <span class="ep-path">/api/healthz</span>
        <span class="ep-desc-label">Health check</span>
        <span class="ep-chevron"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg></span>
      </div>
      <div class="ep-body">
        <div class="ep-body-inner">
          <p class="ep-info">Simple liveness probe. Returns <code>ok</code> when the server is healthy. Includes <code>ApiCount</code>. Used by Render, Replit, and Vercel.</p>
          <div class="ep-input-row">
            <button class="ep-fetch-btn ripple-container" id="btn2" onclick="addRipple(event);fetchEp(2)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg><span>Fetch</span>
            </button>
          </div>
          <div class="ep-skel" id="skel2"><div class="skel-line" style="width:38%"></div></div>
          <div class="ep-result" id="res2">
            <div class="ep-result-meta">
              <span class="ep-status" id="stat2"></span>
              <span class="ep-ms" id="ms2"></span>
              <span class="ep-apicount" id="apc2"></span>
            </div>
            <div class="copy-url-strip" id="curl2"><code id="curl2-text">/api/healthz</code><button class="copy-url-btn" onclick="copyUrl(2)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy URL</button></div>
            <div class="json-actions"><span class="json-label">Raw Response</span><button class="copy-btn" onclick="copyRaw(2)">Copy JSON</button></div>
            <pre class="jbox" id="raw2"></pre>
          </div>
        </div>
      </div>
    </div>

  </div><!-- /ep-list -->

  <!-- FAQ -->
  <div class="sec-label reveal" id="faq">❓ Frequently Asked Questions</div>
  <div class="faq-list reveal">${faqItems}</div>
  <button class="faq-showmore-btn" id="faq-showmore-btn" onclick="toggleFaqExpand()">Show all ${FAQS.length} questions ›</button>

  <div class="card about reveal" id="about">
    <div class="card-title">About TubeFetch</div>
    <p>Pass any YouTube URL or plain search title to <code>/api/v1/q</code> for full metadata or <code>/api/v2/q</code> for a faster response with the title and download links. Both endpoints run in <strong>auto mode</strong> by default — trying Server 1 (btch-downloader), Server 2 (nayan), then Server 3 (youtubei.js) in order until one succeeds. Pin to a specific server with <code>/api/v1/server=3/q?=…</code> or <code>/api/v2/server=3/q?=…</code>. Server 3 returns a full <code>media.qualities[]</code> list with every available stream at every resolution. Use <code>/api/v3/q</code> to get a ranked list of 1–20 search results (default 10 — add <code>&amp;?=N</code> to control the count). Results are cached for <strong>5 minutes</strong>. Every response includes a <strong>ms</strong> timing field and an <strong>ApiCount</strong>.</p>
  </div>

  <div class="card disc reveal" id="disclaimer">
    <div class="card-title">Copyright Disclaimer</div>
    <p>Copyright &copy; 2024&ndash;2026 <strong>MJL</strong>. All rights reserved. Protected under the <strong>Philippine Intellectual Property Code (RA 8293, as amended by RA 10372)</strong>, the <strong>Berne Convention</strong>, the <strong>WIPO Copyright Treaty</strong>, <strong>TRIPS</strong>, the <strong>DMCA</strong>, and equivalent copyright laws in all jurisdictions worldwide. This project is provided for <strong>educational and personal use only</strong>. Downloading copyrighted content without authorization may violate YouTube&rsquo;s Terms of Service and applicable copyright laws in your jurisdiction. The developer (<strong>MJL</strong>) accepts no liability for any misuse. All media content belongs to its respective owners. &nbsp;<a class="disc-link" href="/disclaimer" target="_blank" rel="noopener noreferrer">Read Full Legal Disclaimer &rarr;</a></p>
  </div>

</div><!-- /wrap -->

<footer>
  <p>&copy; 2026 <strong>MJL</strong> &middot; <span class="tf">TubeFetch</span> <strong>v${version}</strong> &middot; For educational purposes only</p>
  <div class="host-badge" id="host-badge"></div>
</footer>

<script>
/* ════════════════════════════════
   CURSOR
════════════════════════════════ */
(function(){
  var cur=document.getElementById('tf-cursor');
  if(!cur||window.matchMedia('(hover:none)').matches)return;
  var cx=0,cy=0,tx=0,ty=0,raf;
  document.addEventListener('mousemove',function(e){ tx=e.clientX; ty=e.clientY; });
  function loop(){
    cx+=(tx-cx)*.14; cy+=(ty-cy)*.14;
    cur.style.transform='translate3d('+(cx-10)+'px,'+(cy-10)+'px,0)';
    raf=requestAnimationFrame(loop);
  }
  loop();
  document.querySelectorAll('a,button,input,textarea,.ep-header,.faq-q,.stat-item,.hbadge').forEach(function(el){
    el.addEventListener('mouseenter',function(){ cur.classList.add('hovering'); });
    el.addEventListener('mouseleave',function(){ cur.classList.remove('hovering'); });
  });
})();

/* ════════════════════════════════
   RIPPLE
════════════════════════════════ */
function addRipple(e){
  var btn=e.currentTarget;
  var rect=btn.getBoundingClientRect();
  var r=document.createElement('span');
  var d=Math.max(btn.offsetWidth,btn.offsetHeight);
  r.className='ripple-el';
  r.style.cssText='width:'+d+'px;height:'+d+'px;left:'+(e.clientX-rect.left-d/2)+'px;top:'+(e.clientY-rect.top-d/2)+'px';
  btn.appendChild(r);
  setTimeout(function(){ r.remove(); },700);
}

/* ════════════════════════════════
   INTRO
════════════════════════════════ */
var introSkipped=false;
(function(){
  var bar=document.getElementById('i-bar');
  var counterEl=document.getElementById('i-counter');
  var reducedMotion=window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  requestAnimationFrame(function(){ requestAnimationFrame(function(){
    if(bar) bar.style.width='100%';
  }); });
  if(counterEl && !reducedMotion){
    var cnt=0;
    var cntIntvl=setInterval(function(){
      cnt=Math.min(100,cnt+1);
      counterEl.textContent=cnt+'%';
      if(cnt>=100) clearInterval(cntIntvl);
    },36);
  }
  var timer=setTimeout(function(){ if(!introSkipped) endIntro(); }, 5000);
  window._introTimer=timer;
})();
function endIntro(){
  var intro=document.getElementById('intro');
  if(!intro||intro.style.display==='none')return;
  var reducedMotion=window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  if(reducedMotion){ intro.style.display='none'; showTerms(); return; }
  var wrap=intro.querySelector('.i-wrap');
  if(wrap){ wrap.style.transition='opacity .25s ease'; wrap.style.opacity='0'; }
  var scanline=document.getElementById('intro-scanline');
  if(scanline) scanline.style.display='none';
  setTimeout(function(){
    intro.classList.add('splitting');
    setTimeout(function(){ intro.style.display='none'; showTerms(); }, 740);
  }, 180);
}

/* ════════════════════════════════
   TERMS
════════════════════════════════ */
function showTerms(){
  var o=document.getElementById('terms-overlay');
  o.classList.add('show');
}
function acceptTerms(){
  var o=document.getElementById('terms-overlay');
  o.classList.remove('show'); o.classList.add('out');
  setTimeout(function(){ o.style.display='none'; o.classList.remove('out'); initParticles(); initReveal(); fetchStats(); }, 320);
}
function declineTerms(){
  var o=document.getElementById('terms-overlay');
  o.classList.remove('show'); o.style.display='none';
  var d=document.getElementById('decline-overlay');
  d.classList.add('show');
  requestAnimationFrame(function(){ requestAnimationFrame(function(){
    var b=document.getElementById('decline-bar'); if(b) b.style.width='100%';
  }); });
  var secs=3;
  var ri=setInterval(function(){
    secs--;
    var el=document.getElementById('decline-redirect');
    if(el) el.textContent='Redirecting in '+secs+'s\u2026';
    if(secs<=0){ clearInterval(ri); window.location.href='https://www.google.com'; }
  },1000);
}

/* ════════════════════════════════
   LIVE STATS
════════════════════════════════ */
function fetchStats(){
  fetch('/api/stats').then(function(r){ return r.json(); }).then(function(d){
    var el=document.getElementById('stat-count');
    var dot=document.getElementById('db-dot');
    if(el&&typeof d.ApiCount==='number'){
      el.childNodes[0].nodeValue=d.ApiCount.toLocaleString();
    }
    if(dot){
      var connected=d.mongoConnected===true;
      var status=d.mongoStatus||'unknown';
      dot.className='db-dot '+(connected?'connected':(status==='failed'||status==='no-uri'?'failed':'fallback'));
      dot.title=connected?'MongoDB connected — counts persist across restarts':'MongoDB '+status+' — counts are in-memory only';
    }
  }).catch(function(){});
}
setInterval(fetchStats,5000);

/* ════════════════════════════════
   PARTICLES
════════════════════════════════ */
var PCV,PCTX,PW,PH,PARTS=[],MOUSE={x:-9999,y:-9999},RAF_RUNNING=false;
function initParticles(){
  PCV=document.getElementById('hero-canvas');
  if(!PCV)return;
  var hero=PCV.parentElement;
  PCTX=PCV.getContext('2d');
  PW=PCV.width=hero.offsetWidth;
  PH=PCV.height=hero.offsetHeight;
  PARTS=[];
  var count=PW<640?20:35;
  for(var i=0;i<count;i++){
    PARTS.push({
      x:Math.random()*PW,y:Math.random()*PH,
      vx:(Math.random()-.5)*.5,vy:(Math.random()-.5)*.5,
      r:Math.random()*1.6+.4,a:Math.random()*.2+.06
    });
  }
  hero.addEventListener('mousemove',function(e){ var rect=hero.getBoundingClientRect(); MOUSE.x=e.clientX-rect.left; MOUSE.y=e.clientY-rect.top; });
  hero.addEventListener('mouseleave',function(){ MOUSE.x=-9999; MOUSE.y=-9999; });
  window.addEventListener('resize',function(){ PW=PCV.width=hero.offsetWidth; PH=PCV.height=hero.offsetHeight; });
  if(!RAF_RUNNING){ RAF_RUNNING=true; tickParticles(); }
}
var _ptLastT=0;
var _ptLines=window.innerWidth>=640;
function tickParticles(ts){
  requestAnimationFrame(tickParticles);
  if(document.hidden) return;
  if(ts-_ptLastT<33) return;
  _ptLastT=ts;
  PCTX.clearRect(0,0,PW,PH);
  for(var i=0;i<PARTS.length;i++){
    var p=PARTS[i];
    var mx=p.x-MOUSE.x,my=p.y-MOUSE.y,md=Math.sqrt(mx*mx+my*my);
    if(md<100&&md>0){ var f=(100-md)/100*.045; p.vx+=mx/md*f; p.vy+=my/md*f; }
    var sp=Math.sqrt(p.vx*p.vx+p.vy*p.vy);
    if(sp>1.5){ p.vx=p.vx/sp*1.5; p.vy=p.vy/sp*1.5; }
    p.x+=p.vx; p.y+=p.vy;
    if(p.x<0){p.x=0;p.vx*=-1;} if(p.x>PW){p.x=PW;p.vx*=-1;}
    if(p.y<0){p.y=0;p.vy*=-1;} if(p.y>PH){p.y=PH;p.vy*=-1;}
    PCTX.beginPath(); PCTX.arc(p.x,p.y,p.r,0,6.2832);
    PCTX.fillStyle='rgba(255,255,255,'+p.a+')'; PCTX.fill();
    if(_ptLines){
      for(var j=i+1;j<PARTS.length;j++){
        var q=PARTS[j],dx=p.x-q.x,dy=p.y-q.y,d=Math.sqrt(dx*dx+dy*dy);
        if(d<120){
          PCTX.beginPath(); PCTX.moveTo(p.x,p.y); PCTX.lineTo(q.x,q.y);
          PCTX.strokeStyle='rgba(255,80,80,'+(0.1*(1-d/120))+')';
          PCTX.lineWidth=.7; PCTX.stroke();
        }
      }
    }
  }
}

/* ════════════════════════════════
   SCROLL REVEAL
════════════════════════════════ */
function initReveal(){
  var els=document.querySelectorAll('.reveal');
  if(!('IntersectionObserver' in window)){ els.forEach(function(el){ el.classList.add('in-view'); }); return; }
  var io=new IntersectionObserver(function(entries){ entries.forEach(function(e){ if(e.isIntersecting) e.target.classList.add('in-view'); }); },{threshold:.07});
  els.forEach(function(el){ io.observe(el); });
}

/* ════════════════════════════════
   BELL
════════════════════════════════ */
var bellOpen=false;
function toggleBell(){ bellOpen?closeBell():openBell(); }
function openBell(){
  var p=document.getElementById('bell-panel'),b=document.getElementById('bell-btn');
  bellOpen=true; b.classList.add('active');
  document.getElementById('bell-dot').style.display='none';
  p.classList.remove('closing'); p.classList.add('opening');
  setTimeout(function(){ p.classList.remove('opening'); p.classList.add('open'); },240);
  setTimeout(function(){ document.addEventListener('click',bellOutside,true); },10);
}
function closeBell(){
  var p=document.getElementById('bell-panel'),b=document.getElementById('bell-btn');
  bellOpen=false; b.classList.remove('active');
  document.removeEventListener('click',bellOutside,true);
  p.classList.remove('open','opening'); p.classList.add('closing');
  setTimeout(function(){ p.classList.remove('closing'); },180);
}
function bellOutside(e){ if(!document.querySelector('.bell-wrap').contains(e.target)) closeBell(); }

/* ════════════════════════════════
   ACCORDION
════════════════════════════════ */
function toggleEp(n){ document.getElementById('ep'+n).classList.toggle('open'); }

/* ════════════════════════════════
   FAQ
════════════════════════════════ */
function toggleFaq(i){ document.getElementById('faq'+i).classList.toggle('open'); }
var _faqExpanded=false;
var _faqTimer=null;
function toggleFaqExpand(){
  _faqExpanded=!_faqExpanded;
  var items=document.querySelectorAll('.faq-item');
  items.forEach(function(el,i){
    if(i>=5){
      if(_faqExpanded) el.classList.remove('faq-hidden');
      else { el.classList.add('faq-hidden'); el.classList.remove('open'); }
    }
  });
  var btn=document.getElementById('faq-showmore-btn');
  if(btn) btn.textContent=_faqExpanded?'Show less ↑':'Show all '+items.length+' questions ›';
  if(_faqTimer){ clearTimeout(_faqTimer); _faqTimer=null; }
  if(_faqExpanded){
    _faqTimer=setTimeout(function(){
      _faqExpanded=true; toggleFaqExpand();
    }, 5*60*1000);
  }
}

/* ════════════════════════════════
   STATS POPUP
════════════════════════════════ */
function openStatsPopup(){
  var ov=document.getElementById('sm-overlay');
  ov.classList.add('open');
  fetch('/api/stats').then(function(r){ return r.json(); }).then(function(d){
    var total=d.ApiCount||0;
    var succ=d.successCount||0;
    var err=d.errorCount||0;
    var sp=total>0?Math.round(succ/total*100):0;
    var ep=total>0?Math.round(err/total*100):0;
    document.getElementById('sm-pct-s').textContent=sp+'%';
    document.getElementById('sm-cnt-s').textContent=succ+' calls';
    document.getElementById('sm-pct-e').textContent=ep+'%';
    document.getElementById('sm-cnt-e').textContent=err+' calls';
    document.getElementById('sm-footer').textContent=total.toLocaleString()+' total · updated live';
    var arcS=document.getElementById('sm-arc-s');
    var arcE=document.getElementById('sm-arc-e');
    var circ=289;
    requestAnimationFrame(function(){ requestAnimationFrame(function(){
      if(arcS) arcS.style.strokeDashoffset=String(circ-(circ*sp/100));
      if(arcE) arcE.style.strokeDashoffset=String(circ-(circ*ep/100));
    }); });
    var connected=d.mongoConnected===true;
    var status=d.mongoStatus||'unknown';
    var badge=document.getElementById('sm-mongo-badge');
    if(badge){
      var cls=connected?'connected':(status==='failed'||status==='no-uri'?'failed':'fallback');
      badge.className='sm-mongo-badge '+cls;
      badge.textContent=connected?'MongoDB Connected':(status==='no-uri'?'No URI Set':'In-Memory Fallback');
    }
  }).catch(function(){});
}
function closeStatsPopup(){ document.getElementById('sm-overlay').classList.remove('open'); }
function smOutsideClick(e){ if(e.target===document.getElementById('sm-overlay')) closeStatsPopup(); }

/* ════════════════════════════════
   STATE
════════════════════════════════ */
var rawStore={0:'',1:'',2:'',3:'',4:''};
var urlStore={0:'',1:'',2:'',3:'',4:''};
var urlStore4a='';
var urlStore4b='';
var descExpanded=false;
var v1VideoId='';
var ytPlayerInstance=null;
var v2VideoId='';
var v2YtPlayer=null;
var ytApiReady=false;
var ytApiCallbacks=[];
var cdTimer=null,cdInterval=null;

/* ════════════════════════════════
   UTILS
════════════════════════════════ */
function sv(id,vis,t){ var el=document.getElementById(id); if(el) el.style.display=vis?(t||'block'):'none'; }
function fmtViews(n){
  if(!n)return null;
  if(n>=1e9)return(n/1e9).toFixed(1).replace(/\\.0$/,'')+'B views';
  if(n>=1e6)return(n/1e6).toFixed(1).replace(/\\.0$/,'')+'M views';
  if(n>=1e3)return(n/1e3).toFixed(1).replace(/\\.0$/,'')+'K views';
  return n.toLocaleString()+' views';
}
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function hl(raw){
  var e=function(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); };
  return e(raw).replace(
    /("(?:[^"\\\\]|\\\\.)*")(\\s*:)|("(?:[^"\\\\]|\\\\.)*")|(\\b\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?\\b)|(\\btrue\\b|\\bfalse\\b|\\bnull\\b)/g,
    function(_,key,col,str,num,bool){
      if(key)return'<span class="jk">'+key+'</span>'+col;
      if(str)return'<span class="js">'+str+'</span>';
      if(num)return'<span class="jn">'+num+'</span>';
      if(bool)return'<span class="jb">'+bool+'</span>';
      return _;
    }
  );
}
function dlIcon(){ return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>'; }
function copyRaw(n){
  if(!rawStore[n])return;
  navigator.clipboard.writeText(rawStore[n]).then(function(){
    var b=document.querySelector('#res'+n+' .copy-btn');
    if(b){ var o=b.textContent; b.textContent='Copied!'; setTimeout(function(){ b.textContent=o; },1500); }
  });
}
function copyUrl(n){
  var u=urlStore[n]||document.getElementById('curl'+n+'-text')&&document.getElementById('curl'+n+'-text').textContent;
  if(!u)return;
  navigator.clipboard.writeText(u).then(function(){
    var b=document.querySelector('#curl'+n+' .copy-url-btn');
    if(b){ var h=b.innerHTML; b.textContent='Copied!'; setTimeout(function(){ b.innerHTML=h; },1500); }
  });
}
function copyUrlV3(which){
  var u=which==='b'?urlStore4b:urlStore4a;
  if(!u)return;
  navigator.clipboard.writeText(window.location.origin+u).then(function(){
    var id=which==='b'?'curl4b':'curl4a';
    var b=document.querySelector('#'+id+' .copy-url-btn');
    if(b){ var h=b.innerHTML; b.textContent='Copied!'; setTimeout(function(){ b.innerHTML=h; },1500); }
  });
}
function showApiCount(n,data){
  var el=document.getElementById('apc'+n);
  if(!el)return;
  if(typeof data==='object'&&data&&typeof data.ApiCount==='number'){
    el.textContent='Call #'+data.ApiCount;
    el.style.display='inline-flex';
    var sc=document.getElementById('stat-count');
    if(sc) sc.childNodes[0].nodeValue=data.ApiCount.toLocaleString();
  } else { el.style.display='none'; }
}

/* ════════════════════════════════
   V3 RESULT LIST
════════════════════════════════ */
function renderV3List(results){
  var list=document.getElementById('v3list');
  if(!list)return;
  if(!results||!results.length){
    list.innerHTML='<div style="font-size:.8rem;color:var(--text4);padding:8px 0">No results found.</div>';
    sv('v3list',true,'block'); return;
  }
  var html='';
  for(var i=0;i<results.length;i++){
    var v=results[i];
    var thumb=esc(v.thumbnail||'');
    var title=esc(v.title||'');
    var chanName=esc(v.channel_name||'');
    var chanUrl=esc(v.channel_url||'#');
    var dur=esc(v.duration||'');
    var views=v.views?fmtViews(v.views):'';
    var date=esc(v.published||'');
    var cat=esc(v.category||'');
    var url=esc(v.url||'#');
    var desc=v.description?esc(v.description.slice(0,120)):'';
    html+='<div class="v3-item">';
    html+='<div class="v3-num">'+(i+1)+'</div>';
    html+='<div class="v3-thumb-wrap"><img class="v3-thumb-img" src="'+thumb+'" alt="" loading="lazy"/>';
    if(dur) html+='<span class="v3-dur-badge">'+dur+'</span>';
    html+='</div>';
    html+='<div class="v3-info">';
    html+='<a class="v3-title" href="'+url+'" target="_blank" rel="noopener noreferrer">'+title+'</a>';
    html+='<a class="v3-channel" href="'+chanUrl+'" target="_blank" rel="noopener noreferrer">'+chanName+'</a>';
    html+='<div class="v3-meta-row">';
    if(views) html+='<span class="v3-views">'+views+'</span>';
    if(date) html+='<span class="v3-date">'+date+'</span>';
    if(cat) html+='<span class="v3-cat-badge">'+cat+'</span>';
    html+='</div>';
    if(desc) html+='<div class="v3-desc">'+desc+'</div>';
    html+='</div></div>';
  }
  list.innerHTML=html; sv('v3list',true,'block');
}

/* ════════════════════════════════
   V2 VIDEO PREVIEW
════════════════════════════════ */
function resetV2Preview(){
  if(v2YtPlayer){ try{ v2YtPlayer.destroy(); }catch(e){} v2YtPlayer=null; }
  var pd=document.getElementById('v2-yt-player'); if(pd) pd.innerHTML='';
  sv('v2-yt-wrap',false); sv('v2-play-overlay',true,'flex');
  var img=document.getElementById('v2-thumb-img'); if(img){ img.style.opacity='1'; img.style.transition=''; }
}
function startV2Preview(){
  if(!v2VideoId)return;
  sv('v2-play-overlay',false);
  var img=document.getElementById('v2-thumb-img');
  if(img){ img.style.transition='opacity .5s ease'; img.style.opacity='0'; }
  var wrap=document.getElementById('v2-yt-wrap'); if(wrap) wrap.style.display='block';
  withYtApi(function(){
    if(v2YtPlayer){ try{ v2YtPlayer.destroy(); }catch(e){} v2YtPlayer=null; }
    var pd=document.getElementById('v2-yt-player'); if(pd) pd.innerHTML='';
    v2YtPlayer=new YT.Player('v2-yt-player',{
      videoId:v2VideoId,width:'100%',height:'100%',
      playerVars:{autoplay:1,rel:0,modestbranding:1,playsinline:1,controls:1},
      events:{onReady:function(e){ e.target.playVideo(); }}
    });
  });
}

/* ════════════════════════════════
   VIDEO PREVIEW
════════════════════════════════ */
function resetVideoPreview(){
  clearTimers();
  sv('r-play-overlay',true,'flex'); sv('r-countdown-wrap',false); sv('r-yt-wrap',false);
  var arc=document.getElementById('r-ring-arc');
  if(arc){ arc.style.transition='none'; arc.style.strokeDashoffset='201'; }
  if(ytPlayerInstance){ try{ ytPlayerInstance.destroy(); }catch(e){} ytPlayerInstance=null; }
  var pd=document.getElementById('r-yt-player'); if(pd) pd.innerHTML='';
  var img=document.getElementById('r-thumb-img'); if(img) img.style.opacity='1';
}
function clearTimers(){ if(cdTimer){clearTimeout(cdTimer);cdTimer=null;} if(cdInterval){clearInterval(cdInterval);cdInterval=null;} }
function startPreview(){
  if(!v1VideoId)return;
  sv('r-play-overlay',false); sv('r-countdown-wrap',true,'flex');
  document.getElementById('r-countdown-n').textContent='5';
  var img=document.getElementById('r-thumb-img'); if(img) img.style.opacity='.3';
  var arc=document.getElementById('r-ring-arc');
  arc.style.transition='none'; arc.style.strokeDashoffset='201';
  requestAnimationFrame(function(){ requestAnimationFrame(function(){ arc.style.transition='stroke-dashoffset 5s linear'; arc.style.strokeDashoffset='0'; }); });
  var secs=4;
  cdInterval=setInterval(function(){ document.getElementById('r-countdown-n').textContent=String(secs); secs--; if(secs<0){clearInterval(cdInterval);cdInterval=null;} },1000);
  cdTimer=setTimeout(function(){ launchVideo(); },5000);
}
function launchVideo(){
  sv('r-countdown-wrap',false);
  var img=document.getElementById('r-thumb-img');
  if(img){ img.style.transition='opacity .5s ease'; img.style.opacity='0'; }
  var wrap=document.getElementById('r-yt-wrap'); wrap.style.display='block';
  withYtApi(function(){
    if(ytPlayerInstance){ try{ ytPlayerInstance.destroy(); }catch(e){} ytPlayerInstance=null; }
    var pd=document.getElementById('r-yt-player'); if(pd) pd.innerHTML='';
    ytPlayerInstance=new YT.Player('r-yt-player',{
      videoId:v1VideoId,width:'100%',height:'100%',
      playerVars:{autoplay:1,rel:0,modestbranding:1,playsinline:1,controls:1},
      events:{onReady:function(e){ e.target.playVideo(); }}
    });
  });
}
function withYtApi(cb){
  if(ytApiReady){ cb(); return; }
  ytApiCallbacks.push(cb);
  if(!document.getElementById('yt-iframe-api')){
    var s=document.createElement('script');
    s.id='yt-iframe-api'; s.src='https://www.youtube.com/iframe_api';
    document.head.appendChild(s);
  }
}
window.onYouTubeIframeAPIReady=function(){
  ytApiReady=true;
  ytApiCallbacks.forEach(function(cb){ cb(); });
  ytApiCallbacks=[];
};

/* ════════════════════════════════
   DESC TOGGLE
════════════════════════════════ */
function toggleDesc(){
  descExpanded=!descExpanded;
  document.getElementById('r-desc').classList.toggle('exp',descExpanded);
  document.getElementById('r-more').textContent=descExpanded?'Show less':'Read more';
  if(!descExpanded){ setTimeout(function(){ var c=document.getElementById('rcard0'); if(c) c.scrollIntoView({behavior:'smooth',block:'nearest'}); },50); }
}


/* ════════════════════════════════
   BTN RESET
════════════════════════════════ */
function setBtnDefault(n){
  var btn=document.getElementById('btn'+n); if(!btn)return;
  btn.disabled=false;
  var isSearch=(n===0||n===3||n===4);
  btn.innerHTML=isSearch
    ?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><span>Search</span>'
    :'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg><span>Fetch</span>';
}

/* ════════════════════════════════
   FETCH
════════════════════════════════ */
async function fetchEp(n){
  var btn=document.getElementById('btn'+n); if(!btn)return;
  btn.disabled=true;
  btn.innerHTML=(n===0||n===3||n===4)
    ?'<span>Searching\u2026</span>'
    :'<span>Fetching\u2026</span>';

  sv('skel'+n,true,'flex'); sv('res'+n,false);
  if(n===0){ sv('rcard0',false); sv('curl0',false); resetVideoPreview(); }
  if(n===3){ sv('v2card',false); sv('curl3',false); resetV2Preview(); }
  if(n===4){ sv('v3list',false); sv('curl4a',false); sv('curl4b',false); }

  var url;
  if(n===0){
    var q=document.getElementById('q0').value.trim();
    if(!q){ setBtnDefault(n); sv('skel'+n,false,'flex'); return; }
    url='/api/v1/q?='+encodeURIComponent(q);
  } else if(n===3){
    var q3=document.getElementById('q3').value.trim();
    if(!q3){ setBtnDefault(n); sv('skel'+n,false,'flex'); return; }
    url='/api/v2/q?='+encodeURIComponent(q3);
  } else if(n===4){
    var q4=document.getElementById('q4').value.trim();
    if(!q4){ setBtnDefault(n); sv('skel'+n,false,'flex'); return; }
    var lim4=document.getElementById('q4limit').value.trim();
    var lim4n=parseInt(lim4,10);
    if(lim4&&(isNaN(lim4n)||lim4n<1||lim4n>20)){ setBtnDefault(n); sv('skel'+n,false,'flex'); return; }
    url='/api/v3/q?='+encodeURIComponent(q4)+(lim4?'&?='+lim4n:'');
  } else if(n===1){
    url='/api/uptime';
  } else {
    url='/api/healthz';
  }

  urlStore[n]=window.location.origin+url;
  var t0=Date.now();
  try{
    var resp=await fetch(url);
    var clientMs=Date.now()-t0;
    var text=await resp.text();
    var data; try{ data=JSON.parse(text); }catch(e){ data=text; }
    rawStore[n]=typeof data==='string'?data:JSON.stringify(data,null,2);
    sv('skel'+n,false,'flex');
    var statEl=document.getElementById('stat'+n);
    statEl.textContent=resp.ok?'200 OK':(resp.status+' Error');
    statEl.className='ep-status '+(resp.ok?'ok':'err');
    var sms=(typeof data==='object'&&data&&typeof data.ms==='number')?data.ms:null;
    document.getElementById('ms'+n).textContent=sms!==null?(sms+'ms server'):(clientMs+'ms');
    var cacEl=document.getElementById('cac'+n);
    if(cacEl) cacEl.style.display=(typeof data==='object'&&data&&data.cached)?'inline-flex':'none';
    showApiCount(n,data);
    if(n===4){
      var q4raw=document.getElementById('q4').value.trim();
      var lim4raw=document.getElementById('q4limit').value.trim();
      var lim4num=parseInt(lim4raw,10);
      var base4='/api/v3/q?='+encodeURIComponent(q4raw);
      var hasLimit=lim4raw&&!isNaN(lim4num);
      urlStore4a=base4;
      urlStore4b=base4+'&?='+(hasLimit?lim4num:10);
      var el4a=document.getElementById('curl4a-text'); if(el4a) el4a.textContent=base4;
      var el4b=document.getElementById('curl4b-text'); if(el4b) el4b.textContent=base4+'&?='+(hasLimit?lim4num:10);
      if(resp.ok){
        sv('curl4a',!hasLimit,'flex');
        sv('curl4b',!!hasLimit,'flex');
      }
    } else {
      var curlTextEl=document.getElementById('curl'+n+'-text');
      if(curlTextEl) curlTextEl.textContent=url;
      if(n===0||n===3) sv('curl'+n,resp.ok,'flex');
    }
    document.getElementById('raw'+n).innerHTML=typeof data==='string'?data:hl(rawStore[n]);
    sv('res'+n,true,'block');

    /* ── V1 rich card ── */
    if(n===0&&typeof data==='object'&&data&&data.success){
      var info=data.info||{};
      var media=data.media||{};
      v1VideoId=data.video_id||'';
      var thumbEl=document.getElementById('r-thumb-img');
      thumbEl.src=info.thumbnail||''; thumbEl.alt=info.title||'';
      thumbEl.style.opacity='1'; thumbEl.style.transition='opacity .55s ease';
      sv('r-play-overlay',!!v1VideoId,'flex');
      var durEl=document.getElementById('r-dur');
      durEl.textContent=info.duration||'';
      durEl.style.display=info.duration?'inline-block':'none';
      var cbEl=document.getElementById('r-cached-b');
      if(cbEl){ cbEl.textContent=data.cached?'\u26a1 Cached':''; cbEl.style.display=data.cached?'inline-flex':'none'; }
      document.getElementById('r-title').textContent=info.title||'';
      var authEl=document.getElementById('r-author');
      authEl.textContent=info.author||'';
      authEl.href=info.channel_url||'#';
      authEl.style.display=info.author?'block':'none';
      var statsEl=document.getElementById('r-stats');
      var viewsHtml='';
      if(info.views) viewsHtml+='<span class="r-stat">'+fmtViews(info.views)+'</span>';
      if(info.published) viewsHtml+='<span class="r-stat">'+esc(info.published)+'</span>';
      if(info.duration_seconds) viewsHtml+='<span class="r-stat">'+esc(info.duration)+'</span>';
      statsEl.innerHTML=viewsHtml+'<span class="cat-badge" id="r-cat"></span>';
      var catEl=document.getElementById('r-cat');
      if(catEl&&data.category){ catEl.textContent=data.category; catEl.style.display='inline-flex'; }
      var descEl=document.getElementById('r-desc');
      var descWrap=document.getElementById('r-desc-wrap');
      if(info.description&&info.description.trim()){
        descEl.textContent=info.description; descWrap.style.display='block'; descExpanded=false;
        descEl.classList.remove('exp'); document.getElementById('r-more').textContent='Read more';
      } else { descWrap.style.display='none'; }
      var dlEl=document.getElementById('r-dl');
      var dlHtml='';
      if(media.mp4&&media.mp4.url) dlHtml+='<a class="dl-btn dl-mp4" href="'+esc(media.mp4.url)+'" target="_blank" rel="noopener noreferrer">'+dlIcon()+' MP4 HD</a>';
      if(media.mp3&&media.mp3.url) dlHtml+='<a class="dl-btn dl-mp3" href="'+esc(media.mp3.url)+'" target="_blank" rel="noopener noreferrer">'+dlIcon()+' MP3</a>';
      if(!dlHtml) dlHtml='<span class="dl-none">No download links available.</span>';
      dlEl.innerHTML=dlHtml;
      sv('rcard0',true,'block');
    }

    /* ── V2 quick card ── */
    if(n===3&&typeof data==='object'&&data&&data.media){
      var m=data.media;
      v2VideoId=data.video_id||'';
      var v2ThEl=document.getElementById('v2-thumb-img');
      if(v2ThEl&&data.thumbnail){
        v2ThEl.src=data.thumbnail; v2ThEl.alt=data.title||''; v2ThEl.style.opacity='1';
        sv('v2-play-overlay',!!v2VideoId,'flex');
        sv('v2-thumb-wrap',true,'block');
        var v2DurEl=document.getElementById('v2-dur');
        if(v2DurEl){ v2DurEl.textContent=data.duration||''; v2DurEl.style.display=data.duration?'inline-block':'none'; }
      } else { sv('v2-thumb-wrap',false); }
      var titleEl=document.getElementById('v2-title-el');
      if(titleEl){ if(data.title){ titleEl.textContent=data.title; titleEl.style.display='block'; } else { titleEl.style.display='none'; } }
      var v2html='';
      if(m.mp4) v2html+='<a class="dl-btn dl-mp4" href="'+esc(m.mp4)+'" target="_blank" rel="noopener noreferrer">'+dlIcon()+' MP4 HD</a>';
      if(m.mp3) v2html+='<a class="dl-btn dl-mp3" href="'+esc(m.mp3)+'" target="_blank" rel="noopener noreferrer">'+dlIcon()+' MP3</a>';
      if(!v2html) v2html='<span class="dl-none">No download links.</span>';
      document.getElementById('v2-dl').innerHTML=v2html;
      sv('v2card',true,'block');
    }

    /* ── V3 list ── */
    if(n===4&&typeof data==='object'&&data&&data.results){ renderV3List(data.results); }

    setBtnDefault(n);
  } catch(err){
    sv('skel'+n,false,'flex'); sv('res'+n,true,'block');
    var statElErr=document.getElementById('stat'+n);
    if(statElErr){ statElErr.textContent='Network Error'; statElErr.className='ep-status err'; }
    document.getElementById('raw'+n).textContent=String(err);
    setBtnDefault(n);
  }
}

/* ════════════════════════════════
   NAVBAR SCROLL
════════════════════════════════ */
(function(){
  var nav=document.querySelector('.topbar');
  if(!nav) return;
  function onScroll(){ nav.classList.toggle('scrolled', window.scrollY > 60); }
  window.addEventListener('scroll', onScroll, {passive:true});
  onScroll();
})();

/* ════════════════════════════════
   CARD 3D TILT
════════════════════════════════ */
(function(){
  if(window.matchMedia('(hover:none)').matches) return;
  if(window.matchMedia('(prefers-reduced-motion:reduce)').matches) return;
  document.querySelectorAll('.ep-card').forEach(function(card){
    var raf=null,lastE=null;
    card.addEventListener('mousemove',function(e){
      lastE=e;
      if(raf) return;
      raf=requestAnimationFrame(function(){
        raf=null;
        if(!lastE) return;
        var rect=card.getBoundingClientRect();
        var dx=(lastE.clientX-rect.left-rect.width/2)/rect.width;
        var dy=(lastE.clientY-rect.top-rect.height/2)/rect.height;
        card.style.transform='perspective(700px) rotateY('+(dx*5)+'deg) rotateX('+(-dy*3.5)+'deg) translateY(-2px)';
      });
    });
    card.addEventListener('mouseleave',function(){
      if(raf){ cancelAnimationFrame(raf); raf=null; } lastE=null;
      card.style.transform='';
    });
  });
})();

/* ════════════════════════════════
   AURORA HUE SHIFT ON SCROLL
════════════════════════════════ */
(function(){
  if(window.matchMedia('(prefers-reduced-motion:reduce)').matches) return;
  var aurora=document.getElementById('aurora');
  if(!aurora) return;
  function onScroll(){
    var max=document.body.scrollHeight-window.innerHeight||1;
    var pct=Math.min(1, window.scrollY/max);
    var hue=Math.round(pct*14);
    aurora.style.filter='hue-rotate('+hue+'deg)';
  }
  window.addEventListener('scroll', onScroll, {passive:true});
})();

/* ════════════════════════════════
   HOST BADGE
════════════════════════════════ */
(function(){
  var hb=document.getElementById('host-badge'); if(!hb)return;
  var h=window.location.hostname;
  var label,color;
  if(h.includes('replit')) { label='Hosted on Replit'; color='#E97A3B'; }
  else if(h.includes('render')) { label='Hosted on Render'; color='#46E3B7'; }
  else if(h.includes('vercel')) { label='Hosted on Vercel'; color='#ffffff'; }
  else { label='Self-hosted'; color='#717171'; }
  hb.innerHTML='<span class="host-pill"><span class="host-dot" style="color:'+color+'"></span>'+label+'</span>';
})();

/* ════════════════════════════════
   SECURITY
════════════════════════════════ */
document.addEventListener('contextmenu',function(e){ e.preventDefault(); });
document.addEventListener('keydown',function(e){
  if(e.key==='F12'||(e.ctrlKey&&(e.key==='u'||e.key==='U'||e.key==='s'||e.key==='S'))||(e.ctrlKey&&e.shiftKey&&(e.key==='I'||e.key==='J'||e.key==='C'))) e.preventDefault();
});
document.addEventListener('dragstart',function(e){ e.preventDefault(); });
var _dbgTimer=null;
function _chkDbg(){
  var t=Date.now();
  debugger;
  if(Date.now()-t>100) document.body.style.filter='blur(8px)';
  else document.body.style.filter='';
}
setInterval(_chkDbg,4000);
window.addEventListener('blur',function(){ document.body.style.filter='blur(6px)'; });
window.addEventListener('focus',function(){ document.body.style.filter=''; });
</script>
</body>
</html>`;
}

const DISCLAIMER_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>TubeFetch — Copyright &amp; Legal Disclaimer</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;background:#0a0a0a;color:#e5e5e5;line-height:1.8;padding:40px 20px 80px}
.wrap{max-width:820px;margin:0 auto}
.back{display:inline-flex;align-items:center;gap:6px;color:#E50914;text-decoration:none;font-size:.78rem;font-weight:700;letter-spacing:.5px;text-transform:uppercase;margin-bottom:32px;opacity:.85}
.back:hover{opacity:1}
h1{font-size:1.6rem;font-weight:900;color:#fff;margin-bottom:6px}
.subtitle{font-size:.78rem;color:#666;margin-bottom:40px;font-family:monospace}
h2{font-size:.95rem;font-weight:800;color:#fff;margin:36px 0 12px;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,.08);text-transform:uppercase;letter-spacing:.5px}
h3{font-size:.82rem;font-weight:700;color:#ccc;margin:18px 0 6px}
p,li{font-size:.82rem;color:#aaa;margin-bottom:10px}
ul{padding-left:20px;margin-bottom:12px}
li{margin-bottom:5px}
strong{color:#ddd}
code{background:rgba(255,255,255,.07);color:#e5e5e5;padding:1px 7px;border-radius:4px;font-size:.88em;font-family:monospace}
.warning{background:rgba(229,9,20,.06);border:1px solid rgba(229,9,20,.18);border-radius:8px;padding:14px 18px;margin-bottom:28px;font-size:.8rem;color:#ccc}
.warning strong{color:#E50914}
.footer{margin-top:60px;padding-top:20px;border-top:1px solid rgba(255,255,255,.08);font-size:.72rem;color:#555;text-align:center;line-height:1.7}
</style>
</head>
<body>
<div class="wrap">
<a class="back" href="/">&larr; Back to TubeFetch</a>
<h1>Copyright &amp; Legal Disclaimer</h1>
<p class="subtitle">TubeFetch &mdash; All Rights Reserved &mdash; Last updated: 2026-06-06</p>

<div class="warning"><strong>IMPORTANT:</strong> Read this document carefully before using, hosting, forking, distributing, or contributing to TubeFetch. By accessing or using this software in any form, you agree to be bound by the terms stated herein.</div>

<h2>1. Copyright Notice</h2>
<p><strong>Copyright &copy; 2024&ndash;2026 MJL. All rights reserved.</strong></p>
<p>TubeFetch &mdash; including but not limited to its source code, compiled binaries, documentation, API design, user interface, visual design, configuration files, build scripts, and all related intellectual property &mdash; is the exclusive property of its author (<strong>MJL</strong>).</p>
<p>This software is protected under the intellectual property laws of the <strong>Republic of the Philippines</strong> and the intellectual property laws of all nations party to international copyright treaties, including but not limited to the <strong>Berne Convention</strong>, the <strong>WIPO Copyright Treaty (WCT)</strong>, and the <strong>WIPO Performances and Phonograms Treaty (WPPT)</strong>.</p>

<h2>2. Governing Law &mdash; Philippines</h2>
<p>This project is authored in and governed primarily by the laws of the <strong>Republic of the Philippines</strong>.</p>
<h3>Republic Act No. 8293 &mdash; Intellectual Property Code of the Philippines (as amended by RA 10372)</h3>
<ul>
<li><strong>Section 172</strong> &mdash; Literary and artistic works, including computer programs, are protected from the moment of creation, without the need for registration or deposit.</li>
<li><strong>Section 177</strong> &mdash; The copyright owner holds the exclusive right to reproduce, distribute, transform, and make available to the public the copyrighted work.</li>
<li><strong>Section 216</strong> &mdash; Infringers are liable for actual damages, statutory damages of <strong>&#8369;50,000&ndash;&#8369;150,000 per act</strong>, attorney&rsquo;s fees, and criminal penalties of <strong>1&ndash;3 years imprisonment</strong> (first offense) and <strong>3&ndash;6 years + &#8369;150,000&ndash;&#8369;500,000</strong> (subsequent offenses).</li>
</ul>

<h2>3. International Copyright Protection</h2>
<h3>Berne Convention (181 member states)</h3>
<p>TubeFetch is protected in all <strong>181 member states</strong> without registration. Copyright subsists from the moment of creation.</p>
<h3>WIPO Copyright Treaty (WCT, 1996)</h3>
<p>Computer programs are protected as literary works under Article 4. Member states must provide legal remedies against circumvention of technological protection measures.</p>
<h3>TRIPS Agreement (WTO, 164 member countries)</h3>
<p>All member countries must provide copyright protection for computer programs equivalent to literary works, with a minimum term of 50 years.</p>
<h3>United States &mdash; DMCA (17 U.S.C. &sect;&sect; 512, 1201)</h3>
<p>Bad-faith or fraudulent takedown notices targeting this software are subject to liability under <strong>17 U.S.C. &sect; 512(f)</strong>, which provides for recovery of damages, costs, and attorney&rsquo;s fees. Any valid legal request must include full legal name, contact details, specific identification of infringing material, a statement under penalty of perjury, and a physical or electronic signature as required by 17 U.S.C. &sect; 512(c)(3).</p>
<h3>European Union &mdash; Directive 2019/790</h3>
<p>TubeFetch is an original work authored by MJL and is not third-party copyrighted content. It is protected under EU copyright law as an original literary work.</p>
<h3>United Kingdom &mdash; CDPA 1988</h3>
<p>Protected as a literary work under Section 3. Unauthorized copying or adaptation constitutes infringement under Sections 16&ndash;21.</p>
<h3>Japan &mdash; Copyright Act (Law No. 48 of 1970)</h3>
<p>Protected under Article 10(1)(ix). Infringement is subject to criminal penalties under Articles 119&ndash;124.</p>
<h3>Singapore &mdash; Copyright Act 2021 &nbsp;|&nbsp; Australia &mdash; Copyright Act 1968</h3>
<p>Protected as a literary work in both jurisdictions. Unauthorized reproduction constitutes infringement subject to civil and criminal remedies.</p>

<h2>4. Permitted Use</h2>
<ul>
<li>View and study the source code for personal educational purposes.</li>
<li>Fork and self-host for personal, non-commercial use, provided all copyright notices, attribution, and this disclaimer remain intact.</li>
<li>Contribute via pull request, subject to terms set by the author.</li>
</ul>

<h2>5. Restrictions</h2>
<p>The following are <strong>expressly prohibited</strong> without prior written consent from the author:</p>
<ul>
<li><strong>Commercial use</strong> &mdash; using TubeFetch or any derivative to generate revenue.</li>
<li><strong>Redistribution</strong> &mdash; publishing, selling, sublicensing, or distributing this software as a product or service.</li>
<li><strong>Removal of attribution</strong> &mdash; removing or modifying any copyright notice, author credit, or legal disclaimer.</li>
<li><strong>Trademark infringement</strong> &mdash; using &ldquo;TubeFetch&rdquo; or &ldquo;MJL&rdquo; to endorse derivative products.</li>
<li><strong>Mass scraping</strong> &mdash; systematic downloading of YouTube content at scale in violation of YouTube&rsquo;s Terms of Service.</li>
<li><strong>Malicious use</strong> &mdash; deploying this software to circumvent, attack, or harm third-party services.</li>
</ul>

<h2>6. Third-Party Content Disclaimer</h2>
<p>TubeFetch is a <strong>metadata and link retrieval API</strong>. It does not host, store, cache, transcode, or redistribute any audio or video content. All media URLs point directly to third-party servers. All YouTube content is owned by its respective creators and is subject to <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer" style="color:#E50914">YouTube&rsquo;s Terms of Service</a>. The user assumes full legal responsibility for any use of returned media links.</p>

<h2>7. No Warranty</h2>
<p>THIS SOFTWARE IS PROVIDED &ldquo;AS IS&rdquo;, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY ARISING FROM, OUT OF, OR IN CONNECTION WITH THE SOFTWARE.</p>

<h2>8. Limitation of Liability</h2>
<p>TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, THE AUTHOR SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, CONSEQUENTIAL, OR PUNITIVE DAMAGES (INCLUDING LOSS OF PROFITS, DATA, BUSINESS, OR GOODWILL) ARISING OUT OF OR RELATED TO YOUR USE OF OR INABILITY TO USE THIS SOFTWARE.</p>

<h2>9. Takedown &amp; Abuse Policy</h2>
<p>The author cooperates with legitimate legal processes. However, this software is an original work of authorship entitled to full copyright protection. Bad-faith DMCA notices or fraudulent abuse reports may be subject to legal action. Any valid legal request must satisfy all statutory requirements including specificity, sworn statement under penalty of perjury, and proper identification.</p>

<h2>10. Severability</h2>
<p>If any provision of this disclaimer is held invalid under applicable law, the remaining provisions continue in full force and effect.</p>

<div class="footer">
  TubeFetch &middot; Copyright &copy; 2024&ndash;2026 MJL &middot; All Rights Reserved<br/>
  Protected under Philippine IP Code RA 8293 &middot; Berne Convention &middot; WIPO Copyright Treaty &middot; TRIPS &middot; DMCA and equivalent laws worldwide.
</div>
</div>
</body>
</html>`;

router.get("/disclaimer", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex");
  res.type("html").send(DISCLAIMER_HTML);
});

router.get("/", (req, res) => {
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol;
  const host = req.headers["x-forwarded-host"] as string || req.headers.host || "localhost";
  const baseUrl = `${proto}://${host}`;
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.youtube.com https://s.ytimg.com https://fonts.googleapis.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com; font-src https://fonts.gstatic.com; img-src * data:; frame-src https://www.youtube.com; connect-src 'self'; media-src 'none'");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Robots-Tag", "noindex");
  res.setHeader("Cache-Control", "no-store");
  let html = buildHtml(VERSION, baseUrl);
  if (isShutdown()) {
    const banner = `<div id="shutdown-banner" style="position:fixed;top:0;left:0;right:0;z-index:9999;background:#7f1d1d;border-bottom:2px solid #ef4444;color:#fee2e2;text-align:center;padding:13px 20px;font-size:13px;font-weight:600;letter-spacing:.2px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">⚠&nbsp;&nbsp;Temporary Shutdown — Admins are currently fixing or improving things. We'll be back in a little while — please be patient.</div>`;
    html = html.replace(/(<body[^>]*>)/, `$1${banner}`);
  }
  res.type("html").send(html);
});

export default router;
