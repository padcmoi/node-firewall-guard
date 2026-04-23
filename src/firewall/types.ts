import type { RequestLike } from "./request.js";

export type StrikeReason = "repeated-invalid-path-access" | "rate-limit" | "invalid-auth" | "suspicious-payload" | (string & {});

export interface StrikePolicy {
  firstThreshold: number;
  firstBanSec: number;
  watchlistSeconds: number;
}

export interface WatchEntry {
  ip: string;
  strikes: number;
  offenses: number;
  first_seen: number;
  last_seen: number;
  ttl_ms: number;
  expires_at_ms: number;
  last_reason: string | string[] | null;
}

export interface WatchlistState {
  version: 1;
  updated_at: string;
  entries: Record<string, WatchEntry>;
}

export interface ActiveBanEntry {
  ip: string;
  banned_at: string;
  banned_until: number;
  expires_at: string;
  duration_sec: number;
  offenses: number;
  reason: string | null;
}

export interface BanState {
  version: 1;
  updated_at: string;
  active_bans: Record<string, ActiveBanEntry>;
}

export interface FirewallHistoryEntry {
  total_offenses: number;
  last_offense: string;
  last_reason: string | string[] | null;
}

export interface FirewallHistoriesState {
  version: 1;
  updated_at: string;
  entries: Record<string, FirewallHistoryEntry>;
}

export interface RegisterStrikeParams {
  ip?: string;
  req: RequestLike;
  reason: StrikeReason;
  policy: StrikePolicy;
}

export interface SecurityAuditEvent {
  timestamp: string;
  ip: string;
  reason: string;
  method: string;
  url: string;
  secure: boolean;
}
