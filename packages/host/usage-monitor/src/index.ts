/**
 * Usage-monitor Host gateway. `UsageMonitorGateway` registers the
 * `usageMonitor` Remote service and publishes one generated Remote,
 * `usageMonitor/snapshot`: the trailing seven days of token/cost buckets
 * folded from live and persisted session logs, the DeepSeek account balance,
 * and the official platform cost for the same window.
 *
 * Every optional capability is read with `ctx.get`, so the gateway loads in
 * deployments without session persistence, the subprocess seam, or
 * credentials and reports machine-readable per-request failures instead.
 * @module @deepseek-ai/dsh-host-usage-monitor
 */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/cordis-plugin-loader'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import type {} from '@deepseek-ai/dsh-credentials'
import type {} from '@deepseek-ai/dsh-sandbox-policy'
import type { Session, SessionEvent, SessionId } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-session-query'
import type {} from '@deepseek-ai/dsh-subprocess'
import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol'
// Typert-generated ./typert and ./remote artifacts import Zod at runtime.
import type {} from 'zod'
import {
  costOf, dayKey, foldWeek, tierOf, weekDays,
  type UsageEventLike, type UsageLike,
} from './usage.ts'
import type { UsageBalanceResult, UsageCostMeta, UsageDayBucket, UsageSnapshot } from './types.ts'

export type * from './types.ts'

/** Official cost fetch result: parsed day aggregates or a machine-readable failure. */
interface OfficialCostResult {
  ok: boolean
  reason?: string
  detail?: string
  currency?: string
  byDay?: Map<string, { total: number; pro: number; flash: number }>
}

/** How long one balance or official-cost payload stays reusable, in milliseconds. */
const FETCH_CACHE_TTL_MS = 60_000

/** Error text of an unknown thrown value, bounded for wire inclusion. */
function errText(err: unknown): string {
  return err !== null && typeof err === 'object' && typeof (err as { message?: unknown }).message === 'string'
    ? (err as { message: string }).message
    : String(err)
}

/** Structural view of one SessionEvent for the aggregation helpers (both read variants carry these members). */
function asUsageEvent(event: SessionEvent): UsageEventLike {
  return event as unknown as UsageEventLike
}

/**
 * Read-only Remote gateway for balance, official cost, and week-bucketed token aggregates.
 * It keeps the current week folded incrementally from the live `session/event`
 * stream and re-scans the whole corpus when the calendar day rolls over.
 */
export class UsageMonitorGateway extends TypertRemoteService {
  private readonly week: UsageDayBucket[] = []
  private scanInflight: Promise<UsageDayBucket[]> | undefined
  private balanceCache: { value: UsageBalanceResult; at: number } | undefined
  private balanceInflight: Promise<UsageBalanceResult> | undefined
  private officialCache: { value: OfficialCostResult; at: number } | undefined
  private officialInflight: Promise<OfficialCostResult> | undefined
  private readonly modelBySession = new Map<SessionId, string>()

  constructor(ctx: Context) {
    super(ctx, 'usageMonitor')
    ctx.on('session/event', (session, event) => { this.onSessionEvent(session, event) })
    void this.ensureWeek()
  }

  /**
   * Fold one live event into the current week's buckets.
   * @param session - session that emitted the event.
   * @param event - the event; header rows select the model tier, assistant rows aggregate.
   */
  private onSessionEvent(session: Session, event: SessionEvent): void {
    const ev = event as unknown as UsageEventLike
    if (event.type === 'request/header') {
      const model = ev.data?.header?.config?.model
      if (typeof model === 'string') this.modelBySession.set(session.id, model)
      return
    }
    if (event.type !== 'assistant/message') return
    const usage = ev.data?.usage
    if (usage === undefined) return
    if (this.week.length !== 7) return
    const idx = this.week.findIndex(b => b.day === dayKey(ev.time))
    if (idx === -1) return
    const bucket = this.week[idx]
    if (bucket === undefined) return
    this.accumulate(bucket, this.modelBySession.get(session.id) ?? '', usage, ev.time)
  }

