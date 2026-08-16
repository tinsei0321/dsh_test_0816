# DSH Web GUI × Codex 三段式 UI 复刻报告

> 生成日期：2026-08-15（长程自主任务收官产物）
> 目标口径：在 DSH Web GUI 中 1:1 复刻 OpenAI Codex 的三段式 UI 与交互细节（左栏 Project/目录树、中栏任务步骤卡流、右栏文件查看器、tab 卡片位置与交互），并把 Web UI 做到极致。

## 1. 任务概述

- **任务性质**：UI/UX 复刻 + 交互逻辑还原 + 视觉主题移植。
- **任务来源**：用户定调（2026-08-15），优先级依次为：目录树功能 → 右栏源码/阅读模式切换 → Phase 3 中栏 Codex 化 → Phase 4 左栏 Project 化 → Phase 5 Codex 主题。
- **前置事件**：会话日志损坏修复（见 §9），历史加载恢复。
- **约束**：全部测试绿；持续更新 TASK_CONTEXT.md；不复制 OpenAI 商标/logo 图形元素（只借鉴风格与数值）；调研开源与网络资料，不重复造轮子。

## 2. 方法论

1. **调研优先**：三路并行调研（官方结构 / 开源实现 / 设计 token），产物见 `.task-ref/specs/`。
2. **权威数据契约**：Codex 三段式 Web UI 的前端源码不公开，但 openai/codex 开源的 `app-server-protocol`（v2 JSON-RPC + JSON Schema）定义了 UI 的数据契约——复刻以它为交互语义基准：
   - 左栏目录树 ← `FsReadDirectory` / `FsWatch` / `FsChangedNotification`
   - 中栏步骤卡 ← `TurnItem` 流（`ItemStarted` / `ItemCompleted` / `AgentMessageDelta` / `CommandExecOutputDelta` …）
   - 右栏 diff ← `FileChangePatchUpdatedNotification`
   - 审批 ← 决策枚举（`Accept` / `AcceptForSession` / `AcceptWithExecpolicyAmendment` / `Decline` / `Cancel`）
3. **不重复造轮子**：直接借鉴已核实的开源实现（详见 `.task-ref/specs/codex-oss-implementations.md`）：
   - `LimLLL/codex-webui`（React 克隆）：Monaco 查看器选项、git-diff-view 红绿、扁平懒加载目录树、审批动态按钮。
   - `theswerd/brainless`：Codex CLI 视觉语言 1:1（ANSI 色 #ededed/#7a7a7a/#abdfa7/#f2a0a0/#5cc2e0、Working shimmer、exec 状态点）。
   - `AIDotNet/ClaudeCodexUi`：真三段式布局 + 可拖拽分隔条 + CSS token 表。
   - `friuns2/codexapp`：真实 app-server 浏览器桥（仅参考思路，注意其生态存在恶意分发包报道）。
4. **实现路径**：能力缝复用（目录浏览 RPC 复用 directory-picker-browse 后端）、槽位组合（slot 系统）、语义 token 换值（--dsw 体系）。

## 3. 复刻架构总览

> 口径说明（重要）：官方桌面 App 的 Codex 视图左栏是 Projects+Chats+Sources 会话树，**官方左栏并不放文件目录树**；左栏目录树是本任务用户的明确优先级需求（对应社区 Codex WebUI 的文件面板与 CodexGuide 的「文件夹中心制」解读），属在官方结构上的增强。中栏官方称 task sidebar（plan/sources/产物/summary），DSH 的 Trajectory 标签页是其对应物。

### 3.1 三段式映射

| Codex 面板 | 内容与交互 | DSH 实现 | 状态 |
|---|---|---|---|
| 左栏 Project/会话 | 按文件夹分组的会话列表 | ui-workspace（会话树）；目录树不在左栏——在最右栏，见 §11 | 见 §4.1 |
| 中栏任务步骤卡流 | turn/step 分组、工具卡（状态点/耗时/红绿结果）、思考块、审批卡、diff 片 | ui-conversation（chat 节点 + ApprovalPanel）+ ui-tool（工具卡）+ ui-trajectory（步骤分组） | 见 §4.2 |
| 右栏文件查看器 | 打开文件 tab、源码/阅读/渲染三模式、行号、diff 红绿、自动跟随最新 read/edit | ui-document（DocumentPanel：tab 条 + 阅读器） | 见 §4.3 |
| 最右栏目录树 | 真实项目目录树（懒加载折叠、隐藏开关、truncated）+ 点击文件联动文档阅读器 | ui-project（`frame.projectTree` 槽，ui-layout 最右栏）+ host.listTreeEntries RPC | 见 §4.1 |
| 全局主题 | Codex 深色工作台气质 | ui-theme（--dsw 语义 token 换值） | 见 §4.4 |

