import fs from 'fs'
import path from 'path'
import { BaseAdapter } from './base.js'
import { createNormalizedEntry, normalizeLeague } from '../schema.js'

const DEFAULT_API_BASE = 'https://external-api.kalshi.com/trade-api/v2'
const DEFAULT_SERIES_TICKERS = [
  'KXMLBGAME', 'KXMLBSPREAD', 'KXMLBTOTAL',
  'KXNBAGAME', 'KXNBASPREAD', 'KXNBATOTAL',
  'KXNFLGAME', 'KXNFLSPREAD', 'KXNFLTOTAL',
  'KXNHLGAME', 'KXNHLSPREAD', 'KXNHLTOTAL',
  'KXWNBAGAME',
  'KXUEFAGAME'
]

const SERIES_PREFIX_META = [
  { prefix: 'KXMLB', sport: 'baseball', league: 'MLB' },
  { prefix: 'KXNBA', sport: 'basketball', league: 'NBA' },
  { prefix: 'KXWNBA', sport: 'basketball', league: 'WNBA' },
  { prefix: 'KXNFL', sport: 'football', league: 'NFL' },
  { prefix: 'KXNHL', sport: 'hockey', league: 'NHL' },
  { prefix: 'KXUEFA', sport: 'soccer', league: 'UEFA' },
  { prefix: 'KXATP', sport: 'tennis', league: 'ATP' },
  { prefix: 'KXNCAAM', sport: 'basketball', league: 'NCAAB' },
  { prefix: 'KXNCAAB', sport: 'baseball', league: 'NCAAB' }
]

/** Share price (0–1) → American odds. */
export function sharePriceToAmerican(price) {
  if (price == null || Number.isNaN(Number(price))) return null
  const p = Number(price)
  if (p <= 0 || p >= 1) return null
  const decimal = 1 / p
  if (decimal >= 2) return Math.round((decimal - 1) * 100)
  return Math.round(-100 / (decimal - 1))
}

function sharePriceToDecimal(price) {
  const p = Number(price)
  if (!p || p <= 0 || p >= 1) return null
  return 1 / p
}

export function getKalshiSeriesTickers(config = {}) {
  const raw = config.seriesTickers ?? process.env.KALSHI_SERIES_TICKERS
  if (raw) {
    return String(raw)
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
  }
  return [...DEFAULT_SERIES_TICKERS]
}

export function inferMarketTypeFromSeries(seriesTicker) {
  const t = String(seriesTicker || '').toUpperCase()
  if (t.includes('SPREAD')) return 'spread'
  if (t.includes('TOTAL')) return 'total'
  if (t.includes('GAME') || t.includes('MATCH')) return 'moneyline'
  return 'other'
}

export function seriesSportMeta(seriesTicker) {
  const t = String(seriesTicker || '').toUpperCase()
  for (const row of SERIES_PREFIX_META) {
    if (t.startsWith(row.prefix)) return { sport: row.sport, league: row.league }
  }
  return { sport: 'other', league: 'Other' }
}

export function parseEventTeams(title) {
  if (!title || typeof title !== 'string') return { away: null, home: null }
  const sep = ' vs '
  if (!title.includes(sep)) return { away: title.trim(), home: null }
  const [away, home] = title.split(sep).map((s) => s.trim())
  return { away: away || null, home: home || null }
}

/** Best ask to buy Yes (price + contracts available at ask). */
export function extractTopYesAsk(market) {
  const price = Number(market?.yes_ask_dollars)
  const size = market?.yes_ask_size_fp != null ? Number(market.yes_ask_size_fp) : null
  if (!price || price <= 0 || price >= 1) return null
  const askSize = size != null && !Number.isNaN(size) && size > 0 ? size : null
  return {
    price,
    size: askSize,
    max_stake_usd: askSize != null ? price * askSize : null
  }
}

/** Best ask to buy No — Kalshi lists no_ask; reciprocal size at that level ≈ yes_bid_size. */
export function extractTopNoAsk(market) {
  const price = Number(market?.no_ask_dollars)
  const size = market?.yes_bid_size_fp != null ? Number(market.yes_bid_size_fp) : null
  if (!price || price <= 0 || price >= 1) return null
  const askSize = size != null && !Number.isNaN(size) && size > 0 ? size : null
  return {
    price,
    size: askSize,
    max_stake_usd: askSize != null ? price * askSize : null
  }
}

function parseSpreadLine(market) {
  const strike = market?.floor_strike
  if (strike == null || Number.isNaN(Number(strike))) return null
  const n = Number(strike)
  const sub = (market.yes_sub_title || market.title || '').toLowerCase()
  if (/wins by over|win by over|wins by more than/.test(sub)) return -Math.abs(n)
  return n
}

