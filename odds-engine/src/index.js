import express from 'express'
import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'node:http'
import { WebSocketServer } from 'ws'
import { loadState, getPublicState, getFullSnapshot, onStateChange } from './state/store.js'
import { setChannelCount, updateChannel } from './state/channels.js'
import { setBatches, replaceBatchesFromCount } from './state/batches.js'
import { addProxiesFromText, removeProxy, resetBadProxies, clearAllProxies } from './state/proxies.js'
import { startScheduler, stopScheduler, runPollSession, updateFleet, setSessionCompleteHandler } from './scheduler/engine.js'
import { listKnownBookIds } from './workers/books.js'
import { renderPage, renderLoginHtml } from './dashboard/pages.js'
import { analyzeSnapshot } from './analyze-batch.js'
import { snapshotToXlsx } from './export-xlsx.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const engineRoot = path.join(__dirname, '..')
const userData = process.env.OL_ENGINE_USER_DATA
  ? path.resolve(process.env.OL_ENGINE_USER_DATA)
  : ''

// Prefer userData .env (desktop), then odds-engine/.env, then repo root .env for book URLs
if (userData) {
  dotenv.config({ path: path.join(userData, '.env'), override: true })
}
dotenv.config({ path: path.join(engineRoot, '.env') })
dotenv.config({ path: path.join(engineRoot, '../.env') })

const PORT = Number(process.env.PORT) || 3100
const LOGIN_PASSWORD = String(process.env.ENGINE_LOGIN_PASSWORD || '').trim()

loadState()

const app = express()
app.use(express.json({ limit: '4mb' }))
app.use(express.urlencoded({ extended: false }))
app.use('/assets', express.static(path.join(engineRoot, 'public')))

function parseCookie(header) {
  const out = {}
  String(header || '')
    .split(';')
    .forEach((part) => {
      const [k, ...rest] = part.trim().split('=')
      if (k) out[k] = rest.join('=')
    })
  return out
}

function isAuthed(req) {
  if (!LOGIN_PASSWORD) return true
  return parseCookie(req.headers.cookie).ol_engine === '1'
}

function requireAuth(req, res, next) {
  if (!isAuthed(req)) return res.status(401).json({ error: 'Unauthorized' })
  next()
}

function sendPage(req, res, pageId) {
  if (LOGIN_PASSWORD && !isAuthed(req)) {
    return res.type('html').send(renderLoginHtml())
  }
  res.type('html').send(renderPage(pageId))
}

app.get('/', (req, res) => sendPage(req, res, 'session'))
app.get('/batches', (req, res) => sendPage(req, res, 'batches'))
app.get('/proxies', (req, res) => sendPage(req, res, 'proxies'))
app.get('/live', (req, res) => sendPage(req, res, 'live'))
app.get('/league-watcher', (req, res) => sendPage(req, res, 'leagues'))
app.get('/json', (req, res) => sendPage(req, res, 'json'))
app.get('/settings', (req, res) => sendPage(req, res, 'settings'))

app.post('/login', (req, res) => {
  if (!LOGIN_PASSWORD) return res.redirect('/')
  if (String(req.body?.password || '') !== LOGIN_PASSWORD) return res.redirect('/')
  res.setHeader('Set-Cookie', 'ol_engine=1; Path=/; HttpOnly; SameSite=Lax')
  res.redirect('/')
})

app.get('/api/state', requireAuth, (_req, res) => {
  res.json({
    ...getPublicState(),
    configuredBooks: listKnownBookIds()
  })
})

app.put('/api/fleet', requireAuth, (req, res) => {
  updateFleet(req.body || {})
  res.json(getPublicState())
})

app.put('/api/channels/count', requireAuth, (req, res) => {
  setChannelCount(req.body?.count)
  res.json(getPublicState())
})

app.put('/api/channels/:id', requireAuth, (req, res) => {
  updateChannel(req.params.id, req.body || {})
  res.json(getPublicState())
})

