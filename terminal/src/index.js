import 'dotenv/config'
import crypto from 'node:crypto'
import fs from 'node:fs'
import express from 'express'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  renderLoginHtml,
  renderDashboardPage,
  vpsPageContent,
  livePageContent,
  leaguesPageContent,
  jsonPageContent
} from './dashboard.js'
import {
  VPS_SLOTS,
  sourceToSlot,
  getPublicControlSnapshot,
  getVpsControlState,
  updateVpsControlState,
  resetVpsControlState,
  resolveScraperConfig
} from './vps-control.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT) || 3000
/** Optional HTTPS URL to the Windows installer. Overrides auto GitHub URL when set. */
const SCRAPER_INSTALLER_URL = String(process.env.SCRAPER_INSTALLER_URL || '').trim()
/** Optional GitHub repo owner/name for auto-built download URLs (overrides scraper-release.json githubRepo). */
const SCRAPER_INSTALLER_GITHUB_REPO = String(process.env.SCRAPER_INSTALLER_GITHUB_REPO || '').trim()
const SCRAPER_RELEASE_MANIFEST_PATH = path.join(__dirname, '../scraper-release.json')
const SCRAPER_DOWNLOADS_DIR = path.join(__dirname, '../downloads')
const LOGIN_PASSWORD = process.env.TERMINAL_LOGIN_PASSWORD || ''
/** If set, scrapers must send header X-Terminal-Ingest-Secret: <same value>. Ingest never uses the browser login cookie. */
const TERMINAL_INGEST_SECRET = String(process.env.TERMINAL_INGEST_SECRET || '').trim()
/** If true, each POST /ingest clears all stored odds from every VPS before applying that request (troubleshooting; disables multi-VPS merge). */
const TERMINAL_REPLACE_ALL_ON_INGEST =
  /^(1|true|yes|on)$/i.test(String(process.env.TERMINAL_REPLACE_ALL_ON_INGEST || '').trim())

/**
 * Comma-separated WebSocket reader tokens (per customer / API key). Empty = legacy auth only.
 * Connect with: wss://host/?token=SECRET or Authorization: Bearer SECRET
 * If TERMINAL_LOGIN_PASSWORD is set, dashboard cookie still allows WS (same host).
 */
function parseWsAllowedTokens(raw) {
  if (!raw || typeof raw !== 'string') return []
  return [...new Set(raw.split(',').map((t) => t.trim()).filter(Boolean))]
}

const WS_ALLOWED_TOKENS_LIST = parseWsAllowedTokens(process.env.TERMINAL_WS_ALLOWED_TOKENS || '')
const WS_TOKEN_AUTH_ENABLED = WS_ALLOWED_TOKENS_LIST.length > 0

/** @typedef {{ version: string, filename: string, githubRepo?: string, githubReleaseTagPrefix?: string, productName: string }} ScraperReleaseManifest */

/** @returns {ScraperReleaseManifest | null} */
function loadScraperReleaseManifest() {
  try {
    const raw = fs.readFileSync(SCRAPER_RELEASE_MANIFEST_PATH, 'utf8')
    const data = JSON.parse(raw)
    const version = String(data.version || '').trim()
    const filename = String(data.filename || '').trim()
    if (!version || !filename) return null
    return {
      version,
      filename,
      githubRepo: String(data.githubRepo || '').trim() || undefined,
      githubReleaseTagPrefix: String(data.githubReleaseTagPrefix || 'scraper-v').trim() || 'scraper-v',
      productName: String(data.productName || 'OddsLocker Scraper').trim() || 'OddsLocker Scraper'
    }
  } catch {
    return null
  }
}

const scraperReleaseManifest = loadScraperReleaseManifest()

function resolveRemoteScraperInstallerUrl(manifest = scraperReleaseManifest) {
  if (!manifest) return SCRAPER_INSTALLER_URL || ''
  const repo = SCRAPER_INSTALLER_GITHUB_REPO || manifest.githubRepo || ''
  if (repo) {
    const tag = `${manifest.githubReleaseTagPrefix || 'scraper-v'}${manifest.version}`
    return `https://github.com/${repo}/releases/download/${tag}/${encodeURIComponent(manifest.filename)}`
  }
  return SCRAPER_INSTALLER_URL || ''
}

function resolveLocalScraperInstallerPath() {
  if (!scraperReleaseManifest) return null
  const exePath = path.join(SCRAPER_DOWNLOADS_DIR, scraperReleaseManifest.filename)
  if (!fs.existsSync(exePath)) return null
  return { filePath: exePath, downloadName: scraperReleaseManifest.filename }
}

/** @returns {{ version: string, filename: string, productName: string, available: boolean, href: string, external: boolean } | null} */
function getScraperDownloadInfo() {
  if (!scraperReleaseManifest) return null
  const remoteUrl = resolveRemoteScraperInstallerUrl()
  if (remoteUrl) {
    return {
      ...scraperReleaseManifest,
      available: true,
      href: remoteUrl,
      external: true,
      autoUrl: !!(SCRAPER_INSTALLER_GITHUB_REPO || scraperReleaseManifest.githubRepo),
    }
  }
  const local = resolveLocalScraperInstallerPath()
  if (!local) {
    return { ...scraperReleaseManifest, available: false, href: '', external: false }
  }
  return {
    ...scraperReleaseManifest,
    available: true,
    href: '/download/scraper',
    external: false
  }
}

function escapeHtmlAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escapeHtmlText(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function getScraperDownloadButtonHtml() {
  const info = getScraperDownloadInfo()
  if (!info?.available) return ''
  const attrs = info.external
    ? ' target="_blank" rel="noopener noreferrer"'
    : ' download'
  return (
    '<a class="download-scraper" href="' +
    escapeHtmlAttr(info.href) +
    '"' +
    attrs +
    '>Download ' +
    escapeHtmlText(info.productName) +
    ' v' +
    escapeHtmlText(info.version) +
    '</a>'
  )
}

function getWsTokenFromRawRequest(request) {
  const raw = request.url || '/'
  const qIndex = raw.indexOf('?')
  const qs = qIndex >= 0 ? raw.slice(qIndex + 1) : ''
  const params = new URLSearchParams(qs)
  const qToken = params.get('token')
  if (qToken) return qToken.trim()
  const auth = request.headers.authorization || request.headers.Authorization
  if (auth && /^Bearer\s+/i.test(String(auth))) {
    return String(auth).replace(/^Bearer\s+/i, '').trim()
  }
  return null
}

function isAllowedWsToken(provided) {
  if (provided == null || provided === '') return false
  const p = Buffer.from(String(provided), 'utf8')
  if (p.length === 0 || p.length > 4096) return false
  for (const allowed of WS_ALLOWED_TOKENS_LIST) {
    const a = Buffer.from(String(allowed), 'utf8')
    if (p.length !== a.length) continue
    try {
      if (crypto.timingSafeEqual(p, a)) return true
    } catch {
      /* ignore */
    }
  }
  return false
}

/** WebSocket upgrade allowed: token (if configured), or dashboard cookie when password is set, or open */
function canUpgradeWebSocket(request) {
  if (WS_TOKEN_AUTH_ENABLED) {
    const tok = getWsTokenFromRawRequest(request)
    if (tok && isAllowedWsToken(tok)) return true
    if (LOGIN_PASSWORD && isAuthed(request)) return true
    return false
  }
  if (LOGIN_PASSWORD) return isAuthed(request)
  return true
}

/** Railway / reverse proxy: so req.secure and cookies work for HTTPS login → WebSocket */
const TRUST_PROXY = process.env.TRUST_PROXY !== '0'

function parseCookieHeader(cookieHeader) {
  /** @type {Record<string, string>} */
  const out = {}
  if (!cookieHeader || typeof cookieHeader !== 'string') return out
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=')
    if (idx === -1) continue
    const k = part.slice(0, idx).trim()
    const v = part.slice(idx + 1).trim()
    if (k) out[k] = v
  }
  return out
}

/** JSON.stringify replacer: BigInt / odd values from book APIs must not crash broadcasts */
function jsonSafeReplacer(_key, value) {
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'function' || typeof value === 'symbol') return undefined
  return value
}

