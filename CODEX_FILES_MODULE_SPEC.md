# Codex Files 模块复刻规格（dsh 参考计划）

> 起草：2026-08-17。目标：在 dsh 上复刻 Codex 桌面 App 的 Files 模块——tab 条、文件阅读区、文件树——覆盖交互、UI/UX 与 feature 细节。
> 用法：本文档是需求基线，不是实现方案。**C 级条目必须在对应素材（S/R 编号）回收后才能进入实现**；A 级条目可直接开工。

## 0. 给 dsh 执行者的导读

- 本文档按「维度 × 状态 × 置信度 × 素材」组织。实现顺序建议：先 A 级（协议与既定行为），素材回收后补 C 级。
- 权威协议副本已下载到 `.codex-ref/schema/*.json`（来源：openai/codex 仓库 `codex-rs/app-server-protocol/schema/json/v2/`），字段名以这些文件为准。
- 合规红线：不复制 OpenAI 专有代码与图形资产（logo/商标/icon 位图）；只复刻行为、交互与设计数值。
- 验收不靠文字描述：静态视觉用截图对比（expected=Codex 截图，actual=dsh 截图），行为用 keyless snapshot（走真实可运行 example，仓库既有惯例）。

## 1. 范围

**在范围内**：Files 面板的三个子模块及其联动——
1. **Tab 条**：打开文件的标签页集合及其全部状态。
2. **文件阅读区**：文件内容展示（源码/diff/其他模式）、行号、跟随逻辑。
3. **文件树**：workspace 目录树、懒加载、实时刷新、变更徽标。
4. **跨模块联动**：消息流/评论/会话切换与上述三者的交互。

**不在范围内**：面板的开合框架本身（已另行讨论）、终端面板、审批卡、threads 列表。

## 2. 置信度体系

| 级别 | 含义 | 来源 |
|---|---|---|
| A | 已确认 | `app-server-protocol` schema（本地副本）或 Codex app 内第一手事实 |
| B | 强推断 | 协议能力推断出的行为、上轮调研沉淀（`CODEX_REPLICA_REPORT.md` 记录的 CodexGuide/社区结论）、产品通识 |
| C | 待素材确认 | 像素、菜单、快捷键、动效、策略阈值——必须由 S（截图）/R（录屏）素材落定 |

## 3. 数据契约基准（A 级，可直接开工）

以下字段形状是 Codex 官方对「UI 渲染什么」的显式定义，dsh 对应 RPC 应保持语义等价（字段名可 dsh 化）：

| Codex 协议 | 形状 | dsh 用途 |
|---|---|---|
| `fs/readDirectory` | 请求 `{path}` → `{entries: [{fileName, isFile, isDirectory}]}`（仅直接子项，不含路径） | 文件树逐层懒加载 |
| `fs/watch` | `{path, watchId}` → `{path}`（规范化后）；连接级 watchId | 树/阅读器订阅根目录变更 |
| `fs/unwatch` | `{watchId}` | 取消订阅 |
| `fs/changed`（通知） | `{watchId, changedPaths: string[]}` | 收到后逐路径重读受影响目录，刷新树与已打开 tab |
| `fs/readFile` | `{path}` → `{dataBase64}` | 阅读器取内容（dsh 侧需加大文件语义，见 §8） |
| `FileChangePatchUpdatedNotification` | `{threadId, turnId, itemId, changes: [{path, kind: add\|delete\|update{move_path}, diff}]}`，`diff` 为文本 patch | 阅读器 diff 标记与树徽标的数据源 |
| `FuzzyFileSearch*`（v1 面） | 存在于协议 | 树过滤/文件快速定位的候选能力（行为 C 级） |
| ~~`FileChangeOutputDeltaNotification`~~ | 官方已废弃，服务器不再发出 | 不实现 |

## 4. 状态矩阵

### 4.1 Tab 条

