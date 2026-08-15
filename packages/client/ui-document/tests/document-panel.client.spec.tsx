// @vitest-environment jsdom
/** DocumentPanel presentation behavior: tabs, inventory rows, reader zones, auto-follow. */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-web-react'
import {
  createSnapshotStore, EMPTY_CHAT_SNAPSHOT, EMPTY_CONVERSATION_VIEWS,
} from '@deepseek-ai/dsh-client-runtime/client'
import type {
  ConversationSnapshot, SessionId, SessionListState, ToolResultNode, WorkspaceListState,
} from '@deepseek-ai/dsh-client-runtime/client'
import type { ToolResultView } from '@deepseek-ai/dsh-client-connection/client'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { DocumentPanel } from '../src/client/DocumentPanel.tsx'
import type { DocumentPanelProps } from '../src/client/DocumentPanel.tsx'
import { createDocumentViewStore } from '../src/client/stores.ts'
import { zh } from '../src/client/locales.ts'

const SID = 's-panel' as SessionId
const t: DocumentPanelProps['t'] = makeTranslate(zh, commonZh)

function snapshotBase(): ConversationSnapshot {
  return {
    sessionId: SID, views: EMPTY_CONVERSATION_VIEWS, chat: EMPTY_CHAT_SNAPSHOT,
    nodes: [], turnTimings: new Map(), turnEnds: new Map(), partial: null, runningCalls: [],
    pending: [], queue: [], running: false, composerPhase: 'active', removed: false, openState: 'open', openError: null,
    hasMore: false, loadingOlder: false, promptError: null, blank: false, subagent: null, lastAgentError: null,
  }
}

function resultNode(seq: number, resultView: ToolResultView | null): ToolResultNode {
  return {
    kind: 'tool-result', seq, time: seq * 1000, callId: `c${seq}`,
    call: { name: 'tool', argsRaw: '{}' }, callTime: seq * 1000 - 1,
    content: [], isError: false, callView: null, resultView, subCalls: [],
  }
}

function snapWith(nodes: ToolResultNode[], running = false): ConversationSnapshot {
  const snap = snapshotBase()
  snap.nodes = nodes
  snap.running = running
  return snap
}

const READ_VIEW: Extract<ToolResultView, { card: 'read' }> = {
  card: 'read', path: 'src/main.ts', offset: 1,
  lines: [{ number: 1, text: 'const x = 1' }], totalLines: 42, lang: 'ts',
}

/** Build the full props share; the test renders the panel itself. */
function propsFor(snap: ConversationSnapshot, overrides: Partial<DocumentPanelProps> = {}): DocumentPanelProps {
  const emptyList = createSnapshotStore<SessionListState>(
    { ids: [], byId: {}, current: undefined, phase: 'ready', subagentsByParent: {}, jobsBySession: {}, currentAddress: undefined })
  const emptyWorkspaces = createSnapshotStore<WorkspaceListState>({
    items: [], archivedSessionIds: [], state: 'idle', phase: 'ready', error: null,
    baselinesReady: true, recentWorkspaceId: undefined,
  })
  const store = createDocumentViewStore().create()
  return {
    sessionId: SID,
    useSession: bindSnapshotSelector({ getSnapshot: () => snap, subscribe: () => () => {} }),
    useSessions: bindSnapshotSelector(emptyList),
    useWorkspaces: bindSnapshotSelector(emptyWorkspaces),
    useProjection: (() => undefined),
    useInput: (() => { throw new Error('unused') }),
    inputActions: {
      setDraft: () => {},
      addImages: () => true,
      removeImage: () => {},
      pruneImages: () => {},
      submit: () => {},
    },
    useStore: bindSnapshotSelector(store),
    actions: store.actions,
    docs: [],
    doc: null,
    onOpen: vi.fn(),
    onClose: vi.fn(),
    cwd: 'D:/workspace',
    t,
    ...overrides,
  }
}

afterEach(() => { cleanup() })

describe('DocumentPanel', () => {
  it('shows the empty state when the session touched no files', () => {
    const view = render(<DocumentPanel {...propsFor(snapshotBase())} />)
    expect(view.getByText('会话中还没有读取或修改的文件')).toBeTruthy()
  })

  it('renders the focused file content beside the frame tree column', () => {
    // The project directory tree is ui-layout's rightmost column, outside
    // this panel; the reader fills the document half.
    const snap = snapWith([resultNode(1, READ_VIEW)])
    const view = render(<DocumentPanel {...propsFor(snap, { docs: ['src/main.ts'], doc: 'src/main.ts' })} />)
    expect(view.container.textContent).toContain('const x = 1')
  })

  it('renders open-file tabs; tab clicks focus, tab close buttons route onClose', () => {
    const snap = snapWith([
      resultNode(1, READ_VIEW),
      resultNode(2, { ...READ_VIEW, path: 'src/other.ts' }),
    ])
    const onOpen = vi.fn()
    const onClose = vi.fn()
    const view = render(<DocumentPanel {...propsFor(snap, {
      docs: ['src/main.ts', 'src/other.ts'], doc: 'src/main.ts', onOpen, onClose,
    })} />)
    const tabs = view.getAllByRole('tab')
    expect(tabs).toHaveLength(2)
    expect(tabs[0]).toHaveProperty('ariaSelected', 'true')
    fireEvent.click(tabs[1]!)
    expect(onOpen).toHaveBeenCalledWith('src/other.ts')
    fireEvent.click(view.getByLabelText('关闭 src/main.ts'))
    expect(onClose).toHaveBeenCalledWith('src/main.ts')
  })

  it('close-all closes every open tab in one gesture (hidden below two tabs)', () => {
    const snap = snapWith([
      resultNode(1, READ_VIEW),
      resultNode(2, { ...READ_VIEW, path: 'src/other.ts' }),
    ])
    const onOpen = vi.fn()
    const onClose = vi.fn()
    const view = render(<DocumentPanel {...propsFor(snap, {
      docs: ['src/main.ts', 'src/other.ts'], doc: 'src/main.ts', onOpen, onClose,
    })} />)
    fireEvent.click(view.getByLabelText('全部关闭'))
    expect(onClose).toHaveBeenCalledTimes(2)
    expect(onClose).toHaveBeenCalledWith('src/main.ts')
    expect(onClose).toHaveBeenCalledWith('src/other.ts')
    // A single open tab offers no close-all affordance.
    const single = render(<DocumentPanel {...propsFor(snap, {
      docs: ['src/main.ts'], doc: 'src/main.ts', onOpen, onClose,
    })} />)
    expect(single.container.querySelector('button[aria-label="全部关闭"]')).toBeNull()
  })

  it('renders the focused file content and its session changes', () => {
    const snap = snapWith([
      resultNode(1, READ_VIEW),
      resultNode(2, { card: 'diff', diffs: [{ path: 'src/main.ts', oldText: 'const x = 1', newText: 'const x = 2' }] }),
    ])
    const view = render(<DocumentPanel {...propsFor(snap, {
      docs: ['src/main.ts'], doc: 'src/main.ts',
    })} />)
    // Reader body: the read line and the changes header both render.
    expect(view.getByText('const x = 1')).toBeTruthy()
    expect(view.getByText('本会话修改')).toBeTruthy()
  })

  it('pins without content show the pick-a-file hint; contentless pins show the unavailable hint', () => {
    // Pin not in the derived entries: the reader shows the pick-a-file hint.
    const snap = snapWith([resultNode(1, READ_VIEW)])
    const outside = render(<DocumentPanel {...propsFor(snap, { doc: 'gone.txt' })} />)
    expect(outside.getByText('从文件列表选择一个查看')).toBeTruthy()

    // A discovered-only path is in the entries but has no content to show.
    const discovered = snapWith([
      resultNode(1, { card: 'search', shape: 'paths', paths: ['src/extra.ts'], truncated: false, total: 1 }),
    ])
    const contentless = render(<DocumentPanel {...propsFor(discovered, { doc: 'src/extra.ts' })} />)
    expect(contentless.getByText('该文件在会话中不可用')).toBeTruthy()
  })

  it('follows the latest file while the agent runs; a manual click pauses until the next turn', () => {
    // The onOpen spy mirrors the real owner: the focused path feeds back into
    // the doc prop, so a followed file is no longer "unfocused".
    const docRef = { current: null as string | null }
    const onOpen = vi.fn((path: string) => { docRef.current = path })
    const renderWith = (snap: ConversationSnapshot) => render(
      <DocumentPanel {...propsFor(snap, {
        onOpen,
        doc: docRef.current,
        docs: ['src/main.ts'],
        useSession: bindSnapshotSelector({ getSnapshot: () => snap, subscribe: () => () => {} }),
      })} />,
    )

    // Running with a latest entry and nothing focused: the panel follows it.
    const a = snapWith([resultNode(1, READ_VIEW)], true)
    const view = renderWith(a)
    expect(onOpen).toHaveBeenCalledWith('src/main.ts')
    expect(docRef.current).toBe('src/main.ts')

    // A manual tab click while running pauses following.
    fireEvent.click(view.getByRole('tab'))
    const callsAfterManual = onOpen.mock.calls.length
    const b = snapWith([
      resultNode(1, READ_VIEW),
      resultNode(2, { ...READ_VIEW, path: 'src/other.ts' }),
    ], true)
    view.rerender(<DocumentPanel {...propsFor(b, {
      onOpen,
      doc: docRef.current,
      useSession: bindSnapshotSelector({ getSnapshot: () => b, subscribe: () => () => {} }),
    })} />)
    expect(onOpen.mock.calls.length).toBe(callsAfterManual)

    // The next running edge (a new turn) re-arms following.
    const idle = snapWith([], false)
    view.rerender(<DocumentPanel {...propsFor(idle, {
      onOpen,
      doc: docRef.current,
      useSession: bindSnapshotSelector({ getSnapshot: () => idle, subscribe: () => () => {} }),
    })} />)
    const callsAfterIdle = onOpen.mock.calls.length
    const next = snapWith([resultNode(3, { ...READ_VIEW, path: 'src/other.ts' })], true)
    view.rerender(<DocumentPanel {...propsFor(next, {
      onOpen,
      doc: docRef.current,
      useSession: bindSnapshotSelector({ getSnapshot: () => next, subscribe: () => () => {} }),
    })} />)
    expect(onOpen.mock.calls.length).toBeGreaterThan(callsAfterIdle)
    expect(onOpen).toHaveBeenLastCalledWith('src/other.ts')
  })

  it('switches the reader from source to rendered Markdown and back', () => {
    const snap = snapWith([
      resultNode(1, { card: 'diff', diffs: [{ path: 'out/report.md', oldText: null, newText: '# report\n\ndone' }] }),
    ])
    const view = render(<DocumentPanel {...propsFor(snap, { docs: ['out/report.md'], doc: 'out/report.md' })} />)
    // Source mode: the raw line text sits in the read block (and the diff).
    expect(view.getAllByText('# report').length).toBeGreaterThan(0)
    const reading = view.getByRole('button', { name: '阅读' })
    fireEvent.click(reading)
    // Reading mode: the heading renders as an h1 (the diff zone below keeps
    // its own raw lines, so only the reader switches).
    expect(view.container.querySelector('h1')?.textContent).toBe('report')
    const source = view.getByRole('button', { name: '源码' })
    fireEvent.click(source)
    expect(view.container.querySelector('h1')).toBeNull()
  })

  it('renders non-Markdown files as plain text in reading mode', () => {
    const snap = snapWith([resultNode(1, READ_VIEW)])
    const view = render(<DocumentPanel {...propsFor(snap, { docs: ['src/main.ts'], doc: 'src/main.ts' })} />)
    fireEvent.click(view.getByRole('button', { name: '阅读' }))
    const pre = view.container.querySelector('pre')
    expect(pre?.textContent).toBe('const x = 1')
  })

  it('offers the render mode only for HTML files and renders a sandboxed iframe', () => {
    const snap = snapWith([resultNode(1, {
      card: 'read', path: 'out/page.html',
      window: { start: 0, end: 1, truncated: false, total: 1 },
      lines: [{ text: '<h1>hello</h1>' }], lang: 'html', totalLines: 1,
    } as never)])
    const view = render(<DocumentPanel {...propsFor(snap, { docs: ['out/page.html'], doc: 'out/page.html' })} />)
    const renderButton = view.getByRole('button', { name: '渲染' })
    fireEvent.click(renderButton)
    const frame = view.container.querySelector('iframe')
    expect(frame).not.toBeNull()
    expect(frame!.getAttribute('sandbox')).toBe('')
    expect(frame!.getAttribute('srcdoc')).toBe('<h1>hello</h1>')
    // A non-HTML file has no render affordance.
    const ts = render(<DocumentPanel {...propsFor(snapWith([resultNode(1, READ_VIEW)]), { docs: ['src/main.ts'], doc: 'src/main.ts' })} />)
    expect(ts.container.querySelector('button[aria-pressed][aria-label]')).toBeNull()
    expect(ts.container.querySelectorAll('button').length).toBeGreaterThan(0)
    expect([...ts.container.querySelectorAll('button')].some(b => b.textContent === '渲染')).toBe(false)
  })
})