### 3.2 数据契约对照

| Codex app-server-protocol | DSH 对应 |
|---|---|
| `FsReadDirectory`（目录列举） | 新增 `host.listTreeEntries` RPC（TreeEntry{name,path,kind,hidden} + truncated，有界流式，1000 条截断同 GitHub 惯例） |
| `FsWatch` / `FsChangedNotification`（目录变更推送） | 未实现（见 §4.1 差距）——目录树按需拉取，无 watch 推送 |
| `TurnItem` 流（步骤事件） | 会话事件流（turn/start、step/start、tool/call、tool/result、assistant/chunk、turn/end…，seq 连续 JSONL 持久化） |
| `FileChangePatchUpdatedNotification`（diff 推送） | ui-document deriveDocuments：从 tool/result 的 read 窗口与 edit diff hunk 纯派生（会话日志内重建，天然可回放） |
| 审批决策枚举 | PendingWait('approval') + 交互面板（允许一次/拒绝），策略级决策由 permission 插件在宿主执行 |

### 3.3 分层（遵循 web client 架构纪律）

- 数据对象层（runtime，React-free）：listTreeEntries 走 `ctx.workspaces` 服务面（`IWorkspaces`），目录数据不进 session log（纯浏览状态）。
- 呈现层（plugin packages）：ui-project / ui-document / ui-tool / ui-trajectory / ui-workspace 各自经 slot 系统组合。
- 主题层（ui-theme）：语义 token 换值，组件零字面颜色。

## 4. 功能与交互复刻对照表

> 状态口径：✅ 做到 / 🟡 部分做到 / ❌ 未做 / ✨ 在 Codex 基础上的优化。

### 4.1 左栏（Project / 会话树）
- ✅ 会话行时间戳：`sessionTimeBucket` 纯函数（刚刚/N 分钟前/N 小时前/昨天 HH:mm/MM-DD/YYYY-MM-DD，zh/en），数据源 `SessionSummary.updatedAt`，行与 hover 卡共用标签。
- ✅ 新建会话入口：侧栏外壳（ui-sidebar）持有唯一入口（宽幅 + 轨道双形态）；已删除 Phase 4 重复加的按钮（第二轮修复「两个 +新会话」）。
- ✅ 文件夹分组：分组头会话数（hover 换操作簇）、当前 workspace 高亮折叠态保持、组内 22px 缩进、键盘可达（Enter/空格）。
- ✅ 交互细节：120ms 背景过渡、:active 按压态、:focus-visible 焦点环、reduced-motion 覆盖；零字面色值（纯语义 token，随 Codex 主题自动生效）。
- ✅ 目录树（新包 ui-project + host.listTreeEntries RPC）：懒加载折叠、文件/目录图标、隐藏文件弱化、truncated「…」、点击文件开右栏文档阅读器——**位置在框架最右栏（常驻，与文档阅读并列），不在左栏**（最终口径，见 §11）。
- ❌ 目录变更实时推送（官方 FsWatch/FsChangedNotification 的对应物，未做；树按需拉取）。

