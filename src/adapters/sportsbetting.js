import path from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { BaseAdapter } from './base.js'
import { createNormalizedEntry } from '../schema.js'
import { errorMeta } from '../fetch-status.js'

const HOST = 'api.sportsbetting.ag'
const WS_PATH = '/pushd'
const TOPIC_SELECTOR = '*rdd/ui/bol/event/live/'
const ORIGIN = 'https://www.sportsbetting.ag'
const LIVE_PAGE = 'https://www.sportsbetting.ag/sportsbook/live'
const BROWSER = 'chrome_149'

const EVENT_ROOT = /^rdd\/ui\/bol\/event\/live\/.+\/(\d+)$/
const MAIN_MARKET = /^rdd\/ui\/bol\/event\/live\/.+\/(\d+)\/markets\/\d+-(MONEYLINE|SPREAD|TOTAL)-\d+$/
const MARKET_TYPE = { MONEYLINE: 'moneyline', SPREAD: 'spread', TOTAL: 'total' }

let diffusionLib = null
let WreqWebSocket = null
let currentProxyUrl = null
let handshakeError = null

function browserOs() {
  if (process.platform === 'win32') return 'windows'
  if (process.platform === 'darwin') return 'macos'
  return 'linux'
}

function enginePackageJson() {
  if (process.env.SCRAPER_SRC_ROOT) {
    return path.resolve(process.env.SCRAPER_SRC_ROOT, '..', 'odds-engine', 'package.json')
  }
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../odds-engine/package.json')
}

function requireEngine(name) {
  return createRequire(enginePackageJson())(name)
}

function noteHandshakeError(message) {
  const match = String(message || '').match(/status code:\s*(\d+)/i)
  if (!match) return
  const code = Number(match[1])
  if (code === 403 || code === 520) {
    handshakeError = new Error(code === 403 ? 'HTTP 403 Cloudflare' : `HTTP ${code}`)
  } else if (code) {
    handshakeError = new Error(`HTTP ${code}`)
  }
}

class DiffusionSocket {
  constructor(url) {
    this._binaryType = 'arraybuffer'
    this.onopen = null
    this.onmessage = null
    this.onerror = null
    this.onclose = null
    const ws = new WreqWebSocket(url, {
      browser: BROWSER,
      os: browserOs(),
      proxy: currentProxyUrl || undefined,
      headers: { Origin: ORIGIN }
    })
    this._ws = ws
    if ('binaryType' in ws) ws.binaryType = 'arraybuffer'
    ws.onopen = () => this.onopen?.()
    ws.onmessage = (event) => {
      let payload = event?.data
      if (this._binaryType === 'arraybuffer' && Buffer.isBuffer(payload)) {
        payload = payload.buffer.slice(payload.byteOffset, payload.byteOffset + payload.byteLength)
      }
      this.onmessage?.({ data: payload })
    }
    ws.onerror = (event) => {
      const err = event?.error || event
      noteHandshakeError(err?.message || err)
      this.onerror?.(err)
    }
    ws.onclose = (event) => this.onclose?.({ code: event?.code, reason: String(event?.reason || '') })
  }

  get binaryType() { return this._binaryType }
  set binaryType(value) {
    this._binaryType = value
    if (this._ws) this._ws.binaryType = value
  }

  send(data) { this._ws.send(data) }
  close() { try { this._ws.close() } catch { /* already closed */ } }
}

async function ensureClients() {
  if (!WreqWebSocket) {
    const mod = await import(pathToFileURL(path.join(path.dirname(enginePackageJson()), 'node_modules/wreq-js/dist/wreq-js.js')).href)
    WreqWebSocket = mod.WebSocket
  }
  if (diffusionLib) return diffusionLib
  const native = globalThis.WebSocket
  Object.defineProperty(globalThis, 'WebSocket', {
    value: DiffusionSocket,
    configurable: true,
    writable: true
  })
  try {
    diffusionLib = requireEngine('diffusion')
  } finally {
    if (native) {
      Object.defineProperty(globalThis, 'WebSocket', { value: native, configurable: true, writable: true })
    }
  }
  return diffusionLib
}

function teamName(participant) {
  const name = participant?.name
  if (Array.isArray(name)) return name.map((part) => String(part || '').trim()).filter(Boolean).join(' ')
  return String(name || '').trim()
}

function pickSide(pickId) {
  return String(pickId || '').split('-').find((part) => part === 'AWAY' || part === 'HOME' || part === 'OVER' || part === 'UNDER') || ''
}

function outcomeName(side, away, home) {
  if (side === 'AWAY') return away
  if (side === 'HOME') return home
  if (side === 'OVER') return 'Over'
  if (side === 'UNDER') return 'Under'
  return ''
}

/**
 * Turn Diffusion topic records into normalized odds.
 * Full-game moneyline, spread, and total only. Locked lines are left out.
 * @param {{ path: string, value: object }[]} records
 */
