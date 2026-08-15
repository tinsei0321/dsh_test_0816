import { describe, expect, it } from 'vitest'
import type { ChatConversationViewNode } from '@deepseek-ai/dsh-client-runtime/client'
import { deriveStepRows, type StepFlowRow } from '../src/client/chat/step-groups.ts'

/** Minimal step-scoped node fake: only the fields deriveStepRows reads. */
function stepNode(key: string, turn: number, step: number, end: boolean, kind = 'assistant-step', data: unknown = {}): ChatConversationViewNode {
  return {
    key, kind, id: key, target: 'chat', anchorSeq: 0, visibility: 'visible', data,
    location: {
      kind: 'step',
      turn: { turn, start: undefined, end: undefined, steps: [] },
      step: { turn, step, start: undefined, end: end ? ({ type: 'step/end' } as never) : undefined },
    },
  } as unknown as ChatConversationViewNode
}

/** Minimal non-step node fake (user message / turn tail). */
function plainNode(key: string): ChatConversationViewNode {
  return {
    key, kind: 'user', id: key, target: 'chat', anchorSeq: 0, visibility: 'visible', data: {},
    location: { kind: 'session' },
  } as unknown as ChatConversationViewNode
}

function store(entries: readonly ChatConversationViewNode[]): { get(key: string): ChatConversationViewNode | undefined } {
  const map = new Map(entries.map(n => [n.key, n]))
  return { get: key => map.get(key) }
}

/** The emitted keys in row order (step headers carry `step:{turn}:{step}`). */
function shapes(rows: readonly StepFlowRow[]): string[] {
  return rows.map(r => r.kind === 'step' ? `step:${r.turn}:${r.step}` : `node:${r.key}`)
}

describe('deriveStepRows', () => {
  it('groups consecutive nodes of one step under a single header', () => {
    const nodes = [stepNode('a', 1, 1, true), stepNode('b', 1, 1, true)]
    const rows = deriveStepRows(['a', 'b'], store(nodes))
    expect(shapes(rows)).toEqual(['step:1:1', 'node:a', 'node:b'])
  })

  it('emits a new header at each (turn, step) transition', () => {
    const nodes = [stepNode('a', 1, 1, true), stepNode('b', 1, 2, true), stepNode('c', 2, 1, true)]
    const rows = deriveStepRows(['a', 'b', 'c'], store(nodes))
    expect(shapes(rows)).toEqual(['step:1:1', 'node:a', 'step:1:2', 'node:b', 'step:2:1', 'node:c'])
  })

  it('resets the group after a non-step node, so the same step number later still re-heads', () => {
    const nodes = [stepNode('a', 1, 1, true), plainNode('u'), stepNode('b', 1, 1, true)]
    const rows = deriveStepRows(['a', 'u', 'b'], store(nodes))
    expect(shapes(rows)).toEqual(['step:1:1', 'node:a', 'node:u', 'step:1:1', 'node:b'])
  })

  it('reports running while the step has no end event, completed once ended', () => {
    const running = deriveStepRows(['a'], store([stepNode('a', 1, 1, false)]))
    expect(running[0]).toMatchObject({ kind: 'step', status: 'running' })
    const done = deriveStepRows(['a'], store([stepNode('a', 1, 1, true)]))
    expect(done[0]).toMatchObject({ kind: 'step', status: 'completed' })
  })

  it('flags an interrupted assistant step as error', () => {
    const nodes = [stepNode('a', 1, 1, true, 'assistant-step', { status: 'interrupted' })]
    expect(deriveStepRows(['a'], store(nodes))[0]).toMatchObject({ kind: 'step', status: 'error' })
  })

  it('flags a step with an errored tool result as error even on a later node', () => {
    const nodes = [
      stepNode('a', 1, 1, true, 'assistant-step', { status: 'settled' }),
      stepNode('b', 1, 1, true, 'tool-call', { root: { kind: 'tool-result', isError: true, subCalls: [] } }),
    ]
    const rows = deriveStepRows(['a', 'b'], store(nodes))
    expect(rows[0]).toMatchObject({ kind: 'step', status: 'error' })
  })

  it('does not flag a settled successful tool result', () => {
    const nodes = [
      stepNode('a', 1, 1, true, 'tool-call', { root: { kind: 'tool-result', isError: false, subCalls: [] } }),
    ]
    expect(deriveStepRows(['a'], store(nodes))[0]).toMatchObject({ kind: 'step', status: 'completed' })
  })
})