  /** Add one usage payload to one bucket under the given tier. */
  private accumulate(bucket: UsageDayBucket, model: string, usage: UsageLike, ms: number): void {
    bucket.generated += usage.outputTokens ?? 0
    bucket.context += (usage.inputTokens ?? 0) + (usage.cacheWriteTokens ?? 0)
    bucket.cached += usage.cacheReadTokens ?? 0
    bucket.calls += 1
    const tier = tierOf(model)
    const cost = costOf(tier, usage, ms)
    bucket.cost += cost
    if (tier === 'pro') bucket.proCost += cost
    else if (tier === 'flash') bucket.flashCost += cost
  }

  /**
   * Fold the whole live-plus-persisted corpus into the trailing seven buckets.
   * @returns the seven buckets, oldest first.
   */
  private async scanWeek(): Promise<UsageDayBucket[]> {
    const days = weekDays(Date.now())
    const liveIds = new Set<SessionId>()
    const eventsBySession: Array<readonly UsageEventLike[]> = []
    const sessions = this.ctx.get('sessions')
    if (sessions !== undefined) {
      try {
        for (const session of sessions.list()) {
          liveIds.add(session.id)
          eventsBySession.push(session.events.map(asUsageEvent))
        }
      } catch {
        /* live store unavailable — fall through to the persisted corpus only */
      }
    }
    const sessionQuery = this.ctx.get('sessionQuery')
    if (sessionQuery !== undefined) {
      try {
        const records = await sessionQuery.listSessions()
        for (const record of records) {
          if (liveIds.has(record.header.id)) continue
          try {
            const light = await sessionQuery.listEvents(record.header.id)
            if (!light.some(ev => ev.type === 'assistant/message')) continue
          } catch {
            continue
          }
          try {
            const snapshot = await sessionQuery.readSession(record.header.id)
            eventsBySession.push(snapshot.events.map(asUsageEvent))
          } catch {
            /* unreadable session — skip */
          }
        }
      } catch {
        /* corpus unavailable — keep the live fold only */
      }
    }
    const buckets = days.map(day => ({ day, generated: 0, context: 0, cached: 0, calls: 0, cost: 0, proCost: 0, flashCost: 0 }))
    for (const events of eventsBySession) {
      const folded = foldWeek(events, days)
      folded.forEach((part, i) => {
        const bucket = buckets[i]
        if (bucket === undefined) return
        bucket.generated += part.generated
        bucket.context += part.context
        bucket.cached += part.cached
        bucket.calls += part.calls
        bucket.cost += part.cost
        bucket.proCost += part.proCost
        bucket.flashCost += part.flashCost
      })
    }
    return buckets
  }

  /** Return the current week's buckets, rescanning when the day changed or the cache is absent. */
  private ensureWeek(): Promise<UsageDayBucket[]> {
    if (this.week.length === 7 && this.week[6]?.day === dayKey(Date.now())) return Promise.resolve(this.week)
    if (this.scanInflight === undefined) {
      this.scanInflight = this.scanWeek().then((buckets) => {
        this.week.splice(0, this.week.length, ...buckets)
        return this.week
      }).finally(() => { this.scanInflight = undefined })
    }
    return this.scanInflight
  }

  /**
   * Fetch the account balance with the resolved API key via the subprocess seam's curl.
   * @returns parsed balance or a machine-readable failure.
   */
  private fetchBalance(): Promise<UsageBalanceResult> {
    if (this.balanceCache !== undefined && Date.now() - this.balanceCache.at < FETCH_CACHE_TTL_MS) {
      return Promise.resolve(this.balanceCache.value)
    }
    if (this.balanceInflight !== undefined) return this.balanceInflight
    this.balanceInflight = this.fetchBalanceFresh().then((value) => {
      this.balanceCache = { value, at: Date.now() }
      return value
    }).finally(() => { this.balanceInflight = undefined })
    return this.balanceInflight
  }

