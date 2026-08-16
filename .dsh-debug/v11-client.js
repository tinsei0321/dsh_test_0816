const CSS = `
.um-root { display: contents; }
.um-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 8px;
  border: none;
  border-radius: 24px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font-family: inherit;
  font-size: 13px;
  line-height: 20px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  cursor: default;
  transition: background-color 120ms ease;
}
.um-chip:hover { background: var(--dsw-alias-interactive-bg-hover); }
.um-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--dsw-alias-state-success-primary);
  animation: um-breathe 2.4s ease-in-out infinite;
}
@keyframes um-breathe {
  0%, 100% { opacity: 1; }
  50% { opacity: .45; }
}
@keyframes um-in {
  from { opacity: 0; }
}
.um-value { font-weight: 600; }
.um-panel {
  position: fixed;
  z-index: 100;
  width: 240px;
  box-sizing: border-box;
  padding: 12px;
  border: 1px solid var(--dsw-alias-border-inverted);
  border-radius: 12px;
  background: var(--dsw-specific-menu);
  box-shadow: var(--dsw-shadow-lv3);
  color: var(--dsw-alias-label-primary);
  font-family: inherit;
  font-size: 12px;
  line-height: 20px;
  animation: um-in 150ms var(--ds-ease-in-out, ease-in-out);
}
@media (prefers-reduced-motion: reduce) {
  .um-panel { animation: none; }
  .um-charttip { transition: none; }
}
.um-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2px; }
.um-title { font-weight: 600; }
.um-live {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  color: var(--dsw-alias-label-secondary);
}
.um-live-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--dsw-alias-state-success-primary);
  animation: um-breathe 2.4s ease-in-out infinite;
}
.um-sec {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--dsw-alias-border-inverted);
}
.um-sec-head { display: flex; align-items: baseline; justify-content: space-between; }
.um-sec-title {
  font-size: 10px;
  letter-spacing: .5px;
  color: var(--dsw-alias-label-secondary);
}
.um-sec-count {
  font-size: 13px;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-primary);
}
.um-cost-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin: 2px 0 6px;
}
.um-cost-value {
  font-size: 13px;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-primary);
}
.um-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 2px 0;
}
.um-label { color: var(--dsw-alias-label-secondary); }
.um-rowvalue { font-variant-numeric: tabular-nums; }
.um-total { font-size: 13px; font-weight: 650; }
.um-c-brand { color: var(--dsw-alias-brand-primary); }
.um-c-primary { color: var(--dsw-alias-label-primary); }
.um-c-muted { color: var(--dsw-alias-label-secondary); }
.um-note { margin-top: 2px; font-size: 11px; color: var(--dsw-alias-state-warn-primary); }
.um-detail {
  margin-top: 4px;
  font-size: 10px;
  line-height: 1.4;
  color: var(--dsw-alias-label-secondary);
  word-break: break-all;
}
.um-chart {
  --um-axis-label: light-dark(rgba(2, 14, 54, 0.6), rgb(150, 150, 150));
  --um-axis-line: light-dark(#D2D8E5, rgba(255, 255, 255, 0.12));
}
.um-chart-main { display: flex; gap: 6px; }
.um-yaxis {
  width: 30px;
  height: 56px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: flex-end;
  flex-shrink: 0;
}
.um-ytick {
  font-size: 10px;
  line-height: 1;
  color: var(--um-axis-label);
  font-variant-numeric: tabular-nums;
}
.um-plot {
  position: relative;
  flex: 1;
  height: 56px;
}
.um-grid {
  position: absolute;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--um-axis-line);
}
.um-hline {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--um-axis-line);
}
.um-bars {
  position: absolute;
  inset: 0;
  display: flex;
}
.um-col {
  flex: 1;
  display: flex;
  padding: 0 4px;
}
.um-colbars {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  width: 100%;
}
.um-seg { width: 100%; }
.um-xwrap {
  display: flex;
  margin-left: 36px;
  margin-top: 4px;
}
.um-xtick {
  flex: 1;
  text-align: center;
  font-size: 10px;
  line-height: 1;
  color: var(--um-axis-label);
  font-variant-numeric: tabular-nums;
}
.um-charttip {
  position: fixed;
  z-index: 110;
  min-width: 168px;
  padding: 8px 16px;
  border: 1px solid var(--dsw-alias-border-inverted);
  border-radius: 24px;
  background: var(--dsw-alias-bg-layer-1);
  box-shadow: var(--dsw-shadow-lv3);
  pointer-events: none;
  font-size: 11px;
  transition: left 240ms var(--ds-ease-in-out, ease), top 240ms var(--ds-ease-in-out, ease);
}
.um-tt-grid { display: flex; gap: 2px; }
.um-tt-col { display: flex; flex-direction: column; gap: 2px; margin-right: 14px; }
.um-tt-date {
  color: var(--dsw-alias-label-primary);
  font-weight: 600;
  font-size: 12px;
  margin-bottom: 2px;
}
.um-tt-row {
  display: flex;
  align-items: center;
  color: var(--dsw-alias-label-secondary);
  font-variant-numeric: tabular-nums;
}
.um-tt-right { margin-right: 0; text-align: right; justify-content: flex-end; }
.um-tt-swatch {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  margin-right: 8px;
  flex-shrink: 0;
}
.um-foot {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-top: 8px;
  padding-top: 6px;
  border-top: 1px solid var(--dsw-alias-border-inverted);
  font-size: 10px;
  color: var(--dsw-alias-label-secondary);
}
`

