// @vitest-environment jsdom
/** HeaderDocumentButton: count-driven visibility and the panel-open route. */

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
import { HeaderDocumentButton } from '../src/client/HeaderDocumentButton.tsx'
import type { HeaderDocumentButtonProps } from '../src/client/HeaderDocumentButton.tsx'
import { zh } from '../src/client/locales.ts'

const SID = 's-header' as SessionId
const t: HeaderDocumentButtonProps['t'] = makeTranslate(zh, commonZh)

function snapshotBase(): ConversationSnapshot {
  return {
    sessionId: SID, views: EMPTY_CONVERSATION_VIEWS, chat: EMPTY_CHAT_SNAPSHOT,
    nodes: [], turnTimings: new Map(), turnEnds: new Map(), partial: null, runningCalls: [],
    pending: [], queue: [], running: false, composerPhase: 'active', removed: false, openState: 'open', openError: null,
    hasMore: false, loadingOlder: false, promptError: null, blank: false, subagent: null, lastAgentError: null,
  }
}

function snapWith(nodes: ToolResultNode[]): ConversationSnapshot {
  const snap = snapshotBase()
  snap.nodes = nodes
  return snap
}

function resultNode(seq: number, resultView: ToolResultView): ToolResultNode {
  return {
    kind: 'tool-result', seq, time: seq * 1000, callId: `c${seq}`,
    call: { name: 'tool', argsRaw: '{}' }, callTime: seq * 1000 - 1,
    content: [], isError: false, callView: null, resultView, subCalls: [],
  }
}

const READ_VIEW: ToolResultView = {
  card: 'read', path: 'src/main.ts', offset: 1,
  lines: [{ number: 1, text: 'const x = 1' }], totalLines: 42, lang: 'ts',
}

function propsFor(snap: ConversationSnapshot, overrides: Partial<HeaderDocumentButtonProps> = {}): HeaderDocumentButtonProps {
  const emptyList = createSnapshotStore<SessionListState>(
    { ids: [], byId: {}, current: undefined, phase: 'ready', subagentsByParent: {}, jobsBySession: {}, currentAddress: undefined })
  const emptyWorkspaces = createSnapshotStore<WorkspaceListState>({
    items: [], archivedSessionIds: [], state: 'idle', phase: 'ready', error: null,
    baselinesReady: true, recentWorkspaceId: undefined,
  })
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
    openPanel: vi.fn(),
    t,
    ...overrides,
  }
}

afterEach(() => { cleanup() })

describe('HeaderDocumentButton', () => {
  it('renders nothing while the session touched no files', () => {
    const view = render(<HeaderDocumentButton {...propsFor(snapshotBase())} />)
    expect(view.container.querySelector('button')).toBeNull()
  })

  it('shows the touched-file count and routes the click to the panel opener', () => {
    const snap = snapWith([
      resultNode(1, READ_VIEW),
      resultNode(2, { ...READ_VIEW, path: 'src/other.ts' }),
    ])
    const openPanel = vi.fn()
    const view = render(<HeaderDocumentButton {...propsFor(snap, { openPanel })} />)
    const pill = view.getByRole('button', { name: '查看会话文件，共 2 个' })
    expect(pill.textContent).toBe('文件 · 2')
    fireEvent.click(pill)
    expect(openPanel).toHaveBeenCalledTimes(1)
  })
})
