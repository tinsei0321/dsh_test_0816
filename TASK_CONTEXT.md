# TASK_CONTEXT — DSH 复刻 Codex 三段式 UI（1:1 结构与交互）

> 本文件是这项任务的跨会话上下文卡。任务从 2026-08-14 起**整体位于本目录**（`D:\Github\dsh_test`）。
> 原系统检出树 `C:\Windows\System32\deepseek-harness` 已整体复制到此处并**还原为未修改状态**——所有后续工作、构建、验证均在本目录进行，不再触碰 C: 目录。

## 目标（2026-08-14 用户定调）

**1:1 复刻 Codex 的 UI 与交互逻辑**（按 Codex Web 三段式解读；目标面以用户确认为准）：

| Codex 界面 | 内容 | DSH 对应 | 状态 |
|---|---|---|---|
| 1. 对话交流 + 进程监控 | 中栏消息流：agent 步骤卡（read/edit/bash/glob…）、思考块、审批卡、diff 片、时长/状态 | 中栏 chat + Trajectory 标签页 + ui-tool 卡片 | 已有，需 Codex 化视觉与交互 |
| 2. 文档内容阅读 | 右栏文件查看器：打开文件标签页、行号+高亮、自动跟随最新 read/edit、diff 红绿标记、滚动条变更标记 | details 栏「文档」半页（v1 已落地，见下） | 需升级为标签页+自动跟随 |
| 3. 文件夹 view source | 左栏会话按文件夹分组 + 文件入口点击即右栏打开 | 左栏 workspace/会话浏览器（会话树，非文件树）；文件入口=会话触碰文件清单 + read/edit 卡片 | 清单已有；卡片联动待做 |

## 已落地（v1 地基 · 测试全绿 30/30）

### ui-conversation（details 栏 tab 化）
- `contract/views.ts`：`ChatStoreState` + `detailsTab: 'tool'|'document'`、`document: string|null`
- `stores.ts`：`setDetailsTab/openDocument/closeDocument`；`select` 自动回工具 tab
- `contract/slots.ts`：子槽 `conversation.details.document`（single/session）+ `DetailsDocumentOwnerProps = { doc, onOpen, cwd }`
- `skeleton/DetailsPanel.tsx` + `.module.css`：双 tab 条「工具详情 | 文档」
- `locales.ts`：`details.tab.tool/details.tab.document`（zh/en）
- `apply.ts`：details 注册声明新子槽
- 测试：`tests/chat-store.client.spec.ts`、`tests/gate-branch-tails.client.spec.tsx`

### 新插件包 `packages/client/ui-document/`
- `deriveDocuments(snapshot)` 纯派生：遍历 `snapshot.nodes`（tool-result）+ `runningCalls`（含嵌套 subCalls），收集 read 窗口行 / diff hunk（含整文件 create 合成全文）/ glob 路径；按最近活动排序
- `DocumentPanel`：触碰文件清单（状态点：已读/已改/仅发现）+ 阅读器（ReadBlock + DiffBlock 变更区）
- locales（`document` 命名空间）、README（含 Model Experience + Known Limitations）、invariant
- 测试：`tests/documents.client.spec.ts`、`tests/document-panel.client.spec.tsx`、`tests/apply.client.spec.ts`

### 注册面
- `tsconfig.client.json`（+ui-document reference）
- `packages/bundle/web-app/cordis.patch.yml`（+`ui-document` dsh.client 行）
- `packages/bundle/web-app/package.json`（+依赖）
- `scripts/verify-package-readme-model-experience.ts`（白名单条目）


## Phase 2 已完成（2026-08-14 · 663/663 测试绿）

### 打开文件标签页 + 自动跟随（ui-conversation + ui-document）
- store：`document: string|null` 升级为 `openDocs: string[] + activeDoc: string|null`；`openDocument(path)` 追加/聚焦 tab，`closeDocument(path)` 关闭并回焦邻居 tab（最后关完回工具半页），`select` 仍回工具 tab
- `DetailsDocumentOwnerProps` = `{ docs, doc, onOpen(path), onClose(path), cwd }`
- `DocumentPanel`：Codex 式 tab strip（含 × 关闭）、触碰文件清单、阅读器（ReadBlock + DiffBlock 变更区）、**自动跟随**（agent 运行中跟随最新 read/edit；手动点击暂停跟随至下一轮次开始）
- locale 新增 `document.closeTab`

### 卡片→右栏联动（Codex 核心交互）
- ui-conversation 提供 `documentOpen` 服务（cordis Context 键 + apply 时 `ctx.provide`，token 强制同路径重复打开成帧）；details 注册的 inject 增加 `openDocument`（layout.openDetails + store 动作）与 `hooks.docOpenRequest` 源；`DetailsPanel` 经 `useDocOpenRequest` 消费请求
- `ChatNodeOwnerProps`/`ChatViewInjected` 增加 `openDocument`，经 `ChatView → ChatNodeSeat → ToolCallTree → ToolCallOwnerProps` 全链下发
- ui-tool：`ToolRow` 新增 `onOpenDocument`（存在时接管路径点击），read/edit/write/通用卡的路径点击 → 文档面板打开（不再走宿主原生打开）
- 测试更新：chat-store/selection-survival/apply-inject/gate-branch-tails/chat-view/toolview-slot/chat-code-subcalls/terminal-card/web-card/diff-card/read-card/search-card

