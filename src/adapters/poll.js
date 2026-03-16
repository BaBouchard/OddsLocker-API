import { BaseAdapter } from './base.js'
import { createNormalizedEntry } from '../schema.js'

const EXCLUDED_SPORTS = ['golf', 'darts']

function isExcludedSport(ev) {
  if (!ev) return false
  const sport = (ev.sport || '').toLowerCase()
  const group = (ev.group || '').toLowerCase()
  return EXCLUDED_SPORTS.some((s) => sport.includes(s) || group.includes(s))
}

/** Turn criterion label into a stable market_type slug (e.g. "Point spread" -> "point_spread"). */
function marketTypeSlug(critLabel) {
  if (!critLabel || typeof critLabel !== 'string') return 'other'
  return critLabel
    .toLowerCase()
    .replace(/\s*-\s*/g, '_')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '') || 'other'
}

/** Build BetRivers deep link: event page or coupon (betslip with selection). */
function buildBookmakerLink(baseUrl, eventId, outcomeId) {
  const base = (baseUrl || 'https://ny.betrivers.com/?page=sportsbook#event/').replace(/\/?$/, '')
  const eventLink = `${base}/${eventId}`
  if (outcomeId != null && outcomeId !== '') {
    return `${eventLink}?coupon=straight|${outcomeId}|`
  }
  return eventLink
}

export class PollAdapter extends BaseAdapter {
  constructor(config = {}) {
    super(config)
    this._timer = null
    this._onOdds = null
  }
  get name() { return 'poll' }
  get bookId() { return this.config.bookId ?? this.config.sportsbookName ?? 'book1' }
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
  async fetchOnce() {
    if (!this._running || !this._onOdds) return
    const hasBetTemplate = this.config.betOfferTemplate || process.env.SPORTSBOOK_BET_TEMPLATE_URL
    if (hasBetTemplate) {
      await this._fetchWithExtrasOnce()
    } else {
      await this._tick(true)
    }
  }
  async _fetchWithExtrasOnce() {
    const url = this.config.pollUrl || process.env.SPORTSBOOK_POLL_URL
    const betTemplate = this.config.betOfferTemplate || process.env.SPORTSBOOK_BET_TEMPLATE_URL
    if (!url || !betTemplate) {
      await this._tick()
      return
    }
    const leagueKey = this._leagueKey
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000), ...this.config.fetchOptions })
      const data = await res.json()
      const baseEntries = this.parseResponse(data, leagueKey) || []

      const liveEvents = Array.isArray(data.liveEvents) ? data.liveEvents : []
      const maxDetail = Number(this.config.maxDetailEvents || process.env.MAX_DETAIL_EVENTS) || 3
      const detailTargets = liveEvents.filter((le) => !isExcludedSport(le.event)).slice(0, maxDetail)

      const detailPromises = detailTargets.map(async (le) => {
        const ev = le.event
        if (!ev || ev.id == null) return []
        const detailUrl = betTemplate.replace('{eventId}', String(ev.id))
        try {
          const dRes = await fetch(detailUrl, { signal: AbortSignal.timeout(10000), ...this.config.fetchOptions })
          const dData = await dRes.json()
          return this.parseResponse(dData, leagueKey) || []
        } catch (e) {
          console.warn('[LiveOdds] Detail betoffer error:', e.message)
          return []
        }
      })

      const detailResults = await Promise.all(detailPromises)
      const detailEntries = detailResults.flat()

      const allEntries = [...baseEntries, ...detailEntries]
      const pollRequests = 1 + detailTargets.length
      this._onOdds(allEntries, { pollRequests })
    } catch (e) {
      console.warn('[LiveOdds] Poll (with extras) error:', e.message)
    }
  }
  async _tick(fromFetchOnce = false) {
    if (!this._running) return
    if (this._timer) { clearTimeout(this._timer); this._timer = null }
    const url = this.config.pollUrl || process.env.SPORTSBOOK_POLL_URL
    const interval = Number(this.config.pollIntervalMs || process.env.POLL_INTERVAL_MS) || 2000
    const leagueKey = this._leagueKey
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000), ...this.config.fetchOptions })
      const data = await res.json()
      const entries = this.parseResponse(data, leagueKey) || []
      if (fromFetchOnce) {
        this._onOdds(entries, { pollRequests: 1 })
      } else if (entries.length) {
        this._onOdds(entries)
      }
    } catch (e) { console.warn('[LiveOdds] Poll error:', e.message) }
    if (this._running && this._autoPoll) this._timer = setTimeout(() => this._tick(), interval)
  }
  parseResponse(data, leagueKey) {
    if (!data) return []
    const entries = []
    const defaultSport = this.config.sportKey || leagueKey
    const defaultLeague = this.config.leagueTitle || leagueKey
    const sportsbook = this.config.sportsbookName || 'sportsbook'
    const bookmakerBase =
      this.config.bookmakerBaseUrl ||
      process.env.BOOKMAKER_BASE_URL ||
      'https://ny.betrivers.com/?page=sportsbook#event/'

    // Kambi bet-offers feed: data.betOffers[] + data.events[] (or single data.event for per-event URL)
    const eventsList = Array.isArray(data.events) ? data.events : (data.event ? [data.event] : null)
    if (Array.isArray(data.betOffers) && eventsList && eventsList.length > 0) {
      const eventsById = new Map()
      for (const ev of eventsList) {
        if (ev && ev.id != null) eventsById.set(ev.id, ev)
      }

      for (const bo of data.betOffers) {
        if (!bo || !Array.isArray(bo.outcomes)) continue
        const ev = eventsById.get(bo.eventId)
        if (!ev) continue
        if (isExcludedSport(ev)) continue
        if (ev.state && ev.state !== 'STARTED' && ev.state !== 'OPEN_FOR_LIVE') continue

        const eventId = ev.id
        const sport = (ev.sport || defaultSport || '').toLowerCase()
        const league = ev.group || defaultLeague
        const home = ev.homeName || ev.home_name
        const away = ev.awayName || ev.away_name
        const commence = ev.start

        const critLabel =
          (bo.criterion && (bo.criterion.label || bo.criterion.englishLabel)) || ''
        // Skip only moneyline here; open.json supplies it to avoid duplicates
        if (/moneyline/i.test(critLabel) || /match odds/i.test(critLabel)) continue

        const marketType = marketTypeSlug(critLabel)

        for (const outcome of bo.outcomes) {
          const name = outcome.label || outcome.englishLabel || outcome.participant
          const oddsAmerican =
            outcome.oddsAmerican != null
              ? Number(outcome.oddsAmerican)
              : outcome.odds != null
                ? Number(outcome.odds)
                : null
          if (!name || oddsAmerican == null) continue

          const rawLine = typeof outcome.line === 'number' ? outcome.line : null
          const lineValue = rawLine != null ? rawLine / 1000 : null
          const outcomeId = outcome.id != null ? outcome.id : null

          entries.push(createNormalizedEntry({
            sport,
            league,
            event_id: eventId,
            home_team: home,
            away_team: away,
            market_type: marketType,
            outcome_name: name,
            line_value: lineValue,
            sportsbook,
            odds_american: oddsAmerican,
            commence_time: commence,
            bookmaker_link: buildBookmakerLink(bookmakerBase, eventId, outcomeId),
            is_live: true
          }))
        }
      }

      return entries
    }

    // Kambi BetRivers live feed: data.liveEvents[]
    if (Array.isArray(data.liveEvents)) {
      for (const le of data.liveEvents) {
        const ev = le.event
        const bo = le.mainBetOffer
        if (!ev || !bo || !Array.isArray(bo.outcomes)) continue
        if (isExcludedSport(ev)) continue
        if (ev.state && ev.state !== 'STARTED' && ev.state !== 'OPEN_FOR_LIVE') continue

        const eventId = ev.id
        const sport = (ev.sport || defaultSport || '').toLowerCase()
        const league = ev.group || defaultLeague
        const home = ev.homeName || ev.home_name
        const away = ev.awayName || ev.away_name
        const commence = ev.start
        const marketType = 'moneyline'

        for (const outcome of bo.outcomes) {
          const name = outcome.label || outcome.englishLabel || outcome.participant
          const oddsAmerican =
            outcome.oddsAmerican != null
              ? Number(outcome.oddsAmerican)
              : outcome.odds != null
                ? Number(outcome.odds) // Kambi "odds" is usually price * 1000
                : null
          if (!name || oddsAmerican == null) continue

          const outcomeId = outcome.id != null ? outcome.id : null

          entries.push(createNormalizedEntry({
            sport,
            league,
            event_id: eventId,
            home_team: home,
            away_team: away,
            market_type: marketType,
            outcome_name: name,
            line_value: null,
            sportsbook,
            odds_american: oddsAmerican,
            commence_time: commence,
            bookmaker_link: buildBookmakerLink(bookmakerBase, eventId, outcomeId),
            is_live: true
          }))
        }
      }
      return entries
    }

    // Fallback: original expected shape with data.events[]
    if (!Array.isArray(data.events)) return []
    const sport = defaultSport
    const league = defaultLeague
    for (const ev of data.events) {
      if (ev.status !== 'live' && ev.status !== 'inprogress') continue
      const eventId = ev.id || ev.event_id
      for (const bm of ev.bookmakers || []) {
        const book = bm.key || bm.title || sportsbook
        for (const market of bm.markets || []) {
          const marketType = { h2h: 'moneyline', spreads: 'spread', totals: 'total' }[market.key] || market.key
          for (const outcome of market.outcomes || []) {
            entries.push(createNormalizedEntry({
              sport, league, event_id: eventId,
              home_team: ev.home_team, away_team: ev.away_team,
              market_type: marketType, outcome_name: outcome.name, line_value: outcome.point ?? null,
              sportsbook: book, odds_american: outcome.price,
              commence_time: ev.commence_time, bookmaker_link: outcome.link || null, is_live: true
            }))
          }
        }
      }
    }
    return entries
  }
  async start(leagueKey, onOdds) {
    const url = this.config.pollUrl || process.env.SPORTSBOOK_POLL_URL
    if (!url) throw new Error('SPORTSBOOK_POLL_URL required for Poll adapter')
    this._onOdds = onOdds
    this._leagueKey = leagueKey
    this._running = true
    this._autoPoll = true
    await this._tick()
  }
  stop() {
    super.stop()
    if (this._timer) { clearTimeout(this._timer); this._timer = null }
    this._onOdds = null
  }
}
