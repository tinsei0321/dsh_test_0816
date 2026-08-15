/**
 * Document plugin, browser half. Registers the details panel's document half
 * into the `conversation.details.document` seat declared by ui-conversation,
 * and the session header's file-review pill (Files · N) into the header
 * action row. Composing this plugin out of cordis.yml leaves both surfaces
 * empty; the details panel's document tab then renders its fallback (nothing)
 * at zero cost.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { type DocumentKey } from './locales.ts'
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Document-tab copy. */
    'document': DocumentKey
  }
  interface SlotMap {
    /**
         * The directory-tree sub-pane of the document view (declared by this
         * package's DocumentPanel entry): ui-project registers the tree here, so
         * the file reader shows the tree and the document side by side.
         */
    'conversation.details.document.tree': {
      kind: 'single'
      scope: 'session'
      owner: DocumentTreeOwnerProps
    }
  }
}
/** Owner share of the document-view tree sub-pane: nothing — the tree is inject-assembled. */
export interface DocumentTreeOwnerProps {
}
export type { DocumentKey } from './locales.ts'
/** Services required by the two registrations and their dictionaries. */
export declare const inject: string[]
/**
 * Client plugin body: register the dictionaries, the document-half entry,
 * and the header file-review pill.
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): void
//# sourceMappingURL=index.d.ts.map
