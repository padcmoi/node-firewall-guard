export { createFirewallGuard } from "./firewall/service.js";
export type { FirewallGuard, FirewallGuardOptions } from "./firewall/service.js";

export { IpTablesClient } from "./firewall/iptable.js";
export type { DropRule, FirewallRuleClient, IpTablesClientOptions } from "./firewall/iptable.js";

export { RedisKeyValueStore } from "./stores/redis-store.js";
export type { RedisStoreOptions } from "./stores/redis-store.js";

export { MemoryKeyValueStore } from "./stores/memory-store.js";

export { cleanRemoteIp, getRemoteIp, isIpAllowed, isIpv4InCidr } from "./core/ip.js";

export type { RequestLike } from "./firewall/request.js";

export type {
  ActiveBanEntry,
  BanState,
  FirewallHistoriesState,
  FirewallHistoryEntry,
  RegisterStrikeParams,
  SecurityAuditEvent,
  StrikePolicy,
  StrikeReason,
  WatchEntry,
  WatchlistState,
} from "./firewall/types.js";
