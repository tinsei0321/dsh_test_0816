/**
 * UsageMonitor: the balance chip in the conversation input strip with a hover
 * panel showing the account balance, today's token totals, and the trailing
 * seven-day token/cost chart. Every fact arrives through the injected `load`
 * callback (the Remote snapshot); the component owns only its transient
 * hover state and its 10-second refresh interval.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { UsageSnapshot } from '@deepseek-ai/dsh-api-remotes/client'
import css from './UsageMonitor.module.css'

/** Registration-side face: the snapshot loader wired by the plugin apply. */
export interface UsageMonitorInjected {
  /** Fetch one fresh snapshot from the Host Remote. */
  load: () => Promise<UsageSnapshot>
}

/** Component props: exactly the injected face. */
export type UsageMonitorProps = UsageMonitorInjected

/** Chart series colors are data, not theme tokens: segment identity must survive theming. */
interface SeriesDef {
  key: 'proCost' | 'flashCost'
  label: string
  color: string
}

// The official DeepSeek platform's usage chart is drawn in the warm orange
// ramp; the two tiers use a deep and a light orange.
const COST_SERIES: readonly SeriesDef[] = [
  { key: 'proCost', label: 'Pro', color: '#FF8F1F' },
  { key: 'flashCost', label: 'Flash', color: '#FFC46B' },
]

const TIP_W = 208
const TIP_H = 100
/** Poll interval for the live refresh, in milliseconds. */
const REFRESH_MS = 10_000

function pad2(x: number): string {
  return String(x).padStart(2, '0')
}

