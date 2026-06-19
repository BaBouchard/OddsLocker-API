import 'dotenv/config'
import crypto from 'node:crypto'
import fs from 'node:fs'
import express from 'express'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import path from 'path'
import { fileURLToPath } from 'url'

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

const VPS_SLOTS = ['vps1', 'vps2', 'vps3', 'vps4', 'vps5', 'vps6']
const KNOWN_SPORTSBOOKS = ['BetRivers', 'FanDuel', 'Bovada', 'PointsBet', 'BetMGM', '888sport', 'The Score Bet', 'Polymarket', 'Kalshi']

function sourceToSlot(sourceId) {
  if (!sourceId) return null
  const s = String(sourceId).toLowerCase()
  const m = s.match(/^(?:vps|scraper)(\d+)$/)
  return m ? 'vps' + m[1] : (VPS_SLOTS.includes(s) ? s : null)
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
        leagueWatcher: lastLeagueWatcher
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
  // With REPLACE_ALL, empty ingests would wipe the whole feed (e.g. another VPS posting 0 rows).
  if (TERMINAL_REPLACE_ALL_ON_INGEST && data.length === 0) {
    console.warn('[Terminal] Ignored empty ingest from', sourceId, '(REPLACE_ALL_ON_INGEST — would have cleared all data)')
    return res.json({ ok: true, skipped: true, reason: 'empty_data_replace_all' })
  }
  if (TERMINAL_REPLACE_ALL_ON_INGEST) {
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
  if (lw && typeof lw === 'object') {
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

app.get('/', (req, res) => {
  if (LOGIN_PASSWORD && !isAuthed(req)) {
    return res.type('html').send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>OddsLocker Login</title>
      <style>
        body { font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif; background: #0f0f12; color: #e4e4e7; margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
        .card { background: #18181c; border: 1px solid #27272f; border-radius: 12px; padding: 1.75rem 1.5rem; width: 100%; max-width: 360px; box-shadow: 0 18px 45px rgba(0,0,0,0.55); }
        h1 { margin: 0 0 0.75rem 0; font-size: 1.4rem; font-weight: 600; letter-spacing: -0.02em; }
        p { margin: 0 0 1.25rem 0; font-size: 0.9rem; color: #a1a1aa; }
        label { display: block; font-size: 0.8rem; margin-bottom: 0.25rem; color: #d4d4d8; }
        input[type="password"] { width: 100%; padding: 0.5rem 0.6rem; border-radius: 8px; border: 1px solid #27272f; background: #09090b; color: #e4e4e7; font-size: 0.9rem; }
        input[type="password"]:focus { outline: none; border-color: #a78bfa; box-shadow: 0 0 0 1px rgba(167,139,250,0.35); }
        button { margin-top: 0.9rem; width: 100%; padding: 0.55rem 0.6rem; border-radius: 999px; border: none; background: linear-gradient(135deg,#a855f7,#6366f1); color: white; font-weight: 500; font-size: 0.9rem; cursor: pointer; }
        button:hover { background: linear-gradient(135deg,#9333ea,#4f46e5); }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>OddsLocker terminal</h1>
        <p>Enter the terminal password to view live odds.</p>
        <form method="post" action="/login">
          <label for="password">Password</label>
          <input id="password" name="password" type="password" autocomplete="current-password" required>
          <button type="submit">Enter</button>
        </form>
      </div>
    </body>
    </html>
    `)
  }
  const scraperDownloadButtonHtml = getScraperDownloadButtonHtml()
  res.type('html').send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>OddsLocker API</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Outfit:wght@400;500;600&display=swap" rel="stylesheet">
      <style>
        :root {
          --bg: #0f0f12;
          --surface: #18181c;
          --border: #2a2a30;
          --text: #e4e4e7;
          --muted: #71717a;
          --accent: #a78bfa;
          --accent-dim: #7c3aed;
          --green: #22c55e;
          --green-dim: #16a34a;
        }
        * { box-sizing: border-box; }
        body {
          font-family: 'Outfit', system-ui, sans-serif;
          background: var(--bg);
          color: var(--text);
          margin: 0;
          min-height: 100vh;
          line-height: 1.5;
        }
        .wrap { max-width: 64rem; margin: 0 auto; padding: 2rem 1.5rem; }
        .header {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 0.25rem;
          flex-wrap: wrap;
        }
        .header img { height: 42px; width: auto; display: block; }
        .header-actions { margin-left: auto; display: flex; align-items: center; gap: 0.5rem; }
        a.download-scraper {
          display: inline-flex;
          align-items: center;
          padding: 0.45rem 0.9rem;
          border-radius: 999px;
          background: linear-gradient(135deg, #a855f7, #6366f1);
          color: #fff;
          font-size: 0.82rem;
          font-weight: 500;
          text-decoration: none;
          white-space: nowrap;
        }
        a.download-scraper:hover { background: linear-gradient(135deg, #9333ea, #4f46e5); }
        h1 {
          font-size: 1.75rem;
          font-weight: 600;
          margin: 0;
          letter-spacing: -0.02em;
        }
        .tagline { color: var(--muted); font-size: 0.95rem; margin: 0 0 1.5rem 0; }
        .section-title .total-odds { font-family: 'JetBrains Mono', monospace; font-weight: 500; color: var(--accent); margin-left: 0.35rem; }
        @keyframes green-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }
        .vps-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 0.75rem; margin-bottom: 1.5rem; perspective: 1100px; }
        .vps-slot {
          --heat: 0;
          padding: 2px;
          border-radius: 10px;
          text-align: center;
          transform-style: preserve-3d;
          will-change: transform, opacity;
          transition: transform 0.55s cubic-bezier(0.23, 1, 0.32, 1), opacity 0.55s ease-out, box-shadow 0.3s ease-out;
          background: linear-gradient(
            to top,
            #7a3535 0%,
            #946040 calc(var(--heat) * 42%),
            #857848 calc(var(--heat) * 72%),
            #524672 calc(var(--heat) * 100%),
            #524672 100%
          );
        }
        .vps-slot.heat-cooldown {
          box-shadow: none;
        }
        .vps-slot-inner {
          background: var(--surface);
          border-radius: 8px;
          padding: 0.65rem 0.75rem;
          height: 100%;
        }
        .vps-slot.deal-in {
          opacity: 1 !important;
          transform: rotateX(0deg) translateY(0) !important;
          box-shadow: 0 18px 40px rgba(0,0,0,0.45);
        }
        .vps-slot .vps-label { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); margin-bottom: 0.35rem; }
        .vps-slot .vps-heat-tag {
          font-size: 0.58rem;
          font-weight: 500;
          letter-spacing: 0.03em;
          text-transform: uppercase;
          color: #a1a1aa;
          margin-bottom: 0.3rem;
        }
        .vps-slot .vps-heat-tag.cool { color: #8b7eb5; }
        .vps-slot .vps-heat-tag.warm { color: #a89458; }
        .vps-slot .vps-heat-tag.hot { color: #b07850; }
        .vps-slot .vps-heat-tag.critical { color: #a86565; }
        .vps-slot .vps-heat-tag.cooldown { color: #9e5050; }
        .vps-slot .vps-n { font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; color: var(--text); margin-bottom: 0.15rem; }
        .vps-slot .vps-time { font-size: 0.65rem; color: var(--muted); margin-bottom: 0.5rem; }
        .vps-slot .vps-books { text-align: left; border-top: 1px solid var(--border); padding-top: 0.4rem; }
        .vps-slot .vps-book-row { display: flex; align-items: center; gap: 0.4rem; font-size: 0.65rem; color: var(--muted); margin-bottom: 0.25rem; }
        .vps-slot .vps-book-row:last-child { margin-bottom: 0; }
        .vps-slot .vps-book-name { flex: 1; min-width: 0; }
        .vps-slot .vps-book-count { font-family: 'JetBrains Mono', monospace; font-size: 0.6rem; color: var(--muted); margin-left: auto; font-variant-numeric: tabular-nums; }
        .vps-slot .vps-book-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
        .vps-slot .vps-book-dot.active { background: #9484c4; animation: green-blink 2s ease-in-out infinite; }
        .vps-slot .vps-book-dot.stale { background: #eab308; }
        .vps-slot .vps-book-dot.off { background: var(--muted); opacity: 0.5; }
        .vps-slot .vps-book-dot.banned { background: #7a3333; }
        .section-title { font-size: 0.85rem; font-weight: 500; color: var(--muted); margin-bottom: 0.75rem; }
        .section-title .lw-sub { font-weight: 400; color: var(--muted); opacity: 0.85; font-size: 0.8rem; }
        .league-watcher-wrap {
          margin-bottom: 1.25rem;
          opacity: 1;
          transform: translateY(0);
          transition: opacity 0.55s ease-out, transform 0.55s ease-out;
        }
        .league-watcher-wrap.reveal-in {
          opacity: 1 !important;
          transform: translateY(0) !important;
        }
        .league-watcher-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(11.5rem, 1fr));
          gap: 0.65rem;
        }
        .lw-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 8px;
          overflow: hidden;
          min-height: 4rem;
        }
        .lw-card-head {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          padding: 0.5rem 0.6rem;
          border-bottom: 1px solid var(--border);
          font-size: 0.78rem;
          font-weight: 600;
          color: var(--text);
          letter-spacing: 0.02em;
        }
        .lw-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .lw-dot.on {
          background: var(--green);
          box-shadow: 0 0 8px rgba(34, 197, 94, 0.45);
          animation: green-blink 2s ease-in-out infinite;
        }
        .lw-dot.off {
          background: var(--muted);
          opacity: 0.45;
        }
        .lw-card-scroll {
          position: relative;
          max-height: 200px;
        }
        .lw-card-body {
          padding: 0.35rem 0.45rem 0.5rem 0.5rem;
          max-height: 200px;
          overflow-y: auto;
          overflow-x: hidden;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .lw-card-body::-webkit-scrollbar {
          display: none;
          width: 0;
          height: 0;
        }
        .lw-scroll-rail {
          position: absolute;
          top: 6px;
          right: 4px;
          bottom: 6px;
          width: 10px;
          pointer-events: none;
          z-index: 2;
        }
        .lw-scroll-rail.is-hidden {
          opacity: 0;
          visibility: hidden;
        }
        .lw-scroll-thumb {
          position: absolute;
          right: 2px;
          width: 3px;
          border-radius: 999px;
          background: rgba(167, 139, 250, 0.28);
          opacity: 0.5;
          transition: width 0.22s ease, height 0.22s ease, background 0.22s ease, opacity 0.22s ease, box-shadow 0.22s ease;
          box-shadow: none;
        }
        .lw-card-scroll.is-hover .lw-scroll-thumb,
        .lw-card-scroll.is-scrolling .lw-scroll-thumb {
          width: 6px;
          right: 0;
          opacity: 1;
          background: rgba(196, 181, 253, 0.84);
          box-shadow: 0 0 10px rgba(167, 139, 250, 0.32);
        }
        .lw-league-row {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.68rem;
          color: var(--muted);
          padding: 0.2rem 0;
        }
        .lw-league-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .lw-empty {
          grid-column: 1 / -1;
          text-align: center;
          padding: 1rem 0.75rem;
          font-size: 0.8rem;
          color: var(--muted);
          background: var(--surface);
          border: 1px dashed var(--border);
          border-radius: 8px;
        }
        .table-wrap {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 10px;
          overflow: hidden;
          max-height: 380px;
          overflow-y: auto;
          opacity: 1;
          transform: translateY(0);
          will-change: opacity, transform;
          transition: opacity 0.6s ease-out, transform 0.6s ease-out;
        }
        .table-wrap.reveal-in {
          opacity: 1 !important;
          transform: translateY(0) !important;
        }
        #oddsTable { width: 100%; border-collapse: collapse; font-size: 0.8125rem; table-layout: fixed; }
        #oddsTable th, #oddsTable td { width: 14.28%; }
        #oddsTable th {
          text-align: left;
          padding: 0.65rem 0.5rem;
          background: var(--surface);
          font-weight: 500;
          color: var(--muted);
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          position: sticky;
          top: 0;
          z-index: 1;
        }
        #oddsTable th:last-child { text-align: right; }
        #oddsTable td { padding: 0.5rem 0.5rem; border-top: 1px solid var(--border); overflow: hidden; text-overflow: ellipsis; }
        #oddsTable tbody tr:hover { background: rgba(167,139,250,0.06); }
        #oddsTable td:last-child { text-align: right; font-family: 'JetBrains Mono', monospace; font-weight: 500; color: var(--accent); }
        #oddsTable td:last-child a.odds-link { color: var(--accent); text-decoration: none; }
        #oddsTable td:last-child a.odds-link:hover { text-decoration: underline; }
        #oddsTable tbody tr:nth-child(even) { background: rgba(255,255,255,0.02); }
        #oddsTable tbody tr:nth-child(even):hover { background: rgba(167,139,250,0.08); }
        .foot { margin-top: 1rem; font-size: 0.8rem; color: var(--muted); }
        .foot a { color: var(--accent); text-decoration: none; }
        .foot a:hover { text-decoration: underline; }
      </style>
    </head>
    <body>
      <div class="wrap">
        <div class="header">
          <img src="/assets/logo.png" alt="OddsLocker">
          <h1>OddsLocker API</h1>
          ${scraperDownloadButtonHtml ? `<div class="header-actions">${scraperDownloadButtonHtml}</div>` : ''}
        </div>
        <p class="tagline">Central aggregator — merge and broadcast normalized odds to website clients.</p>
        <div class="section-title">VPS status <span class="lw-sub">(heat border: demo levels until scrapers report heat)</span></div>
        <div class="vps-grid" id="vpsGrid">
          <div class="vps-slot" data-slot="vps1"><div class="vps-slot-inner"><div class="vps-label">VPS 1</div><div class="vps-heat-tag cool">Cool</div><div class="vps-n">—</div><div class="vps-time">—</div><div class="vps-books"><div class="vps-book-row" data-book="BetRivers"><span class="vps-book-dot off"></span><span class="vps-book-name">BetRivers</span><span class="vps-book-count">—</span></div><div class="vps-book-row" data-book="FanDuel"><span class="vps-book-dot off"></span><span class="vps-book-name">FanDuel</span><span class="vps-book-count">—</span></div><div class="vps-book-row" data-book="Bovada"><span class="vps-book-dot off"></span><span class="vps-book-name">Bovada</span><span class="vps-book-count">—</span></div><div class="vps-book-row" data-book="PointsBet"><span class="vps-book-dot off"></span><span class="vps-book-name">PointsBet</span><span class="vps-book-count">—</span></div><div class="vps-book-row" data-book="BetMGM"><span class="vps-book-dot off"></span><span class="vps-book-name">BetMGM</span><span class="vps-book-count">—</span></div><div class="vps-book-row" data-book="888sport"><span class="vps-book-dot off"></span><span class="vps-book-name">888sport</span><span class="vps-book-count">—</span></div></div></div></div>
          <div class="vps-slot" data-slot="vps2"><div class="vps-slot-inner"><div class="vps-label">VPS 2</div><div class="vps-heat-tag warm">Warm</div><div class="vps-n">—</div><div class="vps-time">—</div><div class="vps-books"><div class="vps-book-row" data-book="BetRivers"><span class="vps-book-dot off"></span><span class="vps-book-name">BetRivers</span><span class="vps-book-count">—</span></div><div class="vps-book-row" data-book="FanDuel"><span class="vps-book-dot off"></span><span class="vps-book-name">FanDuel</span><span class="vps-book-count">—</span></div><div class="vps-book-row" data-book="Bovada"><span class="vps-book-dot off"></span><span class="vps-book-name">Bovada</span><span class="vps-book-count">—</span></div><div class="vps-book-row" data-book="PointsBet"><span class="vps-book-dot off"></span><span class="vps-book-name">PointsBet</span><span class="vps-book-count">—</span></div><div class="vps-book-row" data-book="BetMGM"><span class="vps-book-dot off"></span><span class="vps-book-name">BetMGM</span><span class="vps-book-count">—</span></div><div class="vps-book-row" data-book="888sport"><span class="vps-book-dot off"></span><span class="vps-book-name">888sport</span><span class="vps-book-count">—</span></div></div></div></div>
          <div class="vps-slot" data-slot="vps3"><div class="vps-slot-inner"><div class="vps-label">VPS 3</div><div class="vps-heat-tag hot">Hot</div><div class="vps-n">—</div><div class="vps-time">—</div><div class="vps-books"><div class="vps-book-row" data-book="BetRivers"><span class="vps-book-dot off"></span><span class="vps-book-name">BetRivers</span><span class="vps-book-count">—</span></div><div class="vps-book-row" data-book="FanDuel"><span class="vps-book-dot off"></span><span class="vps-book-name">FanDuel</span><span class="vps-book-count">—</span></div><div class="vps-book-row" data-book="Bovada"><span class="vps-book-dot off"></span><span class="vps-book-name">Bovada</span><span class="vps-book-count">—</span></div><div class="vps-book-row" data-book="PointsBet"><span class="vps-book-dot off"></span><span class="vps-book-name">PointsBet</span><span class="vps-book-count">—</span></div><div class="vps-book-row" data-book="BetMGM"><span class="vps-book-dot off"></span><span class="vps-book-name">BetMGM</span><span class="vps-book-count">—</span></div><div class="vps-book-row" data-book="888sport"><span class="vps-book-dot off"></span><span class="vps-book-name">888sport</span><span class="vps-book-count">—</span></div></div></div></div>
          <div class="vps-slot" data-slot="vps4"><div class="vps-slot-inner"><div class="vps-label">VPS 4</div><div class="vps-heat-tag critical">Critical</div><div class="vps-n">—</div><div class="vps-time">—</div><div class="vps-books"><div class="vps-book-row" data-book="BetRivers"><span class="vps-book-dot off"></span><span class="vps-book-name">BetRivers</span><span class="vps-book-count">—</span></div><div class="vps-book-row" data-book="FanDuel"><span class="vps-book-dot off"></span><span class="vps-book-name">FanDuel</span><span class="vps-book-count">—</span></div><div class="vps-book-row" data-book="Bovada"><span class="vps-book-dot off"></span><span class="vps-book-name">Bovada</span><span class="vps-book-count">—</span></div><div class="vps-book-row" data-book="PointsBet"><span class="vps-book-dot off"></span><span class="vps-book-name">PointsBet</span><span class="vps-book-count">—</span></div><div class="vps-book-row" data-book="BetMGM"><span class="vps-book-dot off"></span><span class="vps-book-name">BetMGM</span><span class="vps-book-count">—</span></div><div class="vps-book-row" data-book="888sport"><span class="vps-book-dot off"></span><span class="vps-book-name">888sport</span><span class="vps-book-count">—</span></div></div></div></div>
          <div class="vps-slot" data-slot="vps5"><div class="vps-slot-inner"><div class="vps-label">VPS 5</div><div class="vps-heat-tag cool">Heating…</div><div class="vps-n">—</div><div class="vps-time">—</div><div class="vps-books"><div class="vps-book-row" data-book="BetRivers"><span class="vps-book-dot off"></span><span class="vps-book-name">BetRivers</span><span class="vps-book-count">—</span></div><div class="vps-book-row" data-book="FanDuel"><span class="vps-book-dot off"></span><span class="vps-book-name">FanDuel</span><span class="vps-book-count">—</span></div><div class="vps-book-row" data-book="Bovada"><span class="vps-book-dot off"></span><span class="vps-book-name">Bovada</span><span class="vps-book-count">—</span></div><div class="vps-book-row" data-book="PointsBet"><span class="vps-book-dot off"></span><span class="vps-book-name">PointsBet</span><span class="vps-book-count">—</span></div><div class="vps-book-row" data-book="BetMGM"><span class="vps-book-dot off"></span><span class="vps-book-name">BetMGM</span><span class="vps-book-count">—</span></div><div class="vps-book-row" data-book="888sport"><span class="vps-book-dot off"></span><span class="vps-book-name">888sport</span><span class="vps-book-count">—</span></div></div></div></div>
          <div class="vps-slot" data-slot="vps6"><div class="vps-slot-inner"><div class="vps-label">VPS 6</div><div class="vps-heat-tag cooldown">Cooldown</div><div class="vps-n">—</div><div class="vps-time">—</div><div class="vps-books"><div class="vps-book-row" data-book="BetRivers"><span class="vps-book-dot off"></span><span class="vps-book-name">BetRivers</span><span class="vps-book-count">—</span></div><div class="vps-book-row" data-book="FanDuel"><span class="vps-book-dot off"></span><span class="vps-book-name">FanDuel</span><span class="vps-book-count">—</span></div><div class="vps-book-row" data-book="Bovada"><span class="vps-book-dot off"></span><span class="vps-book-name">Bovada</span><span class="vps-book-count">—</span></div><div class="vps-book-row" data-book="PointsBet"><span class="vps-book-dot off"></span><span class="vps-book-name">PointsBet</span><span class="vps-book-count">—</span></div><div class="vps-book-row" data-book="BetMGM"><span class="vps-book-dot off"></span><span class="vps-book-name">BetMGM</span><span class="vps-book-count">—</span></div><div class="vps-book-row" data-book="888sport"><span class="vps-book-dot off"></span><span class="vps-book-name">888sport</span><span class="vps-book-count">—</span></div></div></div></div>
        </div>
        <div class="section-title">League watcher <span class="lw-sub">(Bovada live JSON)</span> <span id="lwUpdated" class="total-odds" style="font-size:0.75rem;">—</span></div>
        <div class="league-watcher-wrap" id="leagueWatcherWrap">
          <div class="league-watcher-grid" id="leagueWatcherGrid">
            <div class="lw-empty" id="leagueWatcherEmpty">Waiting for Bovada snapshot from ingest…</div>
          </div>
        </div>
        <div class="section-title">Live feed (WebSocket) <span id="totalOdds" class="total-odds">—</span></div>
        <p id="wsStatus" class="ws-status" style="display:none; color:#f87171; font-size:0.85rem; margin:0 0 0.65rem 0; max-width:42rem;"></p>
        <div class="table-wrap">
          <table id="oddsTable">
            <thead>
              <tr>
                <th>Sport</th>
                <th>League</th>
                <th>Event</th>
                <th>Sportsbook</th>
                <th>Market</th>
                <th>Outcome</th>
                <th>Odds (¢ · US)</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
        <p class="foot">
          <a href="/health">/health</a> · <a href="/export/csv" download>Export CSV</a> · Ingest: <code>POST /ingest</code> · WS readers: <code>wss://host/?token=…</code> or <code>Authorization: Bearer</code> when tokens are configured
        </p>
      </div>
      <script>
        const wsProtocol = location.protocol === 'https:' ? 'wss://' : 'ws://';
        const ws = new WebSocket(wsProtocol + location.host + '/')
        const tbody = document.querySelector('#oddsTable tbody')
        const totalOddsEl = document.getElementById('totalOdds')
        const wsStatusEl = document.getElementById('wsStatus')
        const lwGrid = document.getElementById('leagueWatcherGrid')
        const lwUpdated = document.getElementById('lwUpdated')
        const lwScrollTimers = new WeakMap()
        function syncLwScrollbar(scrollWrap) {
          const body = scrollWrap.querySelector('.lw-card-body')
          const rail = scrollWrap.querySelector('.lw-scroll-rail')
          const thumb = scrollWrap.querySelector('.lw-scroll-thumb')
          if (!body || !rail || !thumb) return
          const trackHeight = body.clientHeight
          const scrollHeight = body.scrollHeight
          if (scrollHeight <= trackHeight + 1) {
            rail.classList.add('is-hidden')
            return
          }
          rail.classList.remove('is-hidden')
          const active = scrollWrap.classList.contains('is-hover') || scrollWrap.classList.contains('is-scrolling')
          const ratio = trackHeight / scrollHeight
          const baseHeight = Math.max(16, Math.round(trackHeight * ratio))
          const thumbHeight = active ? Math.min(trackHeight - 4, Math.round(baseHeight * 1.45)) : baseHeight
          const maxScroll = scrollHeight - trackHeight
          const scrollRatio = maxScroll > 0 ? body.scrollTop / maxScroll : 0
          const maxTop = Math.max(0, trackHeight - thumbHeight)
          thumb.style.height = thumbHeight + 'px'
          thumb.style.top = Math.round(scrollRatio * maxTop) + 'px'
        }
        function setupLwCardScrollbar(scrollWrap) {
          const body = scrollWrap.querySelector('.lw-card-body')
          if (!body || scrollWrap.dataset.lwScrollBound) return
          scrollWrap.dataset.lwScrollBound = '1'
          const sync = () => syncLwScrollbar(scrollWrap)
          scrollWrap.addEventListener('mouseenter', () => {
            scrollWrap.classList.add('is-hover')
            sync()
          })
          scrollWrap.addEventListener('mouseleave', () => {
            scrollWrap.classList.remove('is-hover')
            sync()
          })
          body.addEventListener(
            'scroll',
            () => {
              scrollWrap.classList.add('is-scrolling')
              clearTimeout(lwScrollTimers.get(scrollWrap))
              lwScrollTimers.set(
                scrollWrap,
                setTimeout(() => scrollWrap.classList.remove('is-scrolling'), 900)
              )
              sync()
            },
            { passive: true }
          )
          if (typeof ResizeObserver !== 'undefined') {
            const ro = new ResizeObserver(sync)
            ro.observe(body)
          }
          requestAnimationFrame(sync)
        }
        ;(function setupIntroAnimation() {
          const slots = Array.from(document.querySelectorAll('.vps-slot'))
          const tableWrap = document.querySelector('.table-wrap')
          const lwWrap = document.getElementById('leagueWatcherWrap')
          if (slots.length === 0 || !tableWrap) return
          // prime initial state
          slots.forEach((slot) => {
            slot.style.opacity = '0'
            slot.style.transform = 'rotateX(90deg) translateY(-12px)'
          })
          if (lwWrap) {
            lwWrap.style.opacity = '0'
            lwWrap.style.transform = 'translateY(14px)'
          }
          tableWrap.style.opacity = '0'
          tableWrap.style.transform = 'translateY(18px)'
          // stagger in VPS slots like dealing cards
          slots.forEach((slot, idx) => {
            setTimeout(() => {
              slot.classList.add('deal-in')
            }, idx * 160)
          })
          const totalDuration = (slots.length - 1) * 160 + 550
          setTimeout(() => {
            if (lwWrap) lwWrap.classList.add('reveal-in')
          }, totalDuration)
          setTimeout(() => {
            tableWrap.classList.add('reveal-in')
          }, totalDuration + 380)
        })()
        function heatLabelForLevel(level, cooldown) {
          if (cooldown) return { text: 'Cooldown', cls: 'cooldown' }
          if (level < 0.15) return { text: 'Cool', cls: 'cool' }
          if (level < 0.45) return { text: 'Warm', cls: 'warm' }
          if (level < 0.75) return { text: 'Hot', cls: 'hot' }
          return { text: 'Critical', cls: 'critical' }
        }
        const COOLDOWN_BLINK_MS = 2600
        const COOLDOWN_BORDER_ON = '#7a3333'
        let cooldownSyncStarted = false
        function ensureCooldownSyncLoop() {
          if (cooldownSyncStarted) return
          cooldownSyncStarted = true
          function tickCooldownBlink() {
            const phase = (Date.now() % COOLDOWN_BLINK_MS) / COOLDOWN_BLINK_MS
            const bg = phase < 0.48 ? COOLDOWN_BORDER_ON : 'transparent'
            document.querySelectorAll('.vps-slot.heat-cooldown').forEach((el) => {
              el.style.background = bg
            })
            requestAnimationFrame(tickCooldownBlink)
          }
          requestAnimationFrame(tickCooldownBlink)
        }
        function applyVpsHeat(el, level, cooldown) {
          if (!el) return
          const clamped = Math.max(0, Math.min(1, level))
          el.style.setProperty('--heat', String(clamped))
          el.classList.toggle('heat-cooldown', !!cooldown)
          if (cooldown) {
            ensureCooldownSyncLoop()
          } else {
            el.style.background = ''
          }
          const tag = el.querySelector('.vps-heat-tag')
          if (tag) {
            const { text, cls } = heatLabelForLevel(clamped, cooldown)
            tag.textContent = text
            tag.className = 'vps-heat-tag ' + cls
          }
        }
        function setupDemoVpsHeat() {
          const staticHeat = {
            vps1: 0,
            vps2: 0.28,
            vps3: 0.58,
            vps4: 0.9,
            vps6: { level: 1, cooldown: true }
          }
          for (const slot of Object.keys(staticHeat)) {
            const el = document.querySelector('.vps-slot[data-slot="' + slot + '"]')
            if (!el) continue
            const val = staticHeat[slot]
            const level = typeof val === 'number' ? val : val.level
            const cooldown = typeof val === 'object' && val.cooldown
            applyVpsHeat(el, level, cooldown)
          }
          const vps5 = document.querySelector('.vps-slot[data-slot="vps5"]')
          if (!vps5) return
          const HEAT_MS = 14000
          const COOLDOWN_MS = 6500
          const REST_MS = 3500
          const CYCLE_MS = HEAT_MS + COOLDOWN_MS + REST_MS
          function tick() {
            const t = Date.now() % CYCLE_MS
            if (t < HEAT_MS) {
              const level = t / HEAT_MS
              applyVpsHeat(vps5, level, false)
              const tag = vps5.querySelector('.vps-heat-tag')
              if (tag && level > 0.08 && level < 0.92) {
                tag.textContent = 'Heating…'
                tag.className = 'vps-heat-tag warm'
              }
            } else if (t < HEAT_MS + COOLDOWN_MS) {
              applyVpsHeat(vps5, 1, true)
            } else {
              applyVpsHeat(vps5, 0, false)
            }
            requestAnimationFrame(tick)
          }
          requestAnimationFrame(tick)
        }
        setupDemoVpsHeat()
        function escapeHtml(s) {
          if (s == null) return ''
          const div = document.createElement('div')
          div.textContent = s
          return div.innerHTML
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
          if (n >= 1000000) return '$' + (n / 1000000).toFixed(1) + 'M'
          if (n >= 1000) return '$' + Math.round(n / 1000) + 'k'
          return '$' + Math.round(n)
        }
        function formatOddsDisplay(entry) {
          const cents = formatSharePriceCents(entry && entry.share_price)
          const am = formatAmericanOdds(entry && entry.odds_american)
          let base = ''
          if (cents && am) base = cents + ' · ' + am
          else if (cents) base = cents
          else base = am
          const askSize = entry && entry.ask_size
          if (askSize != null && !Number.isNaN(Number(askSize))) {
            const sh = Number(askSize)
            const usd = formatCompactUsd(entry.max_stake_usd)
            if (sh > 0) {
              const shLabel = sh >= 1000 ? (sh / 1000).toFixed(1) + 'k sh' : Math.round(sh) + ' sh'
              base = base ? base + ' · ' + shLabel + (usd ? ' (' + usd + ')' : '') : shLabel + (usd ? ' (' + usd + ')' : '')
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
          const mt = (entry && entry.market_type) || ''
          if (mt === 'total' && entry && entry.line_value != null && !Number.isNaN(Number(entry.line_value))) {
            return mt + ' ' + entry.line_value
          }
          const line = formatLineValue(entry && entry.line_value)
          if (mt === 'spread' && line) return mt + ' ' + line
          return mt
        }
        function formatOutcomeDisplay(entry) {
          const name = (entry && entry.outcome_name) || ''
          const mt = (entry && entry.market_type) || ''
          if (mt === 'total' && entry && entry.line_value != null && !Number.isNaN(Number(entry.line_value))) {
            return (name + ' ' + entry.line_value).trim()
          }
          const line = formatLineValue(entry && entry.line_value)
          if (mt === 'spread' && line) return (name + ' ' + line).trim()
          return name
        }
        function formatAgo(ts) {
          if (!ts) return '—'
          const s = Math.floor((Date.now() - ts) / 1000)
          if (s < 60) return s + 's ago'
          if (s < 3600) return Math.floor(s/60) + 'm ago'
          return Math.floor(s/3600) + 'h ago'
        }
        function agoRefreshIntervalMs(ageSec) {
          if (ageSec < 5) return 1000
          if (ageSec < 30) return 5000
          if (ageSec < 60) return 10000
          return 60000
        }
        const vpsSlotState = {}
        let vpsAgoTimer = null
        function scheduleVpsAgoTick() {
          if (vpsAgoTimer) clearTimeout(vpsAgoTimer)
          let minInterval = 60000
          const now = Date.now()
          let hasAny = false
          for (const slot of Object.keys(vpsSlotState)) {
            const lastSeen = vpsSlotState[slot]?.lastSeen ?? 0
            if (!lastSeen) continue
            hasAny = true
            const ageSec = (now - lastSeen) / 1000
            const interval = agoRefreshIntervalMs(ageSec)
            if (interval < minInterval) minInterval = interval
          }
          if (!hasAny) return
          vpsAgoTimer = setTimeout(refreshVpsSlotTimes, minInterval)
        }
        function refreshVpsSlotTimes() {
          const STALE_MS = 90000
          document.querySelectorAll('.vps-slot').forEach(el => {
            const slot = el.dataset.slot
            const st = vpsSlotState[slot]
            if (!st) return
            const lastSeen = st.lastSeen ?? 0
            const timeEl = el.querySelector('.vps-time')
            if (timeEl) timeEl.textContent = formatAgo(lastSeen)
            const hasData = st.n && lastSeen
            if (!hasData) return
            const age = Date.now() - lastSeen
            const isStale = age > STALE_MS
            const slotBooks = st.books ?? []
            el.querySelectorAll('.vps-book-row').forEach(row => {
              const book = row.dataset.book
              if (!slotBooks.includes(book)) return
              const dot = row.querySelector('.vps-book-dot')
              if (!dot) return
              dot.classList.remove('active', 'stale')
              dot.classList.add(isStale ? 'stale' : 'active')
            })
          })
          scheduleVpsAgoTick()
        }
        function vpsCountForBook(bookCounts, bookLabel) {
          if (!bookCounts || !bookLabel) return 0
          if (Object.prototype.hasOwnProperty.call(bookCounts, bookLabel)) return bookCounts[bookLabel]
          const low = String(bookLabel).toLowerCase()
          for (const k of Object.keys(bookCounts)) {
            if (String(k).toLowerCase() === low) return bookCounts[k]
          }
          return 0
        }
        function updateVpsSlots(sources) {
          if (!sources) return
          const STALE_MS = 90000
          document.querySelectorAll('.vps-slot').forEach(el => {
            const slot = el.dataset.slot
            const st = sources[slot]
            const n = st?.n ?? 0
            const lastSeen = st?.lastSeen ?? 0
            const slotBooks = st?.books ?? []
            const bookCounts = st?.bookCounts ?? {}
            vpsSlotState[slot] = { lastSeen, n, books: slotBooks, bookCounts }
            const nEl = el.querySelector('.vps-n')
            const timeEl = el.querySelector('.vps-time')
            nEl.textContent = n ? n + ' entries' : '—'
            timeEl.textContent = formatAgo(lastSeen)
            const hasData = n && lastSeen
            const age = lastSeen ? Date.now() - lastSeen : 0
            const isStale = age > STALE_MS
            el.querySelectorAll('.vps-book-row').forEach(row => {
              const book = row.dataset.book
              const dot = row.querySelector('.vps-book-dot')
              const countEl = row.querySelector('.vps-book-count')
              dot.classList.remove('active', 'stale', 'off', 'banned')
              if (!hasData) {
                dot.classList.add('off')
              } else if (slotBooks.includes(book)) {
                dot.classList.add(isStale ? 'stale' : 'active')
              } else {
                dot.classList.add('banned')
              }
              if (countEl) {
                countEl.textContent = hasData ? String(vpsCountForBook(bookCounts, book)) : '—'
              }
            })
          })
          scheduleVpsAgoTick()
        }
        function updateLeagueWatcher(watcher) {
          if (!lwGrid || !lwUpdated) return
          lwUpdated.textContent = watcher && watcher.updatedAt ? 'updated ' + formatAgo(watcher.updatedAt) : '—'
          if (!watcher || !Array.isArray(watcher.sports) || watcher.sports.length === 0) {
            lwGrid.innerHTML = '<div class="lw-empty" id="leagueWatcherEmpty">Waiting for Bovada snapshot from ingest…</div>'
            return
          }
          lwGrid.innerHTML = ''
          watcher.sports.forEach((sp) => {
            const card = document.createElement('div')
            card.className = 'lw-card'
            const head = document.createElement('div')
            head.className = 'lw-card-head'
            const sportDot = document.createElement('span')
            sportDot.className = 'lw-dot ' + (sp.active ? 'on' : 'off')
            const sportName = document.createElement('span')
            sportName.textContent = sp.name || sp.key || 'Sport'
            head.appendChild(sportDot)
            head.appendChild(sportName)
            card.appendChild(head)
            const scrollWrap = document.createElement('div')
            scrollWrap.className = 'lw-card-scroll'
            const body = document.createElement('div')
            body.className = 'lw-card-body'
            if (!sp.leagues || sp.leagues.length === 0) {
              const row = document.createElement('div')
              row.className = 'lw-league-row'
              row.innerHTML = '<span class="lw-dot off"></span><span class="lw-league-name">No leagues</span>'
              body.appendChild(row)
            } else {
              sp.leagues.forEach((lg) => {
                const row = document.createElement('div')
                row.className = 'lw-league-row'
                const d = document.createElement('span')
                d.className = 'lw-dot ' + (lg.active ? 'on' : 'off')
                const nm = document.createElement('span')
                nm.className = 'lw-league-name'
                nm.textContent = lg.name || lg.key || ''
                row.appendChild(d)
                row.appendChild(nm)
                body.appendChild(row)
              })
            }
            const rail = document.createElement('div')
            rail.className = 'lw-scroll-rail is-hidden'
            rail.setAttribute('aria-hidden', 'true')
            const thumb = document.createElement('div')
            thumb.className = 'lw-scroll-thumb'
            rail.appendChild(thumb)
            scrollWrap.appendChild(body)
            scrollWrap.appendChild(rail)
            card.appendChild(scrollWrap)
            setupLwCardScrollbar(scrollWrap)
            lwGrid.appendChild(card)
          })
        }
        ws.onopen = function () {
          if (wsStatusEl) wsStatusEl.style.display = 'none'
        }
        ws.onerror = function () {
          if (!wsStatusEl) return
          wsStatusEl.textContent =
            'WebSocket could not connect. If TERMINAL_WS_ALLOWED_TOKENS is set, external apps need ?token= or Authorization: Bearer. If you use a terminal password: log in, then hard-refresh. Check /health. Ingest may still work — try Export CSV.'
          wsStatusEl.style.display = 'block'
        }
        ws.onclose = function (ev) {
          if (!wsStatusEl || ev.wasClean) return
          if (wsStatusEl.style.display === 'none') {
            wsStatusEl.textContent =
              'WebSocket disconnected (code ' + ev.code + '). Reload the page. Data may still update after reconnect.'
            wsStatusEl.style.display = 'block'
          }
        }
        ws.onmessage = (e) => {
          let msg
          try {
            msg = JSON.parse(e.data)
          } catch (_) {
            return
          }
          if (msg.type !== 'odds') return
          const data = Array.isArray(msg.data) ? msg.data : []
          totalOddsEl.textContent = data.length
          if (msg.sources) updateVpsSlots(msg.sources)
          if (Object.prototype.hasOwnProperty.call(msg, 'leagueWatcher')) updateLeagueWatcher(msg.leagueWatcher)
          tbody.innerHTML = ''
          const max = 80
          data.slice(0, max).forEach(e => {
            const tr = document.createElement('tr')
            const ev = (e.away_team && e.home_team) ? e.away_team + ' @ ' + e.home_team : e.event_id || ''
            const oddsLabel = formatOddsDisplay(e)
            const oddsCell = (e.bookmaker_link && oddsLabel)
              ? '<a href="' + escapeHtml(e.bookmaker_link) + '" target="_blank" rel="noopener noreferrer" class="odds-link">' + escapeHtml(oddsLabel) + '</a>'
              : escapeHtml(oddsLabel)
            tr.innerHTML = '<td>'+ escapeHtml(e.sport||'') +'</td><td>'+ escapeHtml(e.league||'') +'</td><td>'+ escapeHtml(ev) +'</td><td>'+ escapeHtml(e.sportsbook||'') +'</td><td>'+ escapeHtml(formatMarketTypeDisplay(e)) +'</td><td>'+ escapeHtml(formatOutcomeDisplay(e)) +'</td><td>'+ oddsCell +'</td>'
            tbody.appendChild(tr)
          })
          if (data.length > max) {
            const tr = document.createElement('tr')
            tr.innerHTML = '<td colspan="7" style="color: var(--muted); padding: 0.65rem 0.85rem;">… and ' + (data.length - max) + ' more</td>'
            tbody.appendChild(tr)
          }
        }
      </script>
    </body>
    </html>
  `)
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
      { type: 'odds', data: sorted, ts: Date.now(), sources, leagueWatcher: lastLeagueWatcher },
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