| # | 维度 | 状态/变体与预期行为 | 置信度 | 素材 |
|---|---|---|---|---|
| T1 | 位置 | 阅读区顶部的水平 tab 条；面板标题/操作（关闭、更多菜单）是否同排 | C | S01 |
| T2 | 标签内容 | 默认仅显示文件名（非路径）；hover tooltip 显示相对或绝对路径 | B/C | S01 |
| T3 | active/inactive 样式 | 指示条/背景/文字色三态 | C | S01 |
| T4 | hover 态 | 背景、关闭按钮显隐 | C | S02 |
| T5 | 关闭交互 | × 按钮；中键关闭；快捷键（⌘W/Ctrl+W）；关闭后激活哪个 tab（相邻 vs 最近使用） | C | S02/R09 |
| T6 | 修改标记 | 「本会话内被修改过」的徽标（点/色条）；新文件 vs 改文件 vs 删除文件的差异 | C | S03 |
| T7 | 溢出策略 | tab 超宽后：横向滚动 / 下拉收拢 / 压缩宽度，三者组合方式 | C | S04/R03 |
| T8 | 长文件名 | 截断省略号方向、是否保留扩展名 | C | S04 |
| T9 | 文件类型图标 | 是否有类型图标/按扩展名着色 | C | S01 |
| T10 | 拖拽重排 | 是否支持，落点指示样式 | C | R02 |
| T11 | 重复打开 | 已打开文件再次触发打开 → 复用并激活既有 tab（不重复开） | B | R05 |
| T12 | preview 语义 | 树点击是「预览 tab」（再点别处被替换，VS Code 式）还是「固定打开」；何种交互升级为固定 | C | R05 |
| T13 | 空态 | 无 tab 时阅读区显示什么 | C | S15 |
| T14 | 记忆范围 | tab 集合按 session 记忆还是全局；重启后是否恢复 | C | R08 |

### 4.2 文件阅读区

| # | 维度 | 状态/变体与预期行为 | 置信度 | 素材 |
|---|---|---|---|---|
| V1 | 模式集合 | 源码（语法高亮）确定存在；是否存在渲染模式（markdown 预览）、diff 独立模式 | B/C | S05/S06 |
| V2 | 行号 | 源码模式单行号；diff 视图新旧双行号；相对行号有无 | B/C | S01/S06 |
| V3 | diff 标记 | 行背景红绿；gutter +/-；hunk 头（`@@ -a,b +c,d @@`）；多 hunk 折叠与跳转控件 | B/C | S06 |
| V4 | diff 粒度 | 显示「最近一次 turn 的 patch」还是「本会话累计」；`FileChangePatchUpdatedNotification` 按 itemId 推送，聚合策略在 UI 侧 | C | R10 |
| V5 | 删除/新增文件 | delete：tab 内展示什么；add：新文件 diff 全绿 | C | S03 |
| V6 | 跟随状态机 | agent 运行中自动切到最新 read/edit 文件并滚动到触碰窗口；用户滚动/切 tab → 暂停；下一轮开始 → 恢复跟随；是否存在「跟随中」指示器与手动恢复按钮 | B/C | R01/S07 |
| V7 | 滚动记忆 | 每个 tab 独立记忆滚动位置 | C | R08 |
| V8 | 大文件 | 截断提示、加载更多、行数上限 | C | S17 |
| V9 | 二进制/图片 | 图片直接渲染（消息内绝对路径图片确定可渲染 A；阅读器内行为待确认）；二进制占位样式 | A/C | S16 |
| V10 | code comment 锚点 | 行级高亮 + gutter 评论图标 + 点击展开评论（协议事实：评论带 `file/start/end/priority`） | A/C | S08 |
| V11 | 换行 | 长行 wrap/clip 切换有无 | C | S06 |
| V12 | 文件内搜索 | 有无 Ctrl+F 及其 UI | C | S14 |
| V13 | 复制操作 | 复制路径/复制行/复制选区入口 | C | S13 |
| V14 | 只读语义 | 阅读器只读（不内联编辑）；「在编辑器打开」类跳转有无 | B/C | S01 |
| V15 | 设计 token | 等宽字体族/字号/行高、语法主题、深浅主题、圆角、密度 | C | D01 |

### 4.3 文件树

