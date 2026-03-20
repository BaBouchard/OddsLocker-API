import { BaseAdapter } from './base.js'
import { createNormalizedEntry } from '../schema.js'

/** Map BetMGM market name/label to normalized market_type. We scrape every market; map known ones for consistency. */
function toMarketType(name, label = '') {
  const n = (name || '').toLowerCase()
  const l = (label || '').toLowerCase()
  const t = n + ' ' + l
  if (/moneyline|match result|head to head|h2h|winner|to win/.test(t)) return 'moneyline'
  if (/spread|handicap|point spread|alternate spread/.test(t)) return 'spread'
  if (/total|over\/under|over under|ou|alternate total/.test(t)) return 'total'
  return 'other'
}

/** Normalize sport name to slug. */
function sportToSlug(sportName) {
  if (!sportName || typeof sportName !== 'string') return 'other'
  const s = sportName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
  return s || 'other'
}

/**
 * BetMGM live highlights API: sportsOffer[] with fixtures[].
 * Two shapes: optionMarkets (options[].price.americanOdds) and games (results[].americanOdds).
 * We emit every odd (no filter to main three).
 */
export class BetMGMAdapter extends BaseAdapter {
  constructor(config = {}) {
    super(config)
    this._timer = null
    this._onOdds = null
  }

  get name() { return 'betmgm' }
  get bookId() { return this.config.bookId ?? 'betmgm' }
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
    const url = this.config.pollUrl || process.env.BETMGM_POLL_URL
    if (!url) throw new Error('BetMGM poll URL required (BETMGM_POLL_URL or config.pollUrl)')
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

  async _tick(fromFetchOnce = false) {
    if (!this._running) return
    if (this._timer) { clearTimeout(this._timer); this._timer = null }

    const url = this.config.pollUrl || process.env.BETMGM_POLL_URL
    const sportsbook = this.config.sportsbookName || 'BetMGM'
    const baseUrl = (this.config.bookmakerBaseUrl || 'https://www.ny.betmgm.com').replace(/\/?$/, '')
    const interval = Number(this.config.pollIntervalMs || process.env.POLL_INTERVAL_MS) || 2000

    try {
      const cookie = this.config.cookie ?? process.env.BETMGM_COOKIE
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
        Accept: 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        Referer: baseUrl + '/',
        Origin: baseUrl
      }
      if (cookie) headers.Cookie = cookie
      const res = await fetch(url, {
        signal: AbortSignal.timeout(15000),
        headers: { ...headers, ...this.config.fetchOptions?.headers }
      })
      const text = await res.text()
      if (!res.ok) {
        console.warn('[LiveOdds] BetMGM API', res.status, res.statusText, text.slice(0, 200))
        if (fromFetchOnce) this._onOdds([], { pollRequests: 1 })
        if (this._running && this._autoPoll) this._timer = setTimeout(() => this._tick(), interval)
        return
      }
      let data
      try {
        data = text ? JSON.parse(text) : null
      } catch (e) {
        console.warn('[LiveOdds] BetMGM API returned non-JSON:', text.slice(0, 200))
        if (fromFetchOnce) this._onOdds([], { pollRequests: 1 })
        if (this._running && this._autoPoll) this._timer = setTimeout(() => this._tick(), interval)
        return
      }

      const entries = this.parseResponse(data, { sportsbook, baseUrl })
      if (fromFetchOnce || entries.length > 0) {
        this._onOdds(entries, { pollRequests: 1 })
      }
    } catch (e) {
      console.warn('[LiveOdds] BetMGM fetch error:', e.message)
      if (fromFetchOnce) this._onOdds([], { pollRequests: 1 })
    }

