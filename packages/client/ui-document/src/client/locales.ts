/** `document` namespace dictionaries. */

/** Dictionary namespace owned by this plugin. */
export const NS = 'document'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'document.empty': '会话中还没有读取或修改的文件',
  'document.emptyDoc': '从文件列表选择一个查看',
  'document.list': '文件',
  'document.header': '文件',
  'document.headerLabel': '查看会话文件，共 {count} 个',
  'document.close': '关闭文档',
  'document.closeTab': '关闭 {name}',
  'document.closeAll': '全部关闭',
  'document.changes': '本会话修改',
  'document.status.read': '已读取',
  'document.status.changed': '已修改',
  'document.status.discovered': '仅发现',
  'document.notFound': '该文件在会话中不可用',
  'document.mode.label': '查看模式',
  'document.mode.source': '源码',
  'document.mode.reading': '阅读',
  'document.mode.render': '渲染',
}

/** English dictionary (same key set). */
export const en: Record<DocumentKey, string> = {
  'document.empty': 'No files read or modified in this session yet',
  'document.emptyDoc': 'Pick a file from the list to view it',
  'document.list': 'Files',
  'document.header': 'Files',
  'document.headerLabel': 'Review session files: {count}',
  'document.close': 'Close document',
  'document.closeTab': 'Close {name}',
  'document.closeAll': 'Close all',
  'document.changes': 'Changes in this session',
  'document.status.read': 'Read',
  'document.status.changed': 'Modified',
  'document.status.discovered': 'Found',
  'document.notFound': 'This file is not available in this session',
  'document.mode.label': 'View mode',
  'document.mode.source': 'Source',
  'document.mode.reading': 'Reading',
  'document.mode.render': 'Render',
}

/** Union of this namespace's dictionary keys. */
export type DocumentKey = keyof typeof zh