### 验证口径变化
- 路径点击行为：`documentOpen.open(path)`（文档面板）取代 `workspaces.openPath`（宿主）；原生打开仍保留为无面板时的回退（ToolRow `onOpenDocument ?? onOpenFile`）

## 下一步

- [x] 左栏 Project 目录树（第 (1) 优先级 · 2026-08-15 完成，见下）
- [ ] Phase 3：中栏 Codex 化（工具卡视觉/审批卡/思考块/任务步骤分组）
- [ ] Phase 5：Codex 风格视觉主题（--dsw token 覆盖，不复制 OpenAI 商标）

## 左栏 Project 目录树（2026-08-15 完成 · 受影响包 1039/1039 绿 + test:gui 3855/3856）

### 宿主侧（tree 列举原语）
- `directory-picker` 服务定义：`TreeEntry`/`TreeListing` + browse 能力 `listTreeEntries(path, signal)`（根由调用方持有，无 home 默认；fully-qualified 围栏同 list）
- `directory-picker-browse`：opendir 流式扫描 + boundedInsert 窗口 + raceAbort 全部抽成共享私有方法（`scanLevel`/`collectRows`，jscpd 重复度门），文件 dirent 免 stat 探针、符号链接 stat 定 kind、坏链/非文件非目录跳过、truncated 边界同 list
- wire 链路：`host.listTreeEntries` RPC（host.ts/host.schema.ts/rpc-map/handler/client/api-proxy `runBrowseListing` 共享门）；connection carrier + fixture（fileTree 文件子树）；runtime `IWorkspaces.listTreeEntries`（DirectoryBrowseError）

### 客户端（新包 `packages/client/ui-project`）
- 注册进 ui-workspace WorkspaceBrowser 新声明的 `sidebar.workspaces.project` 座位（sectionHeader 与会话列表之间，max-height 45% 自滚动区）
- 根 = 当前会话工作区 cwd（回退最近工作区，纯函数 `currentWorkspacePath`）；目录行懒加载一层（AbortSignal 取消折叠/换根的过期请求）；文件行 → `documentOpen.open(path)`（右栏文档面板，Phase 2 服务）
- store 工厂 `createProjectTreeStore`（展开/加载/选中/隐藏开关；层级不持久化）；隐藏行默认隐藏 + 头部「显示隐藏文件」开关（与 DirectoryBrowser 一致）；truncated 提示行；错误行点击重试
- 注册三面：tsconfig.client.json / web-app cordis.patch.yml / web-app package.json；README 双语 + Model Experience + verify 白名单；覆盖门（ui-project 单包 scoped 100%）

### 本轮顺带修复（均为门禁拦截项）
- `tsconfig.base.json` 补 `ui-document`（上一任务遗漏）与 `ui-project` 的 paths 映射（verify-cordis-config）
- `ui-document/documents.ts` 的 `displayPath`/`entryStatus` 补 JSDoc（verify-export-jsdoc）
- `ui-trajectory/TrajectoryTurn.tsx` exactOptionalPropertyTypes 违规（上一任务遗留）
- apiproxy `listDirectory`/`listTreeEntries` 共享核心抽取（jscpd）

### 遗留（非本轮范围）
- 打包产物 `dist-portable/dsh-web-portable.zip` 未含 ui-project；重新打包前需按收官轮流程重建
- jscpd 余 3 处既有克隆（ui-trajectory×2、ui-workspace×1，上一任务未提交改动）；oxlint 余 6 条 max-len（上一任务 ui-tool/ui-conversation 测试文件）
- Windows 本地覆盖率两个 symlink 分支由 Linux CI 车道覆盖（socket/file-link 夹具，仓库既有惯例）

## 构建与验证状态（2026-08-14 晚）

- `npx tsc -b tsconfig.client.json` → **exit 0**（客户端全程序 + 测试类型门通过）
- 受影响包测试：ui-conversation + ui-tool + ui-document + ui-workflow-run → **687/687 绿**
- tsdown 客户端 bundle（lib/client.js）与 `dsh-web-frontend` dist 已重建
- ⚠️ 验证前置：**需从 `D:\Github\dsh_test` 重启 `dsh web`**（组合新增了 ui-document roster 行，运行中的旧进程不会重扫），然后刷新 3080：
  1. 点击消息流里任意 read/edit 工具卡的文件路径 → 右栏自动打开并切到「文档」tab（Codex 跟随）
  2. 右栏「工具详情 | 文档」双 tab；文档 tab = 打开文件标签页（×关闭）+ 触碰文件清单 + 源码阅读器（最新 read 窗口 + 本会话 diff）
  3. agent 运行期间右栏自动跟随最新 read/edit；手动点 tab 暂停跟随至下一轮
- （vitest 输出末尾的 exit 1 为 vite-tsconfig-paths 废弃警告走 stderr 所致，非真实失败；测试/构建均绿）

## 参考素材（.task-ref/）

