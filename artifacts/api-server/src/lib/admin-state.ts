import { EventEmitter } from "events";

export type LogLevel = "info" | "success" | "error" | "warn";

export interface AdminLogEntry {
  id: number;
  ts: number;
  level: LogLevel;
  message: string;
}

export interface ApiMinuteBucket {
  minute: number;
  count: number;
}

// ── Shutdown flag ──────────────────────────────────────────────────────────────
let _shutdown = false;
export function isShutdown(): boolean { return _shutdown; }
export function setShutdown(val: boolean): void { _shutdown = val; }

// ── Admin event bus ────────────────────────────────────────────────────────────
export const adminBus = new EventEmitter();
adminBus.setMaxListeners(200);

// ── Log ring buffer ────────────────────────────────────────────────────────────
const LOG_BUFFER_MAX = 500;
let _logSeq = 0;
const _logs: AdminLogEntry[] = [];

export function emitAdminLog(level: LogLevel, message: string): void {
  const entry: AdminLogEntry = { id: ++_logSeq, ts: Date.now(), level, message };
  _logs.push(entry);
  if (_logs.length > LOG_BUFFER_MAX) _logs.shift();
  adminBus.emit("log", entry);
}

export function getRecentLogs(limit = 200): AdminLogEntry[] {
  return _logs.slice(-limit);
}

// ── Per-minute API call tracking (last 30 minutes) ───────────────────────────
const _minuteBuckets: ApiMinuteBucket[] = [];
const MINUTE_MS = 60_000;
const MAX_BUCKETS = 30;

function currentMinute(): number {
  return Math.floor(Date.now() / MINUTE_MS) * MINUTE_MS;
}

export function recordApiCall(): void {
  const m = currentMinute();
  const last = _minuteBuckets[_minuteBuckets.length - 1];
  if (last && last.minute === m) {
    last.count++;
  } else {
    _minuteBuckets.push({ minute: m, count: 1 });
    if (_minuteBuckets.length > MAX_BUCKETS) _minuteBuckets.shift();
  }
}

export function getMinuteBuckets(): ApiMinuteBucket[] {
  return [..._minuteBuckets];
}

// ── Package (downloader) status tracking ──────────────────────────────────────
type PackageStat = { lastSuccess: number; lastFailure: number };

const _serverStats: { 1: PackageStat; 2: PackageStat; 3: PackageStat } = {
  1: { lastSuccess: 0, lastFailure: 0 },
  2: { lastSuccess: 0, lastFailure: 0 },
  3: { lastSuccess: 0, lastFailure: 0 },
};

export function recordServerResult(server: 1 | 2 | 3, success: boolean): void {
  if (success) _serverStats[server].lastSuccess = Date.now();
  else         _serverStats[server].lastFailure = Date.now();
}

export type PackageStatus = "up" | "degraded" | "unknown";

export function getServerStatus(server: 1 | 2 | 3): PackageStatus {
  const s = _serverStats[server];
  if (!s.lastSuccess && !s.lastFailure) return "unknown";
  if (s.lastSuccess >= s.lastFailure)   return "up";
  return "degraded";
}
