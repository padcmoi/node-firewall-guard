# CHANGELOG

## [Unreleased] - yyyy-mm-dd

- chore: bootstrap npm package metadata and TypeScript baseline (`package.json`, `tsconfig.json`, `src/index.ts`)
- chore: install and configure ESLint and Prettier with lint/format scripts
- docs: add complete service usage docs and framework guides for Express and NestJS
- fix: align ESM NodeNext imports with explicit `.js` extensions across `src` and POC TS files
- fix: stabilize strict TypeScript generics in namespaced state patching/store flows
- fix: add Express typings (`@types/express`) and explicit request/response typings in POC app handlers
- chore: add `poc/tsconfig.json` for editor-friendly POC typechecking
- test: validate full checks (`npm run build`, `npm run lint`) with zero errors
- test: validate POC ban flow end-to-end with Redis persistence and real iptables rule insertion when `FIREWALL_DRY_RUN=0`
- qa: validate real host iptables ban/unban flow from POC via `curl` (including post-jail unban) and pass quality checks (`npm run lint`, `npm run typecheck`, `npm test`)
- docs: clarify that firewall rules are applied in the container network namespace (not directly in host iptables)
