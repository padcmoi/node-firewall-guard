import type { KeyValueStore } from "../stores/types.js";
import type { FirewallRuleClient, IpTablesClientOptions } from "./iptable.js";
import { IpTablesClient } from "./iptable.js";
import { NamespacedStore } from "./namespaced-store.js";
import type { RequestLike } from "./request.js";
import { FirewallState } from "./state.js";
import { StrikeEngine } from "./strike-engine.js";
import type { RegisterStrikeParams, SecurityAuditEvent, StrikePolicy } from "./types.js";

export interface FirewallGuardOptions {
  store: KeyValueStore;
  namespace?: string;
  ignoreIps?: string[];
  iptables?: FirewallRuleClient;
  iptablesOptions?: IpTablesClientOptions;
  purgeWatchlistIntervalSec?: number;
  purgeBansIntervalSec?: number;
  historiesTtlDays?: number;
  autoPurge?: boolean;
  onAudit?: (event: SecurityAuditEvent) => void;
}

export interface FirewallGuard {
  init: () => Promise<void>;
  stop: () => void;
  registerStrike: (params: RegisterStrikeParams) => Promise<void>;
  registerFromRequest: (req: RequestLike, reason: string, policy: StrikePolicy) => Promise<void>;
  isIpBanned: (ip: string) => boolean;
  snapshot: () => {
    bans: ReturnType<FirewallState["getBansSnapshot"]>;
    watchlist: ReturnType<FirewallState["getWatchlistSnapshot"]>;
    histories: ReturnType<FirewallState["getHistoriesSnapshot"]>;
  };
}

export function createFirewallGuard(options: FirewallGuardOptions) {
  const namespace = options.namespace ?? "FIREWALL_STORE";
  const ignoreIps = options.ignoreIps ?? ["127.0.0.1", "::1"];

  const namespacedStore = new NamespacedStore(options.store, namespace);
  const state = new FirewallState(namespacedStore, options.historiesTtlDays);

  const ruleClient =
    options.iptables ??
    new IpTablesClient({
      dryRun: true,
      ports: [80, 443],
      ...options.iptablesOptions,
    });

  const strikeEngine = new StrikeEngine(state, ruleClient, ignoreIps, options.onAudit);

  const purgeWatchlistIntervalSec = options.purgeWatchlistIntervalSec ?? 30;
  const purgeBansIntervalSec = options.purgeBansIntervalSec ?? 30;
  const autoPurge = options.autoPurge ?? true;

  let watchTimer: NodeJS.Timeout | null = null;
  let bansTimer: NodeJS.Timeout | null = null;
  let initialized = false;

  function ensureInitialized() {
    if (!initialized) {
      throw new Error("Firewall not initialized: call init() first");
    }
  }

  return {
    async init() {
      if (initialized) return;
      initialized = true;

      await state.init();

      if (!autoPurge) return;

      watchTimer = setInterval(() => {
        void state.purgeWatchlistExpired();
      }, purgeWatchlistIntervalSec * 1000);
      watchTimer.unref();

      bansTimer = setInterval(() => {
        void (async () => {
          const expired = await state.purgeExpiredBans();
          for (const ip of expired) {
            await ruleClient.removeDropRule({ ip });
          }
        })();
      }, purgeBansIntervalSec * 1000);
      bansTimer.unref();
    },

    stop() {
      if (watchTimer) {
        clearInterval(watchTimer);
        watchTimer = null;
      }

      if (bansTimer) {
        clearInterval(bansTimer);
        bansTimer = null;
      }

      initialized = false;
    },

    async registerStrike(params: RegisterStrikeParams) {
      ensureInitialized();
      await strikeEngine.register(params);
    },

    async registerFromRequest(req: RequestLike, reason: string, policy: StrikePolicy) {
      ensureInitialized();
      await strikeEngine.register({ req, reason, policy });
    },

    isIpBanned(ip: string) {
      ensureInitialized();
      return state.isBanned(ip);
    },

    snapshot() {
      ensureInitialized();
      return {
        bans: state.getBansSnapshot(),
        watchlist: state.getWatchlistSnapshot(),
        histories: state.getHistoriesSnapshot(),
      };
    },
  } satisfies FirewallGuard;
}
