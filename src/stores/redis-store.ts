import { Redis, type CommonRedisOptions } from "ioredis";
import type { KeyValueStore } from "./types.js";

export interface RedisStoreOptions extends CommonRedisOptions {
  host: string;
  port: number;
  username: string;
  password: string;
}

export class RedisKeyValueStore implements KeyValueStore {
  private readonly client: Redis;
  private connectOnce: Promise<void> | null = null;

  constructor(options: RedisStoreOptions) {
    this.client = new Redis({
      ...options,
      lazyConnect: options.lazyConnect ?? true,
      maxRetriesPerRequest: options.maxRetriesPerRequest ?? null,
    });

    this.client.on("error", () => {
      // prevent unhandled error event crashes
    });
  }

  private async ensureConnected() {
    if (this.client.status === "ready") return;

    if (!this.connectOnce) {
      this.connectOnce = this.client.connect().catch((error: unknown) => {
        this.connectOnce = null;
        throw error;
      });
    }

    await this.connectOnce;
  }

  async get(key: string) {
    await this.ensureConnected();
    return this.client.get(key);
  }

  async set(key: string, value: string) {
    await this.ensureConnected();
    await this.client.set(key, value);
  }

  async del(key: string) {
    await this.ensureConnected();
    return this.client.del(key);
  }

  async close() {
    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
  }
}
