// @vitest-environment jsdom
/**
 * ProjectTree presentation behavior: empty state, root auto-load, lazy
 * directory expansion with abort, hidden-row toggle, truncation, error
 * retry, file open routing, and root changes.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-web-react'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type {
  SessionId, SessionListState, TreeListing, WorkspaceId, WorkspaceListState,
} from '@deepseek-ai/dsh-client-runtime/client'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { ProjectTree, baseNameOf } from '../src/client/ProjectTree.tsx'
import type { ProjectTreeProps } from '../src/client/contract/slots.ts'
import { createProjectTreeStore } from '../src/client/stores.ts'
import { zh } from '../src/client/locales.ts'

const wid = (raw: string): WorkspaceId => raw as WorkspaceId
const SID = 's1' as SessionId

function workspacesState(path: string | null): WorkspaceListState {
  return {
    items: path === null
      ? []
      : [{ workspaceId: wid('ws-1'), path, title: 'ws', sessionIds: [SID], createdAt: '0', updatedAt: '0' }],
    archivedSessionIds: [],
    state: 'idle',
    phase: 'ready',
    error: null,
    baselinesReady: true,
    recentWorkspaceId: path === null ? undefined : wid('ws-1'),
  }
}

function sessionsState(current: SessionId | undefined): SessionListState {
  return {
    ids: current === undefined ? [] : [current],
    byId: {},
    current,
    phase: 'ready',
    subagentsByParent: {},
    jobsBySession: {},
    currentAddress: undefined,
  }
}

const DIR = { name: 'src', path: '/w/src', kind: 'directory' as const, hidden: false }
const FILE = { name: 'README.md', path: '/w/README.md', kind: 'file' as const, hidden: false }
const HIDDEN_FILE = { name: '.gitignore', path: '/w/.gitignore', kind: 'file' as const, hidden: true }

/** Build the full props share plus the live sources the test drives. */
function buildProps(path: string | null = '/w') {
  const workspaces = createSnapshotStore<WorkspaceListState>(workspacesState(path))
  const sessions = createSnapshotStore<SessionListState>(sessionsState(path === null ? undefined : SID))
  const store = createProjectTreeStore().create()
  const listTreeEntries = vi.fn<(path: string, signal: AbortSignal) => Promise<TreeListing>>()
  const openDocument = vi.fn<(path: string) => void>()
  const collapseColumn = vi.fn<() => void>()
  const props: ProjectTreeProps = {
    collapsed: false,
    width: 240,
    useSessions: bindSnapshotSelector(sessions),
    useWorkspaces: bindSnapshotSelector(workspaces),
    useStore: bindSnapshotSelector(store),
    actions: store.actions,
    listTreeEntries,
    openDocument,
    toggleColumn: collapseColumn,
    t: makeTranslate(zh, commonZh),
  }
  return { props, workspaces, sessions, listTreeEntries, openDocument, collapseColumn }
}

afterEach(() => { cleanup() })

