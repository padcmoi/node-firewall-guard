import { dateISO } from "../core/time.js";
import type { NamespacedStore } from "./namespaced-store.js";
import type { FirewallHistoriesState } from "./types.js";

function defaultHistories() {
  return { version: 1, updated_at: dateISO(), entries: {} } satisfies FirewallHistoriesState;
}

function normalizeTtlDays(ttlDays?: number) {
  if (ttlDays === undefined) return undefined;
  if (!Number.isFinite(ttlDays) || ttlDays <= 0) {
    throw new Error("historiesTtlDays must be a positive number");
  }
  return Math.floor(ttlDays);
}

export class FirewallHistories {
  private data: FirewallHistoriesState = defaultHistories();
  private readonly historiesTtlSec: number | undefined;

  constructor(
    private readonly store: NamespacedStore,
    historiesTtlDays?: number
  ) {
    const normalizedDays = normalizeTtlDays(historiesTtlDays);
    this.historiesTtlSec = normalizedDays !== undefined ? normalizedDays * 24 * 60 * 60 : undefined;
  }

  async init() {
    this.data =
      (await this.store.state<FirewallHistoriesState>("histories", { fallback: defaultHistories })) ?? defaultHistories();
  }

  async recordBan(ip: string, reason: string | string[] | null) {
    const lastOffense = new Date().toISOString();

    this.data = await this.store.patch<FirewallHistoriesState>("histories", {
      fallback: defaultHistories,
      ttlSec: this.historiesTtlSec,
      mutate: (state) => {
        const entry = state.entries[ip];
        if (!entry) {
          state.entries[ip] = {
            total_offenses: 1,
            last_offense: lastOffense,
            last_reason: reason,
          };
        } else {
          entry.total_offenses += 1;
          entry.last_offense = lastOffense;
          entry.last_reason = reason;
        }

        state.updated_at = dateISO();
      },
    });
  }

  getSnapshot() {
    return this.data;
  }
}
