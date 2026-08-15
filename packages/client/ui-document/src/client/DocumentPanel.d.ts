import type { PropsLocale, PropsRenderSlots, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import { createDocumentViewStore } from './stores.ts'
export { displayPath } from './documents.ts'
/** Full props: the details panel's document owner currency, the viewing store, the tree sub-pane, plus the locale seat. */
export type DocumentPanelProps = PropsRuntime<'conversation.details.document'> & PropsRenderSlots<'conversation.details.document.tree'> & PropsStore<ReturnType<typeof createDocumentViewStore>> & PropsLocale<'document'>
/** Whether the reader's reading mode renders Markdown for this path. */
export declare function isMarkdownPath(path: string): boolean
/** Whether the reader offers the HTML render mode (Codex artifact preview). */
export declare function isHtmlPath(path: string): boolean
/** The document half of the details panel (see module doc). */
export declare function DocumentPanel({ docs, doc, onOpen, onClose, cwd, useSession, useStore, actions, renderSlot, t }: DocumentPanelProps): import('react').JSX.Element
//# sourceMappingURL=DocumentPanel.d.ts.map
