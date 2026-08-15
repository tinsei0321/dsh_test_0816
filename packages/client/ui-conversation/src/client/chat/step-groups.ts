/**
 * Pure derivation of the chat flow's step-grouping rows: walk the ordered
 * node keys once to map each step to an error flag, then again to emit
 * step-header rows at every (turn, step) transition and node rows otherwise.
 * Pure function over the flow order and the node store — no subscription, no
 * store, no events. The header status is read from the WHOLE step (a step's
 * nodes are contiguous in the flow), so an error that lands on a later node of
 * the step recolors the header via the useMemo dependency on the node store.
 */
import type { ChatConversationViewNode, ToolCallBlock } from '@deepseek-ai/dsh-client-runtime/client'
import { isSettledTool } from '../contract/chat-nodes.ts'

/** Lifecycle state of one Agent step as shown on its flow header. */
export type StepStatus = 'running' | 'completed' | 'error'

/** One render row of the grouped chat flow: a step header or a business node. */
export type StepFlowRow =
  | { readonly kind: 'node'; readonly key: string }
  | { readonly kind: 'step'; readonly turn: number; readonly step: number; readonly status: StepStatus }

/** Stable grouping identity of a step-scoped node. */
function stepKey(location: Extract<ChatConversationViewNode['location'], { kind: 'step' }>['step']): string {
  return `${location.turn}:${location.step}`
}

/** Whether one node carries step-level error evidence (interrupted assistant, errored tool). */
function nodeHasError(node: ChatConversationViewNode): boolean {
  if (node.kind === 'assistant-step') {
    return (node.data as { status?: string }).status === 'interrupted'
  }
  if (node.kind === 'tool-call') {
    const root = (node.data as { root?: ToolCallBlock }).root
    return root !== undefined && isSettledTool(root) && root.isError
  }
  return false
}

/**
 * Group the ordered chat nodes by step, emitting a step header at each new
 * (turn, step). Nodes outside any step (user/steering/context messages,
 * commands, turn tails, retries) render between groups and reset the run.
 * @param order - ordered business-node keys of the current chat window.
 * @param nodes - the live keyed node reader.
 * @returns the grouped render rows.
 */
export function deriveStepRows(
  order: readonly string[],
  nodes: { get(key: string): ChatConversationViewNode | undefined },
): readonly StepFlowRow[] {
  // Pass 1: which steps carry error evidence (assistant interrupted or a
  // settled tool result flagged as an error).
  const errored = new Set<string>()
  for (const key of order) {
    const node = nodes.get(key)
    if (node === undefined || node.location.kind !== 'step') continue
    if (nodeHasError(node)) errored.add(stepKey(node.location.step))
  }

  // Pass 2: emit header + node rows in flow order.
  const rows: StepFlowRow[] = []
  let current: string | null = null
  for (const key of order) {
    const node = nodes.get(key)
    if (node === undefined || node.location.kind !== 'step') {
      rows.push({ kind: 'node', key })
      current = null
      continue
    }
    const location = node.location.step
    const identity = stepKey(location)
    if (current !== identity) {
      const status: StepStatus = errored.has(identity)
        ? 'error'
        : location.end === undefined ? 'running' : 'completed'
      rows.push({ kind: 'step', turn: location.turn, step: location.step, status })
      current = identity
    }
    rows.push({ kind: 'node', key })
  }
  return rows
}
