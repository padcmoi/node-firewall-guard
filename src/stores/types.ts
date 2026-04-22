export type Codec<T> = {
  encode: (value: T) => string;
  decode: (raw: string) => T;
};

export function jsonCodec<T>() {
  return {
    encode: (value: T) => JSON.stringify(value),
    decode: (raw: string) => JSON.parse(raw) as T,
  } satisfies Codec<T>;
}

export interface KeyValueStore {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
  del?: (key: string) => Promise<number>;
}
