/**
 * ui-project browser half on a real SlotRegistry: the plugin occupies the
 * ui-layout-declared `frame.projectTree` single seat with the
 * project tree; teardown empties the seat (HMR safety).
 */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { ProjectTree } from '../src/client/ProjectTree.tsx'
import type { ProjectTreeInjected } from '../src/client/contract/slots.ts'
import { apply, inject } from '../src/client/index.ts'
import { apply as nodeApply } from '../src/index.ts'

async function bench() {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const slots = ctx.get('slots') as SlotRegistry
  ctx.provide('locale', new LocaleRuntime(ctx))
  const listTreeEntries = vi.fn(async (path: string) => ({ path, entries: [], truncated: false }))
  ctx.provide('workspaces', { listTreeEntries })
  return { ctx, slots, listTreeEntries }
}

describe('ui-project browser apply', () => {
  it('declares every service it binds', () => {
    expect(inject).toEqual(['slots', 'workspaces', 'locale'])
  })

  it('node-half apply is an intentional no-op', () => {
    expect(() => { nodeApply({} as never) }).not.toThrow()
  })

  it('waits until ui-layout declares the tree seat', async () => {
    const ctx = new Context()
    await ctx.plugin(SlotRegistry).await()
    ctx.provide('locale', new LocaleRuntime(ctx))
    ctx.provide('workspaces', { listTreeEntries: vi.fn() })
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    expect(ctx.slots.entries('frame.projectTree')).toHaveLength(0)
    ctx.slots.register({
      name: 'root', children: { 'frame.projectTree': { kind: 'single', scope: 'root' } },
    } as never, () => null)
    await Promise.resolve()
    expect(ctx.slots.entries('frame.projectTree')).toHaveLength(1)
    await fiber.dispose()
  })

  it('registers the tree and unregisters on teardown', async () => {
    const b = await bench()
    b.slots.register({
      name: 'root', children: { 'frame.projectTree': { kind: 'single', scope: 'root' } },
    } as never, () => null)
    const fiber = b.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    const entry = b.slots.entries('frame.projectTree')[0]!
    expect(entry.component).toBe(ProjectTree)
    expect(entry.locale).toBe('project')
    await fiber.dispose()
    expect(b.slots.entries('frame.projectTree')).toHaveLength(0)
    await b.ctx.fiber.dispose()
  })

  it('routes the inject face through the runtime service, the optional documentOpen provider, and the layout toggle', async () => {
    const b = await bench()
    const open = vi.fn()
    const toggleTree = vi.fn()
    b.ctx.provide('documentOpen', { open, openPanel: vi.fn() })
    b.ctx.provide('layout', { toggleTree, toggleSidebar: vi.fn(), openDetails: vi.fn(), expandDetails: vi.fn(), closeDetails: vi.fn() })
    b.slots.register({
      name: 'root', children: { 'frame.projectTree': { kind: 'single', scope: 'root' } },
    } as never, () => null)
    const fiber = b.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    const entry = b.slots.entries('frame.projectTree')[0]!
    const injected = (entry.inject as unknown as () => ProjectTreeInjected)()
    const signal = new AbortController().signal
    await injected.listTreeEntries('/w', signal)
    expect(b.listTreeEntries).toHaveBeenCalledWith('/w', signal)
    injected.openDocument('/w/a.ts')
    expect(open).toHaveBeenCalledWith('/w/a.ts')
    injected.toggleColumn()
    expect(toggleTree).toHaveBeenCalledTimes(1)
    await fiber.dispose()
    await b.ctx.fiber.dispose()
  })

  it('tolerates a composition without the documentOpen provider', async () => {
    const b = await bench()
    b.slots.register({
      name: 'root', children: { 'frame.projectTree': { kind: 'single', scope: 'root' } },
    } as never, () => null)
    const fiber = b.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    const entry = b.slots.entries('frame.projectTree')[0]!
    const injected = (entry.inject as unknown as () => ProjectTreeInjected)()
    // The optional-service convention: an absent provider makes the click a no-op.
    expect(() => { injected.openDocument('/w/a.ts') }).not.toThrow()
    await fiber.dispose()
    await b.ctx.fiber.dispose()
  })
})
