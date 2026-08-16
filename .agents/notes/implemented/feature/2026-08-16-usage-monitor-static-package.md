# Agent Note: Usage monitor as a static host/client package pair

Status: implemented

English | [中文](2026-08-16-usage-monitor-static-package.zh.md)

## Problem

The usage monitor (DeepSeek balance chip, today's token totals, and the trailing seven-day token/cost chart) existed only as a dynamic Cordis plugin. Dynamic plugins live in process memory: every web-server restart removed the plugin, and the browser UI was tied to one session's plugin ownership. The user wanted it as a permanent, git-tracked package so any `git pull` checkout ships it built-in.

## Decision

The dynamic plugin became two monorepo packages following the plugin-inventory template:

- `@deepseek-ai/dsh-host-usage-monitor` (`packages/host/usage-monitor`): `UsageMonitorGateway`, a Typert `Remote` service exposing `usageMonitor/snapshot`. It folds the trailing seven local days of token/cost buckets from the live `session/event` stream plus the persisted session corpus, fetches the account balance (`DEEPSEEK_API_KEY` via curl with stdin config) and the official platform cost (`DEEPSEEK_PLATFORM_TOKEN`), and reports per-request failures as machine-readable reasons instead of failing the snapshot. All external capabilities are optional `ctx.get` reads.
- `@deepseek-ai/dsh-client-ui-usage-monitor` (`packages/client/ui-usage-monitor`): registers a `conversation.input.right` entry whose chip and hover panel render the snapshot; the only injected member is the `load` callback bound to `ctx.remote.usageMonitor.snapshot()` through the api-remotes assembly. The 10-second refresh uses a component-owned interval.

Pure aggregation arithmetic lives in `src/usage.ts` and is unit-tested; the client component has a jsdom spec covering loading, hover-panel content, and failure paths. The web-app bundle rows mount both packages, and api-remotes mounts the generated Remote face.

## Alternatives considered

- **Keep it dynamic** — zero repo surface, but every restart and every session loses the plugin; rejected because permanence and git transport were the explicit goals.
- **Single client package with the gateway logic in the node half** — smaller surface, but the gateway needs Host-side session persistence and subprocess access that a client package's node half cannot declare; rejected.
- **Profile bundle package (dsh-review-skills pattern)** — keeps the monorepo clean, but then `git pull` on the fork does not deliver the plugin and office machines need a separate bundle install; rejected.

## Consequences

- The plugin survives restarts and travels with the repository (Gitee `dsh_0816` fork).
- The wire contract is Typert-generated from `UsageSnapshot` in `./types`; changing that payload requires a full `build:lib:host` + `build:lib:client` so the generated faces and client bundles stay in sync.
- Credentials still come from the ambient credential service; each machine must configure `DEEPSEEK_API_KEY` and `DEEPSEEK_PLATFORM_TOKEN` locally.