// Same sort as scraper broadcast: event_id then market (moneyline, spread, total)
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

const lastBySource = {}
const lastSeenBySource = {}
const lastBooksBySource = {}
/** @type {Record<string, Record<string, number>>} sourceId/slot -> sportsbook name -> count from last ingest */
const lastBookCountsBySource = {}
/** Latest Bovada-derived league snapshot from ingest ({ sports, updatedAt }) */
let lastLeagueWatcher = null
const viewers = new Set()

function clearAllTerminalOddsState() {
  for (const k of Object.keys(lastBySource)) delete lastBySource[k]
  for (const k of Object.keys(lastSeenBySource)) delete lastSeenBySource[k]
  for (const k of Object.keys(lastBooksBySource)) delete lastBooksBySource[k]
  for (const k of Object.keys(lastBookCountsBySource)) delete lastBookCountsBySource[k]
  lastLeagueWatcher = null
}

const KNOWN_SPORTSBOOKS = ['BetRivers', 'FanDuel', 'Bovada', 'PointsBet', 'BetMGM', '888sport', 'The Score Bet', 'Polymarket', 'Kalshi']

function shouldReplaceAllOnIngest() {
  const g = getVpsControlState().global
  return TERMINAL_REPLACE_ALL_ON_INGEST || (g.remoteOrchestration && g.replaceAllOnIngest)
}

function ingestAllowedForSource(sourceId) {
  const g = getVpsControlState().global
  if (!g.fleetEnabled) return false
  if (!g.remoteOrchestration) return true
  const slot = sourceToSlot(sourceId)
  if (!slot) return true
  const slotCfg = getVpsControlState().slots[slot]
  return !!(slotCfg?.enabled && slotCfg?.pushEnabled)
}

function countEntriesBySportsbook(entries) {
  /** @type {Record<string, number>} */
  const out = {}
  if (!Array.isArray(entries)) return out
  for (const e of entries) {
    const b = e?.sportsbook
    if (b == null || b === '') continue
    const key = String(b)
    out[key] = (out[key] || 0) + 1
  }
  return out
}

function getSourceStatsForSlots() {
  const stats = { _books: KNOWN_SPORTSBOOKS }
  for (const slot of VPS_SLOTS) {
    const altKey = 'scraper' + slot.replace('vps', '')
    const entries = lastBySource[slot] ?? lastBySource[altKey]
    const lastSeen = lastSeenBySource[slot] ?? lastSeenBySource[altKey]
    const books = lastBooksBySource[slot] ?? lastBooksBySource[altKey] ?? []
    const bookCounts =
      lastBookCountsBySource[slot] ?? lastBookCountsBySource[altKey] ?? {}
    stats[slot] = {
      n: Array.isArray(entries) ? entries.length : 0,
      lastSeen: lastSeen || 0,
      books: Array.isArray(books) ? books : [],
      bookCounts
    }
  }
  return stats
}

function mergeAndBroadcast() {
  const merged = Object.values(lastBySource).flat()
  const sorted = sortByEventThenMarket(merged)
  const sources = getSourceStatsForSlots()
  let payload
  try {
    payload = JSON.stringify(
      {
        type: 'odds',
        data: sorted,
        ts: Date.now(),
        sources,
        leagueWatcher: lastLeagueWatcher,
        vpsControl: getPublicControlSnapshot()
      },
      jsonSafeReplacer
    )
  } catch (e) {
    console.error('[Terminal] mergeAndBroadcast JSON error:', e.message)
    return
  }
  for (const ws of viewers) {
    if (ws.readyState === 1) {
      try {
        ws.send(payload)
      } catch (err) {
        console.error('[Terminal] ws.send error:', err.message)
      }
    }
  }
}

const CSV_HEADERS = ['sport', 'league', 'event_id', 'home_team', 'away_team', 'market_type', 'outcome_name', 'line_value', 'sportsbook', 'odds_american', 'odds_decimal', 'share_price', 'ask_size', 'max_stake_usd', 'commence_time', 'is_live', 'bookmaker_link']

