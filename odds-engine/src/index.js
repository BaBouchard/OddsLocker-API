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

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const engineRoot = path.join(__dirname, '..')

// Prefer odds-engine/.env, fall back to repo root .env for book URLs
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

app.get('/', (req, res) => sendPage(req, res, 'channels'))
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
  const n = addProxiesFromText(req.body?.text || req.body?.proxies || '')
  res.json({ ...getPublicState(), added: n })
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
  res.json({ ...result, state: getPublicState() })
})

app.get('/api/snapshot', requireAuth, (_req, res) => {
  res.json(getFullSnapshot() || { data: [], ts: null })
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

onStateChange(() => broadcast())
setSessionCompleteHandler(() => broadcast())

startScheduler()

httpServer.listen(PORT, () => {
  console.log(`[OddsLocker Engine] http://localhost:${PORT}`)
  console.log(`[OddsLocker Engine] WS ws://localhost:${PORT}/ws`)
  console.log('[OddsLocker Engine] Legacy VPS/terminal hub is NOT used — this package is standalone.')
})

process.on('SIGINT', () => {
  stopScheduler()
  process.exit(0)
})
process.on('SIGTERM', () => {
  stopScheduler()
  process.exit(0)
})