  /** One uncached balance request. */
  private async fetchBalanceFresh(): Promise<UsageBalanceResult> {
    const key = await this.resolveCredential('DEEPSEEK_API_KEY')
    if (key === undefined) return { ok: false, reason: 'no-key' }
    const subprocess = this.ctx.get('subprocess')
    if (subprocess === undefined) return { ok: false, reason: 'no-subprocess' }
    try {
      const curlPath = await subprocess.resolveExecutable('curl.exe')
      const handle = subprocess.spawn({
        argv: [curlPath, '-s', '-m', '15', '-K', '-'],
        cwd: this.workspaceRoot(),
        stdio: {
          stdin: { data: `header = "Authorization: Bearer ${key}"\nurl = "https://api.deepseek.com/user/balance"\n` },
          stdout: { maxBytes: 65536 },
          stderr: { maxBytes: 8192 },
        },
        graceMs: 5000,
      })
      const outcome = await handle.done
      const out = handle.collected.stdout !== undefined ? handle.collected.stdout.readFrom(0) : { text: '', nextOffset: 0, lossy: false }
      const errOut = handle.collected.stderr !== undefined ? handle.collected.stderr.readFrom(0) : { text: '', nextOffset: 0, lossy: false }
      if (outcome.exitCode !== 0) {
        const detail = `curl 退出码 ${String(outcome.exitCode)}${errOut.text.trim() !== '' ? ' · ' + errOut.text.trim().slice(0, 140) : ''}`
        return { ok: false, reason: 'fetch-failed', detail }
      }
      const text = out.text.trim()
      if (text === '') {
        const detail = errOut.text.trim().slice(0, 140)
        return { ok: false, reason: 'empty-response', ...detail === '' ? {} : { detail } }
      }
      const json = JSON.parse(text) as {
        is_available?: unknown
        balance_infos?: Array<{ currency?: unknown; total_balance?: unknown; granted_balance?: unknown; topped_up_balance?: unknown }>
      }
      const infos = Array.isArray(json.balance_infos) ? json.balance_infos : []
      const info = infos[0]
      if (info === undefined) return { ok: false, reason: 'unexpected-response', detail: text.slice(0, 140) }
      return {
        ok: true,
        data: {
          available: json.is_available === true,
          currency: typeof info.currency === 'string' ? info.currency : '',
          total: String(info.total_balance),
          granted: String(info.granted_balance),
          toppedUp: String(info.topped_up_balance),
        },
      }
    } catch (err) {
      return { ok: false, reason: 'error', detail: errText(err).slice(0, 160) }
    }
  }

  /**
   * Fetch the official platform cost for the trailing week via the platform token.
   * @returns day-aggregated cost or a machine-readable failure.
   */
  private fetchOfficialCost(): Promise<OfficialCostResult> {
    if (this.officialCache !== undefined && Date.now() - this.officialCache.at < FETCH_CACHE_TTL_MS) {
      return Promise.resolve(this.officialCache.value)
    }
    if (this.officialInflight !== undefined) return this.officialInflight
    this.officialInflight = this.fetchOfficialCostFresh().then((value) => {
      this.officialCache = { value, at: Date.now() }
      return value
    }).finally(() => { this.officialInflight = undefined })
    return this.officialInflight
  }

