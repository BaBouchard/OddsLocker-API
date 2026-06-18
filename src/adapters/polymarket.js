import fs from 'fs'
import path from 'path'
import { BaseAdapter } from './base.js'
import { createNormalizedEntry, normalizeLeague } from '../schema.js'

const DEFAULT_CATALOG_URL = 'https://gamma-api.polymarket.com/events'
const DEFAULT_BOOKS_URL = 'https://clob.polymarket.com/books'
const DEFAULT_MARKET_TYPES = ['moneyline', 'spreads', 'totals']
const BOOK_BATCH_SIZE = 500

const SPORT_SLUG_MAP = {
  mlb: 'baseball',
  nba: 'basketball',
  nhl: 'hockey',
  nfl: 'football',
  ncaab: 'basketball',
  ncaaf: 'football',
  fif: 'soccer',
  ufc: 'mma',
  tennis: 'tennis',
  soccer: 'soccer'
}

/** Parse Gamma/CLOB JSON fields that may be arrays or JSON strings. */
export function parseJsonArrayField(val) {
  if (Array.isArray(val)) return val
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

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

export function getPolymarketMarketTypes(config = {}) {
  const raw = config.marketTypes ?? process.env.POLYMARKET_MARKET_TYPES ?? DEFAULT_MARKET_TYPES.join(',')
  return String(raw)
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

function toMarketType(sportsMarketType) {
  const t = (sportsMarketType || '').toLowerCase()
  if (t === 'moneyline') return 'moneyline'
  if (t === 'spreads' || t === 'spread') return 'spread'
  if (t === 'totals' || t === 'total') return 'total'
  return t || 'other'
}

function extractTeams(event) {
  if (event.resolvedTeams) {
    return {
      home: event.resolvedTeams.home?.label || event.resolvedTeams.home?.name || null,
      away: event.resolvedTeams.away?.label || event.resolvedTeams.away?.name || null
    }
  }
  const teams = Array.isArray(event.teams) ? event.teams : []
  let home = null
  let away = null
  for (const t of teams) {
    if (t.ordering === 'home') home = t.name || null
    if (t.ordering === 'away') away = t.name || null
  }
  if (!home && !away && teams.length >= 2) {
    home = teams[0]?.name || null
    away = teams[1]?.name || null
  }
  return { home, away }
}

function eventSport(event) {
  const code = event.sport?.sport
  if (code && SPORT_SLUG_MAP[code]) return SPORT_SLUG_MAP[code]
  if (code) return String(code).toLowerCase()
  for (const tag of event.tags || []) {
    const slug = (tag.slug || '').toLowerCase()
    if (SPORT_SLUG_MAP[slug]) return SPORT_SLUG_MAP[slug]
    if (['mlb', 'nba', 'nhl', 'nfl', 'ufc', 'tennis', 'soccer'].includes(slug)) {
      return SPORT_SLUG_MAP[slug] || slug
    }
  }
  return 'other'
}

function eventLeague(event) {
  const skip = new Set(['sports', 'games'])
  for (const tag of event.tags || []) {
    const slug = (tag.slug || '').toLowerCase()
    if (slug && !skip.has(slug)) {
      return tag.label || tag.slug
    }
  }
  if (event.seriesSlug) return event.seriesSlug
  if (event.sport?.sport) return String(event.sport.sport).toUpperCase()
  return null
}

function yesOutcomeLabel(market) {
  const title = (market.groupItemTitle || '').trim()
  if (!title) return null
  if (/^draw/i.test(title)) return 'Draw'
  return title
}

function resolveOutcomeName(market, outcomeIndex, outcomes) {
  const raw = outcomes[outcomeIndex]
  if (raw !== 'Yes' && raw !== 'No') return raw || null
  if (raw === 'No') return null
  return yesOutcomeLabel(market) || 'Yes'
}

function normalizeTeamName(name) {
  return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function teamsMatch(a, b) {
  const x = normalizeTeamName(a)
  const y = normalizeTeamName(b)
  if (!x || !y) return false
  return x === y || x.includes(y) || y.includes(x)
}

function parseAnchorSpread(market) {
  const question = market.question || ''
  const m = question.match(/Spread:\s*(.+?)\s*\(([+-]?\d+(?:\.\d+)?)\)/i)
  if (!m) return null
  const line = Number(m[2])
  if (Number.isNaN(line)) return null
  return { anchorTeam: m[1].trim(), line }
}

function parseLineValue(market, marketType) {
  if (market.line != null && market.line !== '') {
    const n = Number(market.line)
    if (!Number.isNaN(n)) return marketType === 'total' ? Math.abs(n) : n
  }
  const title = market.groupItemTitle || market.question || ''
  const ou = title.match(/(?:O\/U|Over\/Under|Total)\s*(-?\d+(?:\.\d+)?)/i)
  if (ou) return Math.abs(Number(ou[1]))
  const spread = title.match(/(-?\d+(?:\.\d+)?)\s*$/)
  if (spread && marketType === 'spread') return Number(spread[1])
  return null
}

/** Spread/total line for a specific outcome (spread sign flips for the non-anchor team). */
export function resolveLineValue(market, marketType, outcomeName) {
  if (marketType === 'spread') {
    const anchor = parseAnchorSpread(market)
    if (anchor) {
      return teamsMatch(outcomeName, anchor.anchorTeam) ? anchor.line : -anchor.line
    }
  }
  return parseLineValue(market, marketType)
}

/** Top-of-book ask: executable buy price + share size at that price. */
export function extractTopAsk(book) {
  if (!book?.asks?.length) return null
  const asks = [...book.asks].sort((a, b) => Number(a.price) - Number(b.price))
  const top = asks[0]
  if (!top?.price) return null
  const price = Number(top.price)
  if (!price || price <= 0 || price >= 1) return null
  const size = top.size != null ? Number(top.size) : null
  const askSize = size != null && !Number.isNaN(size) && size > 0 ? size : null
  return {
    price,
    size: askSize,
    max_stake_usd: askSize != null ? price * askSize : null
  }
}

/** Polymarket: Gamma catalog (live events) + CLOB order books (top ask + size). */
export class PolymarketAdapter extends BaseAdapter {
  constructor(config = {}) {
    super(config)
    this._timer = null
    this._onOdds = null
    this._leagueKey = null
  }

  get name() { return 'polymarket' }
  get bookId() { return this.config.bookId ?? 'polymarket' }
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

  catalogUrl() {
    return (this.config.catalogUrl || process.env.POLYMARKET_CATALOG_URL || DEFAULT_CATALOG_URL).trim()
  }

  booksUrl() {
    const fromEnv = this.config.booksUrl || process.env.POLYMARKET_BOOKS_URL || process.env.POLYMARKET_PRICES_URL
    return (fromEnv || DEFAULT_BOOKS_URL).trim()
  }

  async fetchLiveEvents() {
    const base = this.catalogUrl().split('?')[0].replace(/\/$/, '')
    const pageLimit = Number(this.config.pageLimit || process.env.POLYMARKET_PAGE_LIMIT) || 100
    const maxPages = Number(this.config.maxPages || process.env.POLYMARKET_MAX_PAGES) || 10
    const all = []

    for (let page = 0; page < maxPages; page++) {
      const offset = page * pageLimit
      const url = `${base}?live=true&active=true&closed=false&limit=${pageLimit}&offset=${offset}`
      const res = await fetch(url, {
        signal: AbortSignal.timeout(20000),
        headers: { Accept: 'application/json' }
      })
      const text = await res.text()
      if (!res.ok) {
        throw new Error(`Gamma ${res.status} ${res.statusText}: ${text.slice(0, 200)}`)
      }
      let batch
      try {
        batch = text ? JSON.parse(text) : []
      } catch {
        throw new Error('Gamma returned non-JSON')
      }
      if (!Array.isArray(batch) || batch.length === 0) break
      all.push(...batch)
      if (batch.length < pageLimit) break
    }

    return all
  }

  /** Best ask price + size per token from batched order books. */
  async fetchBestAskByToken(tokenIds) {
    if (tokenIds.length === 0) return {}
    const url = this.booksUrl()
    const askByToken = {}

    for (let i = 0; i < tokenIds.length; i += BOOK_BATCH_SIZE) {
      const chunk = tokenIds.slice(i, i + BOOK_BATCH_SIZE)
      const body = JSON.stringify(chunk.map((token_id) => ({ token_id })))
      const res = await fetch(url, {
        method: 'POST',
        signal: AbortSignal.timeout(30000),
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Origin: 'https://polymarket.com',
          Referer: 'https://polymarket.com/'
        },
        body
      })
      const text = await res.text()
      if (!res.ok) {
        throw new Error(`CLOB books ${res.status}: ${text.slice(0, 200)}`)
      }
      let books
      try {
        books = text ? JSON.parse(text) : []
      } catch {
        throw new Error('CLOB books returned non-JSON')
      }
      if (!Array.isArray(books)) continue
      for (const book of books) {
        const top = extractTopAsk(book)
        if (!top) continue
        const tokenId = book.asset_id ?? book.token_id
        if (tokenId != null) askByToken[String(tokenId)] = top
      }
    }

    return askByToken
  }

  buildEntries(events, askByToken, opts = {}) {
    const { sportsbook, baseUrl } = opts
    const allowedTypes = new Set(getPolymarketMarketTypes(this.config))
    const entries = []
    const seenTokens = new Set()

    for (const event of events) {
      if (event.live !== true || event.closed === true) continue

      const eventId = event.id || event.slug
      if (!eventId) continue

      const { home, away } = extractTeams(event)
      const sport = eventSport(event)
      const league = normalizeLeague(eventLeague(event))
      const commenceTime = event.startTime || event.startDate || null
      const eventLink = event.slug ? `${baseUrl}/event/${event.slug}` : baseUrl

      for (const market of event.markets || []) {
        if (!market || market.active === false || market.closed === true) continue
        if (market.enableOrderBook === false) continue

        const sportsType = (market.sportsMarketType || '').toLowerCase()
        if (!sportsType || !allowedTypes.has(sportsType)) continue

        const marketType = toMarketType(sportsType)
        const outcomes = parseJsonArrayField(market.outcomes)
        const tokenIds = parseJsonArrayField(market.clobTokenIds)
        if (outcomes.length === 0 || tokenIds.length === 0) continue
        if (outcomes.length !== tokenIds.length) continue

        const isYesNo = outcomes.length === 2 && outcomes.includes('Yes') && outcomes.includes('No')

        for (let i = 0; i < outcomes.length; i++) {
          if (isYesNo && outcomes[i] === 'No') continue

          const outcomeName = resolveOutcomeName(market, i, outcomes)
          if (!outcomeName) continue

          const lineValue = resolveLineValue(market, marketType, outcomeName)

          const tokenId = String(tokenIds[i])
          const topAsk = askByToken[tokenId]
          if (!topAsk?.price) continue
          const price = topAsk.price

          const oddsAmerican = sharePriceToAmerican(price)
          if (oddsAmerican == null) continue

          const dedupeKey = `${eventId}|${market.id || market.slug}|${outcomeName}|${lineValue ?? ''}`
          if (seenTokens.has(dedupeKey)) continue
          seenTokens.add(dedupeKey)

          entries.push(createNormalizedEntry({
            sport,
            league,
            event_id: String(eventId),
            home_team: home,
            away_team: away,
            market_type: marketType,
            outcome_name: outcomeName,
            line_value: lineValue,
            sportsbook,
            odds_american: oddsAmerican,
            odds_decimal: sharePriceToDecimal(price),
            share_price: Number(price),
            ask_size: topAsk.size,
            max_stake_usd: topAsk.max_stake_usd,
            commence_time: commenceTime,
            bookmaker_link: eventLink,
            is_live: true
          }))
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

    const sportsbook = this.config.sportsbookName || process.env.POLYMARKET_NAME || 'Polymarket'
    const baseUrl = (this.config.bookmakerBaseUrl || process.env.POLYMARKET_BOOKMAKER_BASE_URL || 'https://polymarket.com').replace(/\/?$/, '')
    const interval = Number(this.config.pollIntervalMs || process.env.POLL_INTERVAL_MS) || 2000
    const shouldDebug = process.env.DEBUG_POLYMARKET === '1' || process.env.DEBUG_POLYMARKET === 'true'

    try {
      const events = await this.fetchLiveEvents()
      const tokenSet = new Set()
      const allowedTypes = new Set(getPolymarketMarketTypes(this.config))

      for (const event of events) {
        if (event.live !== true) continue
        for (const market of event.markets || []) {
          if (!market?.active || market.closed) continue
          const sportsType = (market.sportsMarketType || '').toLowerCase()
          if (!allowedTypes.has(sportsType)) continue
          for (const id of parseJsonArrayField(market.clobTokenIds)) {
            tokenSet.add(String(id))
          }
        }
      }

      const tokenIds = [...tokenSet]
      const askByToken = await this.fetchBestAskByToken(tokenIds)
      const entries = this.buildEntries(events, askByToken, { sportsbook, baseUrl })

      if (shouldDebug && fromFetchOnce) {
        const debugPath = path.join(process.cwd(), 'debug-polymarket-response.json')
        fs.writeFileSync(debugPath, JSON.stringify({
          liveEvents: events.length,
          tokensRequested: tokenIds.length,
          booksReturned: Object.keys(askByToken).length,
          entries: entries.length,
          sampleEvent: events[0] ? { title: events[0].title, slug: events[0].slug, live: events[0].live } : null,
          sampleEntries: entries.slice(0, 5)
        }, null, 2), 'utf8')
        console.warn('[LiveOdds] Polymarket debug: wrote', debugPath)
      }

      if (entries.length === 0) {
        console.warn('[LiveOdds] Polymarket 0 entries (live events:', events.length, ', tokens:', tokenIds.length, ')')
      }

      this._onOdds(entries, { pollRequests: 2, fromFetchOnce: !!fromFetchOnce })
    } catch (e) {
      console.warn('[LiveOdds] Polymarket fetch error:', e.message)
      if (fromFetchOnce && this._onOdds) {
        this._onOdds([], { pollRequests: 2, fromFetchOnce: true })
      }
    }

    if (this._running && this._autoPoll) {
      this._timer = setTimeout(() => this._tick(), interval)
    }
  }
}
