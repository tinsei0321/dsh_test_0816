/** Pure derivation of the document-tab inventory from conversation snapshots. */

import { describe, expect, it } from 'vitest'
import {
  EMPTY_CHAT_SNAPSHOT, EMPTY_CONVERSATION_VIEWS,
} from '@deepseek-ai/dsh-client-runtime/client'
import type {
  ConversationSnapshot, RunningToolCall, SessionId, ToolResultNode,
} from '@deepseek-ai/dsh-client-runtime/client'
import type { ToolResultView } from '@deepseek-ai/dsh-client-connection/client'
import { deriveDocuments } from '../src/client/documents.ts'

const SID = 's-doc' as SessionId

function snapshotBase(): ConversationSnapshot {
  return {
    sessionId: SID, views: EMPTY_CONVERSATION_VIEWS, chat: EMPTY_CHAT_SNAPSHOT,
    nodes: [], turnTimings: new Map(), turnEnds: new Map(), partial: null, runningCalls: [],
    pending: [], queue: [], running: false, composerPhase: 'active', removed: false, openState: 'open', openError: null,
    hasMore: false, loadingOlder: false, promptError: null, blank: false, subagent: null, lastAgentError: null,
  }
}

/** A settled result node with the given view; seq doubles as the session position. */
function resultNode(seq: number, resultView: ToolResultView | null, subCalls: ToolResultNode['subCalls'] = []): ToolResultNode {
  return {
    kind: 'tool-result', seq, time: seq * 1000, callId: `c${seq}`,
    call: { name: 'tool', argsRaw: '{}' }, callTime: seq * 1000 - 1,
    content: [], isError: false, callView: null, resultView, subCalls,
  }
}

const READ_VIEW: Extract<ToolResultView, { card: 'read' }> = {
  card: 'read',
  path: 'src/main.ts',
  offset: 1,
  lines: [
    { number: 1, text: 'const x = 1' },
    { number: 2, text: 'export { x }' },
  ],
  totalLines: 42,
  lang: 'ts',
}

const EDIT_VIEW: Extract<ToolResultView, { card: 'diff' }> = {
  card: 'diff',
  diffs: [{ path: 'src/main.ts', oldText: 'const x = 1', newText: 'const x = 2' }],
}

const CREATE_VIEW: Extract<ToolResultView, { card: 'diff' }> = {
  card: 'diff',
  diffs: [{ path: 'out/report.md', oldText: null, newText: '# report\n\ndone' }],
}

const GLOB_VIEW: Extract<ToolResultView, { card: 'search' }> = {
  card: 'search', shape: 'paths', paths: ['src/extra.ts', 'src/main.ts'], truncated: false, total: 2,
}

