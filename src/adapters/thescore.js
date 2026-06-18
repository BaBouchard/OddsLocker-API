import fs from 'fs'
import path from 'path'
import { BaseAdapter } from './base.js'
import { createNormalizedEntry, normalizeLeague } from '../schema.js'

const DEFAULT_SECTIONS = ['baseball', 'tennis', 'basketball', 'ebasketball']

/** @returns {string[]} section slugs e.g. baseball, tennis */
export function getTheScoreSectionSlugs(config = {}) {
  const raw = config.sections ?? process.env.THESCORE_SECTIONS ?? DEFAULT_SECTIONS.join(',')
  return String(raw)
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

/** Build Marketplace GET URL for a live section from the base persisted-query URL. */
export function buildTheScoreSectionUrl(baseUrl, sectionSlug) {
  const u = new URL(baseUrl)
  const varsRaw = u.searchParams.get('variables')
  if (!varsRaw) throw new Error('The Score Bet poll URL missing variables query param')
  const vars = JSON.parse(varsRaw)
  vars.selectedFilterId = `Section:Live:${sectionSlug}`
  vars.canonicalUrl = `/live/section/${sectionSlug}`
  vars.includeSectionDefaultField = false
  u.searchParams.set('variables', JSON.stringify(vars))
  return u.toString()
}

function toMarketType(type, name = '') {
  const t = (type || '').toUpperCase()
  const n = (name || '').toLowerCase()
  if (t === 'MONEYLINE' || t === 'THREE_WAY_MONEYLINE' || /moneyline|money line|match result|match winner/.test(n)) return 'moneyline'
  if (t === 'SPREAD' || /spread|run line|handicap|puck line/.test(n)) return 'spread'
  if (t === 'TOTAL' || /total|over\/under|over under/.test(n)) return 'total'
  return t ? t.toLowerCase() : 'other'
}

function parseEventName(name) {
  if (!name || typeof name !== 'string') return { away: null, home: null }
  const sep = name.includes(' @ ') ? ' @ ' : name.includes(' vs ') ? ' vs ' : null
  if (!sep) return { away: name.trim(), home: null }
  const [away, home] = name.split(sep).map((s) => s.trim())
  return { away: away || null, home: home || null }
}

function selectionLabel(name) {
  if (!name) return ''
  if (typeof name === 'string') return name
  return name.defaultName || name.cleanName || name.fullName || ''
}

/** Parse "+275" / "-160" American odds from Odds object. */
function parseAmericanOdds(odds) {
  if (!odds || typeof odds !== 'object') return null
  const formatted = odds.formattedOdds
  if (formatted != null && formatted !== '') {
    const n = Number(String(formatted).replace(/[^\d+-]/g, ''))
    if (!Number.isNaN(n)) return n
  }
  const num = Number(odds.numeratorLong)
  const den = Number(odds.denominatorLong)
  if (!Number.isNaN(num) && !Number.isNaN(den) && den > 0) {
    if (num >= den) return Math.round(((num / den) - 1) * 100)
    return Math.round(-100 / ((num / den) - 1))
  }
  return null
}

function parseLineValue(selection, marketType) {
  const points = selection?.points
  if (!points || points.decimalPoints == null) return null
  const raw = Number(points.decimalPoints)
  if (Number.isNaN(raw)) return null
  if (marketType === 'total') return Math.abs(raw)
  const selType = (selection.type || '').toUpperCase()
  if (/HOME/.test(selType)) return raw
  if (/AWAY/.test(selType)) return raw
  return raw
}

function sportFromDeepLink(webUrl) {
  if (!webUrl || typeof webUrl !== 'string') return 'other'
  const m = webUrl.match(/^\/sport\/([^/]+)/)
  return m ? m[1].replace(/-/g, '_') : 'other'
}

function eventIdFromEvent(ev) {
  if (!ev || typeof ev !== 'object') return null
  if (ev.rawId) return String(ev.rawId)
  const id = ev.id != null ? String(ev.id) : null
  if (!id) return null
  const prefix = id.indexOf(':')
  return prefix >= 0 ? id.slice(prefix + 1) : id
}

function isMarketCard(node) {
  return node?.__typename && /GridMarketCard$/.test(node.__typename)
}

function isInPlayCard(card, event) {
  const attrs = card?.attributes
  if (Array.isArray(attrs) && attrs.includes('IN_PLAY')) return true
  if (event?.status === 'IN_PLAY') return true
  if (event?.statistics?.isInPlay === true) return true
  return false
}


function buildHeaders(config) {
  const origin = config.origin ?? process.env.THESCORE_ORIGIN ?? 'https://sportsbook.thescore.bet'
  const referer = config.referer ?? process.env.THESCORE_REFERER ?? `${origin.replace(/\/?$/, '')}/`
  const cookie = config.cookie ?? process.env.THESCORE_COOKIE
  const anonAuth = config.anonAuth ?? process.env.THESCORE_ANON_AUTH
  const clientVersion = config.clientVersion ?? process.env.THESCORE_CLIENT_VERSION ?? '26.11.1'

  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
    Origin: origin,
    Referer: referer,
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-site',
    'x-client': 'espnbet',
    'x-app': 'espnbet',
    'x-platform': 'web',
    'x-app-version': clientVersion,
    'apollographql-client-name': 'espnbet-espnbet-web',
    'apollographql-client-version': clientVersion,
    'x-apollo-operation-name': 'Marketplace',
    ...(config.fetchOptions?.headers || {})
  }
  if (cookie) headers.Cookie = cookie
  if (anonAuth) {
    headers['x-anonymous-authorization'] = anonAuth.startsWith('Bearer ')
      ? anonAuth
      : `Bearer ${anonAuth}`
  }
  return headers
}

