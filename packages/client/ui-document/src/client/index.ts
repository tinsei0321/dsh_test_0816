/**
 * Document plugin, browser half. Registers the details panel's document half
 * into the `conversation.details.document` seat declared by ui-conversation,
 * and the session header's file-review pill (Files · N) into the header
 * action row. The project directory tree sits in ui-layout's rightmost
 * `frame.projectTree` column (occupied by ui-project), so the reader and the
 * tree are side by side with no sub-slot here. Composing this plugin out of
 * cordis.yml leaves both surfaces empty; the details panel's document tab
 * then renders its fallback (nothing) at zero cost.
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { DocumentPanel } from './DocumentPanel.tsx'
import { HeaderDocumentButton, type HeaderDocumentInjected } from './HeaderDocumentButton.tsx'
import { createDocumentViewStore } from './stores.ts'
import { en, NS, zh, type DocumentKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Document-tab copy. */
    'document': DocumentKey
  }
}

export type { DocumentKey } from './locales.ts'

/** Services required by the two registrations and their dictionaries. */
export const inject = ['slots', 'locale']

/**
 * Client plugin body: register the dictionaries, the document-half entry,
 * and the header file-review pill.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-document: dictionaries')
  ctx.slots.inject(
    'conversation.details.document',
    () => ctx.slots.register({
      name: 'conversation.details.document',
      locale: NS,
      store: createDocumentViewStore(),
    }, DocumentPanel),
  )
  ctx.slots.inject(
    'conversation.session.header.actions',
    () => ctx.slots.register({
      name: 'conversation.session.header.actions',
      id: 'document-files',
      // After the subagent catalog and the jobs pill: reviewing produced
      // files is the post-work gesture.
      order: 30,
      locale: NS,
      inject: (): HeaderDocumentInjected => ({
        openPanel: () => { ctx.get('documentOpen')?.openPanel() },
      }),
    }, HeaderDocumentButton),
  )
}
