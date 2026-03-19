import fs from 'fs'
import path from 'path'
import { BaseAdapter } from './base.js'
import { createNormalizedEntry } from '../schema.js'

/** Map FanDuel marketType / marketName to normalized market_type slug. */
function toMarketType(marketType, marketName) {
  const t = (marketType || '').toUpperCase()
  const n = (marketName || '').toLowerCase()
  if (/MONEY_LINE|MONEYLINE|H2H/.test(t) || /money line|moneyline|match result/.test(n)) return 'moneyline'
  if (/HANDICAP|SPREAD|MATCH_HANDICAP/.test(t) || /spread|handicap/.test(n)) return 'spread'
  if (/TOTAL|OVER_UNDER|TOTAL_POINTS/.test(t) || /total|over|under/.test(n)) return 'total'
  return t ? t.toLowerCase().replace(/_/g, '_') : 'other'
}

/** Parse event name "Away @ Home" or "Away v Home" into [away, home]. */
function parseEventName(name) {
  if (!name || typeof name !== 'string') return { away: null, home: null }
  const sep = name.includes(' @ ') ? ' @ ' : name.includes(' v ') ? ' v ' : null
  if (!sep) return { away: name.trim(), home: null }
  const [away, home] = name.split(sep).map((s) => s.trim())
  return { away: away || null, home: home || null }
}

/** Recursively collect market ids from layout (tabs/sections/markets or marketIds). */
function collectMarketIdsFromLayout(node, out = new Set(), depth = 0) {
  if (!node || typeof node !== 'object' || depth > 15) return out
  if (Array.isArray(node)) {
    node.forEach((n) => collectMarketIdsFromLayout(n, out, depth + 1))
    return out
  }
  if (Array.isArray(node.markets)) node.markets.forEach((id) => id != null && out.add(String(id)))
  if (Array.isArray(node.marketIds)) node.marketIds.forEach((id) => id != null && out.add(String(id)))
  if (node.marketId != null) out.add(String(node.marketId))
  for (const value of Object.values(node)) {
    if (value && typeof value === 'object' && value !== node) collectMarketIdsFromLayout(value, out, depth + 1)
  }
  return out
}

/** FanDuel in-play API: layout + attachments (events, competitions, markets). */
export class FanDuelAdapter extends BaseAdapter {
  constructor(config = {}) {
    super(config)
    this._onOdds = null
    this._leagueKey = null
  }

  get name() { return 'fanduel' }
  get bookId() { return this.config.bookId ?? 'fanduel' }

  async start(leagueKey, onOdds) {
    const url = this.config.pollUrl || process.env.FANDUEL_POLL_URL
    if (!url) throw new Error('FanDuel poll URL required (FANDUEL_POLL_URL or config.pollUrl)')
    this._onOdds = onOdds
    this._leagueKey = leagueKey
    this._running = true
  }

  stop() {
    super.stop()
    this._onOdds = null
  }