function fmtInt(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function fmtMoney(v: string): string {
  const n = Number(v)
  if (!Number.isFinite(n)) return v
  return n.toFixed(2)
}

function fmtCost(v: number, currency: string): string {
  const sym = currency === 'CNY' ? '\u00a5' : '$'
  if (!(v > 0)) return `${sym}0.00`
  return sym + (v >= 0.01 ? v.toFixed(2) : v.toFixed(4))
}

function fmtTime(ms: number | null): string {
  if (ms === null) return '--:--:--'
  const d = new Date(ms)
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
}

function reasonText(reason: string): string {
  if (reason === 'no-key') return '未配置 API Key'
  if (reason === 'no-subprocess') return '执行环境不可用'
  if (reason === 'fetch-failed') return '网络请求失败'
  if (reason === 'empty-response') return '接口无响应'
  if (reason === 'unexpected-response') return '接口响应异常'
  return '余额获取失败'
}

/** Smallest 1/2/5-magnitude multiple at or above the input, for chart axis ceilings. */
function niceCeil(n: number): number {
  if (n <= 0) return 0
  const mag = Math.pow(10, Math.floor(Math.log(n) / Math.LN10))
  for (const m of [1, 2, 5, 10]) {
    if (m * mag >= n) return m * mag
  }
  return 10 * mag
}

const dateLabel = (day: string): string => day.slice(5)

/** Axis label of a cost value: the currency symbol with up to two decimals. */
function fmtAxisCost(v: number, currency: string): string {
  const sym = currency === 'CNY' ? '\u00a5' : '$'
  if (v >= 1) return `${sym}${v.toFixed(1).replace(/\.0$/, '')}`
  if (v > 0) return `${sym}${v.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}`
  return `${sym}0`
}

interface WeekChartProps {
  week: UsageSnapshot['week']
  currency: string
}

function WeekChart({ week, currency }: WeekChartProps) {
  const [hover, setHover] = useState<number | null>(null)
  const [tipPos, setTipPos] = useState<{ x: number; y: number } | null>(null)
  const chartRef = useRef<HTMLDivElement | null>(null)
  const [plotW, setPlotW] = useState(0)

  useLayoutEffect(() => {
    const el = chartRef.current
    if (el === null) return
    const measure = (): void => { setPlotW(Math.max(0, el.clientWidth - 36)) }
    measure()
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(measure)
      ro.observe(el)
      return () => { ro.disconnect() }
    }
    return undefined
  }, [])

  useLayoutEffect(() => {
    if (hover === null) {
      setTipPos(null)
      return
    }
    const chartEl = chartRef.current
    if (chartEl === null) return
    const place = (): void => {
      const rect = chartEl.getBoundingClientRect()
      const margin = 8
      const vw = window.innerWidth
      const vh = window.innerHeight
      const colW = plotW > 0 ? plotW / 7 : Math.max(1, rect.width - 36) / 7
      const baseX = rect.left + 36 + (hover + 0.5) * colW
      let x = baseX + 12
      if (x + TIP_W + margin > vw) x = baseX - TIP_W - 12
      x = Math.max(margin, Math.min(x, vw - TIP_W - margin))
      const panelEl = chartEl.closest(`.${css.panel}`)
      const anchor = panelEl !== null ? panelEl.getBoundingClientRect() : rect
      let y = anchor.top - TIP_H - margin
      if (y < margin) y = anchor.bottom + margin
      if (y + TIP_H > vh - margin) y = Math.max(margin, vh - margin - TIP_H)
      setTipPos({ x, y })
    }
    place()
    window.addEventListener('resize', place)
    return () => { window.removeEventListener('resize', place) }
  }, [hover, plotW])

  // The official platform's "last 7 days" chart is a cost chart: bars draw
  // the official (or locally estimated) per-tier cost, so every day with
  // cost data renders a bar — token counts are not available from the
  // official API and were the reason only today's bar ever appeared.
  const totals = week.map(d => d.proCost + d.flashCost)
  const max = niceCeil(Math.max(Number.EPSILON, ...totals))
  const mid = max / 2
  const colW = plotW > 0 ? plotW / 7 : 0
  const yLabels = [fmtAxisCost(max, currency), fmtAxisCost(mid, currency), fmtAxisCost(0, currency)]

  const columns = week.map((d, i) => {
    const segs = []
    const visible = COST_SERIES.filter(s => d[s.key] > 0)
    for (const s of COST_SERIES) {
      const v = d[s.key]
      if (v <= 0) continue
      const isTop = visible[visible.length - 1] === s
      segs.push(<div key={s.key} className={css.seg} style={{
        height: `${Math.max(4, Math.round(v / max * 56))}px`,
        background: s.color,
        borderRadius: isTop ? '2px 2px 0 0' : '0',
      }} />)
    }
    return (
      <div key={d.day} className={css.col} onMouseEnter={() => { setHover(i) }}>
        <div className={css.colbars}>{segs}</div>
      </div>
    )
  })

  const hovered = hover !== null ? week[hover] : undefined
  return (
    <div className={css.chart} ref={chartRef} onMouseLeave={() => { setHover(null) }}>
      <div className={css.chartMain}>
        <div className={css.yaxis}>
          {yLabels.map((label, i) => <div key={i} className={css.ytick}>{label}</div>)}
        </div>
        <div className={css.plot}>
          <div className={css.grid} style={{ top: 0 }} />
          <div className={css.grid} style={{ top: '50%' }} />
          <div className={css.grid} style={{ bottom: 0 }} />
          {hover !== null && plotW > 0
            ? <div className={css.hline} style={{ left: `${(hover + 0.5) * colW}px` }} />
            : null}
          <div className={css.bars}>{columns}</div>
        </div>
      </div>
      <div className={css.xwrap}>
        {week.map(d => <div key={d.day} className={css.xtick}>{dateLabel(d.day)}</div>)}
      </div>
      {hovered !== undefined && tipPos !== null && (
        <div className={css.charttip} style={{ left: tipPos.x, top: tipPos.y }}>
          <div className={css.ttGrid}>
            <div className={css.ttCol}>
              <div className={css.ttDate}>{dateLabel(hovered.day)}</div>
              {COST_SERIES.map(s => (
                <div key={s.key} className={css.ttRow}>
                  <span className={css.ttSwatch} style={{ background: s.color }} />
                  {s.label}
                </div>
              ))}
            </div>
            <div className={`${css.ttCol} ${css.ttRight}`}>
              <div className={css.ttDate}>{fmtCost(hovered.cost, currency)}</div>
              {COST_SERIES.map(s => (
                <div key={s.key} className={`${css.ttRow} ${css.ttRight}`}>{fmtCost(hovered[s.key], currency)}</div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Balance chip and hover panel.
 * @param props - the injected snapshot loader.
 */
export function UsageMonitor({ load }: UsageMonitorProps) {
  const [snapshot, setSnapshot] = useState<UsageSnapshot | null>(null)
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState<{ top: number; bottom: number; right: number } | null>(null)
  const [bubbleNode, setBubbleNode] = useState<HTMLDivElement | null>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const anchorRef = useRef<HTMLButtonElement | null>(null)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refresh = useCallback(async () => {
    try {
      const res = await load()
      setSnapshot(res)
      setFailed(false)
    } catch {
      setFailed(true)
    }
  }, [load])

  useEffect(() => {
    void refresh()
    const timer = setInterval(() => { void refresh() }, REFRESH_MS)
    return () => { clearInterval(timer) }
  }, [refresh])

  useLayoutEffect(() => {
    if (!open || anchor === null || bubbleNode === null) return
    const fit = (): void => {
      const r = bubbleNode.getBoundingClientRect()
      const margin = 12
      const vw = window.innerWidth
      const vh = window.innerHeight
      let left = anchor.right - r.width
      if (left < margin) left = margin
      if (left + r.width > vw - margin) left = Math.max(margin, vw - margin - r.width)
      let top = anchor.top - 8 - r.height
      if (top < margin) top = anchor.bottom + 8
      if (top + r.height > vh - margin) top = Math.max(margin, vh - margin - r.height)
      setPos({ left, top })
    }
    fit()
    window.addEventListener('resize', fit)
    return () => { window.removeEventListener('resize', fit) }
  }, [open, anchor, bubbleNode, snapshot])

  const onEnter = (): void => {
    if (hideTimerRef.current !== null) {
      clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
    if (showTimerRef.current !== null) clearTimeout(showTimerRef.current)
    showTimerRef.current = setTimeout(() => {
      showTimerRef.current = null
      const el = anchorRef.current
      if (el !== null) {
        const r = el.getBoundingClientRect()
        setAnchor({ top: r.top, bottom: r.bottom, right: r.right })
      }
      setOpen(true)
      void refresh()
    }, 200)
  }
  const onLeave = (): void => {
    if (showTimerRef.current !== null) {
      clearTimeout(showTimerRef.current)
      showTimerRef.current = null
    }
    if (hideTimerRef.current !== null) clearTimeout(hideTimerRef.current)
    hideTimerRef.current = setTimeout(() => {
      hideTimerRef.current = null
      setOpen(false)
      setPos(null)
    }, 140)
  }

  const balance = snapshot?.balance
  const week = snapshot !== null && snapshot.week.length === 7 ? snapshot.week : null
  const costMeta = snapshot?.costMeta ?? { currency: 'USD', source: 'local' }
  const currency = typeof costMeta.currency === 'string' ? costMeta.currency : 'USD'
  const balData = balance?.ok === true && balance.data !== undefined ? balance.data : null
  const chipValue = balData !== null ? `${fmtMoney(balData.total)} ${balData.currency}` : null
  const today = week !== null ? week[6] : undefined
  const todayTotal = today !== undefined ? today.generated + today.context + today.cached : 0
  const todayCost = today !== undefined ? today.cost : 0

  let balanceBody
  if (failed && snapshot === null) {
    balanceBody = <div className={css.note}>连接失败，正在重试…</div>
  } else if (snapshot === null) {
    balanceBody = <div className={css.cMuted}>加载中…</div>
  } else if (balData !== null) {
    balanceBody = (
      <>
        <div className={css.row}><span className={css.label}>总余额</span><span className={`${css.rowvalue} ${css.cBrand} ${css.total}`}>{fmtMoney(balData.total)}</span></div>
        <div className={css.row}><span className={css.label}>赠送</span><span className={`${css.rowvalue} ${css.cPrimary}`}>{fmtMoney(balData.granted)}</span></div>
        <div className={css.row}><span className={css.label}>充值</span><span className={`${css.rowvalue} ${css.cPrimary}`}>{fmtMoney(balData.toppedUp)}</span></div>
        {!balData.available ? <div className={css.note}>账户当前不可用</div> : null}
      </>
    )
  } else {
    balanceBody = (
      <>
        <div className={css.cMuted}>{balance !== undefined ? reasonText(balance.reason ?? '') : '余额获取失败'}</div>
        {balance?.detail !== undefined && balance.detail !== ''
          ? <div className={css.detail}>{balance.detail.slice(0, 160)}</div>
          : null}
      </>
    )
  }

  return (
    <div className={css.root} onMouseEnter={onEnter} onMouseLeave={onLeave}>
      <button
        type="button"
        ref={anchorRef}
        className={css.chip}
        aria-label="用量监测：DeepSeek 余额与今日 Token 消耗"
      >
        <span className={css.dot} aria-hidden="true" />
        <span className={css.value}>{chipValue !== null ? chipValue : (failed ? '—' : '…')}</span>
      </button>
      {open && (
        <div
          className={css.panel}
          role="tooltip"
          ref={setBubbleNode}
          style={pos !== null ? { left: pos.left, top: pos.top } : { left: -9999, top: -9999 }}
        >
          <div className={css.head}>
            <span className={css.title}>用量监测</span>
            <span className={css.live}>
              <span className={css.liveDot} aria-hidden="true" />
              实时
            </span>
          </div>
          <div className={css.sec}>
            <div className={css.secTitle} style={{ marginBottom: 2 }}>{balData !== null ? `余额 · ${balData.currency}` : '余额'}</div>
            {balanceBody}
          </div>
          <div className={css.sec}>
            <div className={css.secHead}>
              <div className={css.secTitle}>今日 Token</div>
              {week !== null ? <div className={css.secCount}>{fmtInt(todayTotal)}</div> : null}
            </div>
            <div className={css.costRow}>
              <span className={css.secTitle}>今日消费总额</span>
              {week !== null ? <span className={css.costValue}>{fmtCost(todayCost, currency)}</span> : null}
            </div>
            {costMeta.detail !== undefined && costMeta.detail !== ''
              ? <div className={css.detail}>{`官方成本: ${costMeta.detail}`}</div>
              : null}
            {week === null ? <div className={css.cMuted}>加载中…</div> : <WeekChart week={week} currency={currency} />}
          </div>
          <div className={css.foot}>
            <span>{today !== undefined ? `今日调用 ${today.calls} 次` : '—'}</span>
            <span>{`更新 ${fmtTime(snapshot !== null ? snapshot.at : null)}`}</span>
          </div>
        </div>
      )}
    </div>
  )
}