### 4.2 中栏（任务步骤卡流）
- ✅ 工具卡耗时 chip：`durationMs`（result.time − callTime，钳零；running/缺失为 null）+ `formatToolDuration`（42 ms / 1.2 s / 2m 05s）；折叠行尾部 muted chip（tabular-nums 12px caption）；running 行不显示（扫光已表达运行态）。
- ✅ turn 分组头墙钟跨度：`TrajectoryTurnModel.durationMs?`（layout fold 内自算，不改对象层）+ `turnWallSpanMs`（跨 turn 全部 timed cell，tool cell 延伸到结果时间）；`Turn N · 1.2 s` 后缀 + aria-label；标签宽度 64→96px。
- ✅ 思考块本地化：`row.think`（思考/Think）替换硬编码 "Think"；灰化折叠形态保留。
- ✅ 审批卡：现有 ApprovalPanel 已是 Codex 形态（amber 状态条 + warn 边框 + 状态点 + 主/次按钮 + 拒绝 hover 危险色）；本轮加「已提交决定」状态层（aria-live 播报）。
- ✅ 状态点三元组（ok/error/run）沿用 StateDot + 扫光；错误行红字失败首行。
- ✅ diff 三态点击语义：点文件名=打开（onOpenDocument）、点行=锚定/展开语义按现有 diff 卡能力核对并落档（Cmd+行 打开能力受宿主限制，报告 §6.6）。
- ❌ 聊天流内步骤分组条（Step N 分组只存在于 Trajectory 视图；chat 流工具卡仍按调用扁平排列——需 chat 节点渲染结构性改动，列后续项）。
- ❌ 审批 resolved 状态徽章驻留（Codex Auto-review 5 态 Reviewing/Approved/Denied/Aborted/Timed out 未复刻——DSH 审批为 composer takeover 一次性语义）。
- 每处新分支均有测试覆盖（含 NaN/负值/缺失边界）。

### 4.3 右栏（文件查看器）
- ✅ 打开文件 tab 条（× 关闭、点击聚焦、回焦邻居 tab、title 提示、「全部关闭」一键清空）
- ✅ **双栏并列（树在右端）**：目录树是框架**最右栏**（`frame.projectTree` 槽，ui-project 占据，root scope，常驻 240px 可拖拽，头部 ✕ 收起为 32px 重新打开轨）——项目文件与文档阅读同屏并列，树位于最右端。
- ✅ 源码模式：行号 + 语法高亮（ReadBlock）+ diff 红绿变更区（DiffBlock）
- ✅ 阅读模式：.md/.markdown 渲染 Markdown（MarkdownText），其余纯文本 pre（解决「.md 原文太乱」）
- ✅ 渲染模式：.html/.htm 产物沙箱 iframe srcdoc 渲染（sandbox="" 不执行脚本）
- ✅ 源码/阅读/渲染三模式切换（按钮组 + aria-pressed + 持久化偏好 dsh.document.view.v1）
- ✅ 自动跟随：agent 运行期间跟随最新 read/edit；手动点 tab 暂停至下一轮开始（running 边沿重置）
- ✅ 卡片→右栏联动：read/edit/write/产物文件路径点击 → 文档面板打开（documentOpen 服务，跨包经 slot 下发）
- ✅ 会话头「文件 · N」pill（触碰文件计数，点击开文档页）
- ✅ **可调宽/独占**：details 栏宽度上限 960、默认 480；打开文件自动扩到 960 主导宽度（`layout.expandDetails()`）；`Cmd/Ctrl+Alt+B` 开关右栏（Codex 评审面板同款快捷键）。
- 🟡 打开文件的真实全文（非 read 窗口）依赖宿主读文件能力，窗口外内容不显示
- ❌ 滚动条变更标记（官方亦无公开资料，仅有第三方「差异标记」设置项的间接线索）
- ❌ 行内评论 / 逐 hunk stage/revert（官方评审面板能力，超出本期 UI 复刻范围）

> 口径修正（第二轮，见 codex-window-architecture.md）：官方 Codex **没有「独占整页」文件查看器**——文件在外部编辑器或右栏 pane 内查看；用户「独占整页」的诉求以「可调宽的右栏 pane + reader 主导」实现，既解决「右下角看文件」又保持 Codex 忠实。最终口径（§11）把目录树放在**最右栏**、与文档阅读并列，reader 与树同屏。

### 4.4 全局主题
- ✅ 新增 `packages/client/ui-theme/src/styles/codex-theme.css`：Codex 静态色阶 + 深色主题语义别名重指（级联在链末，同特异性胜出）。
- ✅ 字体栈：UI 插入 Inter/system-ui；代码栈换 ui-monospace / SF Mono / Cascadia Mono / IBM Plex Mono（CJK 面保留 SimSun 回退防护）。
- ✅ 组装：`packages/client/web/src/base.css` 一行 `@import`（唯一 ui-theme 外改动）。
- 🟡 浅色主题零改动（保留原样）；蓝色保留为次级（button-info-fill、ContextMeter 未动）。
- 🟡 「进行中 cyan」无对应语义别名未强行新增；圆角为组件级 --dsl token，按不动布局的约束未碰。

