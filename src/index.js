import 'dotenv/config'
import { createBroadcastServer } from './broadcast.js'
import { pushToApi, pushToTerminal } from './push.js'
import { WebSocketAdapter } from './adapters/websocket.js'
import { PollAdapter } from './adapters/poll.js'
import { FanDuelAdapter } from './adapters/fanduel.js'
import { BovadaAdapter } from './adapters/bovada.js'
import { PointsBetAdapter } from './adapters/pointsbet.js'
import { MockAdapter } from './adapters/mock.js'
import { ScrapeAdapter } from './adapters/scrape.js'

const LEAGUE_KEY = process.env.LEAGUE_KEY || 'basketball_nba'
const WS_PORT = Number(process.env.WS_SERVER_PORT) || 8765
const PUSH_URL = process.env.PUSH_TO_API_URL || ''
const PUSH_KEY = process.env.PUSH_API_KEY || null
const TERMINAL_URL = process.env.TERMINAL_URL || ''
const SOURCE_ID = process.env.SOURCE_ID || 'scraper1'

const defaultSportKey = process.env.SPORT_KEY || LEAGUE_KEY.split('_')[0]
const defaultLeagueTitle = process.env.LEAGUE_TITLE || LEAGUE_KEY

/**
 * Unified book configs: BetRivers (Kambi), optional second Kambi book, and FanDuel.
 * Each has { bookId, name, adapter: 'poll'|'fanduel', config } for creating the right adapter.
 */
function getBookConfigs() {
  const books = []
  if (process.env.SPORTSBOOK_POLL_URL) {
    books.push({
      bookId: 'betrivers',
      name: process.env.SPORTSBOOK_NAME || 'BetRivers',
      adapter: 'poll',
      config: {
        bookId: 'betrivers',
        pollUrl: process.env.SPORTSBOOK_POLL_URL,
        pollIntervalMs: process.env.POLL_INTERVAL_MS || 2000,
        sportKey: defaultSportKey,
        leagueTitle: defaultLeagueTitle,
        sportsbookName: process.env.SPORTSBOOK_NAME || 'BetRivers',
        betOfferTemplate: process.env.SPORTSBOOK_BET_TEMPLATE_URL,
        maxDetailEvents: process.env.MAX_DETAIL_EVENTS || 3,
        bookmakerBaseUrl: process.env.BOOKMAKER_BASE_URL || null
      }
    })
  }
  if (process.env.SPORTSBOOK_2_POLL_URL) {
    books.push({
      bookId: 'book2',
      name: process.env.SPORTSBOOK_2_NAME || 'book2',
      adapter: 'poll',
      config: {
        bookId: 'book2',
        pollUrl: process.env.SPORTSBOOK_2_POLL_URL,
        pollIntervalMs: process.env.POLL_INTERVAL_MS || 2000,
        sportKey: defaultSportKey,
        leagueTitle: defaultLeagueTitle,
        sportsbookName: process.env.SPORTSBOOK_2_NAME || 'book2',
        betOfferTemplate: process.env.SPORTSBOOK_2_BET_TEMPLATE_URL,
        maxDetailEvents: process.env.SPORTSBOOK_2_MAX_DETAIL_EVENTS || process.env.MAX_DETAIL_EVENTS || 3,
        bookmakerBaseUrl: process.env.SPORTSBOOK_2_BOOKMAKER_BASE_URL || null
      }
    })
  }
  if (process.env.FANDUEL_POLL_URL) {
    const fdSport = process.env.FANDUEL_SPORT || process.env.SPORT_KEY || 'basketball'
    const fdLeague = process.env.FANDUEL_LEAGUE || 'NBA'
    books.push({
      bookId: 'fanduel',
      name: process.env.FANDUEL_NAME || 'FanDuel',
      adapter: 'fanduel',
      config: {
        bookId: 'fanduel',
        pollUrl: process.env.FANDUEL_POLL_URL,
        sportKey: fdSport,
        leagueTitle: fdLeague,
        sportsbookName: process.env.FANDUEL_NAME || 'FanDuel',
        bookmakerBaseUrl: process.env.FANDUEL_BOOKMAKER_BASE_URL || 'https://sportsbook.fanduel.com'
      }
    })
  }
  if (process.env.BOVADA_POLL_URL) {
    const bvSport = process.env.BOVADA_SPORT || process.env.SPORT_KEY || 'basketball'
    const bvLeague = process.env.BOVADA_LEAGUE || 'NBA'
    books.push({
      bookId: 'bovada',
      name: process.env.BOVADA_NAME || 'Bovada',
      adapter: 'bovada',
      config: {
        bookId: 'bovada',
        pollUrl: process.env.BOVADA_POLL_URL,
        sportKey: bvSport,
        leagueTitle: bvLeague,
        sportsbookName: process.env.BOVADA_NAME || 'Bovada',
        bookmakerBaseUrl: process.env.BOVADA_BOOKMAKER_BASE_URL || 'https://www.bovada.lv'
      }
    })
  }
  const pointsbetUrls = [
    process.env.POINTSBET_BASKETBALL_URL,
    process.env.POINTSBET_BASEBALL_URL,
    process.env.POINTSBET_SOCCER_URL,
    process.env.POINTSBET_FOOTBALL_URL,
    process.env.POINTSBET_TENNIS_URL
  ].filter(Boolean)
  if (pointsbetUrls.length > 0) {
    books.push({
      bookId: 'pointsbet',
      name: process.env.POINTSBET_NAME || 'PointsBet',
      adapter: 'pointsbet',
      config: {
        bookId: 'pointsbet',
        sportsbookName: process.env.POINTSBET_NAME || 'PointsBet',
        bookmakerBaseUrl: process.env.POINTSBET_BOOKMAKER_BASE_URL || 'https://www.pointsbet.com',
        basketballUrl: process.env.POINTSBET_BASKETBALL_URL,
        baseballUrl: process.env.POINTSBET_BASEBALL_URL,
        soccerUrl: process.env.POINTSBET_SOCCER_URL,
        footballUrl: process.env.POINTSBET_FOOTBALL_URL,
        tennisUrl: process.env.POINTSBET_TENNIS_URL,
        cookie: process.env.POINTSBET_COOKIE || null
      }
    })
  }
  return books
}