describe('deriveDocuments', () => {
  it('returns an empty inventory for a snapshot without file activity', () => {
    expect(deriveDocuments(snapshotBase())).toEqual([])
  })

  it('folds a read result into content lines, total, and language', () => {
    const snap = snapshotBase()
    snap.nodes = [resultNode(1, READ_VIEW)]
    const [entry] = deriveDocuments(snap)
    expect(entry?.path).toBe('src/main.ts')
    expect(entry?.content).toEqual({
      lines: [{ number: 1, text: 'const x = 1' }, { number: 2, text: 'export { x }' }],
      totalLines: 42,
      lang: 'ts',
    })
    expect(entry?.changes).toEqual([])
    expect(entry?.discoveredOnly).toBe(false)
  })

  it('keeps mutations in session order and never claims content it did not see', () => {
    const snap = snapshotBase()
    snap.nodes = [resultNode(1, EDIT_VIEW)]
    const [entry] = deriveDocuments(snap)
    expect(entry?.content).toBeNull()
    expect(entry?.changes).toEqual([{ path: 'src/main.ts', oldText: 'const x = 1', newText: 'const x = 2' }])
  })

  it('synthesizes whole-file content from a create and keeps the change', () => {
    const snap = snapshotBase()
    snap.nodes = [resultNode(1, CREATE_VIEW)]
    const [entry] = deriveDocuments(snap)
    expect(entry?.content).toEqual({
      lines: [{ number: 1, text: '# report' }, { number: 2, text: '' }, { number: 3, text: 'done' }],
      totalLines: 3,
    })
    expect(entry?.changes).toHaveLength(1)
    expect(entry?.discoveredOnly).toBe(false)
  })

  it('lets the last content-bearing event win: read after create replaces synthesized content', () => {
    const snap = snapshotBase()
    snap.nodes = [resultNode(1, CREATE_VIEW), resultNode(2, READ_VIEW)]
    const [entry] = deriveDocuments(snap)
    expect(entry?.content?.totalLines).toBe(42)
    expect(entry?.content?.lines[0]).toEqual({ number: 1, text: 'const x = 1' })
  })

  it('records edits that follow a read while the read window stays the content', () => {
    const snap = snapshotBase()
    snap.nodes = [resultNode(1, READ_VIEW), resultNode(2, EDIT_VIEW)]
    const [entry] = deriveDocuments(snap)
    expect(entry?.content?.totalLines).toBe(42)
    expect(entry?.changes).toEqual([{ path: 'src/main.ts', oldText: 'const x = 1', newText: 'const x = 2' }])
  })

  it('folds a multi-file diff result per path: each entry gets only its own hunks', () => {
    const snap = snapshotBase()
    snap.nodes = [resultNode(1, {
      card: 'diff',
      diffs: [
        { path: 'a.ts', oldText: 'a0', newText: 'a1' },
        { path: 'b.ts', oldText: 'b0', newText: 'b1' },
      ],
    })]
    const byPath = new Map(deriveDocuments(snap).map(entry => [entry.path, entry]))
    expect(byPath.get('a.ts')?.changes).toEqual([{ path: 'a.ts', oldText: 'a0', newText: 'a1' }])
    expect(byPath.get('b.ts')?.changes).toEqual([{ path: 'b.ts', oldText: 'b0', newText: 'b1' }])
    expect(byPath.get('a.ts')?.content).toBeNull()
  })

  it('marks glob-only paths as discovered and read paths as not', () => {
    const snap = snapshotBase()
    snap.nodes = [resultNode(1, GLOB_VIEW)]
    const entries = deriveDocuments(snap)
    expect(entries.map(e => e.path).sort()).toEqual(['src/extra.ts', 'src/main.ts'])
    expect(entries.every(e => e.content === null && e.changes.length === 0 && e.discoveredOnly)).toBe(true)
    // A later read upgrades the path out of discovered-only.
    snap.nodes = [resultNode(1, GLOB_VIEW), resultNode(2, READ_VIEW)]
    const upgraded = deriveDocuments(snap).find(e => e.path === 'src/main.ts')
    expect(upgraded?.discoveredOnly).toBe(false)
    expect(upgraded?.content).not.toBeNull()
  })

  it('folds nested sub-calls of a settled root', () => {
    const snap = snapshotBase()
    const root = resultNode(1, null, [resultNode(2, READ_VIEW)])
    snap.nodes = [root]
    const entries = deriveDocuments(snap)
    expect(entries).toHaveLength(1)
    expect(entries[0]?.path).toBe('src/main.ts')
  })

  it('records intended diffs from running calls', () => {
    const snap = snapshotBase()
    const running: RunningToolCall = {
      callId: 'r1', name: 'edit', argsRaw: '{}', turn: 1, step: 1, time: 9000,
      callView: { card: 'diff', title: 'Edit', diffs: [{ path: 'a.txt', oldText: 'a', newText: 'b' }] },
      subCalls: [],
    }
    snap.runningCalls = [running]
    const entries = deriveDocuments(snap)
    expect(entries).toHaveLength(1)
    expect(entries[0]?.changes).toEqual([{ path: 'a.txt', oldText: 'a', newText: 'b' }])
  })

  it('sorts by last activity, newest first, path as the stable tiebreak', () => {
    const snap = snapshotBase()
    snap.nodes = [
      resultNode(1, { ...READ_VIEW, path: 'a.ts' }),
      resultNode(2, { ...READ_VIEW, path: 'b.ts' }),
      resultNode(3, { ...READ_VIEW, path: 'c.ts' }),
    ]
    expect(deriveDocuments(snap).map(e => e.path)).toEqual(['c.ts', 'b.ts', 'a.ts'])
    snap.nodes = [resultNode(1, { ...READ_VIEW, path: 'b.ts' }), resultNode(1, { ...READ_VIEW, path: 'a.ts' })]
    expect(deriveDocuments(snap).map(e => e.path)).toEqual(['a.ts', 'b.ts'])
  })
})
