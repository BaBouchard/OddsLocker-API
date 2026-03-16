import { WebSocketServer } from 'ws'

export function createBroadcastServer(port, opts = {}) {
  const wss = new WebSocketServer({ port: Number(port) })
  const clients = new Set()
  const { onMessage, getState } = opts

  wss.on('connection', (ws, req) => {
    clients.add(ws)
    console.log('[LiveOdds] Client connected:', req.socket.remoteAddress, 'total:', clients.size)
    if (typeof getState === 'function') {
      try {
        const state = getState()
        if (state) ws.send(JSON.stringify(state))
      } catch (_) {}
    }
    ws.on('message', (raw) => {
      if (typeof onMessage !== 'function') return
      try {
        const msg = typeof raw === 'string' ? JSON.parse(raw) : JSON.parse(raw.toString())
        onMessage(ws, msg)
      } catch (_) {}
    })
    ws.on('close', () => clients.delete(ws))
    ws.on('error', () => clients.delete(ws))
  })

  const MARKET_ORDER = { moneyline: 0, spread: 1, total: 2 }
  function sortByEventThenMarket(entries) {
    if (!Array.isArray(entries) || entries.length === 0) return entries
    return [...entries].sort((a, b) => {
      const idA = a.event_id != null ? String(a.event_id) : ''
      const idB = b.event_id != null ? String(b.event_id) : ''
      if (idA !== idB) return idA.localeCompare(idB, 'en', { numeric: true })
      const orderA = MARKET_ORDER[a.market_type] ?? 99
      const orderB = MARKET_ORDER[b.market_type] ?? 99
      return orderA - orderB
    })
  }

  function broadcast(entries, meta = {}) {
    if (clients.size === 0) return
    const sorted = sortByEventThenMarket(entries)
    const payloadObj = {
      type: 'odds',
      data: sorted,
      ts: Date.now()
    }
    if (meta && typeof meta === 'object') {
      if ('pollRequests' in meta) payloadObj.pollRequests = meta.pollRequests
    }
    const payload = JSON.stringify(payloadObj)
    for (const client of clients) {
      if (client.readyState === 1) client.send(payload)
    }
  }

  function broadcastControl(obj) {
    if (clients.size === 0) return
    const payload = JSON.stringify(obj)
    for (const client of clients) {
      if (client.readyState === 1) client.send(payload)
    }
  }

  return {
    broadcast,
    broadcastControl,
    get clientCount() { return clients.size },
    close() { wss.close() }
  }
}
