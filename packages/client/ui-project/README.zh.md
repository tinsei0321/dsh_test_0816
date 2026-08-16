# @deepseek-ai/dsh-client-ui-project

[English](README.md) | 中文

框架最右栏，项目目录树，Codex 风格：当前工作区的懒加载文件浏览器。树的根是当前会话所属的工作区，回退到最近活跃的工作区——由标准的 workspace/session 投影在一个纯函数中派生。根层级自动加载；目录行经 runtime 的 `workspaces.listTreeEntries`（宿主的 `host.listTreeEntries` RPC）逐层展开，每次进行中的加载会在其层级折叠或根变化时被中止，过期请求因此绝不会覆盖新请求。文件行经 `ui-conversation` 的可选 `documentOpen` 服务打开详情栏的文档阅读器（无该提供方时点击无效，与其他消费方一致），并在仓库的 git 工作区状态标记该文件时于文件名前渲染一枚彩色状态圆点——VS Code SCM 语义：`M` 已修改（琥珀色）、`A` 已添加与 `R` 已重命名（绿色）、`U` 未跟踪（绿色）、`D` 已删除（红色）、`C` 冲突（紫色），每个根经 `workspaces.gitStatus`（宿主 `host.gitStatus` RPC）扫描一次。隐藏行默认不显示，直到区段头的「显示隐藏文件」开关翻转，与目录浏览器保持一致；被截断的层级显示宿主上限所暗示的「…」提示。

浏览器侧注册进 ui-layout 的 AppFrame 条目所声明的 `frame.projectTree` 座位，该条目把它渲染为最右栏、紧邻详情栏，项目文件与聚焦文档因此并列显示——树位于最右端。头部 ✕ 经 `ctx.layout.toggleTree()` 把该栏收起为紧凑的重新打开轨。从 cordis.yml 中移除该插件即留下空座位，该栏零成本地什么都不渲染。树的浏览状态（展开、选中、已加载层级、隐藏开关）存放在声明的 store 中，栏目收起重挂载后仍保留；层级按需重新列举，且刻意不持久化——上一次会话工作区的路径只会误导。

节点侧是空 apply（roster 行）；该插件不注册任何 prompt 段、工具 schema 或会话事件。

## 模型体验

无。该包是宿主机 `host.listTreeEntries` 列举之上的浏览器侧目录浏览界面，不注册任何面向模型的内容。

#### KV Cache 影响

该包不增加任何 system-prompt 段与请求内容，因此不影响 KV-cache 复用。

## 已知限制与暂缓事项

- **列举依赖宿主的 browse 能力**——只有组合了 `browse` 目录选择后端时树才存在；仅 `native` 的组合不提供列举，树会与无工作区时一样显示空态（RPC 报 `directory-picker-unavailable`）。
- **状态圆点需要 git 仓库与 git 可执行文件**——工作区不在 git 仓库内、宿主 PATH 上没有 git 或扫描超时都会静默退化为不显示圆点；它是装饰性覆盖层，不是权威变更清单。
- **文件打开的是文档标签页而非编辑器**——文件行经 `ui-conversation` 的 `documentOpen` 服务把详情栏文档标签页钉到该路径；文档面板展示会话触碰过的文件内容，而非实时文件系统读取（见 ui-document 的限制）。
- **隐藏行遵循 POSIX 点前缀约定**——宿主仅按点前缀标记隐藏项（不读取 Windows 隐藏属性），开关揭示的正是 browse 后端所能看到的范围。
