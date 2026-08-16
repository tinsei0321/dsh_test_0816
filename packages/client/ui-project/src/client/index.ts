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
import type { ClientContext, SessionListState } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the cordis Context merge declaring the optional
// `documentOpen` service and its DocumentOpen type.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: pulls the cordis Context merge declaring the `layout` service.
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the input-trigger Context merge (ctx.inputTriggers).
import type {} from '@deepseek-ai/dsh-client-ui-input-trigger/client'
import { ProjectTree } from './ProjectTree.tsx'
import type { ProjectTreeInjected } from './contract/slots.ts'
import { createProjectTreeStore } from './stores.ts'
import { en, NS, zh, type ProjectKey } from './locales.ts'
import type { InputTriggerServiceContract, InputTriggerSource } from '@deepseek-ai/dsh-client-ui-input-trigger/client'
import { currentWorkspacePath } from './current-workspace.ts'
import { basenameOf, searchWorkspaceFiles } from './file-search.ts'

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

  // '@' file reference source: fuzzy-search the workspace and insert a chip.
  // Serialization ships the path (the model reads it with its `read` tool);
  // content inlining is a follow-up behind a host read-text RPC. Both the
  // trigger pipeline and the sessions feed are optional — without them the
  // tree still registers and the '@' file source simply stays absent.
  const inputTriggers = ctx.get('inputTriggers') as InputTriggerServiceContract | undefined
  if (inputTriggers !== undefined) {
    const fileSource: InputTriggerSource = {
      trigger: '@',
      name: 'file',
      candidates(_session, { query, signal }) {
        const sessions = ctx.get('sessions') as { list: { getSnapshot(): SessionListState } } | undefined
        if (sessions === undefined) return Promise.resolve([])
        const root = currentWorkspacePath(ctx.workspaces.list.getSnapshot(), sessions.list.getSnapshot())
        if (root === null) return Promise.resolve([])
        return searchWorkspaceFiles((path, sig) => ctx.workspaces.listTreeEntries(path, sig), root, query, signal)
      },
      onPick({ candidate }) {
        const path = candidate.name
        return { insert: { source: 'file', ref: path, label: basenameOf(path), clipboardText: path } }
      },
      codec: {
        clipboardText: ref => ref,
        // Inline the file's content (Codex semantics); a read failure falls
        // back to the bare path so the model reads it with its `read` tool.
        serialize: async (ref, signal) => {
          try {
            const content = await ctx.workspaces.readText(ref, signal)
            return `File: ${ref}\n\n${content}`
          } catch {
            return ref
          }
        },
      },
    }
    ctx.effect(() => inputTriggers.registerSource(fileSource), 'ui-project: @ file source')
  }
}
