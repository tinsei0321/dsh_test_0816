# @deepseek-ai/dsh-host-usage-monitor

English | [中文](README.zh.md)

Host half of the usage monitor. `UsageMonitorGateway` registers the `usageMonitor` Remote service and publishes one generated Remote, `usageMonitor/snapshot`, which returns the trailing seven calendar days of token and cost aggregates folded from the live `session/event` stream and the persisted session corpus, the DeepSeek account balance, and the official platform cost for the same window.

The week buckets count generated, context, and cached tokens plus the completion count per day. Cost uses the official platform cost when the `DEEPSEEK_PLATFORM_TOKEN` credential and the platform request succeed, and otherwise falls back to a local estimate from the published per-million-token pricing table. Balance and cost requests run through the subprocess seam's `curl.exe` with explicit stdin config (no argv quoting), so failed requests report machine-readable reasons (`no-key`, `no-token`, `fetch-failed`, `empty-response`, `api-error`, `unexpected-response`) instead of failing the snapshot.

Every external capability is optional and read with `ctx.get` — the gateway loads without session persistence, the subprocess seam, or credentials. The service is Remote-only and deliberately declares no same-process Cordis `Context` merge; client packages consume it through the explicit [`api-remotes`](../../api/remotes/README.md) assembly.

## Model Experience

None, as this Host-only gateway registers no prompt, tool, message, or provider request.

#### KV Cache effect

None; this package never assembles model input.

## Known Limitations and Deferred Work

- **Credentials come from the ambient credential service** — this package defines no credential references of its own; deployments must mount a credentials provider that resolves `DEEPSEEK_API_KEY` and `DEEPSEEK_PLATFORM_TOKEN`.
- **Cost estimate is a published-price approximation** — the local fallback cannot know promotional or account-specific pricing; it defers to the official platform cost whenever that request succeeds.
- **Trailing-window only** — the snapshot covers exactly the trailing seven local days; earlier history is out of scope.