- `guide-app-overview.md` / `guide-first-task.md` / `guide-task-execution.md` / `guide-approvals.md`（CodexGuide 中文：桌面 App 结构=Chat/Project 双入口、文件夹中心制、diff 检查闭环、审批策略）
- `guide-ide-vscode.md`（IDE 插件：侧边对话面板 + 编辑器 diff；@ 指定文件）
- `codex-webui-readme-zh.md`（社区 web 克隆：文件管理/Monaco/Git diff split 等）
- `codex-webui-*.png`（截图存档，本模型无图像输入未读）
- Codex IDE 版 1:1 要点（已钉进目标）：左=Project 文件夹分组会话；中=任务步骤卡流（工具卡/审批/思考）；右=文件查看器（标签页/跟随/diff 标记）；模式切换与权限控制入口

## 收官轮（2026-08-14 凌晨）— 自查 / e2e 归因 / 打包

### 自查修复（本轮发现并修复）
1. **多文件 diff 交叉污染**（documents.ts）：`foldResultView` 按路径过滤 hunk，每个入口只收自己的 hunk（+回归测试）。
2. **持久化兼容**（stores.ts）：老快照缺 `openDocs` 字段时 `openDocument` 会崩 → action 内 `?? []` 归一（+回归测试：seed 老格式 localStorage 再开文档不抛）。
3. **性能**（DetailsPanel）：`useStore(s => s)` 会因 draft 打字重渲染 → 拆成四个 per-fact selector。
4. **CRLF 污染**：pwsh 批量补丁把 7 个测试文件写成 CRLF → 归一 LF。

### 产物文件点击联动补全（Phase 2/3 交界）
- `TurnTailOwnerProps` + `openDocument`：ui-deliverables 的产物 chips 与正文文件提及 → 右栏打开（保留"在文件夹中显示"走宿主原生）。
- `documentOpen.openPanel()` + 会话头「文件 · N」pill（ui-document 注册 header action，count=触碰文件数，点击开右栏文档页）。

### e2e 归因（真实浏览器回放，双基线对照）
- **本次回归（已修复）**：lifecycle-chrome 4 例——右栏双 tab 结构使 a11y 金样过期 → `DSH_SNAPSHOT=refresh` 刷新（hero/plan-active 两个金样）→ replay 复核 7/7 绿。
- **基线既存失败（与本次无关，原始 C: 检出树同样失败）**：chat-scroll-contract(5)、shipped-composition(2)、minimal-preset(1)、turn-tail-actions(1)、agent-preset-authoring(1)、chat-continuous(1)、approval-composer(1)、replay-round-trip(3)、plugin-config(3)、goal-multi-turn(1)、code-mode-round(4)、details-session-lifecycle(fixture JSON)——根因多为「preset 未挂 bash / Windows 终端检查不支持 / 回放 fixture 转义损坏」。
- settings-chrome：并行负载下偶发，单独跑 8/8 绿。

### 质量门终态
- 单测：受影响 5 包 704/704；全量 test:gui 3784/3786（2 例为并行 flaky，单独复跑均绿）。
- `tsc -b tsconfig.client.json` + `tsconfig.host.json` → 均 exit 0。
- 最终 `pnpm run build`（host+client+frontend）完成；lifecycle-chrome replay 7/7。

### 打包（dist-portable/）
- 方案：工作树瘦身副本（剔除 node_modules/.git/无关目录，恢复 native/packages/examples/website 工作区成员）→ `pnpm install --node-linker=hoisted` 平铺安装（真实目录、无 junction/symlink，压缩安全）→ 材质化唯一残留 workspace 链接 → 内置 node.exe（v24.16.0）→ start.bat + 使用说明.txt。
- 冒烟验证（3199 端口真实启动）：index 200 且含 __DSH_BOOT__；`/plugins/.../ui-document/client.js` 200（21KB、loader handoff）；roster 含 ui-document 行 → 停服、清 home、压缩。
- 产物：`dist-portable\dsh-web-portable.zip`。目标机解压 → 双击 start.bat → http://127.0.0.1:3080（端口冲突设 DSH_WEB_PORT）。数据存 home\，整体拷贝即迁移。

### 遗留（视觉阶段，待用户肉眼验收后继续）
- Phase 3 中栏视觉 Codex 化（工具卡/审批/思考块配色间距）
- Phase 4 左栏细节（时间戳/新建会话入口样式）
- Phase 5 全局 Codex 风格主题（--dsw token 覆盖，不复制商标元素）

## 2026-08-15 续跑（Codex 极致复刻长程任务）

> 用户定调（长程自主跑，不中途询问）：完整 1:1 复刻 Codex 三段式 UI 与交互细节并做到极致。优先级：(1) 目录树；(2) 右栏源码/阅读切换；(3) Phase 3 中栏；(4) Phase 4 左栏；(5) Phase 5 主题。基于网络/GitHub 调研 Codex 菜单层级、交互、token、UX，不重复造轮子。全部测试绿 + 持续更新本文件。最后审计代码并修复，产出复刻程度/架构/功能对比报告。