export function parseSportsbettingTopics(records, opts = {}) {
  const sportsbook = opts.sportsbook || 'SportsBetting.ag'
  const bookmakerLink = opts.bookmakerLink || LIVE_PAGE
  const events = new Map()
  const markets = []
  for (const rec of records || []) {
    const topic = String(rec?.path || '')
    const value = rec?.value
    if (!value || typeof value !== 'object') continue
    const eventMatch = topic.match(EVENT_ROOT)
    if (eventMatch) {
      events.set(eventMatch[1], value)
      continue
    }
    const marketMatch = topic.match(MAIN_MARKET)
    if (marketMatch) markets.push({ eventId: marketMatch[1], marketType: MARKET_TYPE[marketMatch[2]], value })
  }

  const entries = []
  for (const market of markets) {
    const event = events.get(market.eventId)
    if (!event || event.isLive === false) continue
    const board = market.value
    if (!board || board.isOnHold || board.period !== 'MATCH_TIME') continue
    const away = teamName(event.participants?.[0])
    const home = teamName(event.participants?.[1])
    if (!away || !home) continue
    const picks = board.picks && typeof board.picks === 'object' ? board.picks : {}
    for (const [pickId, pick] of Object.entries(picks)) {
      if (!pick || pick.isOnHold) continue
      const side = pickSide(pickId)
      const name = outcomeName(side, away, home)
      const american = Number(pick.oddsContainer?.american)
      if (!name || !Number.isFinite(american) || american === 0) continue
      const decimal = Number(pick.oddsContainer?.decimal)
      const points = Number(pick.points)
      const line = market.marketType === 'moneyline' || !Number.isFinite(points) ? null : points
      entries.push(createNormalizedEntry({
        sport: event.sport || 'unknown',
        league: event.competition,
        event_id: String(event.id || market.eventId),
        home_team: home,
        away_team: away,
        market_type: market.marketType,
        outcome_name: name,
        line_value: line,
        sportsbook,
        odds_american: american,
        odds_decimal: Number.isFinite(decimal) ? decimal : null,
        commence_time: event.start || null,
        bookmaker_link: bookmakerLink,
        is_live: true
      }))
    }
  }
  return entries
}

async function readLiveTopics(session, diffusion) {
  const json = diffusion.datatypes.json()
  const result = await session.fetchRequest().withValues(json).fetch(TOPIC_SELECTOR)
  const records = []
  for (const row of result.results()) {
    let value = null
    try {
      value = row.value()?.get?.() ?? null
    } catch {
      value = null
    }
    if (value) records.push({ path: row.path(), value })
  }
  return records
}

export class SportsBettingAdapter extends BaseAdapter {
  constructor(config = {}) {
    super(config)
    this._onOdds = null
    this._leagueKey = null
  }

  get name() { return 'sportsbetting' }
  get bookId() { return this.config.bookId ?? 'sportsbetting' }

  async start(_leagueKey, onOdds) {
    this._onOdds = onOdds
    this._leagueKey = _leagueKey
    this._running = true
  }

  stop() {
    super.stop()
    this._onOdds = null
  }

  async fetchOnce() {
    if (!this._running || !this._onOdds) return
    const sportsbook = this.config.sportsbookName || 'SportsBetting.ag'
    const bookmakerLink = this.config.bookmakerBaseUrl
      ? `${String(this.config.bookmakerBaseUrl).replace(/\/?$/, '')}/sportsbook/live`
      : LIVE_PAGE
    let session = null
    handshakeError = null
    try {
      const diffusion = await ensureClients()
      if (typeof diffusion.log === 'function') diffusion.log('silent')
      const connect = async (proxyUrl) => {
        currentProxyUrl = proxyUrl || null
        handshakeError = null
        try {
          return await diffusion.connect({
            host: this.config.host || HOST,
            port: 443,
            secure: true,
            path: WS_PATH,
            credentials: '',
            reconnect: false,
            connectionTimeout: 20000,
            transports: 'WEBSOCKET'
          })
        } catch (e) {
          if (handshakeError) throw handshakeError
          throw e
        }
      }
      session = typeof globalThis.__olWithProxy === 'function'
        ? await globalThis.__olWithProxy(connect)
        : await connect(null)
      const records = await readLiveTopics(session, diffusion)
      const entries = parseSportsbettingTopics(records, { sportsbook, bookmakerLink })
      this._onOdds(entries, { pollRequests: 1, fromFetchOnce: true })
    } catch (e) {
      const status = errorMeta(handshakeError || e)
      console.warn('[LiveOdds] SportsBetting.ag fetch error:', (handshakeError || e).message)
      if (status.blocked || status.timedOut) {
        this._onOdds([], { pollRequests: 1, fromFetchOnce: true, ...status })
      }
    } finally {
      currentProxyUrl = null
      if (session && typeof session.close === 'function') {
        try { await session.close() } catch { /* session already closed */ }
      }
    }
  }
}
