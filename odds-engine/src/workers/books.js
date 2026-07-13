/**
 * Book catalog for the engine. Adapters are imported from the legacy scraper
 * library (repo root src/adapters) — shared parsers only; old VPS/terminal spine is unused.
 */
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootSrc = process.env.SCRAPER_SRC_ROOT
  ? path.resolve(process.env.SCRAPER_SRC_ROOT)
  : path.resolve(__dirname, '../../../src')

async function load(mod) {
  return import(pathToFileURL(path.join(rootSrc, mod)).href)
}

function baseEnv() {
  const sportKey = process.env.SPORT_KEY || (process.env.LEAGUE_KEY || 'basketball_nba').split('_')[0]
  const leagueTitle = process.env.LEAGUE_TITLE || process.env.LEAGUE_KEY || 'Other'
  return { sportKey, leagueTitle }
}

export function discoverConfiguredBooks() {
  const { sportKey, leagueTitle } = baseEnv()
  const books = []
  if (process.env.SPORTSBOOK_POLL_URL) {
    books.push({
      bookId: 'betrivers',
      name: process.env.SPORTSBOOK_NAME || 'BetRivers',
      adapter: 'poll',
      config: {
        bookId: 'betrivers',
        pollUrl: process.env.SPORTSBOOK_POLL_URL,
        pollIntervalMs: process.env.POLL_INTERVAL_MS || 5000,
        sportKey,
        leagueTitle,
        sportsbookName: process.env.SPORTSBOOK_NAME || 'BetRivers',
        betOfferTemplate: process.env.SPORTSBOOK_BET_TEMPLATE_URL,
        maxDetailEvents: process.env.MAX_DETAIL_EVENTS || 3,
        bookmakerBaseUrl: process.env.BOOKMAKER_BASE_URL || null
      }
    })
  }
  if (process.env.FANDUEL_POLL_URL) {
    books.push({
      bookId: 'fanduel',
      name: process.env.FANDUEL_NAME || 'FanDuel',
      adapter: 'fanduel',
      config: {
        bookId: 'fanduel',
        pollUrl: process.env.FANDUEL_POLL_URL,
        sportKey: process.env.FANDUEL_SPORT || sportKey,
        leagueTitle: process.env.FANDUEL_LEAGUE || leagueTitle,
        sportsbookName: process.env.FANDUEL_NAME || 'FanDuel',
        bookmakerBaseUrl: process.env.FANDUEL_BOOKMAKER_BASE_URL || 'https://sportsbook.fanduel.com',
        region: process.env.FANDUEL_REGION,
        origin: process.env.FANDUEL_ORIGIN
      }
    })
  }
  if (process.env.BOVADA_POLL_URL) {
    books.push({
      bookId: 'bovada',
      name: process.env.BOVADA_NAME || 'Bovada',
      adapter: 'bovada',
      config: {
        bookId: 'bovada',
        pollUrl: process.env.BOVADA_POLL_URL,
        sportKey: process.env.BOVADA_SPORT || sportKey,
        leagueTitle: process.env.BOVADA_LEAGUE || leagueTitle,
        sportsbookName: process.env.BOVADA_NAME || 'Bovada',
        bookmakerBaseUrl: process.env.BOVADA_BOOKMAKER_BASE_URL || 'https://www.bovada.lv'
      }
    })
  }
  if (
    process.env.POINTSBET_BASKETBALL_URL ||
    process.env.POINTSBET_BASEBALL_URL ||
    process.env.POINTSBET_SOCCER_URL ||
    process.env.POINTSBET_POLL_URL
  ) {
    books.push({
      bookId: 'pointsbet',
      name: process.env.POINTSBET_NAME || 'PointsBet',
      adapter: 'pointsbet',
      config: {
        bookId: 'pointsbet',
        basketballUrl: process.env.POINTSBET_BASKETBALL_URL,
        baseballUrl: process.env.POINTSBET_BASEBALL_URL,
        soccerUrl: process.env.POINTSBET_SOCCER_URL,
        pollUrl: process.env.POINTSBET_POLL_URL,
        sportsbookName: process.env.POINTSBET_NAME || 'PointsBet',
        bookmakerBaseUrl: process.env.POINTSBET_BOOKMAKER_BASE_URL || 'https://www.pointsbet.com',
        cookie: process.env.POINTSBET_COOKIE
      }
    })
  }
  if (process.env.BETMGM_POLL_URL) {
    books.push({
      bookId: 'betmgm',
      name: process.env.BETMGM_NAME || 'BetMGM',
      adapter: 'betmgm',
      config: {
        bookId: 'betmgm',
        pollUrl: process.env.BETMGM_POLL_URL,
        sportsbookName: process.env.BETMGM_NAME || 'BetMGM',
        bookmakerBaseUrl: process.env.BETMGM_BOOKMAKER_BASE_URL || 'https://www.ny.betmgm.com',
        cookie: process.env.BETMGM_COOKIE
      }
    })
  }
  if (process.env.EIGHTS_POLL_URL) {
    books.push({
      bookId: '888sport',
      name: process.env.EIGHTS_NAME || '888sport',
      adapter: '888sport',
      config: {
        bookId: '888sport',
        pollUrl: process.env.EIGHTS_POLL_URL,
        sportsbookName: process.env.EIGHTS_NAME || '888sport',
        bookmakerBaseUrl: process.env.EIGHTS_BOOKMAKER_BASE_URL || 'https://www.888sport.com',
        cookie: process.env.EIGHTS_COOKIE
      }
    })
  }
  if (process.env.THESCORE_POLL_URL || process.env.THESCORE_API_URL) {
    books.push({
      bookId: 'thescore',
      name: process.env.THESCORE_NAME || 'The Score Bet',
      adapter: 'thescore',
      config: {
        bookId: 'thescore',
        pollUrl: process.env.THESCORE_POLL_URL || process.env.THESCORE_API_URL,
        sportsbookName: process.env.THESCORE_NAME || 'The Score Bet',
        bookmakerBaseUrl: process.env.THESCORE_BOOKMAKER_BASE_URL || 'https://sportsbook.thescore.bet',
        cookie: process.env.THESCORE_COOKIE,
        anonAuth: process.env.THESCORE_ANON_AUTH
      }
    })
  }
  if (process.env.POLYMARKET_POLL_URL || process.env.POLYMARKET_GAMMA_URL) {
    books.push({
      bookId: 'polymarket',
      name: process.env.POLYMARKET_NAME || 'Polymarket',
      adapter: 'polymarket',
      config: {
        bookId: 'polymarket',
        pollUrl: process.env.POLYMARKET_POLL_URL || process.env.POLYMARKET_GAMMA_URL,
        sportsbookName: process.env.POLYMARKET_NAME || 'Polymarket',
        bookmakerBaseUrl: process.env.POLYMARKET_BOOKMAKER_BASE_URL || 'https://polymarket.com',
        booksUrl: process.env.POLYMARKET_BOOKS_URL || process.env.POLYMARKET_PRICES_URL || null
      }
    })
  }
  if (process.env.KALSHI_POLL_URL || process.env.KALSHI_API_URL) {
    books.push({
      bookId: 'kalshi',
      name: process.env.KALSHI_NAME || 'Kalshi',
      adapter: 'kalshi',
      config: {
        bookId: 'kalshi',
        pollUrl: process.env.KALSHI_POLL_URL || process.env.KALSHI_API_URL,
        sportsbookName: process.env.KALSHI_NAME || 'Kalshi',
        bookmakerBaseUrl: process.env.KALSHI_BOOKMAKER_BASE_URL || 'https://kalshi.com'
      }
    })
  }
  return books
}

