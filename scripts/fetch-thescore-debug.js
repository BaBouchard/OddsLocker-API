#!/usr/bin/env node
/**
 * Test The Score Bet Marketplace (Page:Live) fetch. Run from repo root:
 *   node scripts/fetch-thescore-debug.js
 * Requires THESCORE_POLL_URL, THESCORE_COOKIE, THESCORE_ANON_AUTH in .env
 */
import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { TheScoreAdapter } from '../src/adapters/thescore.js'

const url = process.env.THESCORE_POLL_URL
if (!url) {
  console.error('Set THESCORE_POLL_URL in .env')
  process.exit(1)
}

const adapter = new TheScoreAdapter({
  pollUrl: url,
  cookie: process.env.THESCORE_COOKIE,
  anonAuth: process.env.THESCORE_ANON_AUTH,
  origin: process.env.THESCORE_ORIGIN,
  referer: process.env.THESCORE_REFERER,
  sections: process.env.THESCORE_SECTIONS,
  sportsbookName: process.env.THESCORE_NAME || 'The Score Bet',
  bookmakerBaseUrl: process.env.THESCORE_BOOKMAKER_BASE_URL
})

let captured = null
adapter._running = true
adapter._onOdds = (entries) => { captured = entries }
await adapter.fetchOnce()

const outPath = path.join(process.cwd(), 'debug-thescore-response.json')
if (fs.existsSync(outPath)) {
  const raw = JSON.parse(fs.readFileSync(outPath, 'utf8'))
  const pageId = raw?.data?.page?.id
  console.log('Wrote', outPath, '| page:', pageId || '(none)', '| errors:', raw?.errors?.length ?? 0)
} else {
  console.log('No debug file (set DEBUG_THESCORE=1 to save response)')
}

const n = Array.isArray(captured) ? captured.length : 0
console.log('Normalized entries:', n)
if (n > 0) {
  console.log('Sample:', JSON.stringify(captured[0], null, 2))
}