function escapeCsvField(val) {
  if (val == null) return ''
  const s = String(val)
  if (/[,"\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
  return s
}

function buildOddsCsv(entries) {
  const sorted = sortByEventThenMarket(Array.isArray(entries) ? entries : [])
  const rows = [CSV_HEADERS.join(',')]
  for (const e of sorted) {
    const row = CSV_HEADERS.map((h) => escapeCsvField(e[h]))
    rows.push(row.join(','))
  }
  return rows.join('\n')
}

const app = express()
if (TRUST_PROXY) app.set('trust proxy', 1)
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: false }))
app.use('/assets', express.static(path.join(__dirname, '../public')))

function isAuthed(req) {
  if (!LOGIN_PASSWORD) return true
  const cookies = parseCookieHeader(req.headers.cookie || '')
  return cookies.ol_auth === '1'
}

function requestIsHttps(req) {
  if (req.secure) return true
  const xf = String(req.get('x-forwarded-proto') || '')
    .split(',')[0]
    .trim()
    .toLowerCase()
  return xf === 'https'
}

app.post('/ingest', (req, res) => {
  // Scrapers cannot send the dashboard cookie; do not gate ingest on TERMINAL_LOGIN_PASSWORD.
  if (TERMINAL_INGEST_SECRET) {
    const sent = String(req.headers['x-terminal-ingest-secret'] || '').trim()
    if (sent !== TERMINAL_INGEST_SECRET) {
      return res.status(401).json({ error: 'Invalid or missing X-Terminal-Ingest-Secret' })
    }
  }
  const { sourceId, data } = req.body || {}
  if (!sourceId || !Array.isArray(data)) {
    return res.status(400).json({ error: 'Missing sourceId or data array' })
  }
  if (!ingestAllowedForSource(sourceId)) {
    console.warn('[Terminal] Ignored ingest from', sourceId, '(fleet or slot disabled in control center)')
    return res.json({ ok: true, skipped: true, reason: 'slot_disabled' })
  }
  const replaceAll = shouldReplaceAllOnIngest()
  // With REPLACE_ALL, empty ingests would wipe the whole feed (e.g. another VPS posting 0 rows).
  if (replaceAll && data.length === 0) {
    console.warn('[Terminal] Ignored empty ingest from', sourceId, '(REPLACE_ALL_ON_INGEST — would have cleared all data)')
    return res.json({ ok: true, skipped: true, reason: 'empty_data_replace_all' })
  }
  if (replaceAll) {
    clearAllTerminalOddsState()
  }
  lastBySource[sourceId] = data
  lastSeenBySource[sourceId] = Date.now()
  const books = [...new Set(data.map((e) => e.sportsbook).filter(Boolean))]
  lastBooksBySource[sourceId] = books
  const bookCounts = countEntriesBySportsbook(data)
  lastBookCountsBySource[sourceId] = bookCounts
  const slot = sourceToSlot(sourceId)
  if (slot) {
    lastSeenBySource[slot] = Date.now()
    lastBooksBySource[slot] = books
    lastBookCountsBySource[slot] = bookCounts
  }
  const lw = req.body?.leagueWatcher
  const gCtrl = getVpsControlState().global
  if (lw && typeof lw === 'object' && (!gCtrl.remoteOrchestration || gCtrl.leagueWatcherPush)) {
    lastLeagueWatcher = {
      sports: Array.isArray(lw.sports) ? lw.sports : [],
      updatedAt: lw.updatedAt || Date.now(),
      sourceId
    }
  }
  const total = Object.values(lastBySource).flat().length
  console.log('[Terminal] Ingest from', sourceId, ':', data.length, 'entries (total', total, ')')
  mergeAndBroadcast()
  res.json({ ok: true, sources: Object.keys(lastBySource).length })
})

function sendDashboardOrLogin(req, res, renderPage) {
  if (LOGIN_PASSWORD && !isAuthed(req)) {
    return res.type('html').send(renderLoginHtml())
  }
  const scraperDownloadButtonHtml = getScraperDownloadButtonHtml()
  renderPage(res, scraperDownloadButtonHtml)
}

