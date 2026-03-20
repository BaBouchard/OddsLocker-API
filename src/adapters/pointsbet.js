import fs from 'fs'
import path from 'path'
import { BaseAdapter } from './base.js'
import { createNormalizedEntry } from '../schema.js'

/** Convert decimal odds to American. */
function decimalToAmerican(decimal) {
  if (decimal == null || Number.isNaN(Number(decimal))) return null
  const d = Number(decimal)
  if (d <= 1) return null
  if (d >= 2) return Math.round((d - 1) * 100)
  return Math.round(-100 / (d - 1))
}

/** Map PointsBet eventName / eventClass to normalized market_type. */
function toMarketType(eventName, eventClass = '') {
  const n = (eventName || '').toLowerCase()
  const c = (eventClass || '').toLowerCase()
  if (/moneyline|head to head|h2h|match result/.test(n) || /moneyline|h2h/.test(c)) return 'moneyline'
  if (/spread|point spread/.test(n) || /spread/.test(c)) return 'spread'
  if (/total|over\/under|over under/.test(n) || /total/.test(c)) return 'total'
  return 'other'
}

/** PointsBet in-play API: one URL per sport, events[].isLive, markets in specialInPlayFixedOddsMarkets / featuredInPlayFixedOddsMarkets. */
export class PointsBetAdapter extends BaseAdapter {
  constructor(config = {}) {
    super(config)
    this._onOdds = null
  }

  get name() { return 'pointsbet' }
  get bookId() { return this.config.bookId ?? 'pointsbet' }

  async start(leagueKey, onOdds) {
    const urls = this.getSportUrls()
    if (urls.length === 0) throw new Error('PointsBet: at least one POINTSBET_*_URL required (e.g. POINTSBET_BASKETBALL_URL)')
    this._onOdds = onOdds
    this._running = true
  }

  stop() {
    super.stop()
    this._onOdds = null
  }

  getSportUrls() {
    const urls = []
    const map = [
      ['basketball', this.config.basketballUrl || process.env.POINTSBET_BASKETBALL_URL],
      ['baseball', this.config.baseballUrl || process.env.POINTSBET_BASEBALL_URL],
      ['soccer', this.config.soccerUrl || process.env.POINTSBET_SOCCER_URL],
      ['football', this.config.footballUrl || process.env.POINTSBET_FOOTBALL_URL],
      ['tennis', this.config.tennisUrl || process.env.POINTSBET_TENNIS_URL]
    ]
    for (const [sport, url] of map) {
      if (url && String(url).trim()) urls.push({ sport, url: String(url).trim() })
    }
    return urls
  }

  async fetchOnce() {
    if (!this._running || !this._onOdds) return
    const sportUrls = this.getSportUrls()
    const sportsbook = this.config.sportsbookName || 'PointsBet'
    const baseUrl = (this.config.bookmakerBaseUrl || 'https://www.pointsbet.com').replace(/\/?$/, '')
    const cookie = this.config.cookie ?? process.env.POINTSBET_COOKIE

    const headers = {
      Accept: 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
      Referer: 'https://on.pointsbet.ca/',
      Origin: 'https://on.pointsbet.ca',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'cross-site',
      ...this.config.fetchOptions?.headers
    }
    if (cookie) headers.Cookie = cookie

    const allEntries = []
    let debugged = false
    for (let i = 0; i < sportUrls.length; i++) {
      const { sport, url } = sportUrls[i]
      if (i > 0) await new Promise((r) => setTimeout(r, 200))
      try {
        const res = await fetch(url, {
          signal: AbortSignal.timeout(15000),
          headers: { ...headers }
        })
        const text = await res.text()
        const shouldDebug = !debugged && (process.env.DEBUG_POINTSBET === '1' || process.env.DEBUG_POINTSBET === 'true')
        if (shouldDebug) {
          debugged = true
          const debugPath = path.join(process.cwd(), 'debug-pointsbet-response.json')
          fs.writeFileSync(debugPath, JSON.stringify({ sport, url, status: res.status, statusText: res.statusText, bodyLength: text.length, body: text.slice(0, 5000) }, null, 2), 'utf8')
          console.warn('[LiveOdds] PointsBet debug: wrote', debugPath)
        }
        if (!res.ok) {
          console.warn('[LiveOdds] PointsBet', sport, res.status, res.statusText, text.slice(0, 150))
          continue
        }
        let data
        try {
          data = text ? JSON.parse(text) : {}
        } catch (e) {
          console.warn('[LiveOdds] PointsBet', sport, 'non-JSON response')
          continue
        }
        const entries = this.parseResponse(data, { sportsbook, sport, baseUrl })
        if (entries.length === 0) {
          const events = data.events || data.data?.events || data.results || []
          const liveCount = Array.isArray(events) ? events.filter((e) => e.isLive === true).length : 0
          console.warn('[LiveOdds] PointsBet', sport, '0 entries (events:', events.length, ', live:', liveCount, ')')
        }
        allEntries.push(...entries)
      } catch (e) {
        console.warn('[LiveOdds] PointsBet', sport, 'fetch error:', e.message)
      }
    }

    this._onOdds(allEntries, { pollRequests: sportUrls.length, fromFetchOnce: true })
  }

  parseResponse(data, opts = {}) {
    const { sportsbook, sport, baseUrl } = opts
    const entries = []
    const events = data.events || data.data?.events || data.results || []
    const sportSlug = (sport || 'other').toLowerCase().replace(/\s+/g, '_')

    for (const ev of events) {
      if (ev.isLive !== true) continue

      const eventId = ev.key || ev.sportEventExternalId
      const homeTeam = ev.homeTeam ?? null
      const awayTeam = ev.awayTeam ?? null
      const league = ev.competitionName ?? null
      const commenceTime = ev.startsAt ? new Date(ev.startsAt).getTime() : null
      const eventLink = eventId ? `${baseUrl}/sports/event/${eventId}` : null

      const marketArrays = [
        ...(ev.specialInPlayFixedOddsMarkets || []),
        ...(ev.featuredInPlayFixedOddsMarkets || [])
      ]

      for (const market of marketArrays) {
        const marketType = toMarketType(market.eventName, market.eventClass)
        const lineValue = market.points != null && market.points !== '' ? Number(market.points) : null

        for (const outcome of market.outcomes || []) {
          const priceDec = outcome.price
          if (priceDec == null) continue
          const oddsAmerican = decimalToAmerican(Number(priceDec))
          if (oddsAmerican == null) continue

          const outcomeName = outcome.name || ''
          let lineVal = lineValue
          if (lineVal == null && outcome.points != null && outcome.points !== '') lineVal = Number(outcome.points)

          entries.push(createNormalizedEntry({
            sport: sportSlug,
            league,
            event_id: eventId,
            home_team: homeTeam,
            away_team: awayTeam,
            market_type: marketType,
            outcome_name: outcomeName,
            line_value: lineVal,
            sportsbook,
            odds_american: oddsAmerican,
            odds_decimal: Number(priceDec),
            commence_time: commenceTime,
            bookmaker_link: eventLink,
            is_live: true
          }))
        }
      }
    }

    return entries
  }
}