## 5. 设计 token 体系

深色主题（`body[data-ds-dark-theme]`）语义别名 → Codex 值映射（完整表见 codex-theme.css 头部注释）：

| --dsw 别名 | Codex 值 | 用途 |
|---|---|---|
| bg-base | #0E0F12 炭灰 | 全局底色（原 bluish #151517） |
| bg-layer-1/2/3 | #202123 / #2A2B2E / #333438 | 卡片/面板石板灰阶梯 |
| specific-sidebar-fill / nav | #17181B / hover #202123 / active-accent #10A37F | 侧栏层级与活动绿标 |
| label-primary/secondary/tertiary/caption | #F5F7FA / #9EA1AA / 白 55% / 白 45% | 纯灰度文字层次 |
| state-business-primary / brand-primary | **#10A37F** | 品牌绿（替换 DeepSeek 蓝） |
| state-success / error-primary | #34C759 / #FF5F57 | 成功/错误 + DiffBlock/StateDot 自动跟随 |
| border-inverted/-2/l1 | 白 8% | 边框低对比 |
| scrollbar | #40434A / #4E5159 graphite | 滚动条 |
| markdown-code-block / banner / inline-code | #202123 / #2A2B2E | 代码块 |

设计决策记录：Codex 视觉气质 =「克制的深色工作台」——近黑炭灰底 + 近白文字 + 灰度阶梯分层 + 绿色仅作点缀（来源：`.task-ref/specs/codex-design-tokens.md`，官方 styles.md 经社区逆向 + 多方文本来源交叉核对）。

## 6. 交互逻辑复刻要点

### 6.1 右栏自动跟随状态机（ui-document DocumentPanel）
- **触发**：agent 运行中（snapshot.running）且未被手动暂停时，面板跟随最新 read/edit（entries[0]）。
- **暂停规则**：手动点 tab / 点文件行 → `manualOverride` 置位，跟随暂停；**下一轮次开始**（running 由 false→true 边沿）重置暂停。
- **数据源**：纯派生（`deriveDocuments(snapshot)`）——遍历 tool/result read 窗口、diff hunk、glob 路径、整文件 create 合成全文，按最近活动排序。会话日志可完整重建，天然可回放（模型可见 ⟺ 已记录原则）。
- 与官方口径的关系：官方文档对「文件查看器自动跟随 read/edit」**无公开资料**（§4.4 已注明勿与 steer/queue 的 Follow-up behavior 混淆）——本实现来自用户口径（"自动跟随最新 read/edit"）。

### 6.2 打开文件 tab 管理（ui-conversation stores）
- `openDocs: string[] + activeDoc`：`openDocument(path)` 追加/聚焦（token 强制同路径重复打开成帧），`closeDocument(path)` 关闭并回焦邻居，最后关完回工具半页；`select` 自动回工具 tab。
- 持久化兼容：老快照缺 `openDocs` 时 action 内 `?? []` 归一（老 localStorage seed 不崩）。

### 6.3 阅读器三模式（ui-document）
- `viewMode: 'source' | 'reading' | 'render'` 持久化（`dsh.document.view.v1`）；reading 对 .md/.markdown 走 MarkdownText，其余 pre 纯文本；render 对 .html/.htm 走沙箱 iframe srcdoc（sandbox="" 不执行脚本）。
- 源码模式 = ReadBlock（行号 + 高亮 + 40 行窗口截断）+ DiffBlock 变更区。

### 6.4 目录树懒加载（ui-project，宿主 listTreeEntries）
- 每次展开一级：`workspaces.listTreeEntries(path, AbortSignal)`，过期请求取消；有界流式列举（maxEntries 1000 + truncated「…」），symlink 按目标定 kind，坏链跳过；点击文件 → documentOpen 服务打开详情栏文档阅读器。
- 注册位：`frame.projectTree`（ui-layout AppFrame 声明的 root-scope 槽，**框架最右栏**，与文档阅读并列）。树根由全局 workspace/session 投影派生，无需会话区。
- **宿主能力选型（关键）**：树列举走 browse 能力；web-app 组合直接钉 browse 对（见 §11.4），否则 Windows 回环下 auto 会选 native 对话框后端（无 `listTreeEntries`），树根恒报「无法读取此目录」。

