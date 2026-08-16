// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-web-react'
import {
  createSnapshotStore, EMPTY_CHAT_SNAPSHOT, EMPTY_CONVERSATION_VIEWS,
} from '@deepseek-ai/dsh-client-runtime/client'
import type { UseSession } from '@deepseek-ai/dsh-client-web-react'
import type { ConversationSnapshot, SessionId, SessionListState, WorkspaceListState } from '@deepseek-ai/dsh-client-runtime/client'
import type { SessionProviderComponent } from '@deepseek-ai/dsh-client-ui-slots'
import type {
  DetailsDocumentOwnerProps, DetailsSlotProps, DetailsToolOwnerProps, SelectionTarget,
} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { createChatStore } from '../src/client/stores.ts'
import { AssistantMarkdown, type AssistantMarkdownProps } from '../src/client/chat/AssistantMarkdown.tsx'
import { StatsLine } from '../src/client/chat/StatsLine.tsx'
import { DetailsPanel } from '../src/client/skeleton/DetailsPanel.tsx'
import { zh } from '../src/client/locales.ts'
import { chatSnapshotFixture } from './chat-snapshot-fixture.client.ts'

/** Absent cross-panel open request for direct DetailsPanel hosts. */
const absentDocRequest = bindSnapshotSelector({
  getSnapshot: () => null as { path: string; token: number } | null,
  subscribe: () => () => {},
})

// Mirrors the real lookup chain (conversation namespace, then common).
const t: AssistantMarkdownProps['t'] = makeTranslate(zh, commonZh)

/** jsdom has no ResizeObserver; StatsLine watches its row for ellipsis truncation through one. */
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

beforeEach(() => { vi.stubGlobal('ResizeObserver', ResizeObserverStub) })
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const SID = 's1' as SessionId

/** Minimal framework seat for direct DetailsPanel host tests. */
const SessionProviderStub: SessionProviderComponent = ({ children }) => children(SID)

/** Observe the owner currency without importing the Tool details renderer. */
function renderToolDetailsProbe(owners?: DetailsToolOwnerProps[]): DetailsSlotProps['renderSlot'] {
  return (_key, owner) => {
    owners?.push(owner as unknown as DetailsToolOwnerProps)
    return <div data-testid="tool-details-seat" />
  }
}

/** Direct-host the details panel with a caller-supplied request hook and open callbacks. */
function renderDetailsPanel(
  useDocOpenRequest: DetailsSlotProps['useDocOpenRequest'],
  openDocument: (path: string) => void,
  openDocumentPanel: () => void,
) {
  const chat = createChatStore().create()
  const emptyList = createSnapshotStore<SessionListState>(
    { ids: [], byId: {}, current: undefined, phase: 'ready', subagentsByParent: {}, jobsBySession: {}, currentAddress: undefined })
  const emptyWorkspaces = createSnapshotStore<WorkspaceListState>({
    items: [], archivedSessionIds: [], state: 'idle', phase: 'ready', error: null,
    baselinesReady: true, recentWorkspaceId: undefined,
  })
  return render(
    <DetailsPanel
      SessionProvider={SessionProviderStub}
      renderSlot={renderToolDetailsProbe()}
      sessionId={SID}
      useSession={bindSnapshotSelector({ getSnapshot: () => snapshotBase(), subscribe: () => () => {} })}
      useSessions={bindSnapshotSelector(emptyList)}
      useWorkspaces={bindSnapshotSelector(emptyWorkspaces)}
      useProjection={(() => undefined)}
      useInput={(() => { throw new Error('unused') })}
      inputActions={{
        setDraft: () => {},
        addImages: () => true,
        removeImage: () => {},
        pruneImages: () => {},
        submit: () => {},
      }}
      useStore={bindSnapshotSelector(chat)}
      actions={chat.actions}
      closeDetails={vi.fn()}
      openDocument={openDocument}
      openDocumentPanel={openDocumentPanel}
      useDocOpenRequest={useDocOpenRequest}
      t={t}
    />,
  )
}

function snapshotBase(): ConversationSnapshot {
  return {
    sessionId: SID, views: EMPTY_CONVERSATION_VIEWS, chat: EMPTY_CHAT_SNAPSHOT,
    nodes: [], turnTimings: new Map(), turnEnds: new Map(), partial: null, runningCalls: [],
    pending: [], queue: [], running: false, composerPhase: 'active', removed: false, openState: 'open', openError: null,
    hasMore: false, loadingOlder: false, promptError: null, blank: false, subagent: null, lastAgentError: null,
  }
}

