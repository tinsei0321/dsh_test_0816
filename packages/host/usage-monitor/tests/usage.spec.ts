import { describe, expect, it } from 'vitest'
import {
  costOf, dayKey, emptyBucket, foldWeek, isPeak, PRICING, tierOf, weekDays,
  type UsageEventLike,
} from '../src/usage.ts'

/** Local-day key for a UTC instant, mirroring the host's local timezone behavior. */
function localDay(year: number, month: number, day: number): string {
  const d = new Date(year, month, day, 12)
  return dayKey(d.getTime())
}

function usageEvent(type: string, time: number, data?: UsageEventLike['data']): UsageEventLike {
  return { type, time, ...data === undefined ? {} : { data } }
}

describe('dayKey and weekDays', () => {
  it('formats a local calendar day with zero-padded month and day', () => {
    expect(localDay(2026, 0, 5)).toBe('2026-01-05')
    expect(localDay(2026, 11, 31)).toBe('2026-12-31')
  })

  it('returns seven consecutive days ending today, oldest first', () => {
    const now = new Date(2026, 0, 10, 9).getTime()
    const days = weekDays(now)
    expect(days).toHaveLength(7)
    expect(days[0]).toBe(localDay(2026, 0, 4))
    expect(days[6]).toBe(localDay(2026, 0, 10))
  })
})

describe('tierOf and costOf', () => {
  it('classifies model ids by embedded tier marker', () => {
    expect(tierOf('deepseek-v4-pro')).toBe('pro')
    expect(tierOf('deepseek-flash')).toBe('flash')
    expect(tierOf('unknown-model')).toBe('')
  })

  it('prices a miss+output message with the flat legacy table before the switchover', () => {
    const before = PRICING.effective - 1000
    // 1M miss + 1M output on pro: 0.435 + 0.87
    expect(costOf('pro', { inputTokens: 1_000_000, outputTokens: 1_000_000 }, before)).toBeCloseTo(1.305, 6)
  })

  it('prices cache hits and writes through the hit/miss rows', () => {
    const before = PRICING.effective - 1000
    // flash: 1M hits + 1M writes + 1M output: 0.0028 + 0.14 + 0.28
    expect(costOf('flash', { cacheReadTokens: 1_000_000, cacheWriteTokens: 1_000_000, outputTokens: 1_000_000 }, before)).toBeCloseTo(0.4228, 6)
  })

  it('switches to the peak table inside the published UTC peak windows', () => {
    const peak = Date.UTC(2026, 7, 17, 2, 0) // 02:00 UTC is inside 01:00–04:00
    const offpeak = Date.UTC(2026, 7, 17, 5, 0)
    expect(isPeak(peak)).toBe(true)
    expect(isPeak(offpeak)).toBe(false)
    expect(costOf('pro', { inputTokens: 1_000_000 }, peak)).toBeCloseTo(1.32, 6)
    expect(costOf('pro', { inputTokens: 1_000_000 }, offpeak)).toBeCloseTo(0.66, 6)
  })
})

describe('foldWeek', () => {
  const day = localDay(2026, 0, 10)
  const noon = new Date(2026, 0, 10, 12).getTime()

  it('folds header model selection and assistant usage into the matching day bucket', () => {
    const events: UsageEventLike[] = [
      usageEvent('request/header', noon, { header: { config: { model: 'deepseek-v4-pro' } } }),
      usageEvent('assistant/message', noon, {
        usage: { inputTokens: 1000, outputTokens: 200, cacheReadTokens: 50, cacheWriteTokens: 10 },
      }),
    ]
    const buckets = foldWeek(events, [day])
    expect(buckets).toHaveLength(1)
    const bucket = buckets[0]!
    expect(bucket).toMatchObject({
      day,
      generated: 200,
      context: 1010,
      cached: 50,
      calls: 1,
    })
    expect(bucket.cost).toBeCloseTo(costOf('pro', { inputTokens: 1000, outputTokens: 200, cacheReadTokens: 50, cacheWriteTokens: 10 }, noon), 9)
    expect(bucket.proCost).toBeCloseTo(bucket.cost, 9)
    expect(bucket.flashCost).toBe(0)
  })

  it('ignores non-usage events and events outside the target window', () => {
    const otherDay = new Date(2026, 0, 9, 12).getTime()
    const events: UsageEventLike[] = [
      usageEvent('assistant/message', otherDay, { usage: { outputTokens: 999 } }),
      usageEvent('tool/call', noon),
      usageEvent('assistant/message', noon, { usage: { outputTokens: 1 } }),
    ]
    const buckets = foldWeek(events, [day])
    expect(buckets[0]?.generated).toBe(1)
    expect(buckets[0]?.calls).toBe(1)
  })

  it('attributes cost to the flash tier when the header model switches', () => {
    const events: UsageEventLike[] = [
      usageEvent('request/header', noon, { header: { config: { model: 'deepseek-v4-pro' } } }),
      usageEvent('assistant/message', noon, { usage: { outputTokens: 100 } }),
      usageEvent('request/header', noon, { header: { config: { model: 'deepseek-flash' } } }),
      usageEvent('assistant/message', noon, { usage: { outputTokens: 100 } }),
    ]
    const buckets = foldWeek(events, [day])
    expect(buckets[0]?.proCost).toBeCloseTo(costOf('pro', { outputTokens: 100 }, noon), 9)
    expect(buckets[0]?.flashCost).toBeCloseTo(costOf('flash', { outputTokens: 100 }, noon), 9)
    expect(buckets[0]?.calls).toBe(2)
  })

  it('starts from empty buckets for days without events', () => {
    const buckets = foldWeek([], [day])
    expect(buckets[0]).toEqual(emptyBucket(day))
  })
})