app.get('/', (req, res) => {
  sendDashboardOrLogin(req, res, (r, downloadBtn) => {
    renderDashboardPage(r, {
      activePage: 'vps',
      pageTitle: 'VPS status',
      tagline: 'Fleet control station and VPS health — remote poll, push, and maintenance.',
      contentHtml: vpsPageContent(),
      scraperDownloadButtonHtml: downloadBtn
    })
  })
})

app.get('/live', (req, res) => {
  sendDashboardOrLogin(req, res, (r, downloadBtn) => {
    renderDashboardPage(r, {
      activePage: 'live',
      pageTitle: 'Live feed',
      tagline: 'Merged normalized odds from all connected scrapers.',
      contentHtml: livePageContent(),
      scraperDownloadButtonHtml: downloadBtn
    })
  })
})

app.get('/league-watcher', (req, res) => {
  sendDashboardOrLogin(req, res, (r, downloadBtn) => {
    renderDashboardPage(r, {
      activePage: 'leagues',
      pageTitle: 'League watcher',
      tagline: 'Bovada live catalog — sports and leagues seen by ingest.',
      contentHtml: leaguesPageContent(),
      scraperDownloadButtonHtml: downloadBtn
    })
  })
})

app.get('/json', (req, res) => {
  sendDashboardOrLogin(req, res, (r, downloadBtn) => {
    renderDashboardPage(r, {
      activePage: 'json',
      pageTitle: 'JSON feed',
      tagline: 'Raw WebSocket payload — type, timestamp, data, and VPS sources.',
      contentHtml: jsonPageContent(),
      scraperDownloadButtonHtml: downloadBtn
    })
  })
})

app.post('/login', (req, res) => {
  if (!LOGIN_PASSWORD) return res.redirect('/')
  const { password } = req.body || {}
  if (!password || password !== LOGIN_PASSWORD) {
    return res.redirect('/')
  }
  const parts = ['ol_auth=1', 'Path=/', 'HttpOnly', 'SameSite=Lax']
  if (requestIsHttps(req)) parts.push('Secure')
  res.setHeader('Set-Cookie', parts.join('; '))
  res.redirect('/')
})