| # | 维度 | 状态/变体与预期行为 | 置信度 | 素材 |
|---|---|---|---|---|
| F1 | 根 | 当前 workspace/cwd 为根；多根 workspace 支持与否 | B/C | S01 |
| F2 | 懒加载 | 展开才 `readDirectory` 该层；loading 指示；错误行 + 点击重试 | A/B | S09/R04 |
| F3 | 折叠记忆 | 展开状态会话内记忆；持久化与否 | C | R08 |
| F4 | 排序 | 目录优先/文件优先、字母序规则（大小写、数字）、`node_modules`/`.git` 特殊处理 | C | S09 |
| F5 | 隐藏文件 | dotfiles 默认隐藏 + 显式开关；开关位置 | B/C | S10 |
| F6 | 截断 | 超大目录 truncated 提示行与阈值 | C | S11 |
| F7 | 变更徽标 | 会话内改/增/删着色（协议数据源为 FileChangePatch 通知）；是否显示 +/- 行数统计 | C | S12 |
| F8 | 实时刷新 | agent 写文件后树自动更新（`fs/watch` → `fs/changed` → 重读受影响目录） | A/B | R06 |
| F9 | 点击行为 | 文件 → 打开 tab（联动 T11/T12）；目录 → toggle；单击 vs 双击差异 | B/C | R05 |
| F10 | 键盘导航 | 上下/左右展开折叠/Enter 打开 | C | S09 |
| F11 | 右键菜单 | 菜单项全集；是否含写操作（新建/重命名/删除）还是纯只读（复制路径类） | C | S13 |
| F12 | 过滤/搜索 | 过滤框有无（协议有 FuzzyFileSearch 可承载） | C | S14 |
| F13 | 缩略徽标 | git 分支状态 dot（上轮已按 VS Code 惯例实现过一版，Codex 原生行为待证） | C | S12 |

### 4.4 跨模块联动

| # | 联动 | 行为 | 置信度 | 素材 |
|---|---|---|---|---|
| X1 | 消息流 → tab | 点击 read/edit 工具卡的文件路径 → 打开 tab 并滚动到触碰位置 | B | R07 |
| X2 | 评论 → 锚点 | code comment（file/start/end）在阅读器落行级锚点 | A/B | S08 |
| X3 | 会话切换 | 切换 thread 后 tab 集/滚动/树展开的恢复范围 | C | R08 |
| X4 | Files 入口 | 会话头「Files · N」类入口打开面板并定位 | B | S01 |
| X5 | 面板记忆 | 面板开合/宽度持久化范围 | C | S18 |

## 5. 显式状态机（实现时的单一事实源）

**FollowMode（跟随）**

```
AUTO_FOLLOW --用户滚动/切 tab--> PAUSED
PAUSED --下一轮 turn 开始--> AUTO_FOLLOW
PAUSED --手动点击「跟随」指示器(若存在)--> AUTO_FOLLOW   [C: S07]
```

**TreeNode**

```
COLLAPSED --展开--> LOADING --成功--> EXPANDED
                          --失败--> ERROR(点击重试)
EXPANDED --收起--> COLLAPSED   （子级缓存保留策略 [C]）
EXPANDED --收到 fs/changed 覆盖路径--> 重读受影响层
```

**Tab**

```
CLOSED --打开--> BACKGROUND <-> ACTIVE
任意态 --本会话 edit 命中--> MODIFIED(徽标派生，非持久状态)
任意态 --文件被删除--> DELETED 展示态 [C: S03]
```

**Watch 生命周期**

```
面板挂载 --> fs/watch(workspace根, watchId)
fs/changed{changedPaths} --> 逐路径失效并重读受影响目录（合批/节流策略 dsh 侧设计）
面板卸载/会话切换 --> fs/unwatch(watchId)
```

## 6. 素材清单（用户按编号捕获）

### 截图 S

- [ ] S01 Files 面板全景默认态：tab 条 + 阅读器 + 文件树同框（多 tab、其中一个 active）
- [ ] S02 tab hover 特写（关闭按钮显隐）
- [ ] S03 修改态三连：改过的文件 / 新建文件 / 被删除文件 的 tab 与树徽标
- [ ] S04 tab 溢出 + 一个超长文件名 tab
- [ ] S05 若存在「渲染/阅读」模式：同文件源码态与渲染态各一张
- [ ] S06 diff 视图特写：多 hunk、行号槽、gutter 符号（含一处长行）
- [ ] S07 跟随指示器特写（若存在）
- [ ] S08 code comment 行锚点态：gutter 图标 + 展开后的评论
- [ ] S09 树展开 3+ 层（排序规则、图标、缩进可见）
- [ ] S10 隐藏文件开关前后对比（两张一组）
- [ ] S11 超大目录截断提示行
- [ ] S12 树变更徽标：改/增/删各一张
- [ ] S13 树右键菜单展开态
- [ ] S14 树过滤/文件内搜索（若存在）
- [ ] S15 阅读区空态
- [ ] S16 图片/二进制文件打开态
- [ ] S17 大文件截断态
- [ ] S18 面板各布局态：全开/半开/收起
- [ ] S19 深浅主题各一组（若支持双主题）

