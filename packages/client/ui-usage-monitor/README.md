# @deepseek-ai/dsh-client-ui-usage-monitor

English | [中文](README.zh.md)

Browser half of the usage monitor: a balance chip in the conversation input strip (`conversation.input.right`) that opens a hover panel with the account balance, today's token totals, and the trailing seven-day token/cost chart. The panel refreshes every 10 seconds through the generated `usageMonitor/snapshot` Remote, so the displayed balance and today's numbers stay live without a page reload.

The component is a pure consumer: every fact arrives through the injected `load` callback (the Remote snapshot), and the component owns only its transient hover state and refresh interval. All colors and geometry consume the shared `--dsw-*` theme tokens; the chart series colors are data (segment identity), not theme decisions.

## Model Experience

None, as this browser surface registers no prompt, tool, message, or provider request.

#### KV Cache effect

None; this package never assembles model input.

## Known Limitations and Deferred Work

- **Chinese-only copy** — the chip, panel, and chart labels are Chinese product copy and are not yet localized through the locale service.
- **Panel is hover-driven only** — there is no keyboard focus path that opens the panel; the chip itself remains keyboard-focusable.