### 事件：会话日志损坏（已修复）
- 现象：杀终端后 session-7c547c04 历史加载失败 `seq gap in committed region at line 3235 (expected 38987, got 38986)`。
- 根因：两个 web 进程并发持有同一会话（影子进程 A + 真实对话进程 B），恢复轮次按批交织写入，seq 38986/38987 区域重叠。
- 修复：解码全帧 → 前缀行 1..3235（至 end-seed 38986）+ 线程 B 全部行（spliced 38987..tool/call 78400，零重编号，接缝天然连续）→ header 帧 + 单事件帧重编码 → scanLog 验证 78401 事件全连续 → 原子替换。原件备份 `.task-ref/session-7c547c04.orig.jsonl.zstd`。其余会话扫描正常（基线 breaks=2 为 header 伪报）。
- 遗留根因（记录）：宿主 session 服务跨进程独占不足；影子进程 A 内容为重复诊断轮（已弃）。

### 运行环境约束（重要）
- 当前 3080 = PID 51980（旧构建，boot 无 ui-document），**本 agent 循环运行在该进程内**——开发期间绝不杀它；新构建用新端口起服验证；收尾用 detached 延时脚本交接 3080（TerminateProcess 不杀子孙，脚本可存活）。

### 进度（本日）
- [x] 日志修复（如上）
- [x] 优先级(2) 右栏源码/阅读切换：上一轮已实现（DocumentPanel modeSwitch + createDocumentViewStore + MarkdownText），本轮验证 ui-document 32/32 绿。
- [~] 优先级(1) 目录树：宿主 RPC 面 461/461 绿、wire 契约/ui-project 包完成；全量 test:gui 已含其 5 个 spec 且 3855/3856 全绿——代理在最终回传中。
- [x] Phase 3 中栏：完成（797/797 复验绿）——工具卡耗时 chip、turn 墙钟跨度、思考块本地化；已记录 2 项诚实差距（聊天流步骤分组条、审批 5 态徽章）。
- [x] 审计：已完成面审计无严重/中等问题；5 条建议全部处置（chip tint token 化、悬停卡 Codex 灰阶、DST 日历减法、2 处 Known Limitations；S4 平台别名改名列独立后续）。ui-conversation 420/420、ui-workspace 131/131 复验绿。
- [x] 审计修复（主 agent 亲自）：InputBar/MessageItem 字面 tint → color-mix 语义别名；tree.ts 昨天判定 DST 修复 + 清理未用常量。
- [x] 调研：3 个后台 agent 完成 → `.task-ref/specs/`（官方结构 / 开源实现 / 设计 token）。
- [~] Phase 3 中栏（subagent 进行中）。
- [x] Phase 4 左栏：ui-workspace 12 文件——时间戳分桶（sessionTimeBucket）、新会话入口（宽/窄双形态）、分组高亮折叠保持、键盘可达、reduced-motion；131/131 绿、coverage 100%、bundle exit 0、零字面色。与目录树 agent 的 sidebar.workspaces.project 槽声明并发无冲突。
- [x] Phase 5 主题：ui-theme 新增 codex-theme.css（炭灰 #0E0F12 + 石板灰阶梯 + 品牌绿 #10A37F + diff #34C759/#FF5F57 + Codex 字体栈），65/65 绿，dist CSS 验证通过。
- [x] 交接机制验证：分离启动 + 文件重定向可在沙箱内起服（3082 探测 200 + ui-document roster）；swap-3080.ps1 升级为探测循环。注意：启动需 ~60-90s；Start-Job 管道捕获在沙箱下静默失效，必须用文件重定向。
- [ ] 质量门、审计、报告、3080 交接。

## 2026-08-15 收官轮状态卡（会话续跑入口 · goal 轮次 14/14 用尽）

### 状态总览（2026-08-15 收官后更新：全部实现代理完成，门禁闭合）
- ✅ 全部完成：日志修复（生产读路径验证）、阅读模式（32/32）、目录树（宿主 461/461 + ui-project 全量并入 test:gui）、Phase 3（798/798 复验）、Phase 4（131/131 + coverage 100%）、Phase 5（65/65）、调研三件套、审计（无严重/中等问题，5 建议全部处置）、报告（CODEX_REPLICA_REPORT.md 全章完成）。
- ✅ 门禁：test:gui 281 文件 3855 绿；tsc client+host exit 0；build exit 0；lifecycle-chrome 金样刷新后 replay 7/7；3082 起服探测 ui-document+ui-project 双 True。
- ✅ e2e 归因：其余回放失败全部基线既存（fixture JSON 转义损坏 / preset 未挂 bash / tool-pwsh 08-11 组合 bug），详见报告 §7.3。
- ✅ 3080 交接已排程：swap-3080.ps1 分离进程执行（睡 120s → 杀 51980 → 起新构建 → 探测循环 3 分钟；日志 .task-ref/swap-3080.log）。
- 遗留（下轮建议）：聊天流步骤分组条、审批 5 态徽章、评审面板能力、目录 watch 推送、会话写独占、dist-portable 重打包——见报告 §10。

