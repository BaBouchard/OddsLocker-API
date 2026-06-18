/* global olScraper */

;(async function init() {
  const statusEl = document.getElementById('status')
  const countEl = document.getElementById('count')
  const lastEl = document.getElementById('last')
  const pollRequestsEl = document.getElementById('pollRequests')
  const outputEl = document.getElementById('output')
  const autoPollEl = document.getElementById('autoPoll')
  const fetchOnceBtn = document.getElementById('fetchOnce')
  const bookCheckboxesWrap = document.getElementById('bookCheckboxesWrap')
  const oddsTableBody = document.querySelector('#oddsTable tbody')
  const wsLabel = document.getElementById('wsLabel')
  const bannerDisengaged = document.getElementById('bannerDisengaged')
  const bannerReconnect = document.getElementById('bannerReconnect')
  const openTerminal = document.getElementById('openTerminal')
  const appVersionEl = document.getElementById('appVersion')

  let ws = null
  let msgCount = 0
  let reconnectTimer = null
  let wantAutoConnect = true
  let wsUrl = 'ws://127.0.0.1:8765'

  if (!window.olScraper) {
    outputEl.textContent = 'Preload missing — olScraper API unavailable.'
    return
  }

  function setStatus(className, text) {
    statusEl.className = 'status ' + className
    statusEl.textContent = text
  }

  function send(msg) {
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
  }

  function formatSharePriceCents(sharePrice) {
    if (sharePrice == null || Number.isNaN(Number(sharePrice))) return null
    const p = Number(sharePrice)
    if (p <= 0 || p >= 1) return null
    const cents = p * 100
    if (cents >= 10) return Math.round(cents) + '¢'
    if (cents >= 1) return parseFloat(cents.toFixed(1)) + '¢'
    return parseFloat(cents.toFixed(2)) + '¢'
  }

  function formatAmericanOdds(american) {
    if (american == null || Number.isNaN(Number(american))) return ''
    const n = Number(american)
    return n > 0 ? '+' + n : String(n)
  }

  function formatCompactUsd(usd) {
    if (usd == null || Number.isNaN(Number(usd))) return null
    const n = Number(usd)
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1000) return `$${Math.round(n / 1000)}k`
    return `$${Math.round(n)}`
  }

  function formatOddsDisplay(entry) {
    const cents = formatSharePriceCents(entry?.share_price)
    const am = formatAmericanOdds(entry?.odds_american)
    let base = ''
    if (cents && am) base = `${cents} · ${am}`
    else if (cents) base = cents
    else base = am
    const askSize = entry?.ask_size
    if (askSize != null && !Number.isNaN(Number(askSize))) {
      const sh = Number(askSize)
      const usd = formatCompactUsd(entry?.max_stake_usd)
      if (sh > 0) {
        const shLabel = sh >= 1000 ? `${(sh / 1000).toFixed(1)}k sh` : `${Math.round(sh)} sh`
        base = base ? `${base} · ${shLabel}${usd ? ` (${usd})` : ''}` : `${shLabel}${usd ? ` (${usd})` : ''}`
      }
    }
    return base
  }

  function formatLineValue(line) {
    if (line == null || Number.isNaN(Number(line))) return null
    const n = Number(line)
    return n > 0 ? '+' + n : String(n)
  }

  function formatMarketTypeDisplay(entry) {
    const mt = entry?.market_type || ''
    if (mt === 'total' && entry?.line_value != null && !Number.isNaN(Number(entry.line_value))) {
      return `${mt} ${entry.line_value}`
    }
    const line = formatLineValue(entry?.line_value)
    if (mt === 'spread' && line) return `${mt} ${line}`
    return mt
  }

  function formatOutcomeDisplay(entry) {
    const name = entry?.outcome_name || ''
    const mt = entry?.market_type || ''
    if (mt === 'total' && entry?.line_value != null && !Number.isNaN(Number(entry.line_value))) {
      return `${name} ${entry.line_value}`.trim()
    }
    const line = formatLineValue(entry?.line_value)
    if (mt === 'spread' && line) return `${name} ${line}`.trim()
    return name
  }

  function renderOddsTable(entries) {
    oddsTableBody.innerHTML = ''
    if (!Array.isArray(entries) || entries.length === 0) return
    const maxRows = 80
    for (let i = 0; i < entries.length && i < maxRows; i++) {
      const e = entries[i]
      const tr = document.createElement('tr')
      const eventLabel =
        e.away_team && e.home_team ? `${e.away_team} @ ${e.home_team}` : e.event_id
      const cells = [
        e.sport || '',
        e.league || '',
        eventLabel || '',
        e.sportsbook || '',
        formatMarketTypeDisplay(e),
        formatOutcomeDisplay(e),
        formatOddsDisplay(e)
      ]
      cells.forEach((val, idx) => {
        const td = document.createElement('td')
        td.textContent = val
        if (idx === 6) td.className = 'num'
        tr.appendChild(td)
      })
      oddsTableBody.appendChild(tr)
    }
  }

  function clearReconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    bannerReconnect.style.display = 'none'
  }

  function scheduleReconnect(reason) {
    if (!wantAutoConnect) return
    clearReconnect()
    const delay = 3000
    bannerReconnect.textContent = `${reason} Retrying in ${delay / 1000}s…`
    bannerReconnect.style.display = 'block'
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      connect()
    }, delay)
  }

  function disconnect() {
    wantAutoConnect = false
    clearReconnect()
    if (ws) {
      ws.close()
      ws = null
    }
    setStatus('disconnected', 'Disconnected')
  }

  function connect() {
    wantAutoConnect = true
    if (ws?.readyState === WebSocket.OPEN) return
    setStatus('connecting', 'Connecting…')
    ws = new WebSocket(wsUrl)
    ws.onopen = () => {
      clearReconnect()
      setStatus('connected', 'Connected — ' + wsUrl)
    }
    ws.onclose = () => {
      ws = null
      setStatus('disconnected', 'Disconnected')
      if (wantAutoConnect) scheduleReconnect('WebSocket closed.')
    }
    ws.onerror = () => {
      setStatus('disconnected', 'Connection error')
    }
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'state') {
          if (msg.autoPoll !== undefined) autoPollEl.checked = !!msg.autoPoll
          if (Array.isArray(msg.books) && msg.books.length > 0) {
            bookCheckboxesWrap.innerHTML = 'Sportsbooks: '
            msg.books.forEach((b) => {
              const label = document.createElement('label')
              label.style.marginRight = '1rem'
              const cb = document.createElement('input')
              cb.type = 'checkbox'
              cb.checked = true
              cb.dataset.bookId = b.id
              label.appendChild(cb)
              label.appendChild(document.createTextNode(' ' + (b.name || b.id)))
              bookCheckboxesWrap.appendChild(label)
            })
          }
          return
        }
        if (msg.type === 'autoPoll') {
          autoPollEl.checked = !!msg.value
          return
        }
        if (msg.type === 'odds') {
          msgCount++
          countEl.textContent = msgCount
          lastEl.textContent = new Date().toLocaleTimeString()
          if (typeof msg.pollRequests === 'number') pollRequestsEl.textContent = String(msg.pollRequests)
          const summary = msg.data.length + ' odds entries at ' + new Date(msg.ts).toLocaleTimeString()
          outputEl.textContent = summary + '\n\n' + JSON.stringify(msg, null, 2)
          renderOddsTable(msg.data)
          return
        }
        outputEl.textContent = JSON.stringify(msg, null, 2)
      } catch (_) {
        outputEl.textContent = e.data
      }
    }
  }

  autoPollEl.addEventListener('change', () => {
    send({ type: 'setAutoPoll', value: autoPollEl.checked })
  })

  fetchOnceBtn.onclick = () => {
    const bookIds = Array.from(
      document.querySelectorAll('#bookCheckboxesWrap input[type=checkbox]:checked')
    )
      .map((el) => el.dataset.bookId)
      .filter(Boolean)
    send(bookIds.length ? { type: 'fetchOnce', bookIds } : { type: 'fetchOnce' })
  }

  document.getElementById('connect').onclick = () => connect()
  document.getElementById('disconnect').onclick = () => disconnect()

  openTerminal.addEventListener('click', () => {
    window.olScraper.openHostedTerminal().then((r) => {
      if (!r?.ok && r?.error) outputEl.textContent = r.error
    })
  })

  try {
    const info = await window.olScraper.getDashboardInfo()
    wsUrl = 'ws://127.0.0.1:' + (info.wsPort || 8765)
    wsLabel.textContent = wsUrl
    if (info.appVersion) appVersionEl.textContent = 'App v' + info.appVersion
    bannerDisengaged.style.display = info.pushingEnabled === false ? 'block' : 'none'
    outputEl.textContent =
      'Connect to receive odds. SOURCE_ID: ' + (info.sourceId || '(none)') + '\nTerminal: ' + (info.terminalUrl || '(none)')
    if (info.pushingEnabled !== false) {
      connect()
    } else {
      setStatus('disconnected', 'Scraper not running (disengaged)')
    }
  } catch (err) {
    outputEl.textContent = 'Could not read dashboard config: ' + String(err)
  }
})()