/** The Score Bet live Marketplace GraphQL (Page:Live persisted query GET). */
export class TheScoreAdapter extends BaseAdapter {
  constructor(config = {}) {
    super(config)
    this._timer = null
    this._onOdds = null
    this._leagueKey = null
    this._authWarned = false
  }

  get name() { return 'thescore' }
  get bookId() { return this.config.bookId ?? 'thescore' }
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
    const url = this.config.pollUrl || process.env.THESCORE_POLL_URL
    if (!url) throw new Error('The Score Bet poll URL required (THESCORE_POLL_URL or config.pollUrl)')
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

  getSectionUrls() {
    const baseUrl = this.config.pollUrl || process.env.THESCORE_POLL_URL
    const slugs = getTheScoreSectionSlugs(this.config)
    return slugs.map((slug) => ({
      slug,
      url: buildTheScoreSectionUrl(baseUrl, slug)
    }))
  }

  async _fetchSection(sectionSlug, url, opts = {}) {
    const { sportsbook, baseUrl, shouldDebug, debugPath, debugAll } = opts
    const res = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(15000),
      headers: buildHeaders(this.config),
      ...this.config.fetchOptions
    })
    const text = await res.text()

    if (!res.ok) {
      if (!this._authWarned) {
        console.warn('[LiveOdds] The Score Bet API', sectionSlug, res.status, res.statusText, '- refresh THESCORE_COOKIE / THESCORE_ANON_AUTH from DevTools Copy as cURL')
        this._authWarned = true
      } else {
        console.warn('[LiveOdds] The Score Bet API', sectionSlug, res.status, res.statusText, text.slice(0, 200))
      }
      if (shouldDebug && debugAll) {
        fs.writeFileSync(debugPath, JSON.stringify({ section: sectionSlug, status: res.status, statusText: res.statusText, body: text }, null, 2), 'utf8')
      }
      return []
    }

    let data
    try {
      data = text ? JSON.parse(text) : {}
    } catch (e) {
      console.warn('[LiveOdds] The Score Bet API', sectionSlug, 'non-JSON:', text.slice(0, 200))
      return []
    }

    if (shouldDebug && debugAll) {
      fs.writeFileSync(debugPath, JSON.stringify({ section: sectionSlug, ...data }, null, 2), 'utf8')
    }

    if (Array.isArray(data.errors) && data.errors.length > 0 && !data.data?.page) {
      if (!this._authWarned) {
        console.warn('[LiveOdds] The Score Bet GraphQL errors:', sectionSlug, data.errors[0]?.message || data.errors[0])
        this._authWarned = true
      }
      return []
    }

    const expectedSection = `Section:Live:${sectionSlug}`
    const actualSection = data.data?.page?.defaultChild?.id
    if (actualSection && actualSection !== expectedSection) {
      console.warn('[LiveOdds] The Score Bet', sectionSlug, 'section unavailable (API returned', actualSection + '), skipping')
      return []
    }

    this._authWarned = false
    return this.parseResponse(data, { sportsbook, baseUrl, sectionSlug })
  }

  async _tick(fromFetchOnce = false) {
    if (!this._running) return
    if (this._timer) { clearTimeout(this._timer); this._timer = null }

    const sportsbook = this.config.sportsbookName || 'The Score Bet'
    const baseUrl = (this.config.bookmakerBaseUrl || process.env.THESCORE_BOOKMAKER_BASE_URL || 'https://sportsbook.thescore.bet').replace(/\/?$/, '')
    const interval = Number(this.config.pollIntervalMs || process.env.POLL_INTERVAL_MS) || 2000
    const sectionUrls = this.getSectionUrls()
    const shouldDebug = process.env.DEBUG_THESCORE === '1' || process.env.DEBUG_THESCORE === 'true'
    const debugPath = path.join(process.cwd(), 'debug-thescore-response.json')

    try {
      const allEntries = []
      let debugged = false
      for (let i = 0; i < sectionUrls.length; i++) {
        const { slug, url } = sectionUrls[i]
        if (i > 0) await new Promise((r) => setTimeout(r, 200))
        try {
          const entries = await this._fetchSection(slug, url, {
            sportsbook,
            baseUrl,
            shouldDebug,
            debugPath,
            debugAll: shouldDebug && !debugged
          })
          if (shouldDebug && !debugged) debugged = true
          allEntries.push(...entries)
        } catch (e) {
          console.warn('[LiveOdds] The Score Bet', slug, 'fetch error:', e.message)
        }
      }
      this._onOdds(allEntries, { pollRequests: sectionUrls.length, fromFetchOnce: !!fromFetchOnce })
    } catch (e) {
      console.warn('[LiveOdds] The Score Bet fetch error:', e.message)
      if (fromFetchOnce && this._onOdds) this._onOdds([], { pollRequests: 1, fromFetchOnce: true })
    }

    if (this._running && this._autoPoll) this._timer = setTimeout(() => this._tick(), interval)
  }

  parseResponse(data, opts = {}) {
    const { sportsbook, baseUrl, sectionSlug } = opts
    const defaultSport = (sectionSlug || '').replace(/-/g, '_') || 'other'
    const entries = []
    if (!data || typeof data !== 'object') return entries

    const page = data.data?.page
    if (!page) return entries

    const cards = []
    const walk = (node) => {
      if (!node || typeof node !== 'object') return
      if (Array.isArray(node)) {
        node.forEach(walk)
        return
      }
      if (isMarketCard(node)) cards.push(node)
      for (const value of Object.values(node)) walk(value)
    }
    walk(page)

    for (const card of cards) {
      const event = card.fallbackEvent || card.event || card.richEvent?.event
      if (!event || !isInPlayCard(card, event)) continue

      const eventId = eventIdFromEvent(event)
      if (!eventId) continue

      const eventName = event.name || ''
      const { away: awayTeam, home: homeTeam } = parseEventName(eventName)
      const league = normalizeLeague(event.competition?.name)
      const commenceTime = event.startTime || null
      const deepLink =
        card.deepLink?.webUrl ||
        event.deepLink?.webUrl ||
        card.deepLink?.canonicalUrl ||
        event.deepLink?.canonicalUrl ||
        null
      const sport = sportFromDeepLink(typeof deepLink === 'string' ? deepLink : '') || defaultSport
      const bookmakerEventLink = deepLink && String(deepLink).startsWith('/')
        ? `${baseUrl}${deepLink}`
        : (deepLink || null)

      const markets = Array.isArray(card.markets) ? card.markets : []
      for (const market of markets) {
        if (!market || market.status !== 'OPEN') continue
        const marketType = toMarketType(market.type, market.name)
        const selections = Array.isArray(market.selections) ? market.selections : []
        for (const selection of selections) {
          if (!selection || selection.status !== 'OPEN') continue
          const oddsAmerican = parseAmericanOdds(selection.odds)
          if (oddsAmerican == null) continue

          const outcomeName = selectionLabel(selection.name)
          if (!outcomeName) continue

          entries.push(createNormalizedEntry({
            sport,
            league,
            event_id: eventId,
            home_team: homeTeam,
            away_team: awayTeam,
            market_type: marketType,
            outcome_name: outcomeName,
            line_value: parseLineValue(selection, marketType),
            sportsbook,
            odds_american: oddsAmerican,
            commence_time: commenceTime,
            bookmaker_link: bookmakerEventLink,
            is_live: true
          }))
        }
      }
    }

    return entries
  }
}