### 调研关键结论（.task-ref/specs/）
- **权威数据契约 = openai/codex 的 `app-server-protocol`**（v2 JSON-RPC + JSON Schema）：左栏 `FsReadDirectory/FsWatch`、中栏 `TurnItem` 流（ItemStarted/ItemCompleted/AgentMessageDelta/CommandExecOutputDelta…）、右栏 `FileChangePatchUpdatedNotification`、审批决策枚举（Accept/AcceptForSession/Decline/Cancel…）。前端源码不公开，随 codex 二进制分发。
- 设计 token（codex-design-tokens.md）：炭灰底 #0E0F12、面板 #202123、文字 #F5F7FA/#9EA1AA、品牌绿 #10A37F、次级蓝 #2B8FFF、成功 #34c759、错误 #ff5f57、diff 新增/删除同前两者、字体 UI=SF Pro Text/Inter + 代码=SF Mono/IBM Plex Mono。现有 dsh 暗色主题结构同源，只需重指语义别名。
- 可抄开源实现（codex-oss-implementations.md）：LimLLL/codex-webui（React 克隆：Monaco+git-diff-view+扁平懒加载树+审批动态按钮）、theswerd/brainless（CLI 视觉 1:1：ANSI 色 #ededed/#7a7a7a/#abdfa7/#f2a0a0/#5cc2e0、Working shimmer、状态点）、AIDotNet/ClaudeCodexUi（真三段式+可拖拽分隔条+CSS token 表）、friuns2/codexapp（真 app-server 浏览器桥，仅参考思路）。

## 2026-08-15 全局深度复刻（第二轮长程任务）

> 用户第二轮定调：修复左侧栏重复 bug；文件查看器改为 Codex 式独占/整页视图（带按钮+标签页，非右下角半页）；系统性学习并复刻 Codex 的系统架构/菜单层级/交互逻辑/功能模块/按钮设计/UI/UX，并在此基础上优化。长程自主，全局由我做主。
> 第三轮指令（用户睡觉前）：① 目录树放最左侧独立栏；② 文件 tab 一键全部关闭；③ 剩余 Codex 功能全部实现。

### 第三轮进展
- [x] **4 栏布局**：AppFrame 三栏 → 四栏「文件树(240, 200-400) | 会话栏 | 中栏 | 详情栏」；computeColumns 六步让步链（details 先缩先关 → 树再缩再关 → center 兜底）；树栏默认常驻、可拖拽、头部 ✕ 收起（layout.toggleTree）；ui-project 注册位 `sidebar.workspaces.project` → `frame.projectTree`（ui-layout 声明）；ui-workspace 回退 Chat/Project 切换（纯会话列表）。ui-layout 62/62、ui-workspace+ui-project 158、tsc client 0。
- [x] **tab 全部关闭**：DocumentPanel 标签行尾「全部关闭」（≥2 tab 时出现，一次 onClose 全部）。ui-document 33/33。
- [x] **缓存根治**：index.html 无缓存头 → `Cache-Control: no-store`（boot manifest 每次必新，根治「看不到新 UI」）；frontend-static 测试加缓存断言。
- [x] **会话切换快捷键**：`Cmd/Ctrl+Shift+[ / ]`（ui-sidebar apply 文档级 keydown，按 list.ids 顺序环切）。ui-sidebar 26/26。
- [x] **树栏折叠轨（重新打开按钮）**：树收起后变 32px 窄条 + `›` 展开按钮（与侧栏折叠轨一致，栏位永不消失）。ui-layout/ui-project 全绿。
- [x] **Cmd+G 搜索**：WorkspaceBrowser 文档级 keydown → 展开侧栏 + 聚焦搜索框（复用 rail 搜索路径）。ui-workspace 130/130。
- [x] **产物预览（HTML 渲染/源码）**：ui-document 阅读模式扩展 `render` 态，.html 文件显示「渲染」按钮，沙箱 iframe srcdoc 渲染（sandbox="" 不执行脚本）。ui-document 34/34。
- [x] 已核实既已接线（无需重做）：ContextMeter 上下文圆环、GoalBar、PermissionSelect 三档、ModelSelect、StatsLine、StateDot 状态徽标；审批卡已是「等待→已提交」两态（DSH 同步审批语义，Codex Auto-review 5 态属异步模型，不强行造态）。
- [x] **聊天流步骤分组（Step N）**：ChatView 在 step 跃迁处插入步骤头（`Step N` + 状态点 ongoing/done/error，数据源 step/end 开步骤信号 + 错误证据），纯渲染层派生，不动对象层/事件。ui-conversation 430/430。
- [ ] 诚实标注（需宿主大能力，非纯 UI 复刻）：Cmd+K 命令面板（需命令注册表）、评审 scope+stage/revert（需 git 后端）、集成终端（需宿主终端会话后端）。

