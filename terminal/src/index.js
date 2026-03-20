import 'dotenv/config'
import express from 'express'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT) || 3000
const LOGIN_PASSWORD = process.env.TERMINAL_LOGIN_PASSWORD || ''
/** If set, scrapers must send header X-Terminal-Ingest-Secret: <same value>. Ingest never uses the browser login cookie. */
const TERMINAL_INGEST_SECRET = process.env.TERMINAL_INGEST_SECRET || ''
/** If true, each POST /ingest clears all stored odds from every VPS before applying that request (troubleshooting; disables multi-VPS merge). */
const TERMINAL_REPLACE_ALL_ON_INGEST =
  /^(1|true|yes|on)$/i.test(String(process.env.TERMINAL_REPLACE_ALL_ON_INGEST || '').trim())

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

const VPS_SLOTS = ['vps1', 'vps2', 'vps3', 'vps4', 'vps5', 'vps6']
const KNOWN_SPORTSBOOKS = ['BetRivers', 'FanDuel', 'Bovada', 'PointsBet', 'BetMGM', '888sport']

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
  const payload = JSON.stringify({
    type: 'odds',
    data: sorted,
    ts: Date.now(),
    sources,
    leagueWatcher: lastLeagueWatcher
  })
  for (const ws of viewers) {
    if (ws.readyState === 1) ws.send(payload)
  }
}

const CSV_HEADERS = ['sport', 'league', 'event_id', 'home_team', 'away_team', 'market_type', 'outcome_name', 'line_value', 'sportsbook', 'odds_american', 'odds_decimal', 'commence_time', 'is_live', 'bookmaker_link']

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
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: false }))
app.use('/assets', express.static(path.join(__dirname, '../public')))

function isAuthed(req) {
  if (!LOGIN_PASSWORD) return true
  const cookie = req.headers.cookie || ''
  return cookie.split(';').some((p) => p.trim() === 'ol_auth=1')
}

