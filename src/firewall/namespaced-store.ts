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

  async state<T>(name: string, opts?: { fallback?: () => T }) {
    const raw = await this.kv.get(this.key(name));

    if (!raw) return opts?.fallback ? opts.fallback() : null;

    try {
      return jsonCodec<T>().decode(raw);
    } catch {
      return opts?.fallback ? opts.fallback() : null;
    }
  }

  async save<T>(name: string, value: T) {
    await this.kv.set(this.key(name), jsonCodec<T>().encode(value));
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

      await this.kv.set(storeKey, jsonCodec<T>().encode(next));
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