app.get('/api/vps-control', (req, res) => {
  if (LOGIN_PASSWORD && !isAuthed(req)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  res.json(getPublicControlSnapshot())
})

app.put('/api/vps-control', (req, res) => {
  if (LOGIN_PASSWORD && !isAuthed(req)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  const body = req.body || {}
  updateVpsControlState(body)
  mergeAndBroadcast()
  res.json(getPublicControlSnapshot())
})

app.post('/api/vps-control/reset', (req, res) => {
  if (LOGIN_PASSWORD && !isAuthed(req)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  resetVpsControlState()
  mergeAndBroadcast()
  res.json(getPublicControlSnapshot())
})

app.get('/api/scraper-config', (req, res) => {
  if (TERMINAL_INGEST_SECRET) {
    const sent = String(req.headers['x-terminal-ingest-secret'] || '').trim()
    if (sent !== TERMINAL_INGEST_SECRET) {
      return res.status(401).json({ error: 'Invalid or missing X-Terminal-Ingest-Secret' })
    }
  }
  const sourceId = String(req.query.sourceId || '').trim()
  if (!sourceId) {
    return res.status(400).json({ error: 'Missing sourceId query parameter' })
  }
  res.json(resolveScraperConfig(sourceId))
})

app.get('/health', (_req, res) => {
  const scraperDownload = getScraperDownloadInfo()
  res.json({
    ok: true,
    sources: Object.keys(lastBySource).length,
    viewers: viewers.size,
    scraperDownload: scraperDownload
      ? {
          version: scraperDownload.version,
          filename: scraperDownload.filename,
          available: scraperDownload.available,
          autoUrl: scraperDownload.autoUrl ?? false,
          href: scraperDownload.available ? scraperDownload.href : null
        }
      : null,
    ws: {
      tokenAuthEnabled: WS_TOKEN_AUTH_ENABLED,
      tokenSlots: WS_ALLOWED_TOKENS_LIST.length,
      loginPasswordEnabled: !!LOGIN_PASSWORD,
      modes:
        WS_TOKEN_AUTH_ENABLED
          ? 'Use ?token= or Authorization: Bearer with one of TERMINAL_WS_ALLOWED_TOKENS; or ol_auth cookie if TERMINAL_LOGIN_PASSWORD is set.'
          : LOGIN_PASSWORD
            ? 'Cookie (ol_auth) after login.'
            : 'Open (no WS auth).'
    }
  })
})

app.get('/download/scraper', (req, res) => {
  if (LOGIN_PASSWORD && !isAuthed(req)) {
    return res.redirect('/')
  }
  const remoteUrl = resolveRemoteScraperInstallerUrl()
  if (remoteUrl) {
    return res.redirect(302, remoteUrl)
  }
  if (!scraperReleaseManifest) {
    return res.status(404).type('text/plain').send('Scraper release manifest missing (terminal/scraper-release.json).')
  }
  const local = resolveLocalScraperInstallerPath()
  if (!local) {
    return res
      .status(404)
      .type('text/plain')
      .send(
        'Installer not on this server. Set SCRAPER_INSTALLER_URL or place the .exe in terminal/downloads/.'
      )
  }
  res.setHeader('Content-Type', 'application/octet-stream')
  res.setHeader('Content-Disposition', `attachment; filename="${local.downloadName}"`)
  fs.createReadStream(local.filePath).pipe(res)
})

app.get('/export/csv', (_req, res) => {
  const merged = Object.values(lastBySource).flat()
  const csv = buildOddsCsv(merged)
  const filename = `odds-export-${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, (c) => (c === 'T' ? '-' : c))}.csv`
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.send(csv)
})

const httpServer = createServer(app)
const wss = new WebSocketServer({ noServer: true })

httpServer.on('upgrade', (request, socket, head) => {
  const pathname = (request.url || '/').split('?')[0] || '/'
  if (pathname !== '/' && pathname !== '') {
    socket.destroy()
    return
  }
  if (!canUpgradeWebSocket(request)) {
    if (WS_TOKEN_AUTH_ENABLED) {
      console.warn(
        '[Terminal] WebSocket upgrade rejected: invalid/missing token (?token= or Authorization: Bearer) and no valid ol_auth cookie'
      )
    } else if (LOGIN_PASSWORD) {
      console.warn(
        '[Terminal] WebSocket upgrade rejected: missing ol_auth cookie (log in via / then reload; trust proxy:',
        TRUST_PROXY,
        ')'
      )
    } else {
      console.warn('[Terminal] WebSocket upgrade rejected')
    }
    socket.destroy()
    return
  }
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request)
  })
})

wss.on('connection', (ws, req) => {
  viewers.add(ws)
  console.log('[Terminal] Viewer connected:', req.socket?.remoteAddress, 'total:', viewers.size)
  const merged = Object.values(lastBySource).flat()
  const sorted = sortByEventThenMarket(merged)
  const sources = getSourceStatsForSlots()
  try {
    const snap = JSON.stringify(
      {
        type: 'odds',
        data: sorted,
        ts: Date.now(),
        sources,
        leagueWatcher: lastLeagueWatcher,
        vpsControl: getPublicControlSnapshot()
      },
      jsonSafeReplacer
    )
    ws.send(snap)
  } catch (e) {
    console.error('[Terminal] Initial WS snapshot failed:', e.message)
  }
  ws.on('close', () => viewers.delete(ws))
  ws.on('error', () => viewers.delete(ws))
})

httpServer.listen(PORT, () => {
  console.log(`[Terminal] HTTP + WebSocket on port ${PORT}`)
  console.log(`[Terminal] Ingest: POST http://localhost:${PORT}/ingest  body: { sourceId, data }`)
  if (WS_TOKEN_AUTH_ENABLED) {
    console.log(
      `[Terminal] WebSocket: ${WS_ALLOWED_TOKENS_LIST.length} token(s) in TERMINAL_WS_ALLOWED_TOKENS — clients use wss://host/?token=… or Authorization: Bearer`
    )
    if (LOGIN_PASSWORD) {
      console.log('[Terminal] WebSocket: dashboard users may also use ol_auth cookie after login.')
    }
  } else {
    console.log('[Terminal] Live feed: set TERMINAL_WS_ALLOWED_TOKENS for per-customer WS tokens (comma-separated).')
  }
})
