/**
 * Wire types for the usage-monitor Remote: one snapshot carries the trailing
 * 7-day token buckets, the balance result, and the cost metadata. Every value
 * is plain JSON so Typert can project it into wire schemas.
 * @module @deepseek-ai/dsh-host-usage-monitor/types
 */

/** One calendar day of token and cost aggregates (local timezone day keys). */
export interface UsageDayBucket {
  /** Local calendar day key, `YYYY-MM-DD`. */
  day: string
  /** Output tokens generated that day. */
  generated: number
  /** Context tokens read that day: input plus cache-write tokens. */
  context: number
  /** Cache-read (hit) tokens that day. */
  cached: number
  /** Assistant completions counted that day. */
  calls: number
  /** Cost that day, in the currency named by {@link UsageCostMeta.currency}. */
  cost: number
  /** Cost that day attributable to `pro`-tier models. */
  proCost: number
  /** Cost that day attributable to `flash`-tier models. */
  flashCost: number
}

/** Cost provenance and currency for the snapshot's cost columns. */
export interface UsageCostMeta {
  /** Cost currency code: `CNY` for official platform cost, `USD` for the local estimate. */
  currency: string
  /** `official` when platform cost replaced the local estimate, else `local`. */
  source: string
  /** Human-readable failure detail when the official cost request failed. */
  detail?: string
}

/** Outcome of one balance request against the DeepSeek account API. */
export interface UsageBalanceResult {
  /** True when a balance payload was parsed. */
  ok: boolean
  /** Machine-readable failure reason when `ok` is false. */
  reason?: string
  /** Human-readable failure detail when `ok` is false. */
  detail?: string
  /** Parsed balance payload; absent when `ok` is false. */
  data?: {
    /** Whether the account is currently usable. */
    available: boolean
    /** Balance currency code, e.g. `CNY`. */
    currency: string
    /** Total balance, kept as a string to preserve API precision. */
    total: string
    /** Granted (promotional) balance, kept as a string. */
    granted: string
    /** Topped-up balance, kept as a string. */
    toppedUp: string
  }
}

/** Complete snapshot payload of the `usageMonitor/snapshot` Remote. */
export interface UsageSnapshot {
  /** Trailing seven buckets, oldest first; `week[6]` is today. */
  week: UsageDayBucket[]
  /** Balance request result. */
  balance: UsageBalanceResult
  /** Cost provenance, currency, and optional official-cost failure detail. */
  costMeta: UsageCostMeta
  /** Host wall-clock milliseconds when the snapshot was assembled. */
  at: number
}