function parseTotalLine(market) {
  const strike = market?.floor_strike
  if (strike == null || Number.isNaN(Number(strike))) return null
  return Math.abs(Number(strike))
}

function spreadOutcomeName(market) {
  const sub = (market?.yes_sub_title || '').trim()
  if (sub) return sub
  return (market?.title || 'Yes').trim()
}

function isMarketActive(market) {
  return market && String(market.status || '').toLowerCase() === 'active'
}

function gameIsLive(market, now = new Date()) {
  const occ = market?.occurrence_datetime
  if (!occ) return false
  const start = new Date(occ)
  if (Number.isNaN(start.getTime())) return false
  const hoursFromStart = (now.getTime() - start.getTime()) / 3600000
  return hoursFromStart >= -0.5 && hoursFromStart <= 8
}

function pushEntry(entries, seen, fields) {
  const dedupeKey = [
    fields.event_id,
    fields.market_type,
    fields.outcome_name,
    fields.line_value ?? ''
  ].join('|')
  if (seen.has(dedupeKey)) return
  seen.add(dedupeKey)
  entries.push(createNormalizedEntry(fields))
}

/** Kalshi Trade API v2 — sports events with nested markets (yes/no ask + size). */
export class KalshiAdapter extends BaseAdapter {
  constructor(config = {}) {
    super(config)
    this._timer = null
    this._onOdds = null
    this._leagueKey = null
  }

  get name() { return 'kalshi' }
  get bookId() { return this.config.bookId ?? 'kalshi' }
  get autoPoll() { return this._autoPoll !== false }

  setAutoPoll(value) {
    this._autoPoll = !!value
    if (!this._autoPoll && this._timer) {
      clearTimeout(this._timer)
      this._timer = null
    }
    if (this._autoPoll && this._running && this._onOdds) {
      const interval = Number(this.config.pollIntervalMs || process.env.POLL_INTERVAL_MS) || 2000
      this._timer = setTimeout(() => this._tick(), interval)
    }
  }

  async start(leagueKey, onOdds) {
    this._onOdds = onOdds
    this._leagueKey = leagueKey
    this._running = true
    this._autoPoll = false
    this._tick()
  }

  stop() {
    super.stop()
    if (this._timer) {
      clearTimeout(this._timer)
      this._timer = null
    }
    this._onOdds = null
  }

  async fetchOnce() {
    if (!this._running || !this._onOdds) return
    await this._tick(true)
  }

  apiBase() {
    return (this.config.apiBaseUrl || process.env.KALSHI_API_BASE_URL || DEFAULT_API_BASE).replace(/\/$/, '')
  }

  async fetchSeriesEvents(seriesTicker) {
    const base = this.apiBase()
    const pageLimit = Number(this.config.pageLimit || process.env.KALSHI_PAGE_LIMIT) || 200
    const maxPages = Number(this.config.maxPages || process.env.KALSHI_MAX_PAGES) || 10
    const all = []
    let cursor = null

    for (let page = 0; page < maxPages; page++) {
      const params = new URLSearchParams({
        status: 'open',
        series_ticker: seriesTicker,
        with_nested_markets: 'true',
        limit: String(pageLimit)
      })
      if (cursor) params.set('cursor', cursor)
      const url = `${base}/events?${params}`
      const res = await fetch(url, {
        signal: AbortSignal.timeout(20000),
        headers: { Accept: 'application/json' }
      })
      const text = await res.text()
      if (!res.ok) {
        throw new Error(`Kalshi events ${res.status}: ${text.slice(0, 200)}`)
      }
      let data
      try {
        data = text ? JSON.parse(text) : {}
      } catch {
        throw new Error('Kalshi events returned non-JSON')
      }
      const batch = Array.isArray(data.events) ? data.events : []
      all.push(...batch)
      cursor = data.cursor || null
      if (!cursor || batch.length < pageLimit) break
    }

    return all
  }