### 6.5 审批流（既有能力 + Codex 化呈现）
- 审批帧（approval/requested → resolved）经 PendingWait 内联于会话流；ApprovalPanel 提供允许一次/拒绝；Auto-review 的 5 态（Reviewing/Approved/Denied/Aborted/Timed out）在官方为内联审批项——DSH 侧数据可得时呈现状态层次（Phase 3 呈现层尽力对齐）。

### 6.6 官方细节差距（本期不做，如实记录）
- steer/queue 双通道、评审面板 scope 切换（Last turn）、逐 hunk stage/revert、行内评论（review guidance 需二次发送）、Cmd+点行打开、内置终端读取——均属官方 App 能力，超出本期 UI 复刻范围。

## 7. 质量与测试

### 7.1 门禁结果（2026-08-15 第三轮修正后）
| 门禁 | 结果 |
|---|---|
| `pnpm run test:gui`（内层，client+host 全量） | ✅ 283 文件 **3862 通过 / 1 跳过 / 0 失败** |
| `npx tsc -b tsconfig.client.json` | ✅ exit 0 |
| `npx tsc -b tsconfig.host.json` | ✅ exit 0 |
| `pnpm run build`（宿主+客户端 bundle+前端 vite） | ✅ exit 0 |
| 起服冒烟（3080 交接后，boot payload 探测） | 见 §11 交接记录 |

### 7.2 分面测试数据
- 宿主目录树 RPC（directory-picker + browse + apiproxy）：**461/461**
- ui-document（阅读模式）：32/32；ui-workspace（P4）：131/131 + scoped coverage 100%；ui-theme（P5）：65/65；ui-conversation：420/420
- Phase 3 四包（ui-tool/ui-trajectory/ui-conversation/ui-user-questions）：**798/798**
- 目录树代理受影响 7 包合计：1039/1039；oxlint/jscpd 对新增代码零违规；verify-package-invariants/cordis-config/README 双门/export-jsdoc/翻译配对全部通过

### 7.3 e2e 回放失败归因（全部非本次回归）
- **本次唯一相关变化**：lifecycle-chrome 金样因 UI 有意变更过期 → `DSH_SNAPSHOT=refresh` 刷新（hero/plan-active 两金样，+38 行新 UI 结构）→ replay 7/7 绿。
- **基线既存失败**（原始检出树同败，早于本任务）：
  1. 回放 fixture JSON 转义损坏（Windows）：markdown-cjk-strong、markdown-images、markdown-inline-code-links、math-rendering、message-actions、navigation-panes、produced-files(-mentions)、seeded-history、stats-paged-history、trajectory-virtualization、workspace-management、composer-tab-geometry、chat-long-interactions、details-session-lifecycle、agent-preset-selection、background-job-list、bash-abort-row、sidebar-scrollbar、skill-tool-row 等（boot 期 `Bad escaped character in JSON`）。
  2. preset 未挂 bash / Windows 终端检查不支持：code-mode-round（tools.bash is not a function）、goal-multi-turn（unknown tool "bash"）、chat-scroll-contract、shipped-composition、minimal-preset、turn-tail-actions、agent-preset-authoring、chat-continuous、approval-composer、replay-round-trip、plugin-config、plan-review、subagent-conversation、cold-blank-session、sidebar-subagent-activity、workflow-run、cordis-tool-round、settings-chrome（并行 flaky，单跑绿）。
  3. pwsh-terminal lane：`duplicate loader entry id: tool-pwsh`——2026-08-11 预设重构（base 平台门 + web-app disable 行）与测试 overlay insert 的组合 bug，相关文件本任务零改动（git 历史佐证）。
  4. hmr-live（dev:web 依赖）、smoke-real（需 DEEPSEEK_API_KEY 自跳过）。

## 8. 事件复盘：会话日志损坏与修复

**现象**：杀终端后 GUI 显示「历史加载失败：corrupt session log: seq gap in committed region at line 3235 (expected 38987, got 38986)」。

