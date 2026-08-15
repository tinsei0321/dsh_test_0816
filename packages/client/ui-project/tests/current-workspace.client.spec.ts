/** The tree's root derivation: current-session workspace, recency fallback, null. */
import { describe, expect, it } from 'vitest'
import type { SessionId, SessionListState, WorkspaceId, WorkspaceListState } from '@deepseek-ai/dsh-client-runtime/client'
import { currentWorkspacePath } from '../src/client/current-workspace.ts'

const wid = (raw: string): WorkspaceId => raw as WorkspaceId
const sid = (raw: string): SessionId => raw as SessionId

function workspaces(items: WorkspaceListState['items'], recentWorkspaceId?: WorkspaceId): WorkspaceListState {
  return {
    items,
    archivedSessionIds: [],
    state: 'idle',
    phase: 'ready',
    error: null,
    baselinesReady: true,
    recentWorkspaceId,
  }
}

function sessions(current: SessionListState['current']): SessionListState {
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

const wsA = { workspaceId: wid('a'), path: '/w/a', title: 'a', sessionIds: [sid('s1')], createdAt: '0', updatedAt: '0' }
const wsB = { workspaceId: wid('b'), path: '/w/b', title: 'b', sessionIds: [sid('s2')], createdAt: '0', updatedAt: '0' }

describe('currentWorkspacePath', () => {
  it('prefers the current session\'s workspace over the recency projection', () => {
    const path = currentWorkspacePath(workspaces([wsA, wsB], wid('b')), sessions(sid('s1')))
    expect(path).toBe('/w/a')
  })

  it('falls back to the most recent workspace when no session is current', () => {
    const path = currentWorkspacePath(workspaces([wsA, wsB], wid('b')), sessions(undefined))
    expect(path).toBe('/w/b')
  })

  it('returns null when no workspace is current at all', () => {
    expect(currentWorkspacePath(workspaces([], undefined), sessions(undefined))).toBeNull()
    expect(currentWorkspacePath(workspaces([], wid('ghost')), sessions(undefined))).toBeNull()
  })

  it('falls back to recency when the current session belongs to no workspace', () => {
    const path = currentWorkspacePath(workspaces([wsA, wsB], wid('a')), sessions(sid('stray')))
    expect(path).toBe('/w/a')
  })
})
