return {
  apply(ctx) {
    const credentials = ctx.get('credentials')
    const subprocess = ctx.get('subprocess')
    const sandboxPolicy = ctx.get('sandboxPolicy')
    const sessionQuery = ctx.get('sessionQuery')
    const sessions = ctx.get('sessions')

    const state = { week: [] }
    let scanInflight = null
    let balanceCache = null
    let balanceInflight = null
    let officialCache = null
    let officialInflight = null

    const dayKey = (ms) => {
      const d = new Date(ms)
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
    }
    const todayKey = () => dayKey(Date.now())
    const emptyBucket = (day) => ({ day, generated: 0, context: 0, cached: 0, calls: 0, cost: 0, proCost: 0, flashCost: 0 })
    const weekDays = () => {
      const now = new Date()
      const days = []
      for (let i = 6; i >= 0; i--) {
        days.push(dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i).getTime()))
      }
      return days
    }
    const usageOf = (ev) => {
      if (ev === null || ev === undefined || ev.type !== 'assistant/message') return undefined
      const d = ev.data
      if (d === null || d === undefined) return undefined
      return d.usage
    }
    const errText = (err) =>
      err !== null && err !== undefined && typeof err === 'object' && typeof err.message === 'string'
        ? err.message
        : String(err)

    const PRICING = {
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
    const tierOf = (model) => {
      if (typeof model !== 'string') return ''
      if (model.indexOf('pro') !== -1) return 'pro'
      if (model.indexOf('flash') !== -1) return 'flash'
      return ''
    }
    const isPeak = (ms) => {
      const h = new Date(ms).getUTCHours()
      return (h >= 1 && h < 4) || (h >= 6 && h < 10)
    }
    const priceRow = (tier, ms) => {
      if (ms >= PRICING.effective) return isPeak(ms) ? PRICING.peak[tier] : PRICING.offpeak[tier]
      return PRICING.old[tier]
    }
    const costOf = (tier, u, ms) => {
      const p = priceRow(tier, ms)
      const miss = (u.inputTokens || 0) + (u.cacheWriteTokens || 0)
      const hit = u.cacheReadTokens || 0
      const out = u.outputTokens || 0
      return (miss * p.miss + hit * p.hit + out * p.out) / 1000000
    }

    const scanWeek = async () => {
      const days = weekDays()
      const index = new Map()
      days.forEach((d, i) => { index.set(d, i) })
      const week = days.map(emptyBucket)
      const liveIds = new Set()

      const foldSession = (events) => {
        let model = ''
        for (const ev of events) {
          if (ev.type === 'request/header') {
            const h = ev.data && ev.data.header
            if (h && h.config && typeof h.config.model === 'string') model = h.config.model
            continue
          }
          if (ev.type !== 'assistant/message') continue
          const i = index.get(dayKey(ev.time))
          if (i === undefined) continue
          const u = usageOf(ev)
          if (u === undefined || u === null) continue
          const b = week[i]
          b.generated += u.outputTokens || 0
          b.context += (u.inputTokens || 0) + (u.cacheWriteTokens || 0)
          b.cached += u.cacheReadTokens || 0
          b.calls += 1
          const tier = tierOf(model)
          const c = costOf(tier, u, ev.time)
          b.cost += c
          if (tier === 'pro') b.proCost += c
          else if (tier === 'flash') b.flashCost += c
        }
      }

      if (sessions !== undefined) {
        try {
          for (const s of sessions.list()) {
            liveIds.add(s.id)
            const evs = s.events
            if (evs === undefined || evs === null) continue
            foldSession(evs)
          }
        } catch (err) { /* live store unavailable */ }
      }

      if (sessionQuery !== undefined) {
        try {
          const records = await sessionQuery.listSessions()
          for (const rec of records) {
            if (liveIds.has(rec.header.id)) continue
            try {
              const light = await sessionQuery.listEvents(rec.header.id)
              let relevant = false
              for (const ev of light) {
                if (ev.type === 'assistant/message' && index.has(dayKey(ev.time))) { relevant = true; break }
              }
              if (!relevant) continue
            } catch (err) { continue }
            try {
              const snap = await sessionQuery.readSession(rec.header.id)
              foldSession(snap.events)
            } catch (err) { /* unreadable session — skip */ }
          }
        } catch (err) { /* corpus unavailable */ }
      }

      state.week = week
      return week
    }

    const ensureWeek = () => {
      if (state.week.length === 7 && state.week[6].day === todayKey()) return state.week
      if (scanInflight === null) {
        scanInflight = scanWeek().finally(() => { scanInflight = null })
      }
      return scanInflight
    }

    const modelBySession = new Map()
    ctx.on('session/event', (session, event) => {
      if (event.type === 'request/header') {
        const h = event.data && event.data.header
        if (h && h.config && typeof h.config.model === 'string') modelBySession.set(session.id, h.config.model)
        return
      }
      if (event.type !== 'assistant/message') return
      const u = usageOf(event)
      if (u === undefined || u === null) return
      if (state.week.length !== 7) return
      const idx = state.week.findIndex((b) => b.day === dayKey(event.time))
      if (idx === -1) return
      const b = state.week[idx]
      b.generated += u.outputTokens || 0
      b.context += (u.inputTokens || 0) + (u.cacheWriteTokens || 0)
      b.cached += u.cacheReadTokens || 0
      b.calls += 1
      const tier = tierOf(modelBySession.get(session.id) || '')
      const c = costOf(tier, u, event.time)
      b.cost += c
      if (tier === 'pro') b.proCost += c
      else if (tier === 'flash') b.flashCost += c
    })

    const fetchBalance = async () => {
      if (balanceCache !== null && Date.now() - balanceCache.at < 60000) return balanceCache.value
      if (balanceInflight !== null) return balanceInflight
      balanceInflight = (async () => {
        let key
        if (credentials !== undefined) {
          try {
            const hit = await credentials.resolve('DEEPSEEK_API_KEY')
            if (hit !== undefined && hit !== null && typeof hit.value === 'string' && hit.value !== '') key = hit.value
          } catch (err) {
            console.error('usage-monitor: credential resolution failed:', errText(err))
          }
        }
        if (key === undefined) return { ok: false, reason: 'no-key' }
        if (subprocess === undefined) return { ok: false, reason: 'no-subprocess' }
        try {
          const curlPath = await subprocess.resolveExecutable('curl.exe')
          const cwd = sandboxPolicy !== undefined && typeof sandboxPolicy.workspaceRoot === 'string' && sandboxPolicy.workspaceRoot !== ''
            ? sandboxPolicy.workspaceRoot
            : 'C:\\'
          const handle = subprocess.spawn({
            argv: [curlPath, '-s', '-m', '15', '-K', '-'],
            cwd,
            stdio: {
              stdin: { data: 'header = "Authorization: Bearer ' + key + '"\nurl = "https://api.deepseek.com/user/balance"\n' },
              stdout: { maxBytes: 65536 },
              stderr: { maxBytes: 8192 },
            },
            graceMs: 5000,
          })
          const outcome = await handle.done
          const out = handle.collected.stdout !== undefined ? handle.collected.stdout.readFrom(0) : { text: '', lossy: false }
          const errOut = handle.collected.stderr !== undefined ? handle.collected.stderr.readFrom(0) : { text: '', lossy: false }
          if (outcome.exitCode !== 0) {
            const detail = 'curl 退出码 ' + String(outcome.exitCode) + (errOut.text.trim() !== '' ? ' · ' + errOut.text.trim().slice(0, 140) : '')
            console.error('usage-monitor: balance fetch failed:', detail)
            return { ok: false, reason: 'fetch-failed', detail }
          }
          const text = out.text.trim()
          if (text === '') {
            const detail = errOut.text.trim().slice(0, 140)
            return { ok: false, reason: 'empty-response', detail: detail === '' ? undefined : detail }
          }
          const json = JSON.parse(text)
          const infos = Array.isArray(json.balance_infos) ? json.balance_infos : []
          if (infos.length === 0) return { ok: false, reason: 'unexpected-response', detail: text.slice(0, 140) }
          const info = infos[0]
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
          const detail = errText(err).slice(0, 160)
          console.error('usage-monitor: balance fetch error:', detail)
          return { ok: false, reason: 'error', detail }
        }
      })()
      try {
        const value = await balanceInflight
        balanceCache = { value, at: Date.now() }
        return value
      } finally {
        balanceInflight = null
      }
    }

    const fetchOfficialCost = async () => {
      if (officialCache !== null && Date.now() - officialCache.at < 60000) return officialCache.value
      if (officialInflight !== null) return officialInflight
      officialInflight = (async () => {
        let token
        if (credentials !== undefined) {
          try {
            const hit = await credentials.resolve('DEEPSEEK_PLATFORM_TOKEN')
            if (hit !== undefined && hit !== null && typeof hit.value === 'string' && hit.value !== '') token = hit.value
          } catch (err) { /* no token */ }
        }
        if (token === undefined) return { ok: false, reason: 'no-token' }
        if (subprocess === undefined) return { ok: false, reason: 'no-subprocess' }
        try {
          const curlPath = await subprocess.resolveExecutable('curl.exe')
          const cwd = sandboxPolicy !== undefined && typeof sandboxPolicy.workspaceRoot === 'string' && sandboxPolicy.workspaceRoot !== ''
            ? sandboxPolicy.workspaceRoot
            : 'C:\\'
          const now = new Date()
          const rawTz = -now.getTimezoneOffset() * 60
          const tzSec = 3600 * Math.floor(rawTz / 3600)
          const rem = rawTz - tzSec
          const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000
          const startSec = Math.floor(todayStart + rem) - 6 * 86400
          const endSec = Math.floor(todayStart + rem) + 86400
          const url = 'https://platform.deepseek.com/api/v0/usage/by_api_key/cost?start=' + startSec + '&end=' + endSec + '&tz=' + tzSec
          const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
          const cfg = 'user-agent = "' + UA + '"\n'
            + 'header = "Authorization: Bearer ' + token + '"\n'
            + 'header = "Accept: application/json, text/plain, */*"\n'
            + 'header = "Origin: https://platform.deepseek.com"\n'
            + 'header = "Referer: https://platform.deepseek.com/usage"\n'
            + 'url = "' + url + '"\n'
          const handle = subprocess.spawn({
            argv: [curlPath, '-s', '-m', '20', '-K', '-'],
            cwd,
            stdio: { stdin: { data: cfg }, stdout: { maxBytes: 262144 }, stderr: { maxBytes: 8192 } },
            graceMs: 5000,
          })
          const outcome = await handle.done
          const out = handle.collected.stdout !== undefined ? handle.collected.stdout.readFrom(0) : { text: '' }
          const errOut = handle.collected.stderr !== undefined ? handle.collected.stderr.readFrom(0) : { text: '' }
          if (outcome.exitCode !== 0) return { ok: false, reason: 'fetch-failed', detail: errOut.text.trim().slice(0, 120) }
          const text = out.text.trim()
          if (text === '') return { ok: false, reason: 'empty-response', detail: errOut.text.trim().slice(0, 120) }
          const json = JSON.parse(text)
          if (json.code !== undefined && json.code !== 0) return { ok: false, reason: 'api-error', detail: String(json.msg || json.code) }
          const biz = json.data && json.data.biz_data
          if (biz === undefined || biz === null) return { ok: false, reason: 'unexpected-response', detail: text.slice(0, 120) }
          const rows = Array.isArray(biz.data) ? biz.data : []
          const currency = rows.length > 0 && typeof rows[0].currency === 'string' ? rows[0].currency : 'CNY'
          const byDay = new Map()
          const ensure = (day) => {
            let b = byDay.get(day)
            if (b === undefined) { b = { total: 0, pro: 0, flash: 0 }; byDay.set(day, b) }
            return b
          }
          for (const entry of rows) {
            const series = Array.isArray(entry.series) ? entry.series : []
            for (const s of series) {
              const buckets = Array.isArray(s.buckets) ? s.buckets : []
              const tier = tierOf(s.model)
              for (const bk of buckets) {
                const day = dayKey((bk.time || 0) * 1000)
                const c = typeof bk.cost === 'number' ? bk.cost : Number(bk.cost)
                if (!isFinite(c)) continue
                const b = ensure(day)
                b.total += c
                if (tier === 'pro') b.pro += c
                else if (tier === 'flash') b.flash += c
              }
            }
          }
          return { ok: true, currency: currency, byDay: byDay }
        } catch (err) {
          return { ok: false, reason: 'error', detail: errText(err).slice(0, 120) }
        }
      })()
      try {
        const value = await officialInflight
        officialCache = { value, at: Date.now() }
        return value
      } finally {
        officialInflight = null
      }
    }

    harness.handle('usage-snapshot', async () => {
      const week = await ensureWeek()
      const balance = await fetchBalance()
      const official = await fetchOfficialCost()
      const snap = week.map((b) => ({ day: b.day, generated: b.generated, context: b.context, cached: b.cached, calls: b.calls, cost: b.cost, proCost: b.proCost, flashCost: b.flashCost }))
      let costMeta = { currency: 'USD', source: 'local' }
      if (official !== null && official.ok === true && official.byDay !== undefined) {
        for (const b of snap) {
          const o = official.byDay.get(b.day)
          if (o !== undefined) { b.cost = o.total; b.proCost = o.pro; b.flashCost = o.flash }
        }
        costMeta = { currency: official.currency, source: 'official' }
      } else if (official !== null && official.detail !== undefined && official.detail !== '') {
        costMeta = { currency: 'USD', source: 'local', detail: official.detail }
      }
      return { week: snap, balance, costMeta, at: Date.now() }
    })

    ensureWeek()
  },
}