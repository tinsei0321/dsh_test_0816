/**
 * The document panel's viewing store: the reader mode (raw source with line
 * numbers, rendered reading view, or a rendered HTML artifact), persisted
 * across reloads. Module level exports the factory only (a module-level
 * handle would pin the store identity across plugin reloads); register()
 * receives the factory and the panel derives its PropsStore share from the
 * return type.
 */
import { type EngineStoreHandle } from '@deepseek-ai/dsh-client-runtime/client'
/** Reader presentation: raw numbered source, rendered Markdown reading view, or an HTML artifact render. */
export type DocumentViewMode = 'source' | 'reading' | 'render'
/** Document panel viewing state persisted across surface remounts and reloads. */
type DocumentViewState = {
  viewMode: DocumentViewMode
}
/** Annotation twin of the actions literal below (the export needs a declared return type). */
type DocumentViewActions = {
  setViewMode: (draft: DocumentViewState, mode: DocumentViewMode) => void
}
/**
 * Create the document panel viewing store handle.
 * @returns the store handle (spec + type + identity + factory in one).
 */
export declare function createDocumentViewStore(): EngineStoreHandle<DocumentViewState, DocumentViewActions>
export {}
//# sourceMappingURL=stores.d.ts.map
