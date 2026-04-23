import { describe, expect, it } from "vitest";
import { cleanRemoteIp, isIpAllowed, isIpv4InCidr } from "../src/index.js";

describe("ip helpers", () => {
  it("normalizes IPv4-mapped values and ports", () => {
    expect(cleanRemoteIp("::ffff:10.0.0.4")).toBe("10.0.0.4");
    expect(cleanRemoteIp("10.0.0.4:443")).toBe("10.0.0.4");
  });

  it("matches IPv4 CIDR", () => {
    expect(isIpv4InCidr("195.7.8.9", "195.7.8.0/24")).toBe(true);
    expect(isIpv4InCidr("195.7.9.9", "195.7.8.0/24")).toBe(false);
  });

  it("supports exact IP and CIDR allow checks", () => {
    expect(isIpAllowed("195.7.8.9", { allowedIps: ["195.7.8.9"] })).toBe(true);
    expect(isIpAllowed("195.7.8.44", { allowedCidrs: ["195.7.8.0/24"] })).toBe(true);
    expect(isIpAllowed("195.7.9.44", { allowedCidrs: ["195.7.8.0/24"] })).toBe(false);
  });
});
