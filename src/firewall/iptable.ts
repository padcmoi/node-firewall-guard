import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type DropRule = {
  ip: string;
};

export interface FirewallRuleClient {
  addDropRule: (rule: DropRule) => Promise<boolean>;
  removeDropRule: (rule: DropRule) => Promise<boolean>;
}

export interface IpTablesClientOptions {
  bin?: string;
  dryRun?: boolean;
  chain?: string;
  ports?: readonly number[];
  action?: "DROP" | "REJECT";
  logger?: {
    info?: (message: string) => void;
  };
}

export class IpTablesClient implements FirewallRuleClient {
  private readonly bin: string;
  private readonly dryRun: boolean;
  private readonly chain: string;
  private readonly ports: readonly number[];
  private readonly action: "DROP" | "REJECT";
  private readonly logger: IpTablesClientOptions["logger"];

  constructor(opts: IpTablesClientOptions = {}) {
    this.bin = opts.bin ?? "iptables";
    this.dryRun = Boolean(opts.dryRun);
    this.chain = opts.chain ?? "INPUT";
    this.ports = opts.ports && opts.ports.length > 0 ? opts.ports : [80, 443];
    this.action = opts.action ?? "REJECT";
    this.logger = opts.logger;
  }

  private buildDropArgs(rule: DropRule, port: number, mode: "-C" | "-I" | "-D") {
    return [mode, this.chain, "-p", "tcp", "-s", rule.ip, "--dport", String(port), "-j", this.action];
  }

  async addDropRule(rule: DropRule) {
    if (this.dryRun) {
      this.logger?.info?.(
        `[FIREWALL][DRY-RUN] drop rule ignored for ip=${rule.ip} port(s)=${this.ports.join(",")} (${this.ports.length} entrie(s))`
      );
      return true;
    }

    for (const port of this.ports) {
      const checkArgs = this.buildDropArgs(rule, port, "-C");
      const insertArgs = this.buildDropArgs(rule, port, "-I");

      try {
        await execFileAsync(this.bin, checkArgs);
        continue;
      } catch {
        // rule does not exist yet
      }

      try {
        await execFileAsync(this.bin, insertArgs);
      } catch {
        return false;
      }
    }

    return true;
  }

  async removeDropRule(rule: DropRule) {
    if (this.dryRun) {
      this.logger?.info?.(
        `[FIREWALL][DRY-RUN] remove drop rule ignored for ip=${rule.ip} port(s)=${this.ports.join(",")} (${this.ports.length} entrie(s))`
      );
      return true;
    }

    let removed = false;

    for (const port of this.ports) {
      const delArgs = this.buildDropArgs(rule, port, "-D");

      for (let i = 0; i < 5; i++) {
        try {
          await execFileAsync(this.bin, delArgs);
          removed = true;
        } catch {
          break;
        }
      }
    }

    return removed;
  }
}