return {
  inject: ['timer'],
  apply(ctx) {
    const slots = ctx.get('slots')
    if (slots === undefined) return

    styles.insert(CSS)

    const fmtTokens = (n) => {
      if (n >= 1000000) return String(Math.round(n / 100000) / 10) + 'M'
      if (n >= 1000) return String(Math.round(n / 100) / 10) + 'K'
      return String(n)
    }
    const fmtInt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    const fmtMoney = (v) => {
      const n = Number(v)
      if (!isFinite(n)) return String(v)
      return n.toFixed(2)
    }
    const fmtCost = (v, currency) => {
      const sym = currency === 'CNY' ? '\u00a5' : '$'
      if (!(v > 0)) return sym + '0.00'
      return sym + (v >= 0.01 ? v.toFixed(2) : v.toFixed(4))
    }
    const pad2 = (x) => String(x).padStart(2, '0')
    const fmtTime = (ms) => {
      if (ms === null || ms === undefined) return '--:--:--'
      const d = new Date(ms)
      return pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds())
    }
    const reasonText = (reason) => {
      if (reason === 'no-key') return '未配置 API Key'
      if (reason === 'no-subprocess') return '执行环境不可用'
      if (reason === 'fetch-failed') return '网络请求失败'
      if (reason === 'empty-response') return '接口无响应'
      if (reason === 'unexpected-response') return '接口响应异常'
      return '余额获取失败'
    }
    const Row = (label, value, colorClass) => React.createElement('div', { className: 'um-row' },
      React.createElement('span', { className: 'um-label' }, label),
      React.createElement('span', { className: 'um-rowvalue ' + colorClass }, value),
    )

    const SERIES = [
      { key: 'generated', label: '生成', color: '#0C70F3' },
      { key: 'context', label: '上下文', color: '#60B3FE' },
      { key: 'cached', label: '缓存', color: '#A0DCFD' },
    ]
    const COST_SERIES = [
      { key: 'proCost', label: 'Pro', color: '#0C70F3' },
      { key: 'flashCost', label: 'Flash', color: '#60B3FE' },
    ]
    const dateLabel = (day) => day.slice(5)
    const fmtAxis = (v) => (v >= 1000 ? fmtTokens(v) : String(Math.round(v)))
    const TIP_W = 208
    const TIP_H = 100

    function niceCeil(n) {
      if (n <= 0) return 0
      const mag = Math.pow(10, Math.floor(Math.log(n) / Math.LN10))
      const steps = [1, 2, 5, 10]
      for (const m of steps) {
        if (m * mag >= n) return m * mag
      }
      return 10 * mag
    }

    function WeekChart(props) {
      const week = props.week
      const currency = props.currency
      const [hover, setHover] = React.useState(null)
      const [tipPos, setTipPos] = React.useState(null)
      const chartRef = React.useRef(null)
      const [plotW, setPlotW] = React.useState(0)

      React.useLayoutEffect(() => {
        const el = chartRef.current
        if (el === null) return
        const measure = () => { setPlotW(Math.max(0, el.clientWidth - 36)) }
        measure()
        if (typeof ResizeObserver !== 'undefined') {
          const ro = new ResizeObserver(measure)
          ro.observe(el)
          return () => { ro.disconnect() }
        }
        return undefined
      }, [])

      React.useLayoutEffect(() => {
        if (hover === null) { setTipPos(null); return }
        const chartEl = chartRef.current
        if (chartEl === null) return
        const place = () => {
          const rect = chartEl.getBoundingClientRect()
          const margin = 8
          const vw = window.innerWidth
          const vh = window.innerHeight
          const colW = plotW > 0 ? plotW / 7 : Math.max(1, rect.width - 36) / 7
          const baseX = rect.left + 36 + (hover + 0.5) * colW
          let x = baseX + 12
          if (x + TIP_W + margin > vw) x = baseX - TIP_W - 12
          x = Math.max(margin, Math.min(x, vw - TIP_W - margin))
          const panelEl = chartEl.closest('.um-panel')
          const anchor = panelEl !== null ? panelEl.getBoundingClientRect() : rect
          let y = anchor.top - TIP_H - margin
          if (y < margin) y = anchor.bottom + margin
          if (y + TIP_H > vh - margin) y = Math.max(margin, vh - margin - TIP_H)
          setTipPos({ x: x, y: y })
        }
        place()
        window.addEventListener('resize', place)
        return () => { window.removeEventListener('resize', place) }
      }, [hover, plotW])

      const totals = week.map((d) => d.generated + d.context + d.cached)
      const max = niceCeil(Math.max(1, ...totals))
      const mid = max / 2
      const colW = plotW > 0 ? plotW / 7 : 0
      const yLabels = [fmtAxis(max), fmtAxis(mid), '0']

      const columns = week.map((d, i) => {
        const segs = []
        const visible = SERIES.filter((s) => d[s.key] > 0)
        for (const s of SERIES) {
          const v = d[s.key]
          if (v <= 0) continue
          const isTop = visible[visible.length - 1] === s
          segs.push(React.createElement('div', {
            key: s.key,
            className: 'um-seg',
            style: {
              height: Math.max(4, Math.round(v / max * 56)) + 'px',
              background: s.color,
              borderRadius: isTop ? '2px 2px 0 0' : '0',
            },
          }))
        }
        return React.createElement('div', {
          key: d.day,
          className: 'um-col',
          onMouseEnter: () => { setHover(i) },
        },
          React.createElement('div', { className: 'um-colbars' }, segs),
        )
      })

      const tip = hover !== null && tipPos !== null ? (
        React.createElement('div', {
          className: 'um-charttip',
          style: { left: tipPos.x + 'px', top: tipPos.y + 'px' },
        },
          React.createElement('div', { className: 'um-tt-grid' },
            React.createElement('div', { className: 'um-tt-col' },
              React.createElement('div', { className: 'um-tt-date' }, dateLabel(week[hover].day)),
              COST_SERIES.map((s) => React.createElement('div', { key: s.key, className: 'um-tt-row' },
                React.createElement('span', { className: 'um-tt-swatch', style: { background: s.color } }),
                s.label,
              )),
            ),
            React.createElement('div', { className: 'um-tt-col um-tt-right' },
              React.createElement('div', { className: 'um-tt-date' }, fmtCost(week[hover].cost, currency)),
              COST_SERIES.map((s) => React.createElement('div', { key: s.key, className: 'um-tt-row um-tt-right' },
                fmtCost(week[hover][s.key], currency),
              )),
            ),
          ),
        )
      ) : null

      return React.createElement('div', {
        className: 'um-chart',
        ref: chartRef,
        onMouseLeave: () => { setHover(null) },
      },
        React.createElement('div', { className: 'um-chart-main' },
          React.createElement('div', { className: 'um-yaxis' },
            yLabels.map((label, i) => React.createElement('div', { key: i, className: 'um-ytick' }, label)),
          ),
          React.createElement('div', { className: 'um-plot' },
            React.createElement('div', { className: 'um-grid', style: { top: 0 } }),
            React.createElement('div', { className: 'um-grid', style: { top: '50%' } }),
            React.createElement('div', { className: 'um-grid', style: { bottom: 0 } }),
            hover !== null && plotW > 0 ? React.createElement('div', {
              className: 'um-hline',
              style: { left: ((hover + 0.5) * colW) + 'px' },
            }) : null,
            React.createElement('div', { className: 'um-bars' }, columns),
          ),
        ),
        React.createElement('div', { className: 'um-xwrap' },
          week.map((d) => React.createElement('div', { key: d.day, className: 'um-xtick' }, dateLabel(d.day))),
        ),
        tip,
      )
    }

    function UsageMonitor() {
      const [snapshot, setSnapshot] = React.useState(null)
      const [failed, setFailed] = React.useState(false)
      const [open, setOpen] = React.useState(false)
      const [anchor, setAnchor] = React.useState(null)
      const [bubbleNode, setBubbleNode] = React.useState(null)
      const [pos, setPos] = React.useState(null)
      const anchorRef = React.useRef(null)
      const hideTimerRef = React.useRef(null)
      const showTimerRef = React.useRef(null)

      const load = React.useCallback(async () => {
        try {
          const res = await host.call('usage-snapshot')
          setSnapshot(res)
          setFailed(false)
        } catch (err) {
          setFailed(true)
        }
      }, [])

      React.useEffect(() => {
        load()
        const stop = ctx.interval(load, 10000)
        return () => { stop() }
      }, [load])

      React.useLayoutEffect(() => {
        if (!open || anchor === null || bubbleNode === null) return
        const fit = () => {
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
          setPos({ left: left, top: top })
        }
        fit()
        window.addEventListener('resize', fit)
        return () => { window.removeEventListener('resize', fit) }
      }, [open, anchor, bubbleNode, snapshot])

      const onEnter = () => {
        if (hideTimerRef.current !== null) { hideTimerRef.current(); hideTimerRef.current = null }
        if (showTimerRef.current !== null) showTimerRef.current()
        showTimerRef.current = ctx.timeout(() => {
          showTimerRef.current = null
          const el = anchorRef.current
          if (el !== null) {
            const r = el.getBoundingClientRect()
            setAnchor({ top: r.top, bottom: r.bottom, right: r.right })
          }
          setOpen(true)
          load()
        }, 200)
      }
      const onLeave = () => {
        if (showTimerRef.current !== null) { showTimerRef.current(); showTimerRef.current = null }
        if (hideTimerRef.current !== null) hideTimerRef.current()
        hideTimerRef.current = ctx.timeout(() => {
          hideTimerRef.current = null
          setOpen(false)
          setPos(null)
        }, 140)
      }

      const balance = snapshot !== null && snapshot.balance !== undefined && snapshot.balance !== null ? snapshot.balance : null
      const week = snapshot !== null && Array.isArray(snapshot.week) && snapshot.week.length === 7 ? snapshot.week : null
      const costMeta = snapshot !== null && snapshot.costMeta !== undefined && snapshot.costMeta !== null ? snapshot.costMeta : { currency: 'USD', source: 'local' }
      const currency = typeof costMeta.currency === 'string' ? costMeta.currency : 'USD'
      const balData = balance !== null && balance.ok === true && balance.data !== undefined && balance.data !== null ? balance.data : null
      const chipValue = balData !== null ? fmtMoney(balData.total) + ' ' + balData.currency : null
      const todayTotal = week !== null
        ? week[6].generated + week[6].context + week[6].cached
        : 0
      const todayCost = week !== null ? week[6].cost : 0

      const head = React.createElement('div', { className: 'um-head' },
        React.createElement('span', { className: 'um-title' }, '用量监测'),
        React.createElement('span', { className: 'um-live' },
          React.createElement('span', { className: 'um-live-dot', 'aria-hidden': 'true' }),
          '实时',
        ),
      )

      let balanceBody
      if (failed && snapshot === null) {
        balanceBody = React.createElement('div', { className: 'um-note' }, '连接失败，正在重试…')
      } else if (snapshot === null) {
        balanceBody = React.createElement('div', { className: 'um-c-muted' }, '加载中…')
      } else if (balData !== null) {
        balanceBody = React.createElement(React.Fragment, null,
          Row('总余额', fmtMoney(balData.total), 'um-c-brand um-total'),
          Row('赠送', fmtMoney(balData.granted), 'um-c-primary'),
          Row('充值', fmtMoney(balData.toppedUp), 'um-c-primary'),
          balData.available === false ? React.createElement('div', { className: 'um-note' }, '账户当前不可用') : null,
        )
      } else {
        balanceBody = React.createElement(React.Fragment, null,
          React.createElement('div', { className: 'um-c-muted' }, reasonText(balance.reason)),
          balance.detail !== undefined && balance.detail !== null && balance.detail !== ''
            ? React.createElement('div', { className: 'um-detail' }, String(balance.detail).slice(0, 160))
            : null,
        )
      }

      const balanceSection = React.createElement('div', { className: 'um-sec' },
        React.createElement('div', { className: 'um-sec-title', style: { marginBottom: 2 } }, balData !== null ? '余额 · ' + balData.currency : '余额'),
        balanceBody,
      )

      const tokenBody = week === null
        ? React.createElement('div', { className: 'um-c-muted' }, '加载中…')
        : React.createElement(WeekChart, { week: week, currency: currency })

      const tokenSection = React.createElement('div', { className: 'um-sec' },
        React.createElement('div', { className: 'um-sec-head' },
          React.createElement('div', { className: 'um-sec-title' }, '今日 Token'),
          week !== null ? React.createElement('div', { className: 'um-sec-count' }, fmtInt(todayTotal)) : null,
        ),
        React.createElement('div', { className: 'um-cost-row' },
          React.createElement('span', { className: 'um-sec-title' }, '今日消费总额'),
          week !== null ? React.createElement('span', { className: 'um-cost-value' }, fmtCost(todayCost, currency)) : null,
        ),
        costMeta.detail !== undefined && costMeta.detail !== null && costMeta.detail !== ''
          ? React.createElement('div', { className: 'um-detail' }, '官方成本: ' + String(costMeta.detail))
          : null,
        tokenBody,
      )

      const foot = React.createElement('div', { className: 'um-foot' },
        React.createElement('span', null, week !== null ? '今日调用 ' + week[6].calls + ' 次' : '—'),
        React.createElement('span', null, '更新 ' + fmtTime(snapshot !== null ? snapshot.at : null)),
      )

      return React.createElement('div', {
        className: 'um-root',
        onMouseEnter: onEnter,
        onMouseLeave: onLeave,
      },
        React.createElement('button', {
          type: 'button',
          ref: anchorRef,
          className: 'um-chip',
          'aria-label': '用量监测：DeepSeek 余额与今日 Token 消耗',
        },
          React.createElement('span', { className: 'um-dot', 'aria-hidden': 'true' }),
          React.createElement('span', { className: 'um-value' }, chipValue !== null ? chipValue : (failed ? '—' : '…')),
        ),
        open === true && React.createElement('div', {
          className: 'um-panel',
          role: 'tooltip',
          ref: setBubbleNode,
          style: pos !== null
            ? { left: pos.left + 'px', top: pos.top + 'px' }
            : { left: '-9999px', top: '-9999px' },
        },
          head,
          balanceSection,
          tokenSection,
          foot,
        ),
      )
    }

    slots.inject('conversation.input.right', () => slots.register(
      { name: 'conversation.input.right', id: 'usage-monitor', order: 0, label: '用量监测' },
      () => React.createElement(UsageMonitor),
    ))
  },
}