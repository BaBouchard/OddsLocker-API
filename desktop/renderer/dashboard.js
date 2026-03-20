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
        e.market_type || '',
        e.outcome_name || '',
        e.odds_american != null ? String(e.odds_american) : ''
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
