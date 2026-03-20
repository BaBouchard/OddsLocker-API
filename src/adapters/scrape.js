/**
 * Scrape adapter: fetch a webpage URL and extract live odds.
 * Use when you only have a link to the sportsbook's website (e.g. their live betting page).
 *
 * Many sites load odds via an internal API. Open DevTools → Network → XHR/fetch,
 * reload the live page, and look for a request that returns JSON with events/odds.
 * That URL often works better in SPORTSBOOK_POLL_URL (no scraping).
 *
 * If the odds are only in the HTML, we fetch the page and try to extract embedded
 * JSON (e.g. __NEXT_DATA__, window.__PRELOADED_STATE__). You may need to subclass
 * and override parseResponse() for your sportsbook's structure.
 */
import { BaseAdapter } from './base.js'
import { createNormalizedEntry, normalizeLeague } from '../schema.js'

export class ScrapeAdapter extends BaseAdapter {
  constructor(config = {}) {
    super(config)
    this._timer = null
    this._onOdds = null
  }

  get name() {
    return 'scrape'
  }

  get autoPoll() { return this._autoPoll !== false }
  setAutoPoll(value) {
    this._autoPoll = !!value
    if (!this._autoPoll && this._timer) {
      clearTimeout(this._timer)
      this._timer = null
    }
    if (this._autoPoll && this._running && this._onOdds) {
      const interval = Number(this.config.pollIntervalMs || process.env.POLL_INTERVAL_MS) || 3000
      this._timer = setTimeout(() => this._tick(), interval)
    }
  }
  async fetchOnce() {
    if (!this._running || !this._onOdds) return
    await this._tick()
  }
  async _tick() {
    if (!this._running) return
    if (this._timer) { clearTimeout(this._timer); this._timer = null }
    const url = this.config.scrapeUrl || process.env.SPORTSBOOK_SCRAPE_URL
    const interval = Number(this.config.pollIntervalMs || process.env.POLL_INTERVAL_MS) || 3000
    const leagueKey = this._leagueKey
    try {
      const data = await this.getData(url)
      const entries = this.parseResponse(data, leagueKey)
      if (entries.length) this._onOdds(entries)
    } catch (e) {
      console.warn('[LiveOdds] Scrape error:', e.message)
    }
    if (this._running && this._autoPoll) this._timer = setTimeout(() => this._tick(), interval)
  }

  /**
   * Try to get JSON from the response: either direct JSON or embedded in HTML.
   */
  async getData(url) {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/json,application/xhtml+xml',
      ...this.config.headers
    }
    const res = await fetch(url, { signal: AbortSignal.timeout(15000), headers })
    const text = await res.text()

    const contentType = (res.headers.get('Content-Type') || '').toLowerCase()
    if (contentType.includes('application/json')) {
      return JSON.parse(text)
    }

    // Try to find embedded JSON in HTML (common patterns)
    const patterns = [
      /<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i,
      /<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i,
      /window\.__PRELOADED_STATE__\s*=\s*({[\s\S]*?});?\s*<\/script>/i,
      /window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});?\s*<\/script>/i,
      /"__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i,
      /data\s*=\s*({[\s\S]*?});?\s*<\/script>/i
    ]
    for (const re of patterns) {
      const match = text.match(re)
      if (match) {
        try {
          return JSON.parse(match[1].trim())
        } catch (_) {
          continue
        }
      }
    }
    return null
  }

  /**
   * Override in a subclass to map your sportsbook's response to normalized entries.
   * Default expects: { events: [ { id, home_team, away_team, status, commence_time, bookmakers: [ { markets: [ { outcomes } ] } ] } ] }
   * or similar. Filter for live only (status === 'live' or 'inprogress').
   */
  parseResponse(data, leagueKey) {
    if (!data) return []
    const events = data.events ?? data.games ?? data.live ?? data.data?.events ?? []
    if (!Array.isArray(events)) return []
    const entries = []
    const sport = this.config.sportKey || leagueKey
    const sportsbook = this.config.sportsbookName || 'sportsbook'
    const marketMap = { h2h: 'moneyline', spreads: 'spread', totals: 'total', moneyline: 'moneyline', spread: 'spread', total: 'total' }

    for (const ev of events) {
      const status = (ev.status || ev.gameStatus || ev.live || '').toString().toLowerCase()
      if (!status.includes('live') && !status.includes('inprogress') && status !== 'in progress') continue

      const eventId = ev.id || ev.eventId || ev.event_id || `${(ev.home_team || ev.homeTeam || '').replace(/\s/g, '')}_${(ev.away_team || ev.awayTeam || '').replace(/\s/g, '')}`
      const league = normalizeLeague(
        ev.league ?? ev.leagueName ?? ev.competition ?? ev.competitionName ?? ev.tournament ?? ev.group
      )
      const homeTeam = ev.home_team ?? ev.homeTeam ?? ev.home
      const awayTeam = ev.away_team ?? ev.awayTeam ?? ev.away
      const bookmakers = ev.bookmakers ?? ev.markets ?? [ev]
      const singleBook = !Array.isArray(ev.bookmakers) && !Array.isArray(ev.markets)

      for (const bm of singleBook ? [{ markets: ev.markets ?? ev.outcomes ?? [] }] : bookmakers) {
        const markets = bm.markets ?? bm
        const marketList = Array.isArray(markets) ? markets : [markets]
        const bookName = bm.key ?? bm.title ?? bm.name ?? sportsbook

        for (const market of marketList) {
          const rawKey = market.key ?? market.type ?? market.marketType ?? ''
          const marketType = marketMap[rawKey] || rawKey || 'moneyline'
          const outcomes = market.outcomes ?? market.odds ?? market.choices ?? []

          for (const outcome of outcomes) {
            const name = outcome.name ?? outcome.outcome ?? outcome.label
            const price = outcome.price ?? outcome.odds ?? outcome.american ?? outcome.moneyLine
            const point = outcome.point ?? outcome.line ?? outcome.spread ?? outcome.total
            if (name == null || price == null) continue
            entries.push(createNormalizedEntry({
              sport,
              league,
              event_id: eventId,
              home_team: homeTeam,
              away_team: awayTeam,
              market_type: marketType,
              outcome_name: name,
              line_value: point ?? null,
              sportsbook: bookName,
              odds_american: Number(price),
              commence_time: ev.commence_time ?? ev.startTime ?? ev.start_time,
              bookmaker_link: outcome.link ?? ev.link ?? this.config.pageUrl ?? null,
              is_live: true
            }))
          }
        }
      }
    }
    return entries
  }

  async start(leagueKey, onOdds) {
    const url = this.config.scrapeUrl || process.env.SPORTSBOOK_SCRAPE_URL
    if (!url) throw new Error('SPORTSBOOK_SCRAPE_URL or config.scrapeUrl is required for Scrape adapter')
    this._onOdds = onOdds
    this._leagueKey = leagueKey
    this._running = true
    this._autoPoll = false
    await this._tick()
  }

  stop() {
    super.stop()
    if (this._timer) {
      clearTimeout(this._timer)
      this._timer = null
    }
    this._onOdds = null
  }
}