### 已修复/落地
- [x] 「两个 +新会话」：侧栏外壳（ui-sidebar）本有「新会话」按钮，删除了 Phase 4 在 WorkspaceBrowser 重复加的那个（含 CSS/函数/测试），ui-workspace 130 绿。
- [x] 「两个 dsh_test 文件夹」：实现 **Chat/Project 分层**——WorkspaceBrowser 顶部「对话 | 项目」segmented 切换（store.view + setView）；Chat 视图=会话列表、Project 视图=目录树全高（二者不同时显示）。ui-workspace 130/130 绿（含切换器测试）。
- [x] 文件查看器 reader 主导：DocumentPanel 重排「标签页→reader 全高→inventory 底部紧凑区」（ui-document 32/32）。
- [x] 文件查看器可「独占」：details 栏宽度上限 520→960、默认 360→480（ui-layout 58/58），右栏可拖到主导宽度。
- [x] 文件查看器快捷键 + 自动扩宽：`Cmd/Ctrl+Alt+B` 开关右栏（AppFrame 文档级 keydown + 测试）；打开文件走 `layout.expandDetails()`（→DETAILS_MAX 960 主导宽度，仅文档打开路径），工具详情仍用 openDetails(480)。ui-layout 59/59、ui-conversation+ui-document+ui-workspace 642/642 绿。
- [~] 调研：codex-design-system.md（22 功能模块/按钮规则/10 交互状态机/12 优化建议）+ codex-window-architecture.md（关键结论：官方 Codex 无「整页」文件查看器，是右栏可开关可调宽 pane；已按此实现）。待办（大特性，超出纯 UI 复刻）：集成终端（底部面板+tab 条合并）、评审 scope 切换 + stage/revert（需 git/宿主能力）。

## 2026-08-15 第三轮修正（用户自我修正：「项目文件」左栏与左侧栏重复 → 目录树移入文档视图并列）

> 用户指令演进：先「文件树放最左侧独立栏」（已按此实现 4 栏布局）→ 随后自我修正「最左端新增的'项目文件'是什么？和原来的不是重复了吗？没必要增加」→ 最终口径「打开文档，目录树与文档阅读**并列**（同屏并排，非上下堆叠）」。

### 本轮落地
- [x] **布局回退三栏**：ui-layout 移除 `frame.projectTree` 槽 / `TREE_*` 常量 / `toggleTree` / 树栏拖拽柄与折叠轨；`computeColumns(viewport, sidebar, details)` 三步让步链；`ILayout = toggleSidebar/openDetails/expandDetails/closeDetails`。保留：`Cmd/Ctrl+Alt+B`、`expandDetails()` 960、窄窗自动折叠、no-store 缓存头。
- [x] **目录树移入文档视图**：ui-document DocumentPanel 声明子槽 `conversation.details.document.tree`（single/root scope，owner 为空）；主体改双栏 `[treePane(200px) | viewer]`；ui-project 注册位迁入该槽，删除 collapsed rail/宽度 owner/toggleColumn/头部 ✕，locale 删 collapseColumn/expandColumn；依赖面 ui-workspace/ui-layout → ui-document（tsconfig/package/dsh.client.inject 三面）。
- [x] **ui-document 瘦身**：会话触碰文件清单（inventory）整体移除（项目目录树取代其概念）；删 `deriveDocumentTreeRows` + store 的 `collapsedDirs/toggleDir` + 死 CSS；阅读器保留 tab 条/全部关闭/自动跟随/三模式（源码·阅读·渲染）/diff/联动；README 双语更新。
- [x] **测试全绿**：ui-layout 62、ui-project 25、ui-document 37；`test:gui` 283 文件 **3862 通过 / 1 跳过 / 0 失败**；`tsc -b tsconfig.client.json` exit 0；`pnpm run build` exit 0。
- [ ] 3080 交接（重建 bundle 后 swap-3080.ps1 探测换服）——收尾步骤。

### 不变的既有完成项（不回退）
- 右栏 tab 条 + 全部关闭、自动跟随、阅读/渲染模式、`documentOpen` 卡片联动、「文件 · N」pill、details 960/480 + 快捷键。
- 中栏耗时 chip / turn 墙钟 / 思考块本地化 / 审批卡两态 / Step N 分组（430/430）；左栏时间戳分桶 / 唯一新建入口 / 分组高亮；Cmd+G 搜索、Cmd/Ctrl+Shift+[·] 会话切换；Codex 主题；Cache-Control: no-store。

## 2026-08-15 第四轮定调（用户最终口径：目录树=最右端常驻真实目录树）

> 用户消息（原文要点）：「我要的是项目目录树，不是项目文件的对话。目录树没了，而且目录树应该在最右侧」+「这个 dsh_test 显示 无法读取此目录」。

### 最终布局（四栏，树在最右）
- `[会话栏 | 中栏 | 详情栏(文档阅读) | 项目目录树]` —— 树是**永久存在的最右栏**（默认 240px，可拖 200-400，头部 ✕ 收起为 32px 重新打开轨，`ctx.layout.toggleTree()`）。
- 文档阅读与目录树并列：打开文档时详情栏与树同屏（树在最右端）；树不再只在打开文档时出现（「目录树没了」修复）。
- 让步链（columns.ts 五步）：details 先缩→details 关→tree 缩→tree 收轨→center 兜底；sidebar 永不退让。`data-tree-collapsed`/owner props 按**解析后宽度**判定（窄窗让步挤出的轨也渲染轨 UI）。
- AppFrame 树拖拽柄在树左缘（左拖=加宽）；details 柄在 details 左缘；`Cmd/Ctrl+Alt+B` 仍管详情栏。

