# @deepseek-ai/dsh-host-usage-monitor

[English](README.md) | 中文

用量监测的 Host 侧。`UsageMonitorGateway` 注册 `usageMonitor` 远端服务并发布一个生成式 Remote：`usageMonitor/snapshot`。它返回最近七个自然日的 Token 与成本聚合（来自实时 `session/event` 事件流与持久化会话语料）、DeepSeek 账户余额，以及同窗口的官方平台成本。

周桶按天统计生成、上下文、缓存 Token 与完成次数。当 `DEEPSEEK_PLATFORM_TOKEN` 凭证存在且平台请求成功时，成本列使用官方平台成本；否则回退到按发布价格表计算的本地估算。余额与成本请求通过 subprocess 服务调用 `curl.exe`，配置经 stdin 传入（不经过 argv 转义），因此失败的请求会返回机器可读的原因（`no-key`、`no-token`、`fetch-failed`、`empty-response`、`api-error`、`unexpected-response`），而不是让整个快照失败。

所有外部能力均为可选、通过 `ctx.get` 读取——没有会话持久化、subprocess 服务或凭证时网关也能加载。该服务仅面向 Remote，刻意不声明同进程 Cordis `Context` 合并；客户端包通过 [`api-remotes`](../../api/remotes/README.md) 装配来消费它。

## Model Experience

无。该 Host 侧网关不注册任何提示词、工具、消息或模型请求。

#### KV Cache effect

无；本包从不组装模型输入。

## Known Limitations and Deferred Work

- **凭证来自环境中的凭证服务** —— 本包不定义自己的凭证引用；部署必须挂载能解析 `DEEPSEEK_API_KEY` 与 `DEEPSEEK_PLATFORM_TOKEN` 的凭证提供者。
- **成本估算基于发布价格近似** —— 本地回退无法感知促销或账户专属价格；官方平台成本请求成功时始终以官方数据为准。
- **仅覆盖滚动窗口** —— 快照只包含最近七个本地自然日，更早的历史不在范围内。