    if (this._running && this._autoPoll) this._timer = setTimeout(() => this._tick(), interval)
  }

  parseResponse(data, opts = {}) {
    const { sportsbook, baseUrl } = opts
    const entries = []
    if (!data || typeof data !== 'object') return entries

    const sportsOffer = data.sportsOffer || data.sportsOffers || []
    if (!Array.isArray(sportsOffer)) return entries

    for (const offer of sportsOffer) {
      const sportName = offer.sport?.name?.value ?? offer.sport?.name ?? ''
      const sport = sportToSlug(sportName)
      const fixtures = offer.fixtures || []
      for (const fix of fixtures) {
        const stage = fix.stage || fix.fixture?.stage
        if (stage !== 'Live') continue

        const fixture = fix.fixture || fix
        const eventId = fixture.id ?? fix.id
        const eventName = fixture.name?.value ?? fixture.name ?? ''
        const league = fixture.competition?.name?.value ?? fixture.competition?.name ?? ''
        const participants = fix.participants || fixture.participants || {}
        let homeTeamName = null
        let awayTeamName = null
        if (Array.isArray(participants)) {
          const home = participants.find((p) => /home|team1/i.test(p.participantType || p.type || ''))
          const away = participants.find((p) => /away|team2/i.test(p.participantType || p.type || ''))
          homeTeamName = home?.name?.value ?? home?.name ?? home?.value ?? null
          awayTeamName = away?.name?.value ?? away?.name ?? away?.value ?? null
        } else {
          const homeTeam = participants.HomeTeam ?? participants.home ?? null
          const awayTeam = participants.AwayTeam ?? participants.away ?? null
          homeTeamName = typeof homeTeam === 'string' ? homeTeam : (homeTeam?.name ?? homeTeam?.value ?? null)
          awayTeamName = typeof awayTeam === 'string' ? awayTeam : (awayTeam?.name ?? awayTeam?.value ?? null)
        }
        const commenceTime = fixture.startDate ?? fix.startDate ?? null
        const eventLink = baseUrl && eventId ? `${baseUrl}/sports/live/${eventId}` : null

        // Shape 1: optionMarkets (options with price.americanOdds)
        const optionMarkets = fix.optionMarkets || fixture.optionMarkets || []
        for (const market of optionMarkets) {
          const marketName = market.name?.value ?? market.name ?? ''
          const marketLabel = market.label?.value ?? market.label ?? ''
          const marketType = toMarketType(marketName, marketLabel)
          const options = market.options || []
          for (const opt of options) {
            const price = opt.price || {}
            let american = price.americanOdds ?? price.american
            if (american == null || american === '') continue
            const oddsAmerican = Number(String(american))
            if (Number.isNaN(oddsAmerican)) continue
            const outcomeName = opt.name?.value ?? opt.name ?? opt.label?.value ?? opt.label ?? ''
            let lineValue = null
            const handicap = price.handicap ?? opt.handicap
            if (handicap != null && handicap !== '') {
              const h = Number(handicap)
              if (!Number.isNaN(h)) lineValue = h
            }
            const outcomeId = opt.id ?? null
            const bookmakerLink = eventLink && outcomeId ? `${eventLink}?selection=${outcomeId}` : eventLink

            entries.push(createNormalizedEntry({
              sport,
              league,
              event_id: eventId,
              home_team: homeTeamName,
              away_team: awayTeamName,
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

        // Shape 2: games (results with americanOdds)
        const games = fix.games || fixture.games || []
        for (const game of games) {
          const results = game.results || []
          const marketName = game.name?.value ?? game.name ?? ''
          const marketLabel = game.label?.value ?? game.label ?? ''
          const marketType = toMarketType(marketName, marketLabel)
          for (const r of results) {
            const american = r.americanOdds ?? r.american
            if (american == null || american === '') continue
            const oddsAmerican = Number(String(american))
            if (Number.isNaN(oddsAmerican)) continue
            const outcomeName = r.name?.value ?? r.name ?? r.label?.value ?? r.label ?? ''
            let lineValue = null
            const handicap = r.handicap
            if (handicap != null && handicap !== '') {
              const h = Number(handicap)
              if (!Number.isNaN(h)) lineValue = h
            }
            const outcomeId = r.id ?? null
            const bookmakerLink = eventLink && outcomeId ? `${eventLink}?selection=${outcomeId}` : eventLink

            entries.push(createNormalizedEntry({
              sport,
              league,
              event_id: eventId,
              home_team: homeTeamName,
              away_team: awayTeamName,
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
      }
    }

    return entries
  }
}
