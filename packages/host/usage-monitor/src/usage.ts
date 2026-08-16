/**
 * Pure aggregation helpers for the usage monitor: day bucketing, model-tier
 * pricing, per-message cost, and whole-log week folding. Everything here is a
 * pure function over plain inputs so the arithmetic is unit-testable without
 * a Cordis context or a live session store.
 * @module @deepseek-ai/dsh-host-usage-monitor/usage
 */

import type { UsageDayBucket } from './types.ts'

/** Token-usage members the aggregation reads; the real SessionEvent usage payload satisfies this structurally. */
export interface UsageLike {
  /** Input tokens (non-cached reads). */
  inputTokens?: number
  /** Output tokens generated. */
  outputTokens?: number
  /** Cache-read (hit) tokens. */
  cacheReadTokens?: number
  /** Cache-write tokens. */
  cacheWriteTokens?: number
}

/** Structural view of the session-event members usage aggregation reads. */
export interface UsageEventLike {
  /** Event type tag; aggregation only folds `assistant/message` and tracks `request/header`. */
  type: string
  /** Event wall-clock milliseconds. */
  time: number
  /** Event payload: header model selection on `request/header`, usage on `assistant/message`. */
  data?: {
    /** Request header payload carrying the effective model id. */
    header?: { config?: { model?: string } }
    /** Assistant completion usage payload. */
    usage?: UsageLike
  }
}

/** Published per-million-token prices; `effective` is the switchover instant. */
export interface PricingTable {
  /** Local estimate applies to messages before this UTC instant; the tiered table applies after. */
  effective: number
  /** Pre-switchover flat prices (hit/miss/output per million tokens). */
  old: { pro: PriceRow; flash: PriceRow }
  /** Post-switchover off-peak prices. */
  offpeak: { pro: PriceRow; flash: PriceRow }
  /** Post-switchover peak prices. */
  peak: { pro: PriceRow; flash: PriceRow }
}

/** Per-tier per-million-token price row. */
export interface PriceRow {
  /** Cache-hit price per million tokens. */
  hit: number
  /** Cache-miss price per million tokens. */
  miss: number
  /** Output price per million tokens. */
  out: number
}

/** The published DeepSeek pricing used for the local (non-official) cost estimate. */
export const PRICING: PricingTable = {
  effective: Date.UTC(2026, 7, 16, 16, 0, 0),
  old: {
    pro: { hit: 0.003625, miss: 0.435, out: 0.87 },
    flash: { hit: 0.0028, miss: 0.14, out: 0.28 },
  },
  offpeak: {
    pro: { hit: 0.022, miss: 0.66, out: 1.98 },
    flash: { hit: 0.007, miss: 0.22, out: 0.66 },
  },
  peak: {
    pro: { hit: 0.044, miss: 1.32, out: 3.96 },
    flash: { hit: 0.014, miss: 0.44, out: 1.32 },
  },
}

/** Model tier key for cost attribution: `pro`, `flash`, or `''` for unrecognized models. */
export type ModelTier = '' | 'pro' | 'flash'

/**
 * Local calendar day key for one wall-clock instant, `YYYY-MM-DD`.
 * @param ms - wall-clock milliseconds.
 * @returns the local calendar day key.
 */
export function dayKey(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * The trailing seven local calendar days ending today, oldest first.
 * @param now - reference instant, normally `Date.now()`.
 * @returns seven `YYYY-MM-DD` keys.
 */
export function weekDays(now: number): string[] {
  const n = new Date(now)
  const days: string[] = []
  for (let i = 6; i >= 0; i--) {
    days.push(dayKey(new Date(n.getFullYear(), n.getMonth(), n.getDate() - i).getTime()))
  }
  return days
}

/**
 * Empty bucket for one day.
 * @param day - calendar day key.
 * @returns a zeroed aggregate bucket.
 */
export function emptyBucket(day: string): UsageDayBucket {
  return { day, generated: 0, context: 0, cached: 0, calls: 0, cost: 0, proCost: 0, flashCost: 0 }
}

/**
 * Model tier key.
 * @param model - model id string.
 * @returns `pro` or `flash` when the id contains the tier marker, otherwise `''`.
 */
export function tierOf(model: string): ModelTier {
  if (model.includes('pro')) return 'pro'
  if (model.includes('flash')) return 'flash'
  return ''
}

/**
 * Whether one instant falls into the published peak window (UTC).
 * @param ms - instant to classify.
 * @returns true inside the 01:00–04:00 or 06:00–10:00 UTC windows.
 */
export function isPeak(ms: number): boolean {
  const h = new Date(ms).getUTCHours()
  return (h >= 1 && h < 4) || (h >= 6 && h < 10)
}

/**
 * Effective price row for one tier at one instant.
 * @param tier - model tier; unrecognized tiers return the `pro` row as the estimate fallback.
 * @param ms - message instant.
 * @returns the price row, never undefined.
 */
export function priceRow(tier: ModelTier, ms: number): PriceRow {
  const t: 'pro' | 'flash' = tier === '' ? 'pro' : tier
  if (ms >= PRICING.effective) return isPeak(ms) ? PRICING.peak[t] : PRICING.offpeak[t]
  return PRICING.old[t]
}

/**
 * Estimated cost of one usage payload in the pricing currency.
 * @param tier - model tier for price selection.
 * @param usage - token counts.
 * @param ms - message instant for peak selection.
 * @returns cost in the pricing currency (USD before switchover, otherwise the tiered table).
 */
export function costOf(tier: ModelTier, usage: UsageLike, ms: number): number {
  const p = priceRow(tier, ms)
  const miss = (usage.inputTokens ?? 0) + (usage.cacheWriteTokens ?? 0)
  const hit = usage.cacheReadTokens ?? 0
  const out = usage.outputTokens ?? 0
  return (miss * p.miss + hit * p.hit + out * p.out) / 1000000
}

/**
 * Fold a log's events into the seven buckets.
 * @param events - session events in log order; only `assistant/message` rows aggregate, `request/header` rows select the model tier.
 * @param days - the seven target day keys, oldest first.
 * @returns seven buckets, one per target day.
 */
export function foldWeek(events: readonly UsageEventLike[], days: readonly string[]): UsageDayBucket[] {
  const index = new Map<string, number>()
  days.forEach((d, i) => { index.set(d, i) })
  const week = days.map(emptyBucket)
  let model = ''
  for (const ev of events) {
    if (ev.type === 'request/header') {
      const config = ev.data?.header?.config
      if (typeof config?.model === 'string') model = config.model
      continue
    }
    if (ev.type !== 'assistant/message') continue
    const usage = ev.data?.usage
    if (usage === undefined) continue
    const i = index.get(dayKey(ev.time))
    if (i === undefined) continue
    const bucket = week[i]
    if (bucket === undefined) continue
    bucket.generated += usage.outputTokens ?? 0
    bucket.context += (usage.inputTokens ?? 0) + (usage.cacheWriteTokens ?? 0)
    bucket.cached += usage.cacheReadTokens ?? 0
    bucket.calls += 1
    const tier = tierOf(model)
    const cost = costOf(tier, usage, ev.time)
    bucket.cost += cost
    if (tier === 'pro') bucket.proCost += cost
    else if (tier === 'flash') bucket.flashCost += cost
  }
  return week
}
