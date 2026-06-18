#!/usr/bin/env node
/**
 * Test Kalshi sports fetch. Run from repo root:
 *   node scripts/fetch-kalshi-debug.js
 * Optional: KALSHI_API_BASE_URL, KALSHI_SERIES_TICKERS, DEBUG_KALSHI=1
 */
import 'dotenv/config'
import { KalshiAdapter } from '../src/adapters/kalshi.js'

const adapter = new KalshiAdapter({
  sportsbookName: process.env.KALSHI_NAME || 'Kalshi',
  bookmakerBaseUrl: process.env.KALSHI_BOOKMAKER_BASE_URL,
  apiBaseUrl: process.env.KALSHI_API_BASE_URL,
  seriesTickers: process.env.KALSHI_SERIES_TICKERS
})

let captured = null
adapter._running = true
adapter._onOdds = (entries) => { captured = entries }
process.env.DEBUG_KALSHI = '1'
await adapter.fetchOnce()

const n = Array.isArray(captured) ? captured.length : 0
console.log('Normalized entries:', n)
if (n > 0) {
  console.log('Sample:', JSON.stringify(captured[0], null, 2))
  const byType = {}
  for (const e of captured) {
    byType[e.market_type] = (byType[e.market_type] || 0) + 1
  }
  console.log('By market_type:', byType)
  const leagues = new Set(captured.map((e) => e.league))
  console.log('Leagues seen:', [...leagues].slice(0, 12).join(', '))
}
