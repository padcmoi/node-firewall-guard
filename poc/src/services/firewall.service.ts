import { createFirewallGuard, IpTablesClient, RedisKeyValueStore, type FirewallGuard } from "../../../src/index.js";
import {
  POC_DRY_RUN,
  POC_IGNORE_IPS,
  POC_NAMESPACE,
  POC_PORT,
  POC_REDIS_HOST,
  POC_REDIS_PASSWORD,
  POC_REDIS_PORT,
  POC_REDIS_USERNAME,
} from "../config/env.js";

export async function createPocFirewallService(): Promise<FirewallGuard> {
  const firewall = createFirewallGuard({
    store: new RedisKeyValueStore({
      host: POC_REDIS_HOST,
      port: POC_REDIS_PORT,
      username: POC_REDIS_USERNAME,
      password: POC_REDIS_PASSWORD,
      lazyConnect: true,
    }),
    namespace: POC_NAMESPACE,
    ignoreIps: POC_IGNORE_IPS,
    iptables: new IpTablesClient({
      dryRun: POC_DRY_RUN,
      ports: [POC_PORT],
      chain: "INPUT",
    }),
    onAudit: (event) => {
      console.info("[AUDIT]", event);
    },
  });

  await firewall.init();
  return firewall;
}
