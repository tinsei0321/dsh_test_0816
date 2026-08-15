/**
 * Project plugin, browser half. Registers the project directory tree into the
 * `frame.projectTree` column declared by ui-layout's AppFrame entry, so the
 * frame's rightmost column shows the current workspace's file tree beside the
 * details column's document reader. Directory rows expand one lazy level at a
 * time through the runtime's `workspaces.listTreeEntries`; file rows open the
 * document reader through ui-conversation's optional `documentOpen` service
 * (absent provider = clicking does nothing, like every other consumer). The
 * column collapse toggle drives the layout service. Composing this plugin out
 * of cordis.yml leaves the column empty at zero cost.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the cordis Context merge declaring the optional
// `documentOpen` service and its DocumentOpen type.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: pulls the cordis Context merge declaring the `layout` service.
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { ProjectTree } from './ProjectTree.tsx'
import type { ProjectTreeInjected } from './contract/slots.ts'
import { createProjectTreeStore } from './stores.ts'
import { en, NS, zh, type ProjectKey } from './locales.ts'

export type { ProjectTreeInjected, ProjectTreeProps } from './contract/slots.ts'
export type { ProjectKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Project directory-tree copy. */
    'project': ProjectKey
  }
}

/** Services required by the registration and its dictionaries. */
export const inject = ['slots', 'workspaces', 'locale']

/**
 * Client plugin body: register the dictionaries and the project-tree entry
 * into the frame column once its declaration is on the ledger.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-project: dictionaries')

  const injected = (): ProjectTreeInjected => ({
    listTreeEntries: (path, signal) => ctx.workspaces.listTreeEntries(path, signal),
    openDocument: (path) => { ctx.get('documentOpen')?.open(path) },
    toggleColumn: () => { ctx.get('layout')?.toggleTree() },
  })
  ctx.slots.inject(
    'frame.projectTree',
    () => ctx.slots.register({
      name: 'frame.projectTree',
      locale: NS,
      store: createProjectTreeStore(),
      inject: injected,
    }, ProjectTree),
  )
}
