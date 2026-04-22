# node-firewall-guard

Firewall guard toolkit for Node.js services running in Docker or on host.

It provides a service that:

- tracks strikes by IP
- applies progressive bans
- manages optional iptables drop/reject rules
- stores state (`watchlist`, `bans`, `histories`) in Redis or memory

## Install

```bash
npm install @naskot/node-firewall-guard
```

## Service API

### `createFirewallGuard(options)`

Creates a singleton-like guard service instance for your app process.

#### Options (`FirewallGuardOptions`)

- `store` (required): Redis-backed key-value store implementing `get/set/del` (recommended: `RedisKeyValueStore`)
- `namespace` (optional, default: `"FIREWALL_STORE"`): key prefix namespace
- `ignoreIps` (optional, default: `["127.0.0.1", "::1"]`): exact IPs and/or IPv4 CIDR ranges to ignore
- `iptables` (optional): custom rule client implementing `addDropRule/removeDropRule`
- `iptablesOptions` (optional): used only when `iptables` is not provided
- `purgeWatchlistIntervalSec` (optional, default: `30`)
- `purgeBansIntervalSec` (optional, default: `30`)
- `autoPurge` (optional, default: `true`)
- `onAudit` (optional): callback receiving security events

#### `iptablesOptions` (`IpTablesClientOptions`)

- `bin` (default: `"iptables"`)
- `dryRun` (default: `false` when explicit, otherwise depends on your setup)
- `chain` (default: `"INPUT"`)
- `ports` (default: `[80, 443]`)
- `action` (default: `"REJECT"`, possible: `"DROP"` or `"REJECT"`)
- `logger.info` (optional function)

### Service methods (`FirewallGuard`)

- `await init()`: initialize caches and start purge intervals
- `stop()`: stop purge intervals
- `await registerStrike({ ip?, req, reason, policy })`
- `await registerFromRequest(req, reason, policy)`
- `isIpBanned(ip)`
- `snapshot()` returns `{ bans, watchlist, histories }`

### Strike policy (`StrikePolicy`)

- `firstThreshold`: strikes before first ban
- `firstBanSec`: base ban duration in seconds
- `watchlistSeconds`: strike TTL window

## Framework docs

- [Express usage](./docs/express/README.md)
- [NestJS usage](./docs/nestjs/README.md)

## Unit tests

```bash
npm test
```

## POC (Docker)

The POC runs inside Docker with:

- a dedicated Redis container (bans/watchlist/histories persistence)
- firewall API container (`NET_ADMIN`/`NET_RAW`, `iptables`)
  POC code is in TypeScript and split like the main project:

- `poc/src/services/firewall.service.ts`
- `poc/src/app.ts`
- `poc/src/index.ts`

```bash
npm run poc:docker:up
```

Test flow:

```bash
curl -X POST http://localhost:3310/strike -H 'content-type: application/json' -d '{"reason":"manual-strike","firstThreshold":2,"firstBanSec":120,"watchlistSeconds":300}'
curl -X POST http://localhost:3310/strike -H 'content-type: application/json' -d '{"reason":"manual-strike","firstThreshold":2,"firstBanSec":120,"watchlistSeconds":300}'
curl http://localhost:3310/state
```

By default the POC uses `FIREWALL_DRY_RUN=1`. Set `FIREWALL_DRY_RUN=0` in `poc/docker-compose.yml` to apply real iptables rules in the container namespace.
