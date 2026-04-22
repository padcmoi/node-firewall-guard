import { describe, expect, it } from "vitest";
import {
  createFirewallGuard,
  MemoryKeyValueStore,
  type DropRule,
  type FirewallRuleClient,
  type StrikePolicy,
} from "../src/index.js";

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

    guard.stop();
  });
});
