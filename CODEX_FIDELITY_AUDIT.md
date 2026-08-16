# Codex 复刻保真度全局审计（2026-08-16）

基准：OpenAI Codex 桌面 App（2026-08 文档快照，rust-v0.148.0-alpha 世代）+ IDE 扩展 + CLI 交叉参照。
被审对象：dsh Web GUI @ feat/codex-workbench-ui（ee2ba4e647）。
审计动机：用户实机验收结论"跟 Codex 差很远，不光 UI，菜单层级、交互逻辑、功能、feature 都差很多"。此前 CODEX_REPLICA_REPORT.md 的"接近完成"是**对照任务自设范围**（四栏布局复刻）的完成度，不是对照 Codex 本尊的保真度——本报告修正这个口径。

## 总评

复刻完成的是 Codex 的**一个视觉切片**（四栏骨架 + 调色板 + 会话树形态），而非 Codex 的工作流。三层保真度：

| 层面 | 保真度 | 判断依据 |
|---|---|---|
| 视觉 | ~40% | 调色板/四栏/会话树形态对齐；组件密度、图标体系、字体层级、动效、context pills 形态未做——所以"一眼不像" |
| 交互逻辑 | ~50% | 会话切换/队列/插话/Plan 模式/审批卡/模型选择器已对齐；diff 审查流（Codex 灵魂交互）整体缺失，审批粒度粗一档 |
| 功能面 | ~30% | 缺：Review 模式、逐 hunk 审查、@ 文件引用、命令面板、终端、worktree 隔离、通知、云任务/PR/自动化整条线 |

## 逐维度对比

### 1. 命令面（菜单层级第一层）

| | Codex 桌面 App | dsh | 差距 |
|---|---|---|---|
| 斜杠命令 | 7 条（/feedback /goal /init /mcp /plan /review /status）+ $skill 显式调技能；CLI 侧 40+ | 7 条（/compact /export /feedback /goal /model /permission /plan）+ skills 入菜单 | 缺 /init /mcp /review /status /rename /fork /resume /diff；dsh 独有 /export |
| 命令面板 | Cmd+Shift+P / Cmd+K 全局面板 | 无 | **P0 缺口**：Codex 的菜单层级中枢 |

### 2. 键盘与输入

| | Codex | dsh | 差距 |
|---|---|---|---|
| 会话切换 Cmd+Shift+[ ] | ✓ | ✓ | 对齐 |
| 面板开关 | Cmd+B 侧栏 / Cmd+Opt+B diff 面板 | Cmd+Alt+B Details ✓ | 部分对齐（无侧栏快捷键） |
| 历史搜索 Cmd+G | ✓（含 Git 分支名） | ✓（会话名+内容） | 基本对齐（内容索引默认关） |
| 线程内查找 Cmd+F | ✓ | ✗ | 缺 |
| 后退/前进 Cmd+[ ] | ✓ | ✗ | 缺 |
| ↑ 编辑上一条 prompt / Esc Esc 编辑前文 | ✓（App/IDE/CLI 均有） | ✗（↑ 只做弹层高亮） | **P0**：高频交互 |
| Enter/Shift+Enter/队列插话 | followUpQueueMode queue/steer | ✓ 且更细（逐条编辑/插话） | **dsh 反超** |
| IME/撤销 | ✓ | ✓（chip 级 undo/redo） | dsh 反超 |
| 新线程快捷键 Cmd+N | ✓ | ✗（仅按钮） | 缺 |

### 3. 模式与权限

| | Codex | dsh | 差距 |
|---|---|---|---|
| 权限预设 | Agent / Agent(full access) / Read Only 三档 UI 预设 | workspace-write / danger-full-access 两档（+派生 Custom） | 缺 Read Only 档；沙箱/审批枚举 dsh 其实同级（read-only 枚举在但没暴露成预设） |
| 审批策略 | untrusted / on-failure / on-request / never 四档 | ask / never 两档 | 粒度差一档 |
| Plan 模式 | ✓（计划待审→确认执行） | ✓（PlanReviewPanel 三动作） | **对齐** |
| Review 模式 | /review 四预设（quick/detailed/security/freshness） | ✗ 完全没有 | **P0** |
| 推理力度 | low/med/high/xhigh/Auto | 按模型目录动态 efforts + Default | 基本对齐（Auto 缺） |

### 4. Diff 与代码审查（Codex 的灵魂，最大差距）

| Codex 桌面 App | dsh |
|---|---|
| 专属 Review pane：staged/unstaged/branch/last-turn 过滤 | ✗ 无 Review pane |
| 逐文件 Keep(入暂存)/Revert(还原) | ✗ 无 |
| 行级 inline review comments（待处理/已解决过滤） | ✗ 无 |
| 每条消息 "Review changes" 入口 | ✗ 无 |
| 消息处 fork 出讨论分支 | ✓（消息级 Branch 已有，形态接近） |
| App 内 PR 视图（GitHub PR 评审） | ✗ 无 |
| /diff 看会话累积变更 | ✗ 无（仅工具行内嵌 DiffBlock 只读展示 + 文档面板"本会话修改"状态） |

