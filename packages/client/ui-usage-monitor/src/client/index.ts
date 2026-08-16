/**
 * Usage monitor browser half: registers the balance chip into the
 * ui-conversation input strip and wires its snapshot loader to the generated
 * `usageMonitor/snapshot` Remote through the api-remotes assembly.
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the generated Remote API and ctx.remote merge through the Client assembly boundary.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
// Type-only: pulls the ui-conversation SlotMap merge (the input.right entry).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { UsageSnapshot } from '@deepseek-ai/dsh-api-remotes/client'
import { UsageMonitor, type UsageMonitorInjected } from './UsageMonitor.tsx'

export type { UsageMonitorInjected, UsageMonitorProps } from './UsageMonitor.tsx'

/** Services required by the input-strip registration and generated Remote face. */
export const inject = ['slots', 'remote', 'remote.usageMonitor']

/**
 * Client plugin body: the balance chip entry in the conversation input strip.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.slots.inject('conversation.input.right', () => ctx.slots.register({
    name: 'conversation.input.right',
    id: 'usage-monitor',
    order: 0,
    inject: (): UsageMonitorInjected => ({
      load: async (): Promise<UsageSnapshot> => {
        const result = await ctx.remote.usageMonitor.snapshot()
        if (!result.ok) {
          throw new Error(`usageMonitor.snapshot failed: ${result.error.code}: ${result.error.message}`)
        }
        return result.value
      },
    }),
  }, UsageMonitor))
}