### 「无法读取此目录」根因与修复
- **根因**：web-app 组合 `directory-picker-auto`，resolve（win32 + 127.0.0.1 回环）→ **native** 后端——原生对话框能力不含 `listTreeEntries`，`host.listTreeEntries` 返回 `directory-picker-unavailable`，树根层级报错行。
- **修复**：web-app cordis.patch.yml 直接钉 browse 对（`dsh-host-directory-picker-browse` + `dsh-client-ui-directory-picker-browse`，auto 注释本身允许 overlay 钉选）；tsconfig.base.json 补 ui-directory-picker-browse paths 映射（verify-cordis-config 门要求行可经 paths 解析）。工作区目录选择随之变为**应用内目录浏览器**（更 Codex）。
- 后端本体验证：browse 能力对 `D:\Github\dsh_test`（64 项）三种写法全部列举成功——问题只在能力选型。

### 测试与门禁
- ui-layout 67（四栏右树 + 五步让步链 + 树轨/拖拽/owner props）；ui-project 25（含 toggleColumn 注入 + 折叠轨）；ui-document 36（纯 reader 回归）。
- `test:gui` 全量跑：**唯一红 = ui-primitives code-block 懒加载语法 5s 超时**（环境负载 flake，与本任务零改动文件；23 个 shiki 语法动态导入逐一验证全部成功，早前单跑亦曾全绿）。ui-trajectory client-bundle 与 api-proxy-search 两例仅在全量并行下失败，单跑绿。
- `verify-cordis-config` 168 通过；`tsc -b tsconfig.client.json` exit 0。
- 待办：build + 3080 换服 + 肉眼验收。

### 关键回归点（验收清单）
1. 打开 GUI → 最右端常驻「项目文件」目录树（dsh_test 根 64 项可展开，不再报「无法读取此目录」）。
2. 点树内文件 → 左侧详情栏打开文档（源码/阅读/渲染三模式），树与阅读并列。
3. 树头部 ✕ → 32px 轨；轨上 › 恢复。拖拽树左缘可调宽。

## 2026-08-16 第五轮（用户：树的观感回到「有线 + 丝滑」）

> 用户消息：「这和你最早给我看到的目录还是不太一样，之前的有『线』的链接，并且效果更『丝滑』，哪个版本唯一的问题就是没有独立竖窗口。找回那个版本，换成现在的独立竖窗口即可。」（+「继续」×2）

### 现状说明（如实）
- 早期「有线」版本未进 git：整段任务历史被收尾轮压成一次提交（`ee2ba4e647`），中间树样式无单独存档（`git reflog` 只有 clone→checkout→两次 commit+amend；`fsck --unreachable` 仅 2 个 pre-amend commit，其 ui-project 文件与 HEAD 完全一致）。故按描述**重建**而非原样找回。

### 本轮落地
- [x] **引导线回归（「线」）**：ProjectTree 从扁平 `--depth` 缩进改回**嵌套 `role=group` 层级 + 竖向引导线**（`.tree [role='group'] { margin-left:10px; padding-left:10px; border-left:1px solid var(--dsw-alias-border-l2) }`），子项沿父级竖线缩进——同仓库嵌套调用树（ui-tool ToolCallTree）的「线」观感。
- [x] **丝滑**：行 hover `background/color` 加 120ms 过渡（`prefers-reduced-motion` 已覆盖禁用）；表头固定、列表区独立滚动（有滚动条）保持。
- [x] **拖宽手柄加宽**：AppFrame `.handle` 8px→12px（margin -4→-6），更好抓取。
- [x] 验证：ui-project 29 例绿；`build:lib:client` exit 0；3082 服务端 bundle 已确认含引导线 CSS。

### 部署状态（重要）
- **3080**：今早 11:36 被宿主重启为**自带的旧版 GUI**（无 ui-project/ui-document、native picker）——承载本 agent 会话，按规则不杀。
- **3082**：D: 最新构建（`start-3082.ps1`，`--port 3082`，日志 `.task-ref/server-3082.*.log`）——用户验收入口 **http://127.0.0.1:3082**。
- 附带：`.task-ref/`、`dist-portable/` 两个未跟踪目录在磁盘上消失（疑似收尾清理）；代码与已提交内容无损。

## 2026-08-16 续跑（本 session · 保真度审计后的 P0 推进）

> 触发：用户「开动」。读 `CODEX_FIDELITY_AUDIT.md` 后确认真实保真度 视觉~40%/交互~50%/功能~30%，用户实机结论「跟 Codex 差很远」已记档。按审计 P0 清单推进：@ 文件引用 / 审批第三态 / Review pane / ↑ 编辑上一条。

