import type { KeyValueStore } from "../stores/types.js";
import { jsonCodec } from "../stores/types.js";

export class NamespacedStore {
  private readonly lockMap = new Map<string, Promise<unknown>>();

  constructor(
    private readonly kv: KeyValueStore,
    private readonly namespace: string
  ) {
    if (!namespace.trim()) {
      throw new Error("namespace is required");
    }
  }

  key(name: string) {
    const safe = name.trim().replace(/\s+/g, "_");
    return `${this.namespace}:${safe}`;
  }

  private async persist(key: string, encoded: string, ttlSec?: number) {
    if (ttlSec !== undefined && this.kv.setWithTtl) {
      await this.kv.setWithTtl(key, encoded, ttlSec);
      return;
    }

    await this.kv.set(key, encoded);
  }

  async state<T>(name: string, opts?: { fallback?: () => T }) {
    const raw = await this.kv.get(this.key(name));

    if (!raw) return opts?.fallback ? opts.fallback() : null;

    try {
      return jsonCodec<T>().decode(raw);
    } catch {
      return opts?.fallback ? opts.fallback() : null;
    }
  }

  async save<T>(name: string, value: T, opts?: { ttlSec?: number }) {
    await this.persist(this.key(name), jsonCodec<T>().encode(value), opts?.ttlSec);
  }

  async delete(name: string) {
    if (!this.kv.del) return 0;
    return this.kv.del(this.key(name));
  }

  async patch<T>(
    name: string,
    opts: {
      fallback: () => T;
      mutate: (current: T) => void | T | Promise<void | T>;
      ttlSec?: number;
    }
  ) {
    const storeKey = this.key(name);

    const previous = this.lockMap.get(storeKey) ?? Promise.resolve();

    const currentRun = previous.then(async () => {
      const raw = await this.kv.get(storeKey);

      let current: T;
      if (!raw) {
        current = opts.fallback();
      } else {
        try {
          current = jsonCodec<T>().decode(raw);
        } catch {
          current = opts.fallback();
        }
      }

      const result = (await opts.mutate(current)) as T | void;
      let next = current;
      if (result !== undefined) {
        next = result;
      }

      await this.persist(storeKey, jsonCodec<T>().encode(next), opts.ttlSec);
      return next;
    });

    this.lockMap.set(storeKey, currentRun);

    try {
      return await currentRun;
    } finally {
      if (this.lockMap.get(storeKey) === currentRun) {
        this.lockMap.delete(storeKey);
      }
    }
  }
}
