import { createFirewallGuard, IpTablesClient, RedisKeyValueStore } from "@naskot/node-firewall-guard";
import * as ENV from "../config/env.js";

export const firewall = createFirewallGuard({
  store: new RedisKeyValueStore({
    host: ENV.POC_REDIS_HOST,
    port: ENV.POC_REDIS_PORT,
    username: ENV.POC_REDIS_USERNAME,
    password: ENV.POC_REDIS_PASSWORD,
    lazyConnect: true,
  }),
  namespace: ENV.POC_NAMESPACE,
  ignoreIps: ENV.POC_IGNORE_IPS,
  historiesTtlDays: ENV.POC_HISTORIES_TTL_DAYS,
  iptables: new IpTablesClient({
    dryRun: ENV.POC_DRY_RUN,
    ports: [ENV.POC_PORT],
    chain: "INPUT",
  }),
  onAudit: (event) => {
    console.info("[AUDIT]", event);
  },
});
