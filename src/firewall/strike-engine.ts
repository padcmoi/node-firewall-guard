import { getRemoteIp, isIpAllowed } from "../core/ip.js";
import { dateISO } from "../core/time.js";
import type { FirewallRuleClient } from "./iptable.js";
import type { FirewallState } from "./state.js";
import type { RegisterStrikeParams, SecurityAuditEvent } from "./types.js";

export class StrikeEngine {
  constructor(
    private readonly state: FirewallState,
    private readonly ruleClient: FirewallRuleClient,
    private readonly ignoreIps: string[],
    private readonly onAudit?: (event: SecurityAuditEvent) => void
  ) {}

  async register(params: RegisterStrikeParams) {
    const ip = params.ip ? params.ip : getRemoteIp(params.req);

    if (ip === "") return;

    if (
      isIpAllowed(ip, {
        allowedIps: this.ignoreIps,
        allowedCidrs: this.ignoreIps,
      })
    ) {
      return;
    }

    if (this.state.isBanned(ip)) return;

    this.onAudit?.({
      timestamp: dateISO(),
      ip,
      reason: params.reason,
      method: params.req.method ?? "GET",
      url: params.req.originalUrl ?? params.req.url ?? "",
      secure: Boolean(params.req.secure),
    });

    const entry = await this.state.registerStrike(ip, params.reason, params.policy.watchlistSeconds * 1000);

    if (entry.strikes >= params.policy.firstThreshold) {
      const offenses = await this.state.incrementOffense(ip);
      await this.ruleClient.addDropRule({ ip });
      await this.state.ban(ip, params.policy.firstBanSec, params.reason, offenses);
    }
  }
}