**这一块是"交互逻辑差很远"的主体**：Codex 是"改完必审、逐处裁决"，dsh 是"改完只看"。

### 5. 会话/任务管理

| | Codex | dsh | 差距 |
|---|---|---|---|
| 重命名/fork/resume/归档 | ✓ | 重命名 ✓ fork ✓ 归档 ✓（**无恢复入口**） resume ✗ | 归档不可逆是 bug 级缺口 |
| 跨线程搜索 | ✓（内容+分支名） | ✓（内容默认关闭，部署开关） | 对齐 |
| 自动压缩 /compact | ✓ | ✓（+压缩卡展示） | 对齐 |
| 自动标题 | ✓ | ✓（fork 递增尾号） | 对齐 |
| 每线程 Git worktree 隔离 | ✓ | ✗ | 缺（P1） |
| 每线程终端 tab | ✓（Cmd+J） | ✗ | 缺（P1，dsh 有 terminal 能力但无 Web UI 面） |
| 删除会话 | ✓ | ✗（无菜单项） | 缺 |

### 6. 上下文输入

| | Codex | dsh | 差距 |
|---|---|---|---|
| **@ 文件/目录模糊引用** | ✓（App/IDE/CLI 全有，日常核心） | ✗（@ 现在是子代理/插件引用） | **P0**：最高频入口缺失 |
| 图片 | ✓ 粘贴/截图 | ✓ 拖放/粘贴/灯箱/限制策略 | 对齐 |
| AGENTS.md | ✓ + /init 生成 | ✓（读）| 缺 /init |
| MCP | /mcp 面板 + @server__tool + OAuth | harness 层有 mcp-client-plugin，**Web GUI 无面板无引用** | P1 |
| Skills | ✓ + $ 显式调用 | ✓ 入斜杠菜单 + 工具行 | 对齐 |
| 长期记忆 Chronicle /memories | ✓ | ✗（仅消息反馈） | P2 |

### 7. 设置

| | Codex App | dsh | 差距 |
|---|---|---|---|
| 模型/Provider 管理 | 单一官方 + config.toml | **dsh 反超**：多 Provider、自定义模型目录、fetch 可用模型、Base URL | — |
| Agent 预设 ≈ profiles | profiles(config) | 四预设 + 创作模式 + 复制/默认/查看组装 | dsh 形态更产品化 |
| 通知设置 | ✓（完成/审批） | ✗（无通知系统） | P1 |
| diff 视图偏好 | ✓ | ✗ | P2 |
| Git 集成偏好 | ✓ | ✗ | P2 |

### 8. 信息架构（菜单层级差距的根源）

Codex App 侧栏 = 项目列表 + 最近线程 + **PR 审查看板** + **Automations**；上下文栏 context pills = model + approvals + **branch/worktree picker** + **mode** + repo；右侧 Review pane；底部终端 tab。dsh 侧栏 = 会话树；composer 座 = 模型/权限/Plan；右侧 = 工具详情+文档。**dsh 缺的不是"栏"，是每栏里的第二三层**（分支选择、模式选择、审看看板、自动化入口）。

### 9. 云/后台产品线

Codex：云任务（容器环境/best-of-n/并行）、GitHub/Slack/Linear 触发、PR 自动开、移动端推送、automations 定时。dsh：会话内后台任务、子代理树、workflow 编排。**是两条不同的产品轴线**——要不要追是战略决定，不是补丁。

### 10. dsh 独有、Codex 桌面版没有的（保住这些）

多 Provider 模型管理面板；队列逐条编辑/插话；子代理目录树与会话层级面；Trajectory 轨迹表（耗时/tok/缓存）；产出文件（Deliverables）行；Goal 长任务条；Workflow 编排卡；创造模式（自研 preset）；双语 UI；文档面板三模式查看器。

## 建议路线

- **P0（补"像个工作台"的魂）**：@ 文件引用（composer 模糊搜文件，走已有 listTreeEntries RPC 就能起步）；审批第三态（always-allow + 编辑后执行）；Review pane MVP（按 last-turn 过滤 + 逐文件 Keep/Revert，落盘走已有 edit 工具反向补丁）；↑ 编辑上一条。
- **P1（补应用壳）**：命令面板 Cmd+K；/status /diff /init /rename 命令；桌面通知；Read-only 预设档；终端 tab（复用 terminal 能力）；归档恢复入口。
- **P2（战略选择）**：云任务/PR/automations 整线（工作量大，先想清楚定位）；worktree 隔离；Chronicle 记忆；Cmd+F 线程内查找。

## 结论

"复刻 Codex UI"任务真实完成的是**布局层**；Codex 体验的承重墙——review 裁决流、@ 引用、命令面板、上下文 pills 层级——还在地基里。按 P0 清单推进两轮，"用起来像"会先于"看起来像"达成。
