/** `project` namespace dictionaries. */

/** Dictionary namespace owned by this plugin. */
export const NS = 'project'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'project.section': '项目文件',
  'project.section.aria': '当前工作区的项目文件目录树',
  'project.empty': '暂无工作区：新建会话并选择目录后，这里会显示项目文件',
  'project.open': '在文档面板打开 {name}',
  'project.toggle': '{name}：{state}',
  'project.expand': '展开',
  'project.collapse': '折叠',
  'project.loading': '加载中…',
  'project.error': '无法读取此目录，点击重试',
  'project.truncated': '目录内容过多，仅显示开头部分',
  'project.showHidden': '显示隐藏文件',
  'project.collapseColumn': '收起文件栏',
  'project.expandColumn': '展开文件栏',
  'project.status.M': '已修改',
  'project.status.A': '已添加',
  'project.status.D': '已删除',
  'project.status.R': '已重命名',
  'project.status.C': '冲突',
  'project.status.U': '未跟踪',
}

/** English dictionary (same key set). */
export const en: Record<ProjectKey, string> = {
  'project.section': 'Project files',
  'project.section.aria': 'Project directory tree of the current workspace',
  'project.empty': 'No workspace yet: after starting a session in a directory, its files appear here',
  'project.open': 'Open {name} in the document panel',
  'project.toggle': '{name}: {state}',
  'project.expand': 'Expand',
  'project.collapse': 'Collapse',
  'project.loading': 'Loading…',
  'project.error': 'Cannot read this directory; click to retry',
  'project.truncated': 'Too many entries; only the beginning is shown',
  'project.showHidden': 'Show hidden files',
  'project.collapseColumn': 'Collapse file panel',
  'project.expandColumn': 'Expand file panel',
  'project.status.M': 'Modified',
  'project.status.A': 'Added',
  'project.status.D': 'Deleted',
  'project.status.R': 'Renamed',
  'project.status.C': 'Conflict',
  'project.status.U': 'Untracked',
}

/** Union of this namespace's dictionary keys. */
export type ProjectKey = keyof typeof zh