  async fetchOnce() {
    if (!this._running || !this._onOdds) return
    const url = this.config.pollUrl || process.env.FANDUEL_POLL_URL
    const sportsbook = this.config.sportsbookName || 'FanDuel'
    const defaultSport = this.config.sportKey || 'basketball'
    const defaultLeague = this.config.leagueTitle || 'NBA'

    try {
      const region = this.config.region ?? process.env.FANDUEL_REGION ?? 'US'
      const origin = this.config.origin ?? process.env.FANDUEL_ORIGIN ?? 'https://sportsbook.fanduel.com'
      const cookie = this.config.cookie ?? process.env.FANDUEL_COOKIE
      const pxContext = this.config.pxContext ?? process.env.FANDUEL_PX_CONTEXT
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
        Accept: 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'X-Sportsbook-Region': region,
        Referer: origin + '/',
        Origin: origin,
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-site',
        ...(this.config.fetchOptions?.headers || {})
      }
      if (pxContext) headers['x-px-context'] = pxContext
      if (cookie) headers.Cookie = cookie
      const res = await fetch(url, {
        signal: AbortSignal.timeout(15000),
        headers,
        ...this.config.fetchOptions
      })
      const text = await res.text()
      const debugPath = path.join(process.cwd(), 'debug-fanduel-response.json')
      const shouldDebug = process.env.DEBUG_FANDUEL === '1' || process.env.DEBUG_FANDUEL === 'true'
      if (!res.ok) {
        console.warn('[LiveOdds] FanDuel API', res.status, res.statusText, text.slice(0, 200))
        if (shouldDebug) fs.writeFileSync(debugPath, JSON.stringify({ status: res.status, statusText: res.statusText, body: text }, null, 2), 'utf8')
        this._onOdds([], { pollRequests: 1 })
        return
      }
      let data
      try {
        data = text ? JSON.parse(text) : {}
      } catch (e) {
        console.warn('[LiveOdds] FanDuel API returned non-JSON:', text.slice(0, 200))
        if (shouldDebug) fs.writeFileSync(debugPath, text, 'utf8')
        this._onOdds([], { pollRequests: 1 })
        return
      }
      if (shouldDebug) fs.writeFileSync(debugPath, JSON.stringify(data, null, 2), 'utf8')
      const entries = this.parseResponse(data, { sportsbook, defaultSport, defaultLeague })
      if (entries.length === 0 && data) {
        const att = data.attachments || {}
        const firstEvent = att.events ? Object.values(att.events)[0] : null
        const firstMarket = att.markets ? Object.values(att.markets)[0] : null
        const firstRunner = firstMarket && Array.isArray(firstMarket.runners) ? firstMarket.runners[0] : null
        console.warn('[LiveOdds] FanDuel parsed 0 entries. Top keys:', Object.keys(data).join(', '))
        console.warn('[LiveOdds] FanDuel attachment keys:', Object.keys(att).join(', '))
        if (firstEvent) console.warn('[LiveOdds] FanDuel sample event keys:', Object.keys(firstEvent).join(', '))
        if (firstMarket) console.warn('[LiveOdds] FanDuel sample market keys:', Object.keys(firstMarket).join(', '))
        if (firstRunner) console.warn('[LiveOdds] FanDuel sample runner keys:', Object.keys(firstRunner).join(', '))
      }
      this._onOdds(entries, { pollRequests: 1 })
    } catch (e) {
      console.warn('[LiveOdds] FanDuel fetch error:', e.message)
      if (process.env.DEBUG_FANDUEL === '1' || process.env.DEBUG_FANDUEL === 'true') {
        console.warn('[LiveOdds] FanDuel: set FANDUEL_REGION in .env (e.g. US-NY) if you see 400 Bad Request')
      }
    }
  }

  parseResponse(data, opts = {}) {
    const { sportsbook, defaultSport, defaultLeague } = opts
    const entries = []
    if (!data || typeof data !== 'object') return entries

    const attachments = data.attachments || {}
    let eventsMap = attachments.events || attachments.event
    if (eventsMap && !Array.isArray(eventsMap) && typeof eventsMap === 'object' && !eventsMap.eventId && !eventsMap.name) {
      // keyed by id
    } else if (Array.isArray(eventsMap)) {
      const byId = {}
      eventsMap.forEach((e) => { const id = e.eventId ?? e.event_id ?? e.id; if (id != null) byId[String(id)] = e })
      eventsMap = byId
    } else if (eventsMap && typeof eventsMap === 'object' && (eventsMap.eventId || eventsMap.event_id)) {
      eventsMap = { [String(eventsMap.eventId ?? eventsMap.event_id)]: eventsMap }
    } else if (!eventsMap || typeof eventsMap !== 'object') {
      eventsMap = {}
    }
    const competitions = attachments.competitions || {}
    const marketsObj = attachments.markets || {}
    // Build list: either from layout (market ids) + attachments.markets, or from all keys of attachments.markets
    let marketsList = []
    const layout = data.layout
    if (layout) {
      const ids = collectMarketIdsFromLayout(layout)
      for (const id of ids) {
        const m = marketsObj[id]
        if (m) marketsList.push({ ...m, marketId: id })
      }
    }
    if (marketsList.length === 0 && typeof marketsObj === 'object' && !Array.isArray(marketsObj)) {
      marketsList = Object.entries(marketsObj).map(([id, m]) => ({ ...m, marketId: id }))
    }

    for (const market of marketsList) {
      if (!market) continue
      const eventIdRaw = market.eventId ?? market.event_id
      if (eventIdRaw == null) continue
      const eventKey = String(eventIdRaw)
      const ev = eventsMap[eventIdRaw] ?? eventsMap[eventKey]
      if (!ev) continue

      const eventId = ev.eventId ?? ev.event_id ?? eventIdRaw
      const compId = ev.competitionId ?? ev.competition_id ?? market.competitionId ?? market.competition_id
      const comp = competitions[compId] || competitions[String(compId)] || {}
      const league = comp.name || comp.displayName || defaultLeague
      const sport = defaultSport

      const eventName = ev.name ?? ev.eventName ?? ''
      const { away: awayTeam, home: homeTeam } = parseEventName(eventName)
      const commenceTime = ev.openDate ?? ev.startTime ?? ev.start ?? null

      const marketType = toMarketType(market.marketType, market.marketName)
      const runners = Array.isArray(market.runners) ? market.runners : []

      const marketIdRaw = market.marketId ?? market.market_id
      const baseUrl = (this.config.bookmakerBaseUrl || 'https://sportsbook.fanduel.com').replace(/\/?$/, '')

      for (const runner of runners) {
        const outcomeName = runner.runnerName ?? runner.name
        const rawOdds =
          runner.winRunnerOdds?.americanDisplayOdds?.americanOdds ??
          runner.winRunnerOdds?.americanOdds ??
          runner.americanOdds ??
          runner.prices?.american ??
          runner.currentOdds?.americanOdds ??
          runner.odds
        const oddsAmerican = rawOdds != null ? Number(rawOdds) : null
        if (!outcomeName || oddsAmerican == null) continue

        let lineValue = null
        const handicap = runner.handicap ?? runner.line
        if (handicap != null && handicap !== '') {
          const h = Number(handicap)
          if (!Number.isNaN(h)) lineValue = h
        }

        const selectionId = runner.selectionId ?? runner.selection_id ?? runner.id
        const bookmakerLink =
          marketIdRaw != null && selectionId != null
            ? `${baseUrl}/addToBetslip?marketId=${encodeURIComponent(String(marketIdRaw))}&selectionId=${encodeURIComponent(String(selectionId))}`
            : null

        entries.push(createNormalizedEntry({
          sport,
          league,
          event_id: eventId,
          home_team: homeTeam,
          away_team: awayTeam,
          market_type: marketType,
          outcome_name: outcomeName,
          line_value: lineValue,
          sportsbook,
          odds_american: oddsAmerican,
          commence_time: commenceTime,
          bookmaker_link: bookmakerLink,
          is_live: true
        }))
      }
    }

    return entries
  }
}
