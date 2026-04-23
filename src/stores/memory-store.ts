import type { KeyValueStore } from "./types.js";

export class MemoryKeyValueStore implements KeyValueStore {
  private readonly data = new Map<string, string>();
  private readonly timers = new Map<string, NodeJS.Timeout>();

  private clearExistingTimer(key: string) {
    const timer = this.timers.get(key);
    if (!timer) return;
    clearTimeout(timer);
    this.timers.delete(key);
  }

  get(key: string) {
    return Promise.resolve(this.data.get(key) ?? null);
  }

  set(key: string, value: string) {
    this.clearExistingTimer(key);
    this.data.set(key, value);
    return Promise.resolve();
  }

  setWithTtl(key: string, value: string, ttlSec: number) {
    this.clearExistingTimer(key);
    this.data.set(key, value);

    const timeoutMs = Math.max(1, Math.floor(ttlSec * 1000));
    const timer = setTimeout(() => {
      this.data.delete(key);
      this.timers.delete(key);
    }, timeoutMs);
    timer.unref();

    this.timers.set(key, timer);
    return Promise.resolve();
  }

  del(key: string) {
    this.clearExistingTimer(key);
    return Promise.resolve(this.data.delete(key) ? 1 : 0);
  }
}
