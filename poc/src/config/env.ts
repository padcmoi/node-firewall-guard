import process from "process";

export const POC_PORT = Number(process.env.PORT ?? 3000);
export const POC_DRY_RUN = process.env.FIREWALL_DRY_RUN !== "0";
export const POC_NAMESPACE = process.env.FIREWALL_NAMESPACE ?? "POC_FIREWALL";
export const POC_REDIS_HOST = process.env.REDIS_HOST ?? "redis";
export const POC_REDIS_PORT = Number(process.env.REDIS_PORT ?? 6379);
export const POC_REDIS_USERNAME = process.env.REDIS_USERNAME ?? "default";
export const POC_REDIS_PASSWORD = process.env.REDIS_PASSWORD ?? "change_me";

export const POC_IGNORE_IPS = (process.env.FIREWALL_IGNORE_IPS ?? "127.0.0.1,::1")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
