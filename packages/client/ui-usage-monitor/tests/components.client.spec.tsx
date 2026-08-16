// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UsageMonitor } from '../src/client/UsageMonitor.tsx'
import type { UsageSnapshot } from '@deepseek-ai/dsh-api-remotes/client'

afterEach(cleanup)

function snapshot(overrides: Partial<UsageSnapshot> = {}): UsageSnapshot {
  const week = Array.from({ length: 7 }, (_, i) => ({
    day: `2026-08-${String(10 + i).padStart(2, '0')}`,
    generated: 500,
    context: 2000,
    cached: 300,
    calls: 3,
    cost: 0.012,
    proCost: 0.012,
    flashCost: 0,
  }))
  return {
    week,
    balance: {
      ok: true,
      data: { available: true, currency: 'CNY', total: '88.50', granted: '10.00', toppedUp: '78.50' },
    },
    costMeta: { currency: 'CNY', source: 'official' },
    at: new Date(2026, 7, 16, 12, 0, 0).getTime(),
    ...overrides,
  }
}

describe('UsageMonitor', () => {
  it('renders the loading chip, then the balance and today totals from the injected loader', async () => {
    const load = vi.fn(async () => snapshot())
    render(<UsageMonitor load={load} />)
    expect(screen.getByRole('button', { name: /用量监测/ })).toBeTruthy()
    expect(screen.getByText('…')).toBeTruthy()
    await waitFor(() => { expect(screen.getByText('88.50 CNY')).toBeTruthy() })
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('opens the hover panel and shows balance rows, today token count, and today cost', async () => {
    const load = vi.fn(async () => snapshot())
    render(<UsageMonitor load={load} />)
    const chip = screen.getByRole('button', { name: /用量监测/ })
    await waitFor(() => { expect(screen.getByText('88.50 CNY')).toBeTruthy() })
    act(() => { fireEvent.mouseEnter(chip) })
    await waitFor(() => { expect(screen.getByText('用量监测', { selector: 'span' })).toBeTruthy() })
    expect(screen.getByText('总余额')).toBeTruthy()
    expect(screen.getByText('赠送')).toBeTruthy()
    expect(screen.getByText('充值')).toBeTruthy()
    expect(screen.getByText('2,800')).toBeTruthy() // today generated+context+cached
    // Today cost (CNY); the axis mid label renders the same value, so both match.
    expect(screen.getAllByText('¥0.01').length).toBeGreaterThan(0)
  })

  it('renders cost bars for every day of the week (not only today)', async () => {
    const load = vi.fn(async () => snapshot())
    render(<UsageMonitor load={load} />)
    const chip = screen.getByRole('button', { name: /用量监测/ })
    await waitFor(() => { expect(screen.getByText('88.50 CNY')).toBeTruthy() })
    act(() => { fireEvent.mouseEnter(chip) })
    await waitFor(() => { expect(screen.getByText('用量监测', { selector: 'span' })).toBeTruthy() })
    // One stacked cost segment per day: all seven days carry cost data, so
    // all seven columns render a bar (the token-based bars only drew today).
    const segs = document.querySelectorAll('[class*="seg"]')
    expect(segs.length).toBe(7)
  })

  it('shows the failure reason instead of a balance when the snapshot reports one', async () => {
    const load = vi.fn(async () => snapshot({
      balance: { ok: false, reason: 'no-key' },
    }))
    render(<UsageMonitor load={load} />)
    const chip = screen.getByRole('button', { name: /用量监测/ })
    await waitFor(() => { expect(load).toHaveBeenCalled() })
    act(() => { fireEvent.mouseEnter(chip) })
    await waitFor(() => { expect(screen.getByText('未配置 API Key')).toBeTruthy() })
  })

  it('falls back to a dash chip when the loader rejects', async () => {
    const load = vi.fn(async () => { throw new Error('boom') })
    render(<UsageMonitor load={load} />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /用量监测/ }).textContent).toContain('—')
    })
  })
})