**根因**：两个 dsh web 进程并发持有同一会话（旧实例的影子进程 A + 用户实际交互的进程 B），恢复轮次按写批（zstd 帧）级交织写入同一 JSONL——两线程各自 seq 连续（A: 38986..43941，B: 38987..78400），但文件整体出现重叠 seq 段，读取扫描器在 turn/end 行抛错，历史整体不可读。

**修复**（脚本 `.task-ref/repair-final.mjs`）：全帧解码（含复用缓冲拷贝，杜绝解码假象）→ 逐行 `decodeStorageRecord` 展开 → 线程计数器归属（A 优先决胜）→ **保留前缀行 1..3235（至 end-seed 38986）+ B 线程全部行**，接缝天然连续、**零重编号**（B 起点 38987 恰证明其读取时见过 A 的 end-seed）→ header 帧 + 单事件帧重编码 → 生产扫描器 scanLog 验证 78401 事件全连续、committedBytes 满长 → 原子替换（原件备份 `.task-ref/session-7c547c04.orig.jsonl.zstd`）→ **生产读路径 `JsonlSessionPersistence.loadStored` 端到端复读成功**。

**结论**：78400+1 事件完整保留，仅弃影子进程的重复轮次；其余会话扫描正常。根因侧（跨进程会话写独占）记录为产品级后续项。

## 9. 审计结果与修复清单

独立审计（`.task-ref/audit-report.md`）：**无严重、无中等问题**。处置记录：
- ✅ S1 悬停卡固定灰 → Codex 灰阶（#F5F7FA/#9EA1AA/白55%）+ 注释说明。
- ✅ S2 时间分桶「昨天」DST 修复（日历减法 + 清理未用常量）。
- ✅ S3 路径键大小写敏感 → ui-document Known Limitations。
- ✅ S5 success-secondary 未跟随 → ui-theme Known Limitations。
- ⏸ S4 `--dsw-alias-brand-primary-new-colorprimary-new-color` 平台历史拼接怪名——功能正确，列为独立 PR 改名项，不混入本任务。
- ✅ 主代理扫描的字面颜色违规：InputBar chip/chipInvalid、MessageItem refChip → `color-mix(in srgb, var(--dsw-alias-state-business-primary/error-primary) …, transparent)`（跟随 Codex 主题）；ui-conversation 420/420 复验绿。
- ✅ 独立复核的正面项：carrier 类型单一事实源、fullyQualified 双围栏、scanLevel/collectRows 无克隆（jscpd 门过）、ui-project 三注册面齐全、invariant 真实理由、早前疑似乱码为 GBK 假象（文件完好）。

## 10. 遗留与下一步

**本期未做（如实记录，含官方无公开资料项）**
- 聊天流内 Step N 分组条（分组仅在 Trajectory 视图）——chat 节点结构改动，列后续。
- 审批 resolved 5 态徽章驻留（DSH 审批为 composer takeover 一次性语义）。
- 官方评审面板能力：scope 切换（Unstaged/Staged/Commit/Branch/Last turn）、逐 hunk stage/revert、行内评论（review guidance 二次发送）、Cmd+点行打开。
- steer/queue 双通道追问（DSH 有 QueueAction 数据面，composer UI 未接）。
- 目录树 watch 推送（官方 FsWatch 对应物）；滚动条变更标记（官方无公开资料）。
- 会话写独占（损坏日志根因侧）；`--dsw` 历史怪名改名；state-success-secondary 统一。
- `dist-portable` 便携包未重新打包（上一版为 Phase 2 时代产物）。

**下一步建议**
1. 肉眼验收：重启后的 3080 上验证右栏文档页、左栏目录树、中栏耗时 chip、Codex 主题观感。
2. 按需把「聊天流步骤分组条」提为下一个迭代。
3. 评审面板能力若产品需要，走独立能力缝（宿主流式 diff + 客户端评审视图）。

## 11. 最终口径：目录树 = 最右端常驻真实目录树（2026-08-15）

> 用户指令演进：先「文件树在最左侧独立栏」→ 自我修正「最左端『项目文件』与左侧栏重复，没必要」→「打开文档，目录树与文档阅读并列」→ **最终**「我要的是项目目录树，不是项目文件的对话；目录树没了，而且目录树应该在最右侧」+「这个 dsh_test 显示 无法读取此目录」。

