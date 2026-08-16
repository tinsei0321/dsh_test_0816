import type { ConversationNode } from '@deepseek-ai/dsh-client-runtime/client'

/**
 * Recall the text of the most recent finalized user message for the
 * "edit previous prompt" gesture (↑ in an empty composer). Returns null when
 * the session has no user message yet (a blank session) — the caller keeps the
 * native caret behavior in that case.
 *
 * Only `user`-kind messages are considered: steering/context nodes are
 * follow-ups or injected history, not the turn-opening prompt a user means to
 * re-edit. Non-text blocks (images) are skipped; text blocks concatenate in
 * order so a multi-block prompt recalls verbatim.
 */
export function recallLastUserText(nodes: readonly ConversationNode[]): string | null {
  for (let i = nodes.length - 1; i >= 0; i -= 1) {
    const node = nodes[i]
    if (node === undefined || node.kind !== 'user') continue
    let text = ''
    for (const block of node.content) {
      if (block.type === 'text') text += block.text
    }
    return text
  }
  return null
}
