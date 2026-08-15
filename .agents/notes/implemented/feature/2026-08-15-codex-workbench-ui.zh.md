# Agent Note: Codex-style workbench UI

Status: implemented

[English](2026-08-15-codex-workbench-ui.md) | 中文

## Problem

Web GUI 此前是三区框架（工作区侧栏、会话流、详情），但 Codex 式工作台需要把更多项目内容呈现在屏幕上：常驻目录树、跟随 agent 读写动作的文件查看器、按步骤编号分组的 turn、以及 Codex 深色调色板。缺口一处是呈现层，另一处是一个宿主能力：按任意工作区路径经线上列举目录条目——既有模态目录选择器从未暴露过这个能力。

## Decision

**一条只读浏览的宿主 RPC 承载目录数据。** `host.listTreeEntries` 的 Service Definition 声明在 `dsh-host-directory-picker`，由 `dsh-host-directory-picker-browse` 以流式 `opendir` 扫描实现，在 `dsh-host-apiproxy` 的 `api/host.ts` 镜像为线上类型（手工抄写以保持浏览器安全的导入面，加围栏交给克隆检测门），再经 `dsh-api-remotes` 与 `dsh-client-connection` re-export 进入 `IWorkspaces` 客户端契约。目录树列举是浏览状态：永不进入 session log，因为模型看不到它。

**两个新客户端插件拥有新栏位。** `dsh-client-ui-project` 在新的 `frame.projectTree` 槽位渲染项目目录树：按层懒加载并带 `AbortController` 取消、隐藏文件开关、截断条目标记、32px 折叠轨。`dsh-client-ui-document` 渲染文件查看器：打开文件 tab 条并回焦邻居、源码 / 阅读 / 渲染三模式、对任意模型产出的 HTML 使用 `sandbox=""` iframe、运行中自动跟随 agent 最新的 read 或 edit 而手动点击会暂停至下一轮。`ui-layout` 经既有栏位让步链获得第四栏，详情面板在 Tool details 旁增加 Documents tab。

**会话 turn 按步骤分组。** `step-groups.ts` 以纯函数两遍扫描从轨迹派生步骤行，`StepGroupHeader` 渲染 running / completed / error 三态；工具行带耗时 chip，审批卡以 `aria-live` 播报等待与已决定两态。

**Codex 观感是 token 别名重指，不是移植样式表。** `codex-theme.css` 把既有 `--dsw` 语义别名重指到 Codex 深色调色板，由 shell 的 `base.css` 导入一次；不重命名任何 token，不复制任何 Codex 品牌素材。

**引导页禁止启发式缓存。** `dsh-host-frontend-static` 对 boot index 返回 `cache-control: no-store`，因为它内嵌的 bundle rev 清单每次构建都变，过期副本会把客户端钉在旧插件 rev 上。

## Testing

各包 spec 覆盖新派生与组件（`step-groups`、`StepGroupHeader`、`ui-project`、`ui-document`、拓宽的 `IWorkspaces` seam），`apps/web/tests/snapshots/lifecycle-chrome/` 的框架级金样已刷新，replay 继续充当装配级证据，见 [browser e2e lane](../testing/2026-07-24-web-gui-browser-e2e-lane.md)。

## Alternatives considered

**不加新 RPC，直接用模态选择器的 provider 渲染树。** 否决：选择器服务一次性工作区选取，常驻树需要可取消的逐层增量列举，且选择器没有暴露面向任意路径的线上安全宿主方法。

**把项目树放进左侧 `ui-workspace`。** 否决：产品把目录树放在会话流对侧；`frame.projectTree` 槽位让布局归属组合层，而不是内嵌进某个侧栏包。

**把目录列举记为 session 事件。** 否决：目录浏览是模型看不到的界面状态；记录它会让每个 session log 膨胀，而 model-visible 规则只约束相反方向。

**移植 Codex 自己的样式表。** 否决：复制品牌呈现且上游重设计即失效；别名级主题保住同一套 token 词表与同一个主题运行时。

## Consequences

框架成为四栏；窄视口下项目树折叠为轨。`apiproxy` 的线上镜像必须人工跟随 directory-picker 的 Service Definition——克隆围栏让漂移可见但无法阻止。目录数据不进 session log 与模型上下文，查看器的自动跟随与目录树消费同一条 RPC。有意推迟：目录 watch 推送、审批五态徽章、评审面板逐 hunk 暂存与回退。