  buildEntries(events, seriesTicker, opts = {}) {
    const { sportsbook, baseUrl } = opts
    const marketType = inferMarketTypeFromSeries(seriesTicker)
    const { sport: defaultSport, league: defaultLeague } = seriesSportMeta(seriesTicker)
    const entries = []
    const seen = new Set()
    const now = new Date()

    for (const event of events) {
      const eventId = event.event_ticker || event.ticker
      if (!eventId) continue

      const { away, home } = parseEventTeams(event.title)
      const meta = event.product_metadata || {}
      const sport = defaultSport
      const league = normalizeLeague(defaultLeague || meta.competition)
      const commenceTime = event.markets?.[0]?.occurrence_datetime || null
      const eventLink = `${baseUrl}/events/${encodeURIComponent(String(eventId).toLowerCase())}`

      for (const market of event.markets || []) {
        if (!isMarketActive(market)) continue

        const yesAsk = extractTopYesAsk(market)
        if (!yesAsk) continue

        const oddsAmerican = sharePriceToAmerican(yesAsk.price)
        if (oddsAmerican == null) continue

        const isLive = gameIsLive(market, now)
        const baseFields = {
          sport,
          league,
          event_id: String(eventId),
          home_team: home,
          away_team: away,
          sportsbook,
          commence_time: commenceTime,
          bookmaker_link: eventLink,
          is_live: isLive
        }

        if (marketType === 'moneyline') {
          pushEntry(entries, seen, {
            ...baseFields,
            market_type: 'moneyline',
            outcome_name: (market.yes_sub_title || market.title || 'Yes').trim(),
            line_value: null,
            odds_american: oddsAmerican,
            odds_decimal: sharePriceToDecimal(yesAsk.price),
            share_price: yesAsk.price,
            ask_size: yesAsk.size,
            max_stake_usd: yesAsk.max_stake_usd
          })
          continue
        }

        if (marketType === 'spread') {
          pushEntry(entries, seen, {
            ...baseFields,
            market_type: 'spread',
            outcome_name: spreadOutcomeName(market),
            line_value: parseSpreadLine(market),
            odds_american: oddsAmerican,
            odds_decimal: sharePriceToDecimal(yesAsk.price),
            share_price: yesAsk.price,
            ask_size: yesAsk.size,
            max_stake_usd: yesAsk.max_stake_usd
          })
          continue
        }

        if (marketType === 'total') {
          const line = parseTotalLine(market)
          pushEntry(entries, seen, {
            ...baseFields,
            market_type: 'total',
            outcome_name: 'Over',
            line_value: line,
            odds_american: oddsAmerican,
            odds_decimal: sharePriceToDecimal(yesAsk.price),
            share_price: yesAsk.price,
            ask_size: yesAsk.size,
            max_stake_usd: yesAsk.max_stake_usd
          })

          const noAsk = extractTopNoAsk(market)
          if (!noAsk) continue
          const underAmerican = sharePriceToAmerican(noAsk.price)
          if (underAmerican == null) continue
          pushEntry(entries, seen, {
            ...baseFields,
            market_type: 'total',
            outcome_name: 'Under',
            line_value: line,
            odds_american: underAmerican,
            odds_decimal: sharePriceToDecimal(noAsk.price),
            share_price: noAsk.price,
            ask_size: noAsk.size,
            max_stake_usd: noAsk.max_stake_usd
          })
        }
      }
    }

    return entries
  }

  async _tick(fromFetchOnce = false) {
    if (!this._running) return
    if (this._timer) {
      clearTimeout(this._timer)
      this._timer = null
    }

    const sportsbook = this.config.sportsbookName || process.env.KALSHI_NAME || 'Kalshi'
    const baseUrl = (this.config.bookmakerBaseUrl || process.env.KALSHI_BOOKMAKER_BASE_URL || 'https://kalshi.com').replace(/\/?$/, '')
    const interval = Number(this.config.pollIntervalMs || process.env.POLL_INTERVAL_MS) || 2000
    const shouldDebug = process.env.DEBUG_KALSHI === '1' || process.env.DEBUG_KALSHI === 'true'
    const seriesTickers = getKalshiSeriesTickers(this.config)

    try {
      const allEntries = []
      let pollRequests = 0

      for (let i = 0; i < seriesTickers.length; i++) {
        const seriesTicker = seriesTickers[i]
        if (i > 0) {
          await new Promise((r) => setTimeout(r, Number(this.config.seriesDelayMs || process.env.KALSHI_SERIES_DELAY_MS) || 300))
        }
        const events = await this.fetchSeriesEvents(seriesTicker)
        pollRequests++
        allEntries.push(...this.buildEntries(events, seriesTicker, { sportsbook, baseUrl }))
      }

      if (shouldDebug && fromFetchOnce) {
        const debugPath = path.join(process.cwd(), 'debug-kalshi-response.json')
        fs.writeFileSync(debugPath, JSON.stringify({
          seriesPolled: seriesTickers.length,
          entries: allEntries.length,
          sampleEntries: allEntries.slice(0, 8)
        }, null, 2), 'utf8')
        console.warn('[LiveOdds] Kalshi debug: wrote', debugPath)
      }

      if (allEntries.length === 0) {
        console.warn('[LiveOdds] Kalshi 0 entries (series:', seriesTickers.length, ')')
      }

      this._onOdds(allEntries, { pollRequests, fromFetchOnce: !!fromFetchOnce })
    } catch (e) {
      console.warn('[LiveOdds] Kalshi fetch error:', e.message)
      if (fromFetchOnce && this._onOdds) {
        this._onOdds([], { pollRequests: 1, fromFetchOnce: true })
      }
    }

    if (this._running && this._autoPoll) {
      this._timer = setTimeout(() => this._tick(), interval)
    }
  }
}
