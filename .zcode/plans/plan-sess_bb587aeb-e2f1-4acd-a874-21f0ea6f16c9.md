# Claude Code 切换到 GLM-5.3

## 现状

`C:\Users\Hi\.claude\settings.json` 已接入 GLM Coding Plan（端点 + 套餐 Key 均正确），但模型映射还是 `glm-5.2`，且同时存在旧式覆盖变量 `ANTHROPIC_MODEL` / `ANTHROPIC_SMALL_FAST_MODEL`（优先级更高，会压住 `ANTHROPIC_DEFAULT_*`）。

## 改动步骤

1. **备份**：复制 `settings.json` → `settings.json.bak-20260815`（沿用 Codex 配置备份的命名惯例）。

2. **编辑 `settings.json` 的 `env` 段**（其余内容——enabledPlugins、extraKnownMarketplaces、effortLevel 等——全部不动）：
   - 删除 `ANTHROPIC_MODEL` 和 `ANTHROPIC_SMALL_FAST_MODEL`（旧式覆盖变量，官方文档已不用，保留会钉死旧模型）
   - `ANTHROPIC_DEFAULT_OPUS_MODEL`: `glm-5.2` → `glm-5.3[1m]`
   - `ANTHROPIC_DEFAULT_SONNET_MODEL`: `glm-5.2` → `glm-5.3[1m]`
   - `ANTHROPIC_DEFAULT_HAIKU_MODEL`: `glm-5.2` → `glm-4.7`（官方推荐的轻量快速档，后台小任务省套餐额度）
   - 保留：`ANTHROPIC_BASE_URL`、`ANTHROPIC_AUTH_TOKEN`、`API_TIMEOUT_MS`、`CLAUDE_CODE_AUTO_COMPACT_WINDOW`、`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`

3. **版本检查**：运行 `claude --version`。`[1m]` 模型名需要较新版 Claude Code；若版本明显过旧，用 npm 升级 `@anthropic-ai/claude-code` 后再验证。

4. **冒烟验证**：新终端跑一次性非交互请求（`claude -p "只回复ok"`），确认端点、Key、模型全链路可用；如有报错（如模型不存在）按报错排查版本。

5. **更新记忆**：把"Claude Code 已于 2026-08-15 切到 GLM-5.3（含备份文件位置、Haiku 槽位用 glm-4.7 的取舍）"并入 `glm-coding-plan-integration-docs` 记忆。

## 回滚

恢复 `settings.json.bak-20260815` 即可回到 glm-5.2 全槽位配置。

## 完成后你需要做的

在新的终端窗口启动 `claude`，输入 `/status` 确认 Model 显示 `glm-5.3[1m]`（改动需新开终端才生效）。