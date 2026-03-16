import { BaseAdapter } from './base.js'
import { createNormalizedEntry } from '../schema.js'

/** Bovada sport code (ev.sport) -> normalized sport slug. Use event-level so boxing/MMA etc. are not labeled as NBA. */
const SPORT_CODE_TO_SLUG = {
  BASK: 'basketball',
  SOCC: 'soccer',
  TENN: 'tennis',
  HCKY: 'hockey',
  GOLF: 'golf',
  BASE: 'baseball',
  MMA: 'mma',
  CRIC: 'cricket',
  BOXI: 'boxing',
  MOSP: 'motor_sports',
  ESPT: 'esports',
  TABL: 'table_tennis',
  VOLL: 'volleyball',
  RUGU: 'rugby',
  DART: 'darts',
  FOOT: 'football',
  MBOX: 'boxing',
  BOX: 'boxing'
}

function sportFromEvent(ev, pathSportDescription, defaultSport) {
  const code = (ev.sport || ev.sportCode || '').toUpperCase()
  if (code && SPORT_CODE_TO_SLUG[code]) return SPORT_CODE_TO_SLUG[code]
  if (pathSportDescription) return pathSportDescription.toLowerCase().replace(/\s+/g, '_')
  return (defaultSport || 'other').toLowerCase().replace(/\s+/g, '_')
}

/** Map Bovada market description/key to normalized market_type. */
function toMarketType(description, descriptionKey = '') {
  const d = (description || '').toLowerCase()
  const k = (descriptionKey || '').toLowerCase()
  if (/moneyline|head to head|h2h/.test(d) || /2w-12/.test(k)) return 'moneyline'
  if (/spread|handicap|point spread/.test(d) || /hcap|handicap/.test(k)) return 'spread'
  if (/total|over|under|over\/under/.test(d) || /ou|over-under/.test(k)) return 'total'
  return 'other'
}

/** Bovada live sportsbook API: array of path groups, each with events[]. Only events with live === true are included. */
export class BovadaAdapter extends BaseAdapter {
  constructor(config = {}) {
    super(config)
    this._onOdds = null
    this._leagueKey = null
  }

  get name() { return 'bovada' }
  get bookId() { return this.config.bookId ?? 'bovada' }

  async start(leagueKey, onOdds) {
    const url = this.config.pollUrl || process.env.BOVADA_POLL_URL
    if (!url) throw new Error('Bovada poll URL required (BOVADA_POLL_URL or config.pollUrl)')
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
    const url = this.config.pollUrl || process.env.BOVADA_POLL_URL
    const sportsbook = this.config.sportsbookName || 'Bovada'
    const defaultSport = this.config.sportKey || 'basketball'
    const defaultLeague = this.config.leagueTitle || 'NBA'
    const baseUrl = (this.config.bookmakerBaseUrl || 'https://www.bovada.lv').replace(/\/?$/, '')

    try {
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
        Accept: 'application/json',
        'Accept-Language': 'en-US,en;q=0.9'
      }
      const res = await fetch(url, {
        signal: AbortSignal.timeout(15000),
        headers: { ...headers, ...this.config.fetchOptions?.headers }
      })
      const text = await res.text()
      if (!res.ok) {
        console.warn('[LiveOdds] Bovada API', res.status, res.statusText, text.slice(0, 200))
        this._onOdds([], { pollRequests: 1 })
        return
      }
      let data
      try {
        data = text ? JSON.parse(text) : []
      } catch (e) {
        console.warn('[LiveOdds] Bovada API returned non-JSON:', text.slice(0, 200))
        this._onOdds([], { pollRequests: 1 })
        return
      }
      const entries = this.parseResponse(Array.isArray(data) ? data : [data], {
        sportsbook,
        defaultSport,
        defaultLeague,
        baseUrl
      })
      this._onOdds(entries, { pollRequests: 1 })
    } catch (e) {
      console.warn('[LiveOdds] Bovada fetch error:', e.message)
    }
  }

  parseResponse(pathGroups, opts = {}) {
    const { sportsbook, defaultSport, defaultLeague, baseUrl } = opts
    const entries = []
    if (!Array.isArray(pathGroups)) return entries

    for (const group of pathGroups) {
      const pathSegments = group.path || []
      const leaguePath = pathSegments.find((p) => p.type === 'LEAGUE')
      const sportPath = pathSegments.find((p) => p.type === 'SPORT')
      const pathSportDescription = sportPath?.description || null
      const league = leaguePath?.description || defaultLeague

      const events = group.events || []
      for (const ev of events) {
        if (ev.live !== true && ev.live !== 'true') continue

        const sport = sportFromEvent(ev, pathSportDescription, defaultSport)
        const eventId = ev.id
        const competitors = ev.competitors || []
        const home = competitors.find((c) => c.home === true)
        const away = competitors.find((c) => c.home === false)
        const homeTeam = home?.name ?? null
        const awayTeam = away?.name ?? null
        const commenceTime = ev.startTime ?? null
        const eventLink = ev.link ? `${baseUrl.replace(/\/?$/, '')}/sports${ev.link}` : null

        const displayGroups = ev.displayGroups || []
        for (const dg of displayGroups) {
          const markets = dg.markets || []
          for (const market of markets) {
            if (market.period && market.period.live !== true && market.period.live !== 'true') continue
            const marketType = toMarketType(market.description, market.descriptionKey)
            const marketId = market.id

            for (const outcome of market.outcomes || []) {
              const rawAmerican = outcome.price?.american
              if (rawAmerican == null || rawAmerican === '') continue
              const oddsAmerican = Number(String(rawAmerican))
              if (Number.isNaN(oddsAmerican)) continue

              const outcomeName = outcome.description || ''
              let lineValue = null
              const handicap = outcome.price?.handicap
              if (handicap != null && handicap !== '') {
                const h = Number(handicap)
                if (!Number.isNaN(h)) lineValue = h
              }

              const outcomeId = outcome.id
              const bookmakerLink = eventLink && outcomeId
                ? `${eventLink}?coupon=straight|${outcomeId}|`
                : eventLink || null

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
        }
      }
    }

    return entries
  }
}
