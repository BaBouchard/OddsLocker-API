#!/usr/bin/env node
/**
 * Test Polymarket Gamma + CLOB fetch. Run from repo root:
 *   node scripts/fetch-polymarket-debug.js
 * Optional: POLYMARKET_CATALOG_URL, POLYMARKET_BOOKS_URL, DEBUG_POLYMARKET=1
 */
import 'dotenv/config'
import { PolymarketAdapter } from '../src/adapters/polymarket.js'

const adapter = new PolymarketAdapter({
  sportsbookName: process.env.POLYMARKET_NAME || 'Polymarket',
  bookmakerBaseUrl: process.env.POLYMARKET_BOOKMAKER_BASE_URL,
  catalogUrl: process.env.POLYMARKET_CATALOG_URL,
  booksUrl: process.env.POLYMARKET_BOOKS_URL || process.env.POLYMARKET_PRICES_URL,
  marketTypes: process.env.POLYMARKET_MARKET_TYPES
})

let captured = null
adapter._running = true
adapter._onOdds = (entries) => { captured = entries }
process.env.DEBUG_POLYMARKET = '1'
await adapter.fetchOnce()

const n = Array.isArray(captured) ? captured.length : 0
console.log('Normalized entries:', n)
if (n > 0) {
  console.log('Sample:', JSON.stringify(captured[0], null, 2))
  const books = new Set(captured.map((e) => e.league))
  console.log('Leagues seen:', [...books].slice(0, 10).join(', '))
}
