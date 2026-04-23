# NestJS integration

## 1) Build and initialize the firewall provider

```ts
import { Provider } from "@nestjs/common";
import { createFirewallGuard, IpTablesClient, RedisKeyValueStore } from "@naskot/node-firewall-guard";

export const FIREWALL_GUARD = Symbol("FIREWALL_GUARD");

export const FirewallGuardProvider: Provider = {
  provide: FIREWALL_GUARD,
  useFactory: async () => {
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
    return firewall;
  },
};
```

Ban enforcement is handled by `iptables/nftables` rules managed by the service. Do not implement route-level ban decisions in your app layer.

## 2) Register strikes from routes/middlewares

```ts
import { Inject, Injectable, NestMiddleware } from "@nestjs/common";
import type { Request, Response, NextFunction } from "express";
import type { FirewallGuard } from "@naskot/node-firewall-guard";

@Injectable()
export class SecurityStrikeMiddleware implements NestMiddleware {
  constructor(@Inject(FIREWALL_GUARD) private readonly firewall: FirewallGuard) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    if (req.path.startsWith("/admin") && !req.headers.authorization) {
      await this.firewall.registerFromRequest(req, "invalid-auth", {
        firstThreshold: 3,
        firstBanSec: 120,
        watchlistSeconds: 900,
      });
    }

    next();
  }
}
```

## 3) Register provider and middleware in module

```ts
import { MiddlewareConsumer, Module, NestModule, RequestMethod } from "@nestjs/common";

@Module({
  providers: [FirewallGuardProvider, SecurityStrikeMiddleware, FirewallShutdown],
  exports: [FirewallGuardProvider],
  controllers: [FirewallController],
})
export class FirewallModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SecurityStrikeMiddleware).forRoutes({ path: "*", method: RequestMethod.ALL });
  }
}
```

## 4) Expose snapshot endpoint

```ts
import { Controller, Get, Inject } from "@nestjs/common";
import type { FirewallGuard } from "@naskot/node-firewall-guard";

@Controller("internal/firewall")
export class FirewallController {
  constructor(@Inject(FIREWALL_GUARD) private readonly firewall: FirewallGuard) {}

  @Get("state")
  state() {
    return this.firewall.snapshot();
  }
}
```

## 5) Application shutdown hook

```ts
import { Inject, Injectable, OnApplicationShutdown } from "@nestjs/common";
import type { FirewallGuard } from "@naskot/node-firewall-guard";

@Injectable()
export class FirewallShutdown implements OnApplicationShutdown {
  constructor(@Inject(FIREWALL_GUARD) private readonly firewall: FirewallGuard) {}

  onApplicationShutdown() {
    this.firewall.stop();
  }
}
```

## Docker note

If you want real iptables writes from inside the API container, add:

- `cap_add: [NET_ADMIN, NET_RAW]`
- `iptables` binary in the image

Without those, keep `dryRun: true`.