  /** One uncached official-cost request. */
  private async fetchOfficialCostFresh(): Promise<OfficialCostResult> {
    const token = await this.resolveCredential('DEEPSEEK_PLATFORM_TOKEN')
    if (token === undefined) return { ok: false, reason: 'no-token' }
    const subprocess = this.ctx.get('subprocess')
    if (subprocess === undefined) return { ok: false, reason: 'no-subprocess' }
    try {
      const curlPath = await subprocess.resolveExecutable('curl.exe')
      const now = new Date()
      const rawTz = -now.getTimezoneOffset() * 60
      const tzSec = 3600 * Math.floor(rawTz / 3600)
      const rem = rawTz - tzSec
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000
      const startSec = Math.floor(todayStart + rem) - 6 * 86400
      const endSec = Math.floor(todayStart + rem) + 86400
      const url = `https://platform.deepseek.com/api/v0/usage/by_api_key/cost?start=${startSec}&end=${endSec}&tz=${tzSec}`
      const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
      const cfg = `user-agent = "${UA}"\n`
        + `header = "Authorization: Bearer ${token}"\n`
        + 'header = "Accept: application/json, text/plain, */*"\n'
        + 'header = "Origin: https://platform.deepseek.com"\n'
        + 'header = "Referer: https://platform.deepseek.com/usage"\n'
        + `url = "${url}"\n`
      const handle = subprocess.spawn({
        argv: [curlPath, '-s', '-m', '20', '-K', '-'],
        cwd: this.workspaceRoot(),
        stdio: { stdin: { data: cfg }, stdout: { maxBytes: 262144 }, stderr: { maxBytes: 8192 } },
        graceMs: 5000,
      })
      const outcome = await handle.done
      const out = handle.collected.stdout !== undefined ? handle.collected.stdout.readFrom(0) : { text: '', nextOffset: 0, lossy: false }
      const errOut = handle.collected.stderr !== undefined ? handle.collected.stderr.readFrom(0) : { text: '', nextOffset: 0, lossy: false }
      if (outcome.exitCode !== 0) return { ok: false, reason: 'fetch-failed', detail: errOut.text.trim().slice(0, 120) }
      const text = out.text.trim()
      if (text === '') return { ok: false, reason: 'empty-response', detail: errOut.text.trim().slice(0, 120) }
      const json = JSON.parse(text) as {
        code?: unknown
        msg?: unknown
        data?: {
          biz_data?: {
            data?: Array<{
              currency?: unknown
              series?: Array<{ model?: unknown; buckets?: Array<{ time?: unknown; cost?: unknown }> }>
            }>
          }
        }
      }
      if (json.code !== undefined && json.code !== 0) return { ok: false, reason: 'api-error', detail: errText(json.msg ?? json.code).slice(0, 120) }
      const rows = json.data?.biz_data?.data
      if (rows === undefined) return { ok: false, reason: 'unexpected-response', detail: text.slice(0, 120) }
      const currency = typeof rows[0]?.currency === 'string' ? rows[0].currency : 'CNY'
      const byDay = new Map<string, { total: number; pro: number; flash: number }>()
      const ensure = (day: string): { total: number; pro: number; flash: number } => {
        let bucket = byDay.get(day)
        if (bucket === undefined) {
          bucket = { total: 0, pro: 0, flash: 0 }
          byDay.set(day, bucket)
        }
        return bucket
      }
      for (const entry of rows) {
        for (const series of entry.series ?? []) {
          const tier = tierOf(typeof series.model === 'string' ? series.model : '')
          for (const bk of series.buckets ?? []) {
            const day = dayKey(Number(bk.time ?? 0) * 1000)
            const cost = typeof bk.cost === 'number' ? bk.cost : Number(bk.cost)
            if (!Number.isFinite(cost)) continue
            const bucket = ensure(day)
            bucket.total += cost
            if (tier === 'pro') bucket.pro += cost
            else if (tier === 'flash') bucket.flash += cost
          }
        }
      }
      return { ok: true, currency, byDay }
    } catch (err) {
      return { ok: false, reason: 'error', detail: errText(err).slice(0, 120) }
    }
  }

  /** Resolve one credential reference through the optional credentials service. */
  private async resolveCredential(name: string): Promise<string | undefined> {
    const credentials = this.ctx.get('credentials')
    if (credentials === undefined) return undefined
    try {
      const hit = await credentials.resolve(credentialRef(name))
      if (hit !== undefined && typeof hit.value === 'string' && hit.value !== '') return hit.value
    } catch (err) {
      console.error('usage-monitor: credential resolution failed:', errText(err))
    }
    return undefined
  }

  /** Child-process working directory: the sandbox policy's workspace root when available. */
  private workspaceRoot(): string {
    const policy = this.ctx.get('sandboxPolicy')
    return policy !== undefined && policy.workspaceRoot !== '' ? policy.workspaceRoot : 'C:\\'
  }

  /**
   * Assemble one complete snapshot: week buckets, balance, and official cost.
   * @returns the wire snapshot; each sub-request reports its own failure without failing the snapshot.
   */
  @Remote('snapshot')
  async snapshot(): Promise<UsageSnapshot> {
    const week = await this.ensureWeek()
    const balance = await this.fetchBalance()
    const official = await this.fetchOfficialCost()
    const snap = week.map(b => ({ ...b }))
    let costMeta: UsageCostMeta = { currency: 'USD', source: 'local' }
    if (official.ok && official.byDay !== undefined && official.currency !== undefined) {
      for (const bucket of snap) {
        const o = official.byDay.get(bucket.day)
        if (o !== undefined) {
          bucket.cost = o.total
          bucket.proCost = o.pro
          bucket.flashCost = o.flash
        }
      }
      costMeta = { currency: official.currency, source: 'official' }
    } else if (official.detail !== undefined && official.detail !== '') {
      costMeta = { currency: 'USD', source: 'local', detail: official.detail }
    }
    return { week: snap, balance, costMeta, at: Date.now() }
  }
}

export default UsageMonitorGateway
