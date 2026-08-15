/**
 * ui-document browser half on a real SlotRegistry: the plugin occupies the
 * ui-conversation-declared `conversation.details.document` single seat with
 * the document panel; teardown empties the seat (HMR safety).
 */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { DocumentPanel } from '../src/client/DocumentPanel.tsx'
import { HeaderDocumentButton, type HeaderDocumentInjected } from '../src/client/HeaderDocumentButton.tsx'
import { apply, inject } from '../src/client/index.ts'
import { apply as nodeApply } from '../src/index.ts'

async function bench() {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const slots = ctx.get('slots') as SlotRegistry
  ctx.provide('locale', new LocaleRuntime(ctx))
  return { ctx, slots }
}

describe('ui-document browser apply', () => {
  it('declares every service it binds', () => {
    expect(inject).toEqual(['slots', 'locale'])
  })

  it('node-half apply is an intentional no-op', () => {
    expect(() => { nodeApply({} as never) }).not.toThrow()
  })

  it('waits until conversation declares the document seat', async () => {
    const ctx = new Context()
    await ctx.plugin(SlotRegistry).await()
    ctx.provide('locale', new LocaleRuntime(ctx))
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    expect(ctx.slots.entries('conversation.details.document')).toHaveLength(0)
    ctx.slots.register({
      name: 'root', children: { 'conversation.details.document': { kind: 'single', scope: 'session' } },
    } as never, () => null)
    await Promise.resolve()
    expect(ctx.slots.entries('conversation.details.document')).toHaveLength(1)
    await fiber.dispose()
  })

  it('registers the panel and unregisters on teardown', async () => {
    const b = await bench()
    b.slots.register({
      name: 'root', children: { 'conversation.details.document': { kind: 'single', scope: 'session' } },
    } as never, () => null)
    const fiber = b.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    const entry = b.slots.entries('conversation.details.document')[0]!
    expect(entry.component).toBe(DocumentPanel)
    await fiber.dispose()
    expect(b.slots.entries('conversation.details.document')).toHaveLength(0)
    await b.ctx.fiber.dispose()
  })

  it('registers the header file pill, routes its inject through documentOpen.openPanel, and unregisters on teardown', async () => {
    const b = await bench()
    const openPanel = vi.fn()
    b.ctx.provide('documentOpen', { open: vi.fn(), openPanel })
    b.slots.register({
      name: 'root',
      children: { 'conversation.session.header.actions': { kind: 'list', scope: 'session' } },
    } as never, () => null)
    const fiber = b.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    const entry = b.slots.entries('conversation.session.header.actions')[0]!
    expect(entry.component).toBe(HeaderDocumentButton)
    expect(entry.options.id).toBe('document-files')
    const injected = (entry.inject as unknown as () => HeaderDocumentInjected)()
    injected.openPanel()
    expect(openPanel).toHaveBeenCalledTimes(1)
    await fiber.dispose()
    expect(b.slots.entries('conversation.session.header.actions')).toHaveLength(0)
    await b.ctx.fiber.dispose()
  })
})
