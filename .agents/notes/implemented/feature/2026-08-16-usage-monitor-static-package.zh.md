# Agent Note: 用量监测固化为静态 host/client 包对

Status: implemented

[English](2026-08-16-usage-monitor-static-package.md) | 中文

## 问题

用量监测（DeepSeek 余额胶囊、今日 Token 总量与最近七天 Token/成本柱状图）此前只以动态 Cordis 插件形式存在。动态插件只活在进程内存中：每次 web 服务器重启插件即消失，且浏览器 UI 绑定在某个会话的插件归属上。用户希望它成为永久、纳入 git 的插件包，任何 `git pull` 后的检出都内建该功能。

## 决策

动态插件按 plugin-inventory 模板拆成两个 monorepo 包：

- `@deepseek-ai/dsh-host-usage-monitor`（`packages/host/usage-monitor`）：`UsageMonitorGateway`，一个 Typert `Remote` 服务，对外暴露 `usageMonitor/snapshot`。它把最近七个本地自然日的 Token/成本桶从实时 `session/event` 事件流与持久化会话语料中聚合出来，通过 curl（stdin 传配置）请求账户余额（`DEEPSEEK_API_KEY`）与官方平台成本（`DEEPSEEK_PLATFORM_TOKEN`），并把每个请求的失败报告为机器可读的原因，而不是让整个快照失败。所有外部能力均为可选的 `ctx.get` 读取。
- `@deepseek-ai/dsh-client-ui-usage-monitor`（`packages/client/ui-usage-monitor`）：注册 `conversation.input.right` 条目，胶囊与悬停面板渲染快照；唯一注入成员是绑定到 `ctx.remote.usageMonitor.snapshot()` 的 `load` 回调（经 api-remotes 装配）。10 秒刷新使用组件自有的定时器。

纯聚合算术放在 `src/usage.ts` 并有单元测试；客户端组件有 jsdom 测试覆盖加载、悬停面板内容与失败路径。web-app bundle 行挂载两个包，api-remotes 挂载生成的 Remote face。

## 曾考虑的替代方案

- **保持动态** —— 仓库零改动，但每次重启、每个会话都会丢失插件；因目标就是永久化与 git 分发而否决。
- **单客户端包、网关逻辑放进 node half** —— 面积更小，但网关需要 Host 侧的会话持久化与 subprocess 能力，客户端包的 node half 无法声明；否决。
- **Profile bundle 包（dsh-review-skills 模式）** —— monorepo 更干净，但 `git pull` fork 不会带出插件，办公机还需单独装 bundle；否决。

## 后果

- 插件重启不丢，并随仓库（Gitee `dsh_0816` fork）一起分发。
- 线格式由 `./types` 中的 `UsageSnapshot` 经 Typert 生成；改动该载荷需要完整执行 `build:lib:host` + `build:lib:client`，保持生成 face 与客户端 bundle 同步。
- 凭证仍来自环境中的凭证服务；每台机器需本地配置 `DEEPSEEK_API_KEY` 与 `DEEPSEEK_PLATFORM_TOKEN`。
