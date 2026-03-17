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

/** Map 888Sport selection to normalized market_type. */
function toMarketType(sel) {
  const schema = sel.selection_schema
  const type = (sel.selection_type || '').toString().toLowerCase()
  const name = (sel.selection_name || sel.name || '').toLowerCase()
  const hasLine = sel.specialoddsvalue != null && sel.specialoddsvalue !== ''

  // Totals: Over/Under with a numeric line or totals schema
  if (schema === 12 || type === 'over' || type === 'under' || /over|under/.test(name)) {
    return 'total'
  }
  // Spreads/handicaps: schema 23 or has +/- line
  if (schema === 23 || hasLine || /[+-]\d+(\.\d+)?/.test(String(sel.specialoddsvalue || ''))) {
    return 'spread'
  }
  // 1/X/2 or moneyline style
  if (schema === 1 || schema === 25 || ['1', '2', 'x'].includes(type) || /moneyline|match result/.test(name)) {
    return 'moneyline'
  }
  return 'other'
}

function parseLineValue(sel) {
  const v = sel.specialoddsvalue
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isNaN(n) ? null : n
}

/** 888Sport in-play API: GET getInplayEvents/all (multi-sport). */
export class EightEightEightAdapter extends BaseAdapter {
  constructor(config = {}) {
    super(config)
    this._onOdds = null
  }

  get name() { return '888sport' }
  get bookId() { return this.config.bookId ?? '888sport' }

  async start(leagueKey, onOdds) {
    const url = this.config.pollUrl || process.env.EIGHTS_POLL_URL
    if (!url) throw new Error('888Sport poll URL required (EIGHTS_POLL_URL or config.pollUrl)')
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
    const url = this.config.pollUrl || process.env.EIGHTS_POLL_URL
    const sportsbook = this.config.sportsbookName || '888sport'
    const baseUrl = (this.config.bookmakerBaseUrl || 'https://www.888sport.com').replace(/\/?$/, '')
    const cookie = this.config.cookie ?? process.env.EIGHTS_COOKIE

    const headers = {
      Accept: '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
      Origin: 'https://www.888sport.com',
      Referer: 'https://www.888sport.com/',
      'Sec-Fetch-Site': 'same-site',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Dest': 'empty'
    }
    if (cookie) headers.Cookie = cookie

    try {
      const res = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(15000),
        headers: { ...headers, ...this.config.fetchOptions?.headers }
      })
      const text = await res.text()
      if (!res.ok) {
        console.warn('[LiveOdds] 888Sport API', res.status, res.statusText, text.slice(0, 200))
        this._onOdds([], { pollRequests: 1 })
        return
      }
      let data
      try {
        data = text ? JSON.parse(text) : null
      } catch (e) {
        console.warn('[LiveOdds] 888Sport API non-JSON:', text.slice(0, 200))
        this._onOdds([], { pollRequests: 1 })
        return
      }
      const entries = this.parseResponse(data, { sportsbook, baseUrl })
      this._onOdds(entries, { pollRequests: 1 })
    } catch (e) {
      console.warn('[LiveOdds] 888Sport fetch error:', e.message)
    }
  }

  parseResponse(data, opts = {}) {
    const { sportsbook } = opts
    const entries = []
    if (!data || typeof data !== 'object') return entries

    const selections = data.selections || {}
    const sports = Array.isArray(data.sports) ? data.sports : []

    // Build quick lookup: sportId -> sport meta
    const sportMetaById = new Map()
    for (const s of sports) {
      if (s && s.id != null) sportMetaById.set(s.id, s)
    }

    for (const sport of sports) {
      const sportName = sport.name || ''
      const sportSlug = (sport.slug || sportName || '').toString().toLowerCase().replace(/\s+/g, '-')
      const tournaments = Array.isArray(sport.tournaments) ? sport.tournaments : []

      for (const tourn of tournaments) {
        const leagueName = tourn.name || ''
        const events = Array.isArray(tourn.events) ? tourn.events : []

        for (const ev of events) {
          if (!ev || !ev.id) continue
          if (!ev.is_inplay && ev.match_status !== 'IN_PROGRESS') continue

          const eventId = ev.id
          const evSelections = selections[String(eventId)]
          if (!evSelections) continue

          const competitors = Array.isArray(ev.competitors) ? ev.competitors : []
          const home = competitors[0]
          const away = competitors[1]
          const homeTeam = home?.name || null
          const awayTeam = away?.name || null

          const commenceTime = ev.scheduled_start || null

          // Handle both object (marketId -> [sels]) and array shapes
          const marketEntries = []
          if (Array.isArray(evSelections)) {
            marketEntries.push([ev.market_id || null, evSelections])
          } else if (typeof evSelections === 'object') {
            for (const [mId, arr] of Object.entries(evSelections)) {
              if (Array.isArray(arr)) marketEntries.push([mId, arr])
            }
          }

          for (const [marketId, sels] of marketEntries) {
            if (!Array.isArray(sels) || sels.length === 0) continue
            for (const sel of sels) {
              if (!sel || sel.active !== 1 || sel.visible !== 1) continue
              if (sel.suspended || sel.is_market_suspended) continue
              if (sel.tradable === 0) continue

              const dec = sel.decimal_current_price || sel.decimal_price
              const oddsAmerican = decimalToAmerican(dec)
              if (oddsAmerican == null) continue

              const marketType = toMarketType(sel)
              const lineValue = parseLineValue(sel)
              const outcomeName = sel.selection_name || sel.name || ''
              const selSportSlug = (sel.sport_slug || sportSlug || '').toString().toLowerCase().replace(/\s+/g, '_')

              entries.push(createNormalizedEntry({
                sport: selSportSlug || sportSlug || 'other',
                league: leagueName || ev.categorySlug || null,
                event_id: eventId,
                home_team: homeTeam,
                away_team: awayTeam,
                market_type: marketType,
                outcome_name: outcomeName,
                line_value: lineValue,
                sportsbook,
                odds_american: oddsAmerican,
                commence_time: commenceTime,
                bookmaker_link: null,
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

