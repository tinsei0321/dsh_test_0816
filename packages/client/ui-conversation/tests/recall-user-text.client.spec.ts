import { describe, expect, it } from 'vitest'
import { recallLastUserText } from '../src/client/conversation-nodes/user.ts'
import type { ConversationNode } from '@deepseek-ai/dsh-client-runtime/client'

function text(content: string): unknown {
  return { type: 'text', text: content }
}

function userNode(content: readonly unknown[], seq = 1): ConversationNode {
  return { kind: 'user', seq, time: 0, content, source: null } as unknown as ConversationNode
}

function assistantNode(seq = 1): ConversationNode {
  return { kind: 'assistant', seq, time: 0, turn: 1, step: 1, blocks: [] } as unknown as ConversationNode
}

describe('recallLastUserText', () => {
  it('returns null for an empty node list', () => {
    expect(recallLastUserText([])).toBeNull()
  })

  it('returns null when no user message exists yet', () => {
    expect(recallLastUserText([assistantNode(2), assistantNode(1)])).toBeNull()
  })

  it('recalls the single user message text', () => {
    expect(recallLastUserText([userNode([text('hello world')])])).toBe('hello world')
  })

  it('recalls the LAST user message across turns', () => {
    const nodes = [
      userNode([text('first')], 1),
      assistantNode(2),
      userNode([text('second')], 3),
    ]
    expect(recallLastUserText(nodes)).toBe('second')
  })

  it('concatenates text blocks and skips non-text blocks', () => {
    const nodes = [userNode([text('a'), { type: 'image', attachment: 'x' }, text('b')])]
    expect(recallLastUserText(nodes)).toBe('ab')
  })
})
