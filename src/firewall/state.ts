import { dateISO, dateNowMs } from "../core/time.js";
import { FirewallHistories } from "./histories.js";
import type { NamespacedStore } from "./namespaced-store.js";
import type { BanState, WatchlistState } from "./types.js";

function defaultBans() {
  return { version: 1, updated_at: dateISO(), active_bans: {} } satisfies BanState;
}

function defaultWatchlist() {
  return { version: 1, updated_at: dateISO(), entries: {} } satisfies WatchlistState;
}

export class FirewallState {
  private bansCache: BanState = defaultBans();
  private watchCache: WatchlistState = defaultWatchlist();
  private readonly histories: FirewallHistories;

  constructor(private readonly store: NamespacedStore) {
    this.histories = new FirewallHistories(store);
  }

  async init() {
    await this.histories.init();
    await this.refreshCaches();
  }

  private appendUniqueReason(previous: string | string[] | null, next: string) {
    if (!previous) return next;
    if (typeof previous === "string") return previous === next ? previous : [previous, next];
    return previous.includes(next) ? previous : [...previous, next];
  }

  private async refreshCaches() {
    this.bansCache = (await this.store.state<BanState>("bans", { fallback: defaultBans })) ?? defaultBans();
    this.watchCache = (await this.store.state<WatchlistState>("watchlist", { fallback: defaultWatchlist })) ?? defaultWatchlist();
  }

  async registerStrike(ip: string, reason: string, ttlMs: number) {
    const now = dateNowMs();
    const expiresAt = now + ttlMs;

    this.watchCache = await this.store.patch<WatchlistState>("watchlist", {
      fallback: defaultWatchlist,
      mutate: (state) => {
        const entry = state.entries[ip];

        if (!entry) {
          state.entries[ip] = {
            ip,
            strikes: 1,
            offenses: 0,
            first_seen: now,
            last_seen: now,
            ttl_ms: ttlMs,
            expires_at_ms: expiresAt,
            last_reason: reason,
          };
        } else {
          const ttl = Math.max(entry.ttl_ms, ttlMs);
          entry.strikes += 1;
          entry.last_seen = now;
          entry.last_reason = this.appendUniqueReason(entry.last_reason, reason);
          entry.ttl_ms = ttl;
          entry.expires_at_ms = Math.max(entry.expires_at_ms, now + ttl);
        }

        state.updated_at = dateISO();
      },
    });

    return this.watchCache.entries[ip];
  }

  async incrementOffense(ip: string) {
    const now = dateNowMs();

    this.watchCache = await this.store.patch<WatchlistState>("watchlist", {
      fallback: defaultWatchlist,
      mutate: (state) => {
        const entry = state.entries[ip];
        if (!entry) return;

        entry.offenses += 1;
        entry.strikes = 0;
        entry.last_seen = now;
        entry.expires_at_ms = now + entry.ttl_ms;

        state.updated_at = dateISO();
      },
    });

    const entry = this.watchCache.entries[ip];
    return entry ? entry.offenses : 1;
  }

  async purgeWatchlistExpired() {
    const now = dateNowMs();

    this.watchCache = await this.store.patch<WatchlistState>("watchlist", {
      fallback: defaultWatchlist,
      mutate: (state) => {
        let changed = false;

        for (const [ip, entry] of Object.entries(state.entries)) {
          if (now >= entry.expires_at_ms) {
            delete state.entries[ip];
            changed = true;
          }
        }

        if (changed) state.updated_at = dateISO();
      },
    });
  }

  async ban(ip: string, baseSec: number, reason: string | null, offenses: number) {
    const duration = baseSec * offenses;
    const now = dateNowMs();
    const bannedUntil = now + duration * 1000;

    this.bansCache = await this.store.patch<BanState>("bans", {
      fallback: defaultBans,
      mutate: (state) => {
        state.active_bans[ip] = {
          ip,
          banned_at: dateISO(now),
          banned_until: bannedUntil,
          expires_at: new Date(bannedUntil).toISOString(),
          duration_sec: duration,
          offenses,
          reason,
        };

        state.updated_at = dateISO();
      },
    });

    const watchReasons = this.watchCache.entries[ip]?.last_reason ?? reason;
    await this.histories.recordBan(ip, watchReasons);
  }

  async purgeExpiredBans() {
    const now = dateNowMs();
    const expired: string[] = [];

    this.bansCache = await this.store.patch<BanState>("bans", {
      fallback: defaultBans,
      mutate: (state) => {
        for (const [ip, ban] of Object.entries(state.active_bans)) {
          if (now >= ban.banned_until) {
            delete state.active_bans[ip];
            expired.push(ip);
          }
        }

        if (expired.length > 0) {
          state.updated_at = dateISO();
        }
      },
    });

    return expired;
  }

  isBanned(ip: string) {
    const ban = this.bansCache.active_bans[ip];
    return Boolean(ban && dateNowMs() < ban.banned_until);
  }

  getBansSnapshot() {
    return this.bansCache;
  }

  getWatchlistSnapshot() {
    return this.watchCache;
  }

  getHistoriesSnapshot() {
    return this.histories.getSnapshot();
  }
}
