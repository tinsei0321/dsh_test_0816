/** `document` namespace dictionaries. */
/** Dictionary namespace owned by this plugin. */
export declare const NS = 'document'
/** Simplified Chinese dictionary (the key-set source of truth). */
export declare const zh: {
  'document.empty': string
  'document.emptyDoc': string
  'document.list': string
  'document.header': string
  'document.headerLabel': string
  'document.close': string
  'document.closeTab': string
  'document.closeAll': string
  'document.changes': string
  'document.status.read': string
  'document.status.changed': string
  'document.status.discovered': string
  'document.notFound': string
  'document.mode.label': string
  'document.mode.source': string
  'document.mode.reading': string
  'document.mode.render': string
}
/** English dictionary (same key set). */
export declare const en: Record<DocumentKey, string>
/** Union of this namespace's dictionary keys. */
export type DocumentKey = keyof typeof zh
//# sourceMappingURL=locales.d.ts.map