describe('render branch tails', () => {
  it('AssistantMarkdown reasoning row is ok-state when not the streaming tail', () => {
    const view = render(
      <AssistantMarkdown
        t={t}
        blocks={[{ kind: 'reasoning', text: 'done thinking' }, { kind: 'text', text: 'answer' }]}
        streaming
      />,
    )
    // reasoning at index 0 with a later block: running is false → ok state.
    expect(view.container.querySelector('[data-state="ok"]')).not.toBeNull()
  })

  it('StatsLine falls back to window-node counts and drops every token group without projections', () => {
    // No sessionStats key → the window fold supplies the counts (the
    // assembly-without-the-unit fallback). Node `usage` is deliberately
    // ignored: billing rides the durable tokenUsage projection, so an absent
    // projection leaves counts only.
    const nodes = [
      { kind: 'assistant', seq: 1, time: 1, turn: 1, step: 1, blocks: [] },
      { kind: 'assistant', seq: 2, time: 2, turn: 1, step: 2, blocks: [], usage: { inputTokens: 4, outputTokens: 6 } },
      { kind: 'assistant', seq: 3, time: 3, turn: 2, step: 1, blocks: [], usage: { inputTokens: 5 } },
    ] as const
    const snap = {
      ...snapshotBase(),
      chat: chatSnapshotFixture({ nodes }),
      nodes: [
        ...nodes,
      ],
    }
    const source = { getSnapshot: () => snap, subscribe: () => () => {} }
    const view = render(
      <StatsLine
        t={t}
        useSession={bindSnapshotSelector(source) as unknown as UseSession<ConversationSnapshot>}
        useProjection={() => undefined}
      />,
    )
    expect(view.container.textContent).toBe('2 轮 · 3 步')
  })

  it('AssistantMarkdown reasoning as the streaming tail renders the running ring', () => {
    const view = render(
      <AssistantMarkdown t={t} blocks={[{ kind: 'reasoning', text: 'still thinking' }]} streaming />,
    )
    expect(view.container.querySelector('[data-state="running"]')).not.toBeNull()
  })

  it('DetailsPanel title falls to 详情 when the selection has no toolName and no material', () => {
    localStorage.clear()
    const snap = snapshotBase()
    const chat = createChatStore().create()
    chat.actions.select({ turnSeq: 1, callId: 'ghost' } satisfies SelectionTarget)
    const emptyList = createSnapshotStore<SessionListState>(
      { ids: [], byId: {}, current: undefined, phase: 'ready', subagentsByParent: {}, jobsBySession: {}, currentAddress: undefined })
    const emptyWorkspaces = createSnapshotStore<WorkspaceListState>({
      items: [], archivedSessionIds: [], state: 'idle', phase: 'ready', error: null,
      baselinesReady: true, recentWorkspaceId: undefined,
    })
    const view = render(
      <DetailsPanel
        SessionProvider={SessionProviderStub}
        renderSlot={renderToolDetailsProbe()}
        sessionId={SID}
        useSession={bindSnapshotSelector({ getSnapshot: () => snap, subscribe: () => () => {} })}
        useSessions={bindSnapshotSelector(emptyList)}
        useWorkspaces={bindSnapshotSelector(emptyWorkspaces)}
        useProjection={(() => undefined)}
        useInput={(() => { throw new Error('unused') })}
        inputActions={{
          setDraft: () => {},
          addImages: () => true,
          removeImage: () => {},
          pruneImages: () => {},
          submit: () => {},
        }}
        useStore={bindSnapshotSelector(chat)}
        actions={chat.actions}
        closeDetails={vi.fn()}
        openDocument={vi.fn()}
        openDocumentPanel={vi.fn()}
        useDocOpenRequest={absentDocRequest}
        t={t}
      />,
    )
    expect(view.getByText('详情')).toBeTruthy()
    expect(view.getByText('该调用不在当前窗口内')).toBeTruthy()
  })

  it('DetailsPanel resolves a nested run_code leaf to its full logged args and output', () => {
    localStorage.clear()
    const snap = snapshotBase()
    const longText = 'x'.repeat(1_000)
    snap.runningCalls = [{
      callId: 'p1', name: 'run_code', argsRaw: '{}', turn: 1, step: 1,
      time: 7_000, callView: null, subCalls: [{
        kind: 'tool-result', seq: 8, time: 8_000, callId: 'p1:code:1',
        call: { name: 'run_code', argsRaw: '{"code":"return 1"}' },
        callTime: 8_000,
        content: [], isError: false, callView: null, resultView: null,
        subCalls: [{
          kind: 'tool-result', seq: 9, time: 9_000, callId: 'p1:code:1:code:1',
          call: { name: 'read', argsRaw: '{"path":"notes/demo.txt"}' },
          callTime: 8_500,
          content: [{ type: 'text', text: longText }], isError: false, callView: null, resultView: null,
          subCalls: [],
        }],
      }],
    }]
    snap.chat = chatSnapshotFixture({ runningCalls: snap.runningCalls })
    const chat = createChatStore().create()
    chat.actions.select({ turnSeq: 9, callId: 'p1:code:1:code:1', toolName: 'read' } satisfies SelectionTarget)
    const emptyList = createSnapshotStore<SessionListState>(
      { ids: [], byId: {}, current: undefined, phase: 'ready', subagentsByParent: {}, jobsBySession: {}, currentAddress: undefined })
    const emptyWorkspaces = createSnapshotStore<WorkspaceListState>({
      items: [], archivedSessionIds: [], state: 'idle', phase: 'ready', error: null,
      baselinesReady: true, recentWorkspaceId: undefined,
    })
    const owners: DetailsToolOwnerProps[] = []
    const view = render(
      <DetailsPanel
        SessionProvider={SessionProviderStub}
        renderSlot={renderToolDetailsProbe(owners)}
        sessionId={SID}
        useSession={bindSnapshotSelector({ getSnapshot: () => snap, subscribe: () => () => {} })}
        useSessions={bindSnapshotSelector(emptyList)}
        useWorkspaces={bindSnapshotSelector(emptyWorkspaces)}
        useProjection={(() => undefined)}
        useInput={(() => { throw new Error('unused') })}
        inputActions={{
          setDraft: () => {},
          addImages: () => true,
          removeImage: () => {},
          pruneImages: () => {},
          submit: () => {},
        }}
        useStore={bindSnapshotSelector(chat)}
        actions={chat.actions}
        closeDetails={vi.fn()}
        openDocument={vi.fn()}
        openDocumentPanel={vi.fn()}
        useDocOpenRequest={absentDocRequest}
        t={t}
      />,
    )
    // Conversation resolves the selected sub-call and hands its complete
    // frozen block to the Tool-owned details seat.
    expect(view.getByText('read')).toBeTruthy()
    expect(view.getByTestId('tool-details-seat')).toBeTruthy()
    expect(owners).toHaveLength(1)
    expect(owners[0]?.block).toMatchObject({
      callId: 'p1:code:1:code:1',
      call: { name: 'read', argsRaw: '{"path":"notes/demo.txt"}' },
      content: [{ type: 'text', text: longText }],
    })
  })

  it('DetailsPanel switches halves: the document tab renders the seat and routes open/close through the store', () => {
    localStorage.clear()
    const snap = snapshotBase()
    // A selected in-flight call keeps the tool half rendering its seat, so the
    // tab switch visibly replaces one seat with the other.
    snap.runningCalls = [{
      callId: 'r1', name: 'bash', argsRaw: '{}', turn: 1, step: 1, time: 1, callView: null, subCalls: [],
    }]
    snap.chat = chatSnapshotFixture({ runningCalls: snap.runningCalls })
    const chat = createChatStore().create()
    chat.actions.select({ turnSeq: 1, callId: 'r1' })
    const documentOwners: DetailsDocumentOwnerProps[] = []
    const probe = ((key: string, owner?: unknown) => {
      if (key === 'conversation.details.document') {
        documentOwners.push(owner as DetailsDocumentOwnerProps)
        return <div data-testid="document-seat" />
      }
      return <div data-testid="tool-details-seat" />
    }) as DetailsSlotProps['renderSlot']
    const emptyList = createSnapshotStore<SessionListState>(
      { ids: [], byId: {}, current: undefined, phase: 'ready', subagentsByParent: {}, jobsBySession: {}, currentAddress: undefined })
    const emptyWorkspaces = createSnapshotStore<WorkspaceListState>({
      items: [], archivedSessionIds: [], state: 'idle', phase: 'ready', error: null,
      baselinesReady: true, recentWorkspaceId: undefined,
    })
    const view = render(
      <DetailsPanel
        SessionProvider={SessionProviderStub}
        renderSlot={probe}
        sessionId={SID}
        useSession={bindSnapshotSelector({ getSnapshot: () => snap, subscribe: () => () => {} })}
        useSessions={bindSnapshotSelector(emptyList)}
        useWorkspaces={bindSnapshotSelector(emptyWorkspaces)}
        useProjection={(() => undefined)}
        useInput={(() => { throw new Error('unused') })}
        inputActions={{
          setDraft: () => {},
          addImages: () => true,
          removeImage: () => {},
          pruneImages: () => {},
          submit: () => {},
        }}
        useStore={bindSnapshotSelector(chat)}
        actions={chat.actions}
        closeDetails={vi.fn()}
        openDocument={vi.fn()}
        openDocumentPanel={vi.fn()}
        useDocOpenRequest={absentDocRequest}
        t={t}
      />,
    )
    // Default half: the tool seat renders, the document seat never mounts.
    expect(view.getByTestId('tool-details-seat')).toBeTruthy()
    expect(view.queryByTestId('document-seat')).toBeNull()
    expect(documentOwners).toHaveLength(0)

    // The tab button flips the panel to the document half.
    fireEvent.click(view.getByRole('tab', { name: '文档' }))
    expect(view.queryByTestId('tool-details-seat')).toBeNull()
    expect(view.getByTestId('document-seat')).toBeTruthy()
    expect(documentOwners).toHaveLength(1)
    expect(documentOwners[0]?.doc).toBeNull()
    expect(documentOwners[0]?.docs).toEqual([])

    // Opening through the owner currency appends a tab and focuses it.
    act(() => { documentOwners[documentOwners.length - 1]?.onOpen?.('notes/demo.txt') })
    expect(chat.store.getSnapshot().openDocs).toEqual(['notes/demo.txt'])
    expect(chat.store.getSnapshot().activeDoc).toBe('notes/demo.txt')
    expect(chat.store.getSnapshot().detailsTab).toBe('document')
    expect(documentOwners[documentOwners.length - 1]?.doc).toBe('notes/demo.txt')
    expect(documentOwners[documentOwners.length - 1]?.docs).toEqual(['notes/demo.txt'])

    // Closing through the same currency removes the last tab and the store
    // returns the panel to the tool half.
    act(() => { documentOwners[documentOwners.length - 1]?.onClose?.('notes/demo.txt') })
    expect(chat.store.getSnapshot().openDocs).toEqual([])
    expect(chat.store.getSnapshot().activeDoc).toBeNull()
    expect(chat.store.getSnapshot().detailsTab).toBe('tool')
    expect(view.getByTestId('tool-details-seat')).toBeTruthy()
  })

  it('DetailsPanel consumes a published open request through the injected request hook', () => {
    localStorage.clear()
    const openDocument = vi.fn()
    const openDocumentPanel = vi.fn()
    let request: { path: string | null; token: number } | null = null
    const listeners = new Set<() => void>()
    const requestSource = {
      getSnapshot: () => request,
      subscribe: (fn: () => void) => {
        listeners.add(fn)
        return () => { listeners.delete(fn) }
      },
    }
    const useDocOpenRequest = bindSnapshotSelector(requestSource)
    renderDetailsPanel(useDocOpenRequest, openDocument, openDocumentPanel)
    expect(openDocument).not.toHaveBeenCalled()
    // A published request routes into the injected write path.
    request = { path: 'notes/x.txt', token: 1 }
    act(() => { for (const fn of listeners) fn() })
    expect(openDocument).toHaveBeenCalledWith('notes/x.txt')
    // Re-opening the same path re-publishes with a bumped token: the panel
    // consumes the second frame instead of deduping by path.
    request = { path: 'notes/x.txt', token: 2 }
    act(() => { for (const fn of listeners) fn() })
    expect(openDocument).toHaveBeenCalledTimes(2)
    // A panel-only request (no path) opens the document tab without a pin.
    request = { path: null, token: 3 }
    act(() => { for (const fn of listeners) fn() })
    expect(openDocumentPanel).toHaveBeenCalledTimes(1)
    expect(openDocument).toHaveBeenCalledTimes(2)
  })

  it('DetailsPanel swallows a pre-existing open request on mount (no re-pop on session switch)', () => {
    localStorage.clear()
    const openDocument = vi.fn()
    const openDocumentPanel = vi.fn()
    // A stale request the previous session already consumed stays parked in
    // the apply-level source while the panel remounts for the new session.
    let request: { path: string | null; token: number } | null = { path: 'notes/stale.txt', token: 7 }
    const listeners = new Set<() => void>()
    const requestSource = {
      getSnapshot: () => request,
      subscribe: (fn: () => void) => {
        listeners.add(fn)
        return () => { listeners.delete(fn) }
      },
    }
    const useDocOpenRequest = bindSnapshotSelector(requestSource)
    renderDetailsPanel(useDocOpenRequest, openDocument, openDocumentPanel)
    // The mount-time request is treated as already handled: a session switch
    // must not re-pop the document panel from a previous session's open.
    expect(openDocument).not.toHaveBeenCalled()
    expect(openDocumentPanel).not.toHaveBeenCalled()
    // A genuinely new request still routes through the injected write path.
    request = { path: 'notes/fresh.txt', token: 8 }
    act(() => { for (const fn of listeners) fn() })
    expect(openDocument).toHaveBeenCalledWith('notes/fresh.txt')
    expect(openDocumentPanel).not.toHaveBeenCalled()
  })
})