const adapterCache = new Map()

export async function getAdapter(bookId) {
  if (adapterCache.has(bookId)) return adapterCache.get(bookId)
  const cfg = discoverConfiguredBooks().find((b) => b.bookId === bookId)
  if (!cfg) return null

  let Adapter
  if (cfg.adapter === 'fanduel') {
    Adapter = (await load('adapters/fanduel.js')).FanDuelAdapter
  } else if (cfg.adapter === 'bovada') {
    Adapter = (await load('adapters/bovada.js')).BovadaAdapter
  } else if (cfg.adapter === 'pointsbet') {
    Adapter = (await load('adapters/pointsbet.js')).PointsBetAdapter
  } else if (cfg.adapter === 'betmgm') {
    Adapter = (await load('adapters/betmgm.js')).BetMGMAdapter
  } else if (cfg.adapter === '888sport') {
    Adapter = (await load('adapters/eightsport.js')).EightEightEightAdapter
  } else if (cfg.adapter === 'thescore') {
    Adapter = (await load('adapters/thescore.js')).TheScoreAdapter
  } else if (cfg.adapter === 'polymarket') {
    Adapter = (await load('adapters/polymarket.js')).PolymarketAdapter
  } else if (cfg.adapter === 'kalshi') {
    Adapter = (await load('adapters/kalshi.js')).KalshiAdapter
  } else {
    Adapter = (await load('adapters/poll.js')).PollAdapter
  }

  const adapter = new Adapter(cfg.config)
  const leagueKey = process.env.LEAGUE_KEY || 'betrivers_live'
  let lastEntries = []
  let lastMeta = {}
  await adapter.start(leagueKey, (entries, meta) => {
    lastEntries = Array.isArray(entries) ? entries : []
    lastMeta = meta || {}
  })
  if (typeof adapter.setAutoPoll === 'function') adapter.setAutoPoll(false)

  const wrapped = {
    bookId,
    name: cfg.name,
    adapter,
    async fetchOnce() {
      lastEntries = []
      lastMeta = {}
      if (typeof adapter.fetchOnce === 'function') await adapter.fetchOnce()
      return { entries: lastEntries, meta: lastMeta }
    },
    stop() {
      adapter.stop()
    }
  }
  adapterCache.set(bookId, wrapped)
  return wrapped
}

export function listKnownBookIds() {
  return discoverConfiguredBooks().map((b) => ({ id: b.bookId, name: b.name, configured: true }))
}
