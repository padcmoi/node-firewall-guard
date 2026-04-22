# Express integration

## 1) Create and initialize the service

```ts
import express from "express";
import { createFirewallGuard, IpTablesClient, RedisKeyValueStore } from "@naskot/node-firewall-guard";

const app = express();
app.use(express.json());

const store = new RedisKeyValueStore({
  host: process.env.REDIS_HOST ?? "redis_persist",
  port: Number(process.env.REDIS_PORT ?? 6379),
  username: process.env.REDIS_USER ?? "redis_state_user",
  password: process.env.REDIS_PASSWORD ?? "change_me",
  lazyConnect: true,
});

const firewall = createFirewallGuard({
  store,
  namespace: process.env.FIREWALL_REDIS_NS ?? "FIREWALL_STORE",
  ignoreIps: (process.env.FIREWALL_IGNORE_IPS ?? "127.0.0.1,::1")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
  iptables: new IpTablesClient({
    bin: "iptables",
    dryRun: process.env.NODE_ENV !== "production",
    chain: "INPUT",
    ports: [Number(process.env.HTTP_PORT ?? 3000), Number(process.env.HTTPS_PORT ?? 3001)],
    action: "REJECT",
  }),
  purgeWatchlistIntervalSec: 30,
  purgeBansIntervalSec: 30,
  autoPurge: true,
  onAudit: (event) => {
    console.info("[FIREWALL_AUDIT]", event);
  },
});

await firewall.init();
```

## 2) Register strikes from routes/middlewares

```ts
app.use(async (req, _res, next) => {
  if (req.path.startsWith("/admin") && !req.headers.authorization) {
    await firewall.registerFromRequest(req, "invalid-auth", {
      firstThreshold: 3,
      firstBanSec: 120,
      watchlistSeconds: 900,
    });
  }
  next();
});
```

## 3) Block already-banned callers early

```ts
import { cleanRemoteIp } from "@naskot/node-firewall-guard";

app.use((req, res, next) => {
  const source =
    typeof req.headers["x-forwarded-for"] === "string" ? req.headers["x-forwarded-for"] : (req.socket.remoteAddress ?? "");
  const ip = cleanRemoteIp(source);

  if (ip && firewall.isIpBanned(ip)) {
    return res.status(403).json({ ok: false, error: `IP ${ip} is banned` });
  }

  next();
});
```

## 4) Expose state for internal debugging

```ts
app.get("/internal/firewall/state", (_req, res) => {
  res.json(firewall.snapshot());
});
```

## 5) Shutdown

```ts
process.on("SIGTERM", () => firewall.stop());
process.on("SIGINT", () => firewall.stop());
```

## Docker note

If you want real iptables writes from inside the API container, add:

- `cap_add: [NET_ADMIN, NET_RAW]`
- `iptables` binary in the image

Without those, keep `dryRun: true`.
