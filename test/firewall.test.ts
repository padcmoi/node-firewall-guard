import { describe, expect, it } from "vitest";
import {
  createFirewallGuard,
  MemoryKeyValueStore,
  type DropRule,
  type FirewallRuleClient,
  type StrikePolicy,
} from "../src/index.js";
import type { KeyValueStore } from "../src/stores/types.js";

class FakeRuleClient implements FirewallRuleClient {
  readonly addCalls: string[] = [];
  readonly removeCalls: string[] = [];

  addDropRule(rule: DropRule) {
    this.addCalls.push(rule.ip);
    return Promise.resolve(true);
  }

  removeDropRule(rule: DropRule) {
    this.removeCalls.push(rule.ip);
    return Promise.resolve(true);
  }
}

class TtlAwareStore implements KeyValueStore {
  private readonly data = new Map<string, string>();
  readonly setWithTtlCalls: Array<{ key: string; ttlSec: number }> = [];

  get(key: string) {
    return Promise.resolve(this.data.get(key) ?? null);
  }

  set(key: string, value: string) {
    this.data.set(key, value);
    return Promise.resolve();
  }

  setWithTtl(key: string, value: string, ttlSec: number) {
    this.data.set(key, value);
    this.setWithTtlCalls.push({ key, ttlSec });
    return Promise.resolve();
  }
}

function makeRequest(ip: string) {
  return {
    headers: {
      "x-forwarded-for": ip,
    },
    method: "GET",
    url: "/attack",
    secure: false,
  };
}

const policy: StrikePolicy = {
  firstThreshold: 2,
  firstBanSec: 120,
  watchlistSeconds: 300,
};

describe("firewall guard", () => {
  it("bans an IP when threshold is reached", async () => {
    const store = new MemoryKeyValueStore();
    const rules = new FakeRuleClient();

    const guard = createFirewallGuard({
      store,
      namespace: "TEST_FIREWALL",
      iptables: rules,
      autoPurge: false,
      ignoreIps: ["127.0.0.1", "::1"],
    });

    await guard.init();

    await guard.registerFromRequest(makeRequest("195.7.8.9"), "rate-limit", policy);
    await guard.registerFromRequest(makeRequest("195.7.8.9"), "rate-limit", policy);

    expect(rules.addCalls).toEqual(["195.7.8.9"]);
    expect(guard.isIpBanned("195.7.8.9")).toBe(true);
    const snapshot = guard.snapshot();
    expect(snapshot.bans.active_bans["195.7.8.9"]?.ip).toBe("195.7.8.9");
    expect(snapshot.histories.entries["195.7.8.9"]?.total_offenses).toBe(1);

    guard.stop();
  });

  it("ignores configured CIDR values", async () => {
    const store = new MemoryKeyValueStore();
    const rules = new FakeRuleClient();

    const guard = createFirewallGuard({
      store,
      namespace: "TEST_FIREWALL_2",
      iptables: rules,
      autoPurge: false,
      ignoreIps: ["10.0.0.0/8"],
    });

    await guard.init();

    await guard.registerFromRequest(makeRequest("10.1.2.3"), "invalid-auth", policy);
    await guard.registerFromRequest(makeRequest("10.1.2.3"), "invalid-auth", policy);

    expect(rules.addCalls.length).toBe(0);
    expect(guard.isIpBanned("10.1.2.3")).toBe(false);
    expect(guard.snapshot().bans.active_bans["10.1.2.3"]).toBeUndefined();

    guard.stop();
  });

  it("refreshes histories TTL on each ban record when configured", async () => {
    const store = new TtlAwareStore();
    const rules = new FakeRuleClient();
    const ttlDays = 7;
    const expectedTtlSec = ttlDays * 24 * 60 * 60;

    const guard = createFirewallGuard({
      store,
      namespace: "TEST_HISTORIES_TTL",
      iptables: rules,
      autoPurge: false,
      historiesTtlDays: ttlDays,
    });

    await guard.init();

    const ttlPolicy: StrikePolicy = {
      firstThreshold: 1,
      firstBanSec: 0,
      watchlistSeconds: 300,
    };

    await guard.registerFromRequest(makeRequest("203.0.113.5"), "invalid-auth", ttlPolicy);
    await guard.registerFromRequest(makeRequest("203.0.113.5"), "invalid-auth", ttlPolicy);

    expect(store.setWithTtlCalls.length).toBe(2);
    expect(store.setWithTtlCalls.every((call) => call.key === "TEST_HISTORIES_TTL:histories")).toBe(true);
    expect(store.setWithTtlCalls.every((call) => call.ttlSec === expectedTtlSec)).toBe(true);

    guard.stop();
  });
});
