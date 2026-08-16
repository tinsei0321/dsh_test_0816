# @deepseek-ai/dsh-client-ui-usage-monitor

[English](README.md) | 中文

用量监测的浏览器侧：对话输入条（`conversation.input.right`）里的余额胶囊，悬停展开面板展示账户余额、今日 Token 总量与最近七天的 Token/成本柱状图。面板每 10 秒通过生成的 `usageMonitor/snapshot` Remote 刷新一次，余额与今日数据无需刷新页面即保持实时。

组件是纯消费者：所有数据都通过注入的 `load` 回调（Remote 快照）到达，组件只持有自己的瞬时悬停状态与刷新定时器。颜色与几何全部使用共享的 `--dsw-*` 主题 token；图表序列颜色属于数据（序列身份），不属于主题决策。

## Model Experience

无。该浏览器侧界面不注册任何提示词、工具、消息或模型请求。

#### KV Cache effect

无；本包从不组装模型输入。

## Known Limitations and Deferred Work

- **文案仅中文** —— 胶囊、面板与图表标签为中文产品文案，尚未通过 locale 服务做多语言化。
- **面板仅支持悬停打开** —— 目前没有键盘焦点路径可以展开面板；胶囊本身保持键盘可聚焦。
