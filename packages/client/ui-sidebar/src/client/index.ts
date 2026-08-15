/** Registers the sidebar shell into the layout-owned slot. */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { SidebarRootInjected } from './contract/slots.ts'
import { SidebarRoot } from './SidebarRoot.tsx'
import { en, zh, type SidebarKey } from './locales.ts'

export type {
  SidebarFooterActionOwnerProps, SidebarRootComponentProps, SidebarRootInjected,
  SidebarSectionOwnerProps, SidebarSettingsOwnerProps,
} from './contract/slots.ts'
export type { SidebarKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Sidebar shell controls copy. */
    sidebar: SidebarKey
  }
}

/** Dictionary namespace owned by this plugin (shell controls copy). */
const NS = 'sidebar'

/** Services required by the sidebar plugin. */
export const inject = ['slots', 'layout', 'sessions', 'workspaces', 'locale']

/** Registers the sidebar shell and its service callbacks.
 * @param ctx - Client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-sidebar: dictionaries')

  // Codex session-switch shortcuts: Cmd/Ctrl+Shift+[ / ] move through the
  // listed sessions in list order. No current selection = nothing to switch.
  ctx.effect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (!(e.metaKey || e.ctrlKey) || !e.shiftKey) return
      if (e.key !== '[' && e.key !== ']') return
      const { ids, current } = ctx.sessions.list.getSnapshot()
      if (ids.length === 0 || current === undefined) return
      const index = ids.indexOf(current)
      if (index === -1) return
      const delta = e.key === ']' ? 1 : -1
      // Non-empty ids make the modulo index in range; the undefined check only
      // narrows the element access for the typechecker.
      const target = ids[(index + delta + ids.length) % ids.length]
      if (target === undefined) return
      e.preventDefault()
      ctx.sessions.open(target)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('keydown', onKeyDown) }
  }, 'ui-sidebar: session-switch shortcuts')

  const injectProps = (): SidebarRootInjected => ({
    // The shell's New Session button rides the runtime's shared action
    // (current Session Workspace, then recent Workspace).
    startSession: (workspaceId) => { ctx.workspaces.startSession(workspaceId) },
    toggleSidebar: () => { ctx.layout.toggleSidebar() },
  })
  ctx.effect(
    () => ctx.slots.register({
      name: 'sidebar',
      locale: NS,
      // The shell owns geometry; ui-workspace registers the whole browsing
      // region (header, search, session list, workspace dialogs), ui-settings
      // registers the foot trigger + settings panel.
      children: {
        'sidebar.workspaces': { kind: 'single', scope: 'root' },
        'sidebar.settings': { kind: 'single', scope: 'root' },
        'sidebar.footer.action': { kind: 'list', scope: 'root' },
      },
      inject: injectProps,
    }, SidebarRoot),
    'ui-sidebar: slot registration',
  )
}