app.post('/ingest', (req, res) => {
  // Scrapers cannot send the dashboard cookie; do not gate ingest on TERMINAL_LOGIN_PASSWORD.
  if (TERMINAL_INGEST_SECRET) {
    const sent = req.headers['x-terminal-ingest-secret']
    if (sent !== TERMINAL_INGEST_SECRET) {
      return res.status(401).json({ error: 'Invalid or missing X-Terminal-Ingest-Secret' })
    }
  }
  const { sourceId, data } = req.body || {}
  if (!sourceId || !Array.isArray(data)) {
    return res.status(400).json({ error: 'Missing sourceId or data array' })
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
        }
        .header img { height: 42px; width: auto; display: block; }
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
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 0.65rem 0.75rem;
          text-align: center;
          transform-style: preserve-3d;
          will-change: transform, opacity;
          transition: transform 0.55s cubic-bezier(0.23, 1, 0.32, 1), opacity 0.55s ease-out, box-shadow 0.3s ease-out;
        }
        .vps-slot.deal-in {
          opacity: 1 !important;
          transform: rotateX(0deg) translateY(0) !important;
          box-shadow: 0 18px 40px rgba(0,0,0,0.45);
        }
        .vps-slot .vps-label { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); margin-bottom: 0.35rem; }
        .vps-slot .vps-n { font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; color: var(--text); margin-bottom: 0.15rem; }
        .vps-slot .vps-time { font-size: 0.65rem; color: var(--muted); margin-bottom: 0.5rem; }
        .vps-slot .vps-books { text-align: left; border-top: 1px solid var(--border); padding-top: 0.4rem; }
        .vps-slot .vps-book-row { display: flex; align-items: center; gap: 0.4rem; font-size: 0.65rem; color: var(--muted); margin-bottom: 0.25rem; }
        .vps-slot .vps-book-row:last-child { margin-bottom: 0; }
        .vps-slot .vps-book-name { flex: 1; min-width: 0; }
        .vps-slot .vps-book-count { font-family: 'JetBrains Mono', monospace; font-size: 0.6rem; color: var(--muted); margin-left: auto; font-variant-numeric: tabular-nums; }
        .vps-slot .vps-book-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
        .vps-slot .vps-book-dot.active { background: var(--green); animation: green-blink 2s ease-in-out infinite; }
        .vps-slot .vps-book-dot.stale { background: #eab308; }
        .vps-slot .vps-book-dot.off { background: var(--muted); opacity: 0.5; }
        .vps-slot .vps-book-dot.banned { background: #ef4444; }
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
        .lw-card-body { padding: 0.35rem 0.5rem 0.5rem; max-height: 200px; overflow-y: auto; }
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
        </div>
        <p class="tagline">Central aggregator — merge and broadcast normalized odds to website clients.</p>
        <div class="section-title">VPS status</div>
        <div class="vps-grid" id="vpsGrid">
          <div class="vps-slot" data-slot="vps1"><div class="vps-label">VPS 1</div><div class="vps-n">—</div><div class="vps-time">—</div><div class="vps-books"><div class="vps-book-row" data-book="BetRivers"><span class="vps-book-dot off"></span><span class="vps-book-name">BetRivers</span><span class="vps-book-count">—</span></div><div class="vps-book-row" data-book="FanDuel"><span class="vps-book-dot off"></span><span class="vps-book-name">FanDuel</span><span class="vps-book-count">—</span></div><div class="vps-book-row" data-book="Bovada"><span class="vps-book-dot off"></span><span class="vps-book-name">Bovada</span><span class="vps-book-count">—</span></div><div class="vps-book-row" data-book="PointsBet"><span class="vps-book-dot off"></span><span class="vps-book-name">PointsBet</span><span class="vps-book-count">—</span></div><div class="vps-book-row" data-book="BetMGM"><span class="vps-book-dot off"></span><span class="vps-book-name">BetMGM</span><span class="vps-book-count">—</span></div><div class="vps-book-row" data-book="888sport"><span class="vps-book-dot off"></span><span class="vps-book-name">888sport</span><span class="vps-book-count">—</span></div></div></div>
          <div class="vps-slot" data-slot="vps2"><div class="vps-label">VPS 2</div><div class="vps-n">—</div><div class="vps-time">—</div><div class="vps-books"><div class="vps-book-row" data-book="BetRivers"><span class="vps-book-dot off"></span><span class="vps-book-name">BetRivers</span><span class="vps-book-count">—</span></div><div class="vps-book-row" data-book="FanDuel"><span class="vps-book-dot off"></span><span class="vps-book-name">FanDuel</span><span class="vps-book-count">—</span></div><div class="vps-book-row" data-book="Bovada"><span class="vps-book-dot off"></span><span class="vps-book-name">Bovada</span><span class="vps-book-count">—</span></div><div class="vps-book-row" data-book="PointsBet"><span class="vps-book-dot off"></span><span class="vps-book-name">PointsBet</span><span class="vps-book-count">—</span></div><div class="vps-book-row" data-book="BetMGM"><span class="vps-book-dot off"></span><span class="vps-book-name">BetMGM</span><span class="vps-book-count">—</span></div><div class="vps-book-row" data-book="888sport"><span class="vps-book-dot off"></span><span class="vps-book-name">888sport</span><span class="vps-book-count">—</span></div></div></div>
          <div class="vps-slot" data-slot="vps3"><div class="vps-label">VPS 3</div><div class="vps-n">—</div><div class="vps-time">—</div><div class="vps-books"><div class="vps-book-row" data-book="BetRivers"><span class="vps-book-dot off"></span><span class="vps-book-name">BetRivers</span><span class="vps-book-count">—</span></div><div class="vps-book-row" data-book="FanDuel"><span class="vps-book-dot off"></span><span class="vps-book-name">FanDuel</span><span class="vps-book-count">—</span></div><div class="vps-book-row" data-book="Bovada"><span class="vps-book-dot off"></span><span class="vps-book-name">Bovada</span><span class="vps-book-count">—</span></div><div class="vps-book-row" data-book="PointsBet"><span class="vps-book-dot off"></span><span class="vps-book-name">PointsBet</span><span class="vps-book-count">—</span></div><div class="vps-book-row" data-book="BetMGM"><span class="vps-book-dot off"></span><span class="vps-book-name">BetMGM</span><span class="vps-book-count">—</span></div><div class="vps-book-row" data-book="888sport"><span class="vps-book-dot off"></span><span class="vps-book-name">888sport</span><span class="vps-book-count">—</span></div></div></div>
          <div class="vps-slot" data-slot="vps4"><div class="vps-label">VPS 4</div><div class="vps-n">—</div><div class="vps-time">—</div><div class="vps-books"><div class="vps-book-row" data-book="BetRivers"><span class="vps-book-dot off"></span><span class="vps-book-name">BetRivers</span><span class="vps-book-count">—</span></div><div class="vps-book-row" data-book="FanDuel"><span class="vps-book-dot off"></span><span class="vps-book-name">FanDuel</span><span class="vps-book-count">—</span></div><div class="vps-book-row" data-book="Bovada"><span class="vps-book-dot off"></span><span class="vps-book-name">Bovada</span><span class="vps-book-count">—</span></div><div class="vps-book-row" data-book="PointsBet"><span class="vps-book-dot off"></span><span class="vps-book-name">PointsBet</span><span class="vps-book-count">—</span></div><div class="vps-book-row" data-book="BetMGM"><span class="vps-book-dot off"></span><span class="vps-book-name">BetMGM</span><span class="vps-book-count">—</span></div><div class="vps-book-row" data-book="888sport"><span class="vps-book-dot off"></span><span class="vps-book-name">888sport</span><span class="vps-book-count">—</span></div></div></div>
          <div class="vps-slot" data-slot="vps5"><div class="vps-label">VPS 5</div><div class="vps-n">—</div><div class="vps-time">—</div><div class="vps-books"><div class="vps-book-row" data-book="BetRivers"><span class="vps-book-dot off"></span><span class="vps-book-name">BetRivers</span><span class="vps-book-count">—</span></div><div class="vps-book-row" data-book="FanDuel"><span class="vps-book-dot off"></span><span class="vps-book-name">FanDuel</span><span class="vps-book-count">—</span></div><div class="vps-book-row" data-book="Bovada"><span class="vps-book-dot off"></span><span class="vps-book-name">Bovada</span><span class="vps-book-count">—</span></div><div class="vps-book-row" data-book="PointsBet"><span class="vps-book-dot off"></span><span class="vps-book-name">PointsBet</span><span class="vps-book-count">—</span></div><div class="vps-book-row" data-book="BetMGM"><span class="vps-book-dot off"></span><span class="vps-book-name">BetMGM</span><span class="vps-book-count">—</span></div><div class="vps-book-row" data-book="888sport"><span class="vps-book-dot off"></span><span class="vps-book-name">888sport</span><span class="vps-book-count">—</span></div></div></div>
          <div class="vps-slot" data-slot="vps6"><div class="vps-label">VPS 6</div><div class="vps-n">—</div><div class="vps-time">—</div><div class="vps-books"><div class="vps-book-row" data-book="BetRivers"><span class="vps-book-dot off"></span><span class="vps-book-name">BetRivers</span><span class="vps-book-count">—</span></div><div class="vps-book-row" data-book="FanDuel"><span class="vps-book-dot off"></span><span class="vps-book-name">FanDuel</span><span class="vps-book-count">—</span></div><div class="vps-book-row" data-book="Bovada"><span class="vps-book-dot off"></span><span class="vps-book-name">Bovada</span><span class="vps-book-count">—</span></div><div class="vps-book-row" data-book="PointsBet"><span class="vps-book-dot off"></span><span class="vps-book-name">PointsBet</span><span class="vps-book-count">—</span></div><div class="vps-book-row" data-book="BetMGM"><span class="vps-book-dot off"></span><span class="vps-book-name">BetMGM</span><span class="vps-book-count">—</span></div><div class="vps-book-row" data-book="888sport"><span class="vps-book-dot off"></span><span class="vps-book-name">888sport</span><span class="vps-book-count">—</span></div></div></div>
        </div>
        <div class="section-title">League watcher <span class="lw-sub">(Bovada live JSON)</span> <span id="lwUpdated" class="total-odds" style="font-size:0.75rem;">—</span></div>
        <div class="league-watcher-wrap" id="leagueWatcherWrap">
          <div class="league-watcher-grid" id="leagueWatcherGrid">
            <div class="lw-empty" id="leagueWatcherEmpty">Waiting for Bovada snapshot from ingest…</div>
          </div>
        </div>
        <div class="section-title">Live feed (WebSocket) <span id="totalOdds" class="total-odds">—</span></div>
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
                <th>Odds</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
        <p class="foot">
          <a href="/health">/health</a> · <a href="/export/csv" download>Export CSV</a> · Ingest: <code>POST /ingest</code> with <code>sourceId</code>, <code>data</code>, optional <code>leagueWatcher</code> · ws://localhost: (local) · wss://oddslocker-api-production.up.railway.app (hosted)
        </p>
      </div>
      <script>
        const wsProtocol = location.protocol === 'https:' ? 'wss://' : 'ws://';
        const ws = new WebSocket(wsProtocol + location.host)
        const tbody = document.querySelector('#oddsTable tbody')
        const totalOddsEl = document.getElementById('totalOdds')
        const lwGrid = document.getElementById('leagueWatcherGrid')
        const lwUpdated = document.getElementById('lwUpdated')
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
        function escapeHtml(s) {
          if (s == null) return ''
          const div = document.createElement('div')
          div.textContent = s
          return div.innerHTML
        }
        function formatAgo(ts) {
          if (!ts) return '—'
          const s = Math.round((Date.now() - ts) / 1000)
          if (s < 60) return s + 's ago'
          if (s < 3600) return Math.floor(s/60) + 'm ago'
          return Math.floor(s/3600) + 'h ago'
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
            card.appendChild(body)
            lwGrid.appendChild(card)
          })
        }
        ws.onmessage = (e) => {
          const msg = JSON.parse(e.data)
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
            const oddsCell = (e.bookmaker_link && (e.odds_american != null || e.odds_american === 0))
              ? '<a href="' + escapeHtml(e.bookmaker_link) + '" target="_blank" rel="noopener noreferrer" class="odds-link">' + escapeHtml(String(e.odds_american)) + '</a>'
              : (e.odds_american != null ? escapeHtml(String(e.odds_american)) : '')
            tr.innerHTML = '<td>'+ escapeHtml(e.sport||'') +'</td><td>'+ escapeHtml(e.league||'') +'</td><td>'+ escapeHtml(ev) +'</td><td>'+ escapeHtml(e.sportsbook||'') +'</td><td>'+ escapeHtml(e.market_type||'') +'</td><td>'+ escapeHtml(e.outcome_name||'') +'</td><td>'+ oddsCell +'</td>'
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
  res.setHeader('Set-Cookie', 'ol_auth=1; Path=/; HttpOnly; SameSite=Lax')
  res.redirect('/')
})