### 11.1 最终布局（四栏，树在最右）
- AppFrame = `[会话栏 | 中栏 | 详情栏(文档阅读) | 项目目录树]`：`frame.projectTree` 槽（root scope，owner = {collapsed,width}），树**永久存在**——默认 240px、可拖 200-400、头部 ✕ 收起为 32px 重新打开轨（`ctx.layout.toggleTree()`），不再只在打开文档时出现。
- `computeColumns(viewport, sidebar, details, tree)` 五步让步链：details 先缩→details 自动关→tree 缩向 200→tree 收轨 32→center 兜底；sidebar 永不退让。`data-tree-collapsed` 与 owner props 按**解析后宽度**判定（窄窗让步挤出的轨同样渲染轨 UI）。
- 拖拽柄：sidebar 柄 / details 柄（details 左缘）/ tree 柄（树左缘，左拖加宽）；`Cmd/Ctrl+Alt+B` 仍管详情栏。

### 11.2 「无法读取此目录」根因与修复
- **根因**：web-app 组合 `directory-picker-auto`，其 resolve（win32 + 回环绑定）选 **native** 后端——原生对话框能力不含 `listTreeEntries`，`host.listTreeEntries` 返回 `directory-picker-unavailable`，树根层级恒显错误行（此前树从未在实机工作过）。
- **修复**：web-app cordis.patch.yml 直接钉 browse 对（`dsh-host-directory-picker-browse` + `dsh-client-ui-directory-picker-browse`；auto 的注释本允许 overlay 钉选）；tsconfig.base.json 补 browse surface 的 paths 映射（verify-cordis-config 要求行可经 paths 解析）。工作区目录选择随之变为**应用内目录浏览器**（更 Codex 化）。
- 后端本体验证：browse 能力对 `D:\Github\dsh_test`（64 项）三种路径写法全部列举成功——问题只在能力选型，不在列举逻辑。

### 11.3 ui-document 回归纯阅读器
- DocumentPanel = 打开文件 tab 条 + 阅读器（源码/阅读/渲染三模式 + 自动跟随 + diff 变更区）；树子槽（`conversation.details.document.tree`）与 inventory 清单全部移除——树的概念由最右栏的 ui-project 项目目录树唯一承担。
- 阅读器保留：tab 条（含全部关闭）、自动跟随、源码/阅读/渲染三模式、diff 变更区、documentOpen 联动。

### 11.4 目录树观感（第五轮：引导线 + 丝滑）
- **引导线（「线」）**：ProjectTree 从扁平缩进改回嵌套 `role=group` 层级 + 竖向引导线（`.tree [role='group']` 的 `border-left:1px solid var(--dsw-alias-border-l2)` + 10px 缩进）——子项沿父级竖线缩进，与 ui-tool ToolCallTree 同款「线」观感。
- **丝滑**：行 hover `background/color` 加 120ms 过渡（`prefers-reduced-motion` 覆盖禁用）；表头固定、列表区独立滚动（有滚动条）。
- **拖宽手柄**：AppFrame `.handle` 8px→12px，更好抓取。
- 说明：用户所称「最早的有线版本」未进 git（任务历史被收尾轮压成一次提交），本轮为按描述重建，非原样找回。

### 11.5 验证与部署
- `test:gui` 全量：唯一红 = ui-primitives code-block 懒加载语法 5s 超时（环境负载 flake，本任务零改动文件；23 个 shiki 语法逐一验证导入成功，早前单跑亦曾全绿）；ui-trajectory client-bundle 与 api-proxy-search 仅并行下失败、单跑绿。
- `verify-cordis-config` 168 通过；`tsc -b tsconfig.client.json` exit 0；`pnpm run build` / `build:lib:client` exit 0；ui-project/ui-layout/ui-document + scrollbar 门全绿。
- 部署：**3080** 被宿主重启为自带旧版 GUI（不杀）；最新构建起于 **3082**（`--port 3082`，日志 `.task-ref/server-3082.*.log`）供验收 http://127.0.0.1:3082。肉眼验收清单见 TASK_CONTEXT.md。
