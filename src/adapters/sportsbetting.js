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
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15'

const EVENT_ROOT = /^rdd\/ui\/bol\/event\/live\/.+\/(\d+)$/
const MAIN_MARKET = /^rdd\/ui\/bol\/event\/live\/.+\/(\d+)\/markets\/\d+-(MONEYLINE|SPREAD|TOTAL)-\d+$/
const MARKET_TYPE = { MONEYLINE: 'moneyline', SPREAD: 'spread', TOTAL: 'total' }

let diffusionLib = null
let socketAgent = null
let handshakeError = null

function enginePackageJson() {
  if (process.env.SCRAPER_SRC_ROOT) {
    return path.resolve(process.env.SCRAPER_SRC_ROOT, '..', 'odds-engine', 'package.json')
  }
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../odds-engine/package.json')
}

function requireEngine(name) {
  return createRequire(enginePackageJson())(name)
}

class DiffusionSocket {
  constructor(url) {
    this.binaryType = 'arraybuffer'
    this.onopen = null
    this.onmessage = null
    this.onerror = null
    this.onclose = null
    const WS = requireEngine('ws')
    const ws = new WS(url, {
      agent: socketAgent || undefined,
      headers: { Origin: ORIGIN, 'User-Agent': UA },
      handshakeTimeout: 20000
    })
    this._ws = ws
    ws.on('unexpected-response', (_req, res) => {
      const code = Number(res.statusCode) || 0
      const server = String(res.headers?.server || '')
      handshakeError = new Error(
        code === 403 || /cloudflare/i.test(server) ? `HTTP ${code || 403} Cloudflare` : `HTTP ${code}`
      )
      try { ws.terminate() } catch { /* already closed */ }
    })
    ws.on('open', () => this.onopen?.())
    ws.on('message', (data) => {
      let payload = data
      if (this.binaryType === 'arraybuffer' && Buffer.isBuffer(data)) {
        payload = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
      }
      this.onmessage?.({ data: payload })
    })
    ws.on('error', (err) => this.onerror?.(err))
    ws.on('close', (code, reason) => this.onclose?.({ code, reason: String(reason || '') }))
  }

  send(data) { this._ws.send(data) }
  close() { try { this._ws.close() } catch { /* already closed */ } }
}

function loadDiffusion() {
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

async function proxyAgent(proxyUrl) {
  if (!proxyUrl) return null
  const mod = await import(pathToFileURL(path.join(path.dirname(enginePackageJson()), 'node_modules/https-proxy-agent/dist/index.js')).href)
  const Agent = mod.HttpsProxyAgent
  return new Agent(proxyUrl)
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
      const diffusion = loadDiffusion()
      const connect = async (proxyUrl) => {
        socketAgent = await proxyAgent(proxyUrl)
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
      socketAgent = null
      if (session && typeof session.close === 'function') {
        try { await session.close() } catch { /* session already closed */ }
      }
    }
  }
}