/** Legacy: poll-only configs for single-adapter path (no FanDuel in single mode). */
function getPollBookConfigs() {
  const configs = []
  if (process.env.SPORTSBOOK_POLL_URL) {
    configs.push({
      bookId: 'betrivers',
      pollUrl: process.env.SPORTSBOOK_POLL_URL,
      pollIntervalMs: process.env.POLL_INTERVAL_MS || 2000,
      sportKey: defaultSportKey,
      leagueTitle: defaultLeagueTitle,
      sportsbookName: process.env.SPORTSBOOK_NAME || 'BetRivers',
      betOfferTemplate: process.env.SPORTSBOOK_BET_TEMPLATE_URL,
      maxDetailEvents: process.env.MAX_DETAIL_EVENTS || 3,
      bookmakerBaseUrl: process.env.BOOKMAKER_BASE_URL || null
    })
  }
  if (process.env.SPORTSBOOK_2_POLL_URL) {
    configs.push({
      bookId: 'book2',
      pollUrl: process.env.SPORTSBOOK_2_POLL_URL,
      pollIntervalMs: process.env.POLL_INTERVAL_MS || 2000,
      sportKey: defaultSportKey,
      leagueTitle: defaultLeagueTitle,
      sportsbookName: process.env.SPORTSBOOK_2_NAME || 'book2',
      betOfferTemplate: process.env.SPORTSBOOK_2_BET_TEMPLATE_URL,
      maxDetailEvents: process.env.SPORTSBOOK_2_MAX_DETAIL_EVENTS || process.env.MAX_DETAIL_EVENTS || 3,
      bookmakerBaseUrl: process.env.SPORTSBOOK_2_BOOKMAKER_BASE_URL || null
    })
  }
  return configs
}

function selectAdapter() {
  if (process.env.SPORTSBOOK_WS_URL) {
    return new WebSocketAdapter({
      wsUrl: process.env.SPORTSBOOK_WS_URL,
      sportKey: defaultSportKey,
      leagueTitle: defaultLeagueTitle,
      sportsbookName: process.env.SPORTSBOOK_NAME || 'live_book'
    })
  }
  if (process.env.SPORTSBOOK_POLL_URL && !process.env.SPORTSBOOK_2_POLL_URL) {
    const c = getPollBookConfigs()[0]
    return new PollAdapter(c)
  }
  if (process.env.SPORTSBOOK_SCRAPE_URL) {
    return new ScrapeAdapter({
      scrapeUrl: process.env.SPORTSBOOK_SCRAPE_URL,
      pollIntervalMs: process.env.POLL_INTERVAL_MS || 3000,
      sportKey: defaultSportKey,
      leagueTitle: defaultLeagueTitle,
      sportsbookName: process.env.SPORTSBOOK_NAME || 'live_book',
      pageUrl: process.env.SPORTSBOOK_SCRAPE_URL
    })
  }
  console.log('[LiveOdds] No SPORTSBOOK_WS_URL, SPORTSBOOK_POLL_URL, or SPORTSBOOK_SCRAPE_URL set; using mock adapter for testing.')
  return new MockAdapter({
    pollIntervalMs: process.env.POLL_INTERVAL_MS || 3000,
    sportsbookName: 'mock_live',
    sportKey: 'basketball',
    leagueTitle: 'NBA'
  })
}

