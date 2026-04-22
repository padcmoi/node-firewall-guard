import type { KeyValueStore } from "./types.js";

export class MemoryKeyValueStore implements KeyValueStore {
  private readonly data = new Map<string, string>();

  get(key: string) {
    return Promise.resolve(this.data.get(key) ?? null);
  }

  set(key: string, value: string) {
    this.data.set(key, value);
    return Promise.resolve();
  }

  del(key: string) {
    return Promise.resolve(this.data.delete(key) ? 1 : 0);
  }
}