app.get('/health', (_req, res) => {
  res.json({ ok: true, sources: Object.keys(lastBySource).length, viewers: viewers.size })
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
  const path = request.url?.split('?')[0]
  if (path === '/' || path === '') {
    if (!isAuthed(request)) {
      socket.destroy()
      return
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request)
    })
  } else {
    socket.destroy()
  }
})

wss.on('connection', (ws, req) => {
  viewers.add(ws)
  console.log('[Terminal] Viewer connected:', req.socket?.remoteAddress, 'total:', viewers.size)
  const merged = Object.values(lastBySource).flat()
  const sorted = sortByEventThenMarket(merged)
  const sources = getSourceStatsForSlots()
  ws.send(JSON.stringify({ type: 'odds', data: sorted, ts: Date.now(), sources, leagueWatcher: lastLeagueWatcher }))
  ws.on('close', () => viewers.delete(ws))
  ws.on('error', () => viewers.delete(ws))
})

httpServer.listen(PORT, () => {
  console.log(`[Terminal] HTTP + WebSocket on port ${PORT}`)
  console.log(`[Terminal] Ingest: POST http://localhost:${PORT}/ingest  body: { sourceId, data }`)
  console.log(`[Terminal] Live feed: ws://localhost: (local) · wss://oddslocker-api-production.up.railway.app (hosted)`)
})
