// @vitest-environment jsdom
/** Chat-store actions, scoped persistence, and instance isolation. */
import { beforeEach, describe, expect, it } from 'vitest'
import { createChatStore } from '../src/client/stores.ts'

const KEY = 'dsh.conversation.chat'

beforeEach(() => {
  localStorage.clear()
})

describe('createChatStore', () => {
  it('init shape: empty selection/draft/view, tool tab, no open documents', () => {
    const store = createChatStore().create()
    expect(store.store.getSnapshot()).toEqual({
      selection: null, draft: '', view: null, inspect: null, detailsTab: 'tool', openDocs: [], activeDoc: null,
    })
  })

  it('actions cover the declared write set', () => {
    const store = createChatStore().create()

    store.actions.select({ turnSeq: 3, callId: 'c1', toolName: 'bash' })
    expect(store.store.getSnapshot().selection).toEqual({ turnSeq: 3, callId: 'c1', toolName: 'bash' })
    store.actions.select(null)
    expect(store.store.getSnapshot().selection).toBeNull()

    store.actions.setDraft('hello')
    expect(store.store.getSnapshot().draft).toBe('hello')

    store.actions.setView('chat')
    expect(store.store.getSnapshot().view).toBe('chat')

    store.actions.setInspect({ callId: 'c1' })
    expect(store.store.getSnapshot().inspect).toEqual({ callId: 'c1' })
    store.actions.setInspect(null)
    expect(store.store.getSnapshot().inspect).toBeNull()
  })

  it('document actions: open appends tabs and focuses; close refocuses neighbours; select returns to the tool tab', () => {
    const store = createChatStore().create()

    store.actions.openDocument('notes/demo.txt')
    expect(store.store.getSnapshot().openDocs).toEqual(['notes/demo.txt'])
    expect(store.store.getSnapshot().activeDoc).toBe('notes/demo.txt')
    expect(store.store.getSnapshot().detailsTab).toBe('document')

    // Re-opening an existing tab refocuses without duplicating.
    store.actions.openDocument('src/main.ts')
    store.actions.openDocument('notes/demo.txt')
    expect(store.store.getSnapshot().openDocs).toEqual(['notes/demo.txt', 'src/main.ts'])
    expect(store.store.getSnapshot().activeDoc).toBe('notes/demo.txt')

    // Selecting a tool call while documents are open reopens the tool half.
    store.actions.select({ turnSeq: 4, callId: 'c2' })
    expect(store.store.getSnapshot().detailsTab).toBe('tool')
    expect(store.store.getSnapshot().openDocs).toHaveLength(2)

    store.actions.setDetailsTab('document')
    expect(store.store.getSnapshot().detailsTab).toBe('document')

    // Closing the focused tab refocuses the remaining neighbour.
    store.actions.closeDocument('notes/demo.txt')
    expect(store.store.getSnapshot().openDocs).toEqual(['src/main.ts'])
    expect(store.store.getSnapshot().activeDoc).toBe('src/main.ts')

    // Closing the last tab clears the half and returns to the tool tab.
    store.actions.closeDocument('src/main.ts')
    expect(store.store.getSnapshot().openDocs).toEqual([])
    expect(store.store.getSnapshot().activeDoc).toBeNull()
    expect(store.store.getSnapshot().detailsTab).toBe('tool')
  })

  it('persists per scope key and rehydrates a fresh instance', () => {
    const handle = createChatStore()
    const s1 = handle.create('sess-1')
    s1.actions.setDraft('draft for one')
    s1.actions.select({ turnSeq: 1 })

    // Scope-suffixed key: each session persists separately.
    expect(localStorage.getItem(`${KEY}.sess-1`)).not.toBeNull()
    expect(localStorage.getItem(`${KEY}.sess-2`)).toBeNull()

    // A rebuilt instance under the same scope key rehydrates the state.
    const again = createChatStore().create('sess-1')
    expect(again.store.getSnapshot().draft).toBe('draft for one')
    expect(again.store.getSnapshot().selection).toEqual({ turnSeq: 1 })

    // A sibling scope starts clean.
    const other = createChatStore().create('sess-2')
    expect(other.store.getSnapshot().draft).toBe('')
  })

  it('clearPersisted removes the scope entry (session-death cleanup hook)', () => {
    const store = createChatStore().create('sess-9')
    store.actions.setDraft('doomed')
    expect(localStorage.getItem(`${KEY}.sess-9`)).not.toBeNull()
    store.clearPersisted()
    expect(localStorage.getItem(`${KEY}.sess-9`)).toBeNull()
  })

  it('rehydrates a pre-document-half snapshot and opens documents without crashing', () => {
    // A session persisted before the document half exists lacks the new
    // fields; the membership test must normalize the draft, not throw.
    localStorage.setItem(`${KEY}.sess-old`, JSON.stringify({
      selection: null, draft: 'old draft', view: null, inspect: null,
    }))
    const store = createChatStore().create('sess-old')
    expect(store.store.getSnapshot().draft).toBe('old draft')
    expect(() => { store.actions.openDocument('notes/legacy.txt') }).not.toThrow()
    expect(store.store.getSnapshot().openDocs).toEqual(['notes/legacy.txt'])
    expect(store.store.getSnapshot().activeDoc).toBe('notes/legacy.txt')
    expect(store.store.getSnapshot().detailsTab).toBe('document')
    expect(() => { store.actions.closeDocument('notes/legacy.txt') }).not.toThrow()
    expect(store.store.getSnapshot().openDocs).toEqual([])
  })

  it('every create() is an independent instance; the factory holds no singleton', () => {
    const handle = createChatStore()
    const a = handle.create()
    const b = handle.create()
    a.actions.setDraft('only in a')
    expect(b.store.getSnapshot().draft).toBe('')
    // Two factory calls likewise share no LIVE state (identity is per handle
    // VALUE, not per module — the sharing contract lives in the framework's
    // handle x scope-key resolution, not in module state). Persistence is the
    // one sanctioned cross-instance channel: clear it so this assertion sees
    // memory identity, not rehydration (covered by the persist case above).
    localStorage.clear()
    const c = createChatStore().create()
    expect(c.store.getSnapshot().draft).toBe('')
  })
})
