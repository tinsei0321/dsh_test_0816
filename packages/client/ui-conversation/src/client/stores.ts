/**
 * Per-session chat store shared by conversation and details registrations.
 * The plugin creates its handle at apply time so identity follows the fiber.
 */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-runtime/client'
import type { CallId, ChatStoreState, SelectionTarget } from './contract/views.ts'

/** Declared action shape used to give the exported factory a stable return type. */
type ChatActions = {
  select: (draft: ChatStoreState, target: SelectionTarget | null) => void
  setDraft: (draft: ChatStoreState, text: string) => void
  setView: (draft: ChatStoreState, view: string) => void
  setInspect: (draft: ChatStoreState, target: { callId: CallId } | null) => void
  setDetailsTab: (draft: ChatStoreState, tab: 'tool' | 'document') => void
  openDocument: (draft: ChatStoreState, path: string) => void
  closeDocument: (draft: ChatStoreState, path: string) => void
}

/**
 * Declares the per-session chat state and write surface.
 * @returns the store handle.
 */
export function createChatStore(): EngineStoreHandle<ChatStoreState, ChatActions> {
  return defineStore({
    // Anchored to the contract shape: consumers read the store through
    // PropsStore<ChatStore>'s SnapshotSelectorHook<ChatStoreState>, so init
    // and the contract cannot drift.
    init: (): ChatStoreState => ({
      selection: null, draft: '', view: null, inspect: null, detailsTab: 'tool', openDocs: [], activeDoc: null,
    }),
    persist: 'dsh.conversation.chat',
    actions: {
      // A new tool selection reopens the tool half: the user clicked a row to
      // see that call, not to stay on a previously pinned document.
      select: (d, target: SelectionTarget | null) => {
        d.selection = target
        d.detailsTab = 'tool'
      },
      setDraft: (d, text: string) => { d.draft = text },
      setView: (d, view: string) => { d.view = view },
      setInspect: (d, target: { callId: CallId } | null) => { d.inspect = target },
      setDetailsTab: (d, tab: 'tool' | 'document') => { d.detailsTab = tab },
      // Opening a document appends a tab (first open wins the position) and
      // focuses it; re-opening an existing tab only refocuses. Persisted
      // snapshots from before the document half rehydrate without `openDocs`,
      // so the draft is normalized before the membership test.
      openDocument: (d, path: string) => {
        const openDocs = d.openDocs ?? []
        if (!openDocs.includes(path)) d.openDocs = [...openDocs, path]
        d.activeDoc = path
        d.detailsTab = 'document'
      },
      // Closing a tab refocuses its later neighbour (falling back to the
      // earlier one); the last tab closing returns the panel to the tool half.
      closeDocument: (d, path: string) => {
        const openDocs = d.openDocs ?? []
        const index = openDocs.indexOf(path)
        if (index === -1) return
        const next = openDocs.filter(item => item !== path)
        if (d.activeDoc === path) {
          d.activeDoc = next[Math.min(index, next.length - 1)] ?? null
        }
        d.openDocs = next
        if (next.length === 0) {
          d.activeDoc = null
          d.detailsTab = 'tool'
        }
      },
    },
  })
}