### 本轮落地
- [x] **清掉跑偏的动态插件**：此前在 3080 旧进程上做的 `codex-1` 换肤插件（浮层文件树）整体删除——与源码级复刻无关，纯噪音。
- [x] **树样式提交 + 部署**：未提交的「引导线 + 丝滑」3 文件（`AppFrame.module.css`/`ProjectTree.module.css`/`ProjectTree.tsx`）单独提交 `e89f827f4f`（此前「有线」版曾因整段压缩丢失，本次保住）。客户端 bundle 重建，3082 重启，boot rev `2ac72e4fd4b0`，服务端已确认含 `[role=group]+border-left` 引导线 CSS。
- [x] **P0「↑ 编辑上一条」**（Codex edit-previous，高频交互）：`conversation-nodes/user.ts` 新增纯函数 `recallLastUserText(nodes)`（倒序找最近 `user` 节点，concat 文本块、跳过非文本块）；`InputBar.tsx` 空草稿 + 无菜单消费 + 未锁定/未提交时，↑ 召回最近用户提示词并 `setDraft` + 光标回尾（selector 派生为 primitive，流式节点追加不重渲染）。测试 `recall-user-text.client.spec.ts` 5 例；ui-conversation 全量 435/435 绿；`tsc -b tsconfig.client.json` exit 0；提交 `cae4143fdd`。
- [x] **P0「@ 文件引用」**（MVP）：`ui-project` 新增 `file-search.ts`（`searchWorkspaceFiles` 有界 DFS 模糊搜索，跳过 node_modules/.git/dist 等重目录，RESULT_CAP 200 / VISIT_CAP 300，AbortSignal 中止）+ `basenameOf`；`index.ts` 注册 `@` 源 `name:'file'`（`ctx.get('inputTriggers')` 可选，`sessions` 经 `ctx.get` 可选——树注册不依赖二者）；onPick 插 chip `{source:'file', ref:path, label:basename}`，codec `serialize` 送路径（模型用 `read` 工具读取，**内容直插为后续**：需宿主 readText RPC）；`ui-input-trigger` 菜单字典补 `file`（zh 文件 / en Files）。测试 `file-search.client.spec.ts` 6 例 + ui-project 35/35 + ui-input-trigger 108/108 绿；tsc exit 0；提交 `a627c126cf`。

- [x] **@ 文件引用内容直插**：新增 `host.readText` RPC 全链路——directory-picker browse 能力 `readText`（readFile + stat 判文件 + 64KiB 上限 + fully-qualified 围栏 + `file-unreadable` 错误码）、apiproxy（host.ts/schema/rpc-map/rpc.ts 错误词汇/rpc.schema/handler/fetch client/api-proxy）、client runtime（`IWorkspaces.readText` + `WorkspaceRuntime.readText`）；ui-project 的 codec.serialize 改为 `readText` 内联内容（`File: <path>\n\n<content>`，读取失败优雅回退路径）。测试：directory-picker-browse 19/19、apiproxy 380/380、runtime workspaces 23/23、ui-project 35/35 绿；host+client tsc 双 exit 0；提交 `305394ac05`。

- [x] **P0「审批第三态」**（always-allow / session-wide grant）：`ApprovalOutcome` 增 `allowed-for-session`、`ApprovalPolicy` 增 `always-allow`（自动批准，模型侧 `ALWAYS_ALLOW_SENTENCE`）；服务 `decide()` 对 `always-allow` 确定性返回 `allowed-once`，`request()` 收到 `allowed-for-session` 时 `setApprovalPolicy(session,'always-allow')`；ApprovalPanel 增第三按钮「总是允许」；wire（approvals/approvals.schema/events.schema）+ tools switch + sandbox escalation switch + invariant + fixture 全链路同步。测试：user-approval 33/33、sandbox escalation 11/11、apiproxy-approval 11/11、ui-conversation + core/tools 821/821 绿；host+client tsc 双 exit 0；提交 `31dcb00260`。

### 下一步（P0 续）
- Review pane MVP（last-turn 过滤 + Keep/Revert）；审批「编辑后执行」（面板内编辑命令再执行，属后续）。

## 2026-08-16 收官汇总（本 session · 5 轮）

> 5 轮完成 5 个 P0 + 树样式部署 + 跑偏插件清理，每轮测试/tsc/build 全绿。真实保真度从「视觉切片」推进到「有核心工作流」（@ 文件引用 + 审批第三态 + 内容直插）。

### 已完成（提交链）
- `e89f827f4f` 树样式（引导线+丝滑，保住此前丢失的「有线」版）
- `cae4143fdd` P0「↑ 编辑上一条」
- `a627c126cf` P0「@ 文件引用」MVP（搜索+插 chip）
- `305394ac05` P0「@ 文件引用内容直插」（host.readText RPC 全链路）
- `31dcb00260` P0「审批第三态」（always-allow / session-wide grant）

### 验证口径（全绿）
- `verify-cordis-config` 120 配置通过；host+client `tsc -b` 双 exit 0；`build:lib` exit 0
- 分面：ui-project 35/35、ui-conversation 435/435、ui-input-trigger 108/108、ui-document/ui-workspace/ui-layout/ui-sidebar 248/248、apiproxy 380/380、user-approval 33/33、sandbox escalation 11/11、core/tools+ui-conversation 821/821、directory-picker-browse 19/19、runtime workspaces 23/23
- 3082 部署：boot rev 逐步推进至 `9df08637edd0`（含树样式/readText/审批第三态）

### 遗留（下一 session 续）
- **P0**：Review pane MVP（last-turn 过滤 + 逐文件 Keep/Revert，需 host.writeText RPC + 反向补丁）；审批「编辑后执行」
- **P1**：审批 resolved 5 态徽章（Reviewing/Approved/Denied/Aborted/Timed out 驻留，DSH 现为一次性 composer 语义）；Cmd+K 命令面板；/status /diff /init /rename 命令；桌面通知；Read-only 预设档；终端 tab；归档恢复入口（归档不可逆=bug 级缺口）
- **P2**：云任务/PR/automations；worktree 隔离；Chronicle 记忆；Cmd+F 线程内查找