describe('ProjectTree', () => {
  it('labels a bare root path by its own path', () => {
    expect(baseNameOf('/')).toBe('/')
    // A drive root has no basename segment; the drive letter is its label.
    expect(baseNameOf('C:\\')).toBe('C:')
  })

  it('shows the empty state when no workspace is current, without listing', () => {
    const b = buildProps(null)
    const view = render(<ProjectTree {...b.props} />)
    expect(view.getByText('暂无工作区：新建会话并选择目录后，这里会显示项目文件')).toBeTruthy()
    expect(b.listTreeEntries).not.toHaveBeenCalled()
  })

  it('auto-loads the root level and routes file clicks through the document opener', async () => {
    const b = buildProps()
    b.listTreeEntries.mockResolvedValue({ path: '/w', entries: [DIR, FILE], truncated: false })
    const view = render(<ProjectTree {...b.props} />)
    await view.findByText('README.md')
    expect(b.listTreeEntries).toHaveBeenCalledWith('/w', expect.anything())
    fireEvent.click(view.getByText('README.md'))
    expect(b.openDocument).toHaveBeenCalledWith('/w/README.md')
    expect(view.getByRole('treeitem', { selected: true }).textContent).toContain('README.md')
  })

  it('expands a directory one lazy level at a time and collapses it', async () => {
    const b = buildProps()
    b.listTreeEntries.mockImplementation(async (path: string) => {
      if (path === '/w') return { path, entries: [DIR], truncated: false }
      if (path === '/w/src') return { path, entries: [FILE], truncated: false }
      throw new Error(`unexpected path ${path}`)
    })
    const view = render(<ProjectTree {...b.props} />)
    await view.findByText('src')
    fireEvent.click(view.getByText('src'))
    await view.findByText('README.md')
    expect(b.listTreeEntries).toHaveBeenCalledWith('/w/src', expect.anything())
    // Collapse hides the children; the cached level needs no reload on re-expand.
    fireEvent.click(view.getByText('src'))
    expect(view.queryByText('README.md')).toBeNull()
    const calls = b.listTreeEntries.mock.calls.length
    fireEvent.click(view.getByText('src'))
    await view.findByText('README.md')
    expect(b.listTreeEntries.mock.calls.length).toBe(calls)
  })

  it('aborts the in-flight load when its directory collapses', async () => {
    const b = buildProps()
    let dirSignal: AbortSignal | undefined
    b.listTreeEntries.mockImplementation(async (path: string, signal: AbortSignal) => {
      if (path === '/w') return { path, entries: [DIR], truncated: false }
      return new Promise((_resolve, reject) => {
        dirSignal = signal
        signal.addEventListener('abort', () => { reject(new Error('aborted')) }, { once: true })
      })
    })
    const view = render(<ProjectTree {...b.props} />)
    await view.findByText('src')
    fireEvent.click(view.getByText('src'))
    await view.findByText('加载中…')
    fireEvent.click(view.getByText('src'))
    await waitFor(() => { expect(dirSignal?.aborted).toBe(true) })
  })

  it('hides hidden rows until the show-hidden toggle flips', async () => {
    const b = buildProps()
    b.listTreeEntries.mockResolvedValue({ path: '/w', entries: [FILE, HIDDEN_FILE], truncated: false })
    const view = render(<ProjectTree {...b.props} />)
    await view.findByText('README.md')
    expect(view.queryByText('.gitignore')).toBeNull()
    fireEvent.click(view.getByText('显示隐藏文件'))
    expect(view.getByText('.gitignore')).toBeTruthy()
  })

  it('reports a truncated level and an unreadable one, retrying the latter on click', async () => {
    const b = buildProps()
    let dirCalls = 0
    b.listTreeEntries.mockImplementation(async (path: string) => {
      if (path === '/w') return { path, entries: [DIR], truncated: true }
      dirCalls++
      if (dirCalls === 1) throw new Error('denied')
      return { path, entries: [FILE], truncated: false }
    })
    const view = render(<ProjectTree {...b.props} />)
    await view.findByText('src')
    expect(view.getByText('目录内容过多，仅显示开头部分')).toBeTruthy()
    fireEvent.click(view.getByText('src'))
    await view.findByText('无法读取此目录，点击重试')
    fireEvent.click(view.getByText('无法读取此目录，点击重试'))
    await view.findByText('README.md')
  })

  it('re-roots when the current workspace changes, dropping the old level', async () => {
    const b = buildProps()
    b.listTreeEntries.mockImplementation(async (path: string) => {
      if (path === '/w') return { path, entries: [FILE], truncated: false }
      if (path === '/w2') return {
        path,
        entries: [{ name: 'main.ts', path: '/w2/main.ts', kind: 'file' as const, hidden: false }],
        truncated: false,
      }
      throw new Error(`unexpected path ${path}`)
    })
    const view = render(<ProjectTree {...b.props} />)
    await view.findByText('README.md')
    act(() => { b.workspaces.set(workspacesState('/w2')) })
    await view.findByText('main.ts')
    expect(b.listTreeEntries).toHaveBeenCalledWith('/w2', expect.anything())
    expect(view.queryByText('README.md')).toBeNull()
  })

  it('aborts every in-flight load when the root changes', async () => {
    const b = buildProps()
    let dirSignal: AbortSignal | undefined
    b.listTreeEntries.mockImplementation((path: string, signal: AbortSignal) => {
      if (path === '/w') return Promise.resolve({ path, entries: [DIR], truncated: false })
      return new Promise((_resolve, reject) => {
        dirSignal = signal
        signal.addEventListener('abort', () => { reject(new Error('aborted')) }, { once: true })
      })
    })
    const view = render(<ProjectTree {...b.props} />)
    await view.findByText('src')
    fireEvent.click(view.getByText('src'))
    // The new root's own load also lands in the pending arm and reassigns
    // dirSignal, so pin the stale directory's signal before switching.
    const staleSignal = dirSignal
    expect(staleSignal).toBeDefined()
    act(() => { b.workspaces.set(workspacesState('/w2')) })
    await waitFor(() => { expect(staleSignal!.aborted).toBe(true) })
  })

  it('clears to the empty state when the workspace disappears', async () => {
    const b = buildProps()
    b.listTreeEntries.mockResolvedValue({ path: '/w', entries: [FILE], truncated: false })
    const view = render(<ProjectTree {...b.props} />)
    await view.findByText('README.md')
    act(() => { b.workspaces.set(workspacesState(null)) })
    expect(await view.findByText('暂无工作区：新建会话并选择目录后，这里会显示项目文件')).toBeTruthy()
    expect(view.queryByText('README.md')).toBeNull()
  })

  it('drops a load that settles after its directory was collapsed, instead of resurrecting the level', async () => {
    const b = buildProps()
    let resolveDir!: (listing: TreeListing) => void
    // The directory load ignores its signal (a Host that settles despite the
    // client-side abort): the late success must not write the level.
    b.listTreeEntries.mockImplementation((path: string) => {
      if (path === '/w') return Promise.resolve({ path, entries: [DIR], truncated: false })
      return new Promise((resolve) => { resolveDir = resolve })
    })
    const view = render(<ProjectTree {...b.props} />)
    await view.findByText('src')
    fireEvent.click(view.getByText('src'))
    await view.findByText('加载中…')
    fireEvent.click(view.getByText('src'))
    await act(async () => {
      resolveDir({ path: '/w/src', entries: [FILE], truncated: false })
    })
    expect(view.queryByText('README.md')).toBeNull()
    // Re-expanding needs a fresh load: the aborted settle wrote no level.
    const calls = b.listTreeEntries.mock.calls.length
    fireEvent.click(view.getByText('src'))
    await waitFor(() => { expect(b.listTreeEntries.mock.calls.length).toBe(calls + 1) })
  })

  it('collapses and re-expands the root row from the cached level', async () => {
    const b = buildProps()
    b.listTreeEntries.mockResolvedValue({ path: '/w', entries: [FILE], truncated: false })
    const view = render(<ProjectTree {...b.props} />)
    await view.findByText('README.md')
    fireEvent.click(view.getByRole('button', { name: /折叠/ }))
    expect(view.queryByText('README.md')).toBeNull()
    const calls = b.listTreeEntries.mock.calls.length
    fireEvent.click(view.getByRole('button', { name: /展开/ }))
    await view.findByText('README.md')
    expect(b.listTreeEntries.mock.calls.length).toBe(calls)
  })
})