async function main() {
  const bookConfigs = getBookConfigs()
  const multiBook = bookConfigs.length >= 1

  if (multiBook) {
    // One or more books (BetRivers, FanDuel, etc.): one adapter per book, merge into one feed; fetch once respects checkboxes
    const server = createBroadcastServer(WS_PORT, {
      getState() {
        const pollAdapter = adapters.find((a) => typeof a.autoPoll !== 'undefined')
        const autoPoll = pollAdapter ? pollAdapter.autoPoll : true
        return {
          type: 'state',
          autoPoll,
          books: bookConfigs.map((b) => ({ id: b.bookId, name: b.name }))
        }
      },
      onMessage(ws, msg) {
        if (msg.type === 'setAutoPoll') {
          adapters.forEach((a) => typeof a.setAutoPoll === 'function' && a.setAutoPoll(!!msg.value))
          console.log('[LiveOdds] Auto poll:', msg.value ? 'ON' : 'OFF')
          server.broadcastControl({ type: 'autoPoll', value: !!msg.value })
        }
        if (msg.type === 'fetchOnce') {
          const bookIds = Array.isArray(msg.bookIds) ? msg.bookIds : null
          const toFetch = bookIds?.length
            ? adapters.filter((a) => a.bookId && bookIds.includes(a.bookId))
            : adapters
          if (bookIds?.length) lastFetchBookIds = bookIds
          toFetch.forEach((a) => typeof a.fetchOnce === 'function' && a.fetchOnce())
        }
      }
    })
    console.log(`[LiveOdds] WebSocket server listening on port ${WS_PORT}. Connect to ws://localhost:${WS_PORT}`)

    const lastEntriesByBook = {}
    const adapters = []
    let lastFetchBookIds = null // when set, broadcast only these books' entries (so "Fetch FanDuel only" shows only FanDuel)
    const bookIdToKey = Object.fromEntries(bookConfigs.map((b) => [b.bookId, b.config.sportsbookName]))

    const mergeAndBroadcast = () => {
      let merged
      if (lastFetchBookIds && lastFetchBookIds.length > 0) {
        merged = lastFetchBookIds.flatMap((id) => lastEntriesByBook[bookIdToKey[id]] || [])
        lastFetchBookIds = null
        if (merged.length === 0) merged = Object.values(lastEntriesByBook).flat()
      } else {
        merged = Object.values(lastEntriesByBook).flat()
      }
      server.broadcast(merged)
      if (PUSH_URL) pushToApi(merged, PUSH_URL, PUSH_KEY)
      if (TERMINAL_URL) pushToTerminal(merged, TERMINAL_URL, SOURCE_ID)
    }

    for (const book of bookConfigs) {
      const adapter = book.adapter === 'fanduel'
        ? new FanDuelAdapter(book.config)
        : book.adapter === 'bovada'
          ? new BovadaAdapter(book.config)
          : book.adapter === 'pointsbet'
            ? new PointsBetAdapter(book.config)
            : new PollAdapter(book.config)
      const bookKey = book.config.sportsbookName
      adapters.push(adapter)
      await adapter.start(LEAGUE_KEY, (entries, meta) => {
        lastEntriesByBook[bookKey] = Array.isArray(entries) ? entries : []
        mergeAndBroadcast()
      })
      console.log(`[LiveOdds] Adapter "${adapter.name}" (${adapter.bookId}) started for ${bookKey} (league: ${LEAGUE_KEY})`)
    }

    const shutdown = () => {
      adapters.forEach((a) => a.stop())
      server.close()
      process.exit(0)
    }
    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)
    return
  }

  // Single adapter (poll, WS, scrape, or mock)
  const adapter = selectAdapter()
  const server = createBroadcastServer(WS_PORT, {
    getState() {
      if (typeof adapter.autoPoll !== 'undefined') {
        return { type: 'autoPoll', value: adapter.autoPoll }
      }
      return null
    },
    onMessage(ws, msg) {
      if (msg.type === 'setAutoPoll' && typeof adapter.setAutoPoll === 'function') {
        adapter.setAutoPoll(!!msg.value)
        console.log('[LiveOdds] Auto poll:', adapter.autoPoll ? 'ON' : 'OFF')
        server.broadcastControl({ type: 'autoPoll', value: adapter.autoPoll })
      }
      if (msg.type === 'fetchOnce' && typeof adapter.fetchOnce === 'function') {
        adapter.fetchOnce()
      }
    }
  })
  console.log(`[LiveOdds] WebSocket server listening on port ${WS_PORT}. Connect to ws://localhost:${WS_PORT}`)

  const onOdds = (entries, meta) => {
    server.broadcast(entries, meta)
    if (PUSH_URL) pushToApi(entries, PUSH_URL, PUSH_KEY)
    if (TERMINAL_URL) pushToTerminal(entries, TERMINAL_URL, SOURCE_ID)
  }

  await adapter.start(LEAGUE_KEY, onOdds)
  console.log(`[LiveOdds] Adapter "${adapter.name}" started for league: ${LEAGUE_KEY}`)

  const shutdown = () => {
    adapter.stop()
    server.close()
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((err) => {
  console.error('[LiveOdds] Fatal:', err)
  process.exit(1)
})