### 录屏 R（每段 5–15 秒即可）

- [ ] R01 跟随全流程：agent 连续改 2+ 文件 → 用户手动切 tab 打断 → 下一轮自动恢复
- [ ] R02 tab 拖拽重排
- [ ] R03 tab 溢出滚动/收拢交互
- [ ] R04 树懒加载展开（含 loading 态）
- [ ] R05 树点击文件 → tab 打开；连续点不同文件观察 preview 替换语义
- [ ] R06 agent 新建/删除文件 → 树实时刷新
- [ ] R07 消息流工具卡点路径 → 打开并跳转
- [ ] R08 切换会话再切回：tab 集/滚动/树展开恢复
- [ ] R09 关闭 tab 后的激活转移（多 tab 时关中间一个）
- [ ] R10 diff 视图在 agent 修改过程中的更新节奏

### 设计 token D（无需用户操作，由 Codex 侧从 S01/S06/S19 识图提取）

- [ ] D01 色板（背景/前景/红绿 diff/active 指示）、间距、字号行高、圆角、动效时长，回填 §4.2 V15

## 7. dsh 实现映射

### 已有基础（host 能力层，不随 UI 重做丢弃）

- 会话事件流已含 read 窗口与 edit diff hunk：阅读内容与 diff 可从日志纯派生，天然满足「model-visible ⟺ logged」与回放。
- `host.listTreeEntries` RPC（树列举语义已验证）；`webserver` upgrade + connection 桥可承载推送。

### host 缺口（建议各成一个 PR，完整能力缝：SD/Provider/Consumer）

1. **fs watch 推送缝**：`fs/watch`+`fs/changed` 语义等价；注意合批/节流（agent 批量写文件时避免每文件一次推送）。
2. **阅读器内容读取 RPC**：`fs/readFile` 语义等价 + 大文件策略（行窗口/截断阈值，对齐 S17 观察值）。
3. （可选）**fuzzy 文件搜索**，若 S14 证实树过滤存在。

### UI 侧（重做范围）

- 三个 store：Tabs（含 MODIFIED 派生）、Tree（含 watch 失效重读）、Viewer（含 FollowMode 状态机）。
- 渲染层语法高亮建议用维护依赖（如 Shiki），符合仓库「依赖优先于手卷」政策。

### 仓库惯例约束（不可豁免）

- 每个用户可见行为变更配 keyless snapshot（真实可运行 example）。
- 双语 README、导出 JSDoc、非平凡改动配 Agent Note；per-file 100% coverage gate。

## 8. 开放问题（素材回收后裁决）

1. T7 溢出的具体策略组合；T12 preview tab 语义；F11 右键是否含写操作。
2. V1 模式集合全集；V4 diff 聚合粒度（per-turn vs 累计）；V6 跟随恢复的精确边界。
3. F4 排序规则与 F6 截断阈值；F13 徽标形态。
4. dsh 侧自定：watch 合批窗口、readFile 截断阈值（拿到 S17 后对齐 Codex 数值）。

## 9. 建议交付顺序

| 阶段 | 内容 | 前置 |
|---|---|---|
| P0 | 素材回收，C 级落定，本文档定稿 | 用户 |
| P1 | host：watch 推送缝 + readFile RPC | 无（A 级） |
| P2 | UI：面板骨架 + 文件树（懒加载/隐藏/截断） | P1、S09–S12 |
| P3 | UI：阅读器 + tab 系统静态部分 | P1、S01–S06 |
| P4 | 交互：FollowMode + 跨模块联动 + 记忆 | R01、R05、R07、R08 |
| P5 | 保真度轮：截图对比验收 + token 对齐 + snapshot 补全 | D01 |

每阶段独立可交付、可验收。