app.put('/api/batches', requireAuth, (req, res) => {
  try {
    if (req.body?.count != null && !req.body?.batches) {
      replaceBatchesFromCount(req.body.count, req.body.bookAssignment)
    } else {
      setBatches(req.body?.batches || [])
    }
    res.json(getPublicState())
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

app.post('/api/proxies', requireAuth, (req, res) => {
  const result = addProxiesFromText(req.body?.text || req.body?.proxies || '')
  const added = typeof result === 'number' ? result : result.added
  const rejected = typeof result === 'number' ? [] : result.rejected
  const skipped = typeof result === 'number' ? 0 : result.skipped
  res.json({ ...getPublicState(), added, rejected, skipped })
})

app.delete('/api/proxies/:id', requireAuth, (req, res) => {
  removeProxy(req.params.id)
  res.json(getPublicState())
})

app.post('/api/proxies/reset-bad', requireAuth, (req, res) => {
  resetBadProxies()
  res.json(getPublicState())
})

app.post('/api/proxies/clear', requireAuth, (req, res) => {
  clearAllProxies()
  res.json(getPublicState())
})

app.post('/api/session/run', requireAuth, async (_req, res) => {
  const result = await runPollSession()
  if (result?.snapshot && Array.isArray(result.snapshot.data)) {
    const { data, ...snapshot } = result.snapshot
    snapshot.entryCount = data.length
    result.snapshot = snapshot
  }
  res.json({ ...result, state: getPublicState() })
})

app.post('/api/session/analyze', requireAuth, (_req, res) => {
  const snap = getFullSnapshot()
  const reports = Array.isArray(snap?.bookReports) ? snap.bookReports : []
  const rows = Array.isArray(snap?.data) ? snap.data : null
  if (!snap || !rows || (rows.length === 0 && reports.length === 0)) {
    return res.json({ ok: false, reason: 'no_snapshot' })
  }
  res.json(analyzeSnapshot(snap))
})

app.get('/api/snapshot', requireAuth, (_req, res) => {
  res.json(getFullSnapshot() || { data: [], ts: null })
})

app.get('/api/snapshot.xlsx', requireAuth, (_req, res) => {
  const snap = getFullSnapshot()
  const rows = Array.isArray(snap?.data) ? snap.data : []
  if (!rows.length) {
    return res.status(404).json({ ok: false, reason: 'no_snapshot' })
  }
  const stamp = new Date(snap.ts || Date.now()).toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const body = snapshotToXlsx(rows)
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="oddslocker-odds-${stamp}.xlsx"`)
  res.send(body)
})

app.get('/health', (_req, res) => {
  const st = getPublicState()
  res.json({
    ok: true,
    service: 'oddslocker-engine',
    channels: st.channels.length,
    batches: st.batches.length,
    proxies: st.proxyStats,
    sessions: st.stats.sessions
  })
})

const httpServer = createServer(app)
const wss = new WebSocketServer({ server: httpServer, path: '/ws' })
const viewers = new Set()

function broadcast() {
  const snap = getFullSnapshot()
  const payload = JSON.stringify({
    type: 'odds',
    ts: snap?.ts || Date.now(),
    data: snap?.data || [],
    leagueWatcher: getPublicState().leagueWatcher,
    engine: getPublicState()
  })
  for (const ws of viewers) {
    if (ws.readyState === 1) {
      try {
        ws.send(payload)
      } catch (_) {}
    }
  }
}

wss.on('connection', (ws, req) => {
  if (LOGIN_PASSWORD) {
    const cookies = parseCookie(req.headers.cookie)
    if (cookies.ol_engine !== '1') {
      ws.close()
      return
    }
  }
  viewers.add(ws)
  broadcast()
  ws.on('close', () => viewers.delete(ws))
})

onStateChange((publicState) => {
  const payload = JSON.stringify({ type: 'state', engine: publicState })
  for (const ws of viewers) {
    if (ws.readyState === 1) {
      try { ws.send(payload) } catch (_) {}
    }
  }
})
setSessionCompleteHandler(() => broadcast())

startScheduler()

httpServer.listen(PORT, () => {
  console.log(`[OddsLocker Engine] http://localhost:${PORT}`)
  console.log(`[OddsLocker Engine] WS ws://localhost:${PORT}/ws`)
  const terminalUrl = String(process.env.TERMINAL_URL || '').trim()
  if (terminalUrl) {
    let terminalHost = terminalUrl
    try { terminalHost = new URL(terminalUrl.replace(/^ws/i, 'http')).host } catch { /* keep raw */ }
    console.log('[OddsLocker Engine] Finished batches post to the terminal →', terminalHost)
  } else {
    console.log('[OddsLocker Engine] TERMINAL_URL is not set. Set it, or WEBHOOK_URL, or finished batches stay on this machine.')
  }
})

process.on('SIGINT', () => {
  stopScheduler()
  process.exit(0)
})
process.on('SIGTERM', () => {
  stopScheduler()
  process.exit(0)
})
