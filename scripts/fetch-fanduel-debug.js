#!/usr/bin/env node
/**
 * One-off fetch of FanDuel in-play API and write response to debug-fanduel-response.json.
 * Run from project root: node scripts/fetch-fanduel-debug.js
 * Requires .env with FANDUEL_POLL_URL (or pass URL as first arg).
 */
import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const url = process.argv[2] || process.env.FANDUEL_POLL_URL

if (!url) {
  console.error('Set FANDUEL_POLL_URL in .env or pass URL as first argument.')
  process.exit(1)
}

const outPath = path.join(__dirname, '..', 'debug-fanduel-response.json')

async function main() {
  const region = process.env.FANDUEL_REGION || 'US'
  const origin = process.env.FANDUEL_ORIGIN || 'https://sportsbook.fanduel.com'
  console.log('Fetching', url.slice(0, 60) + '...', 'region:', region, 'origin:', origin)
  const res = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
      'x-sportsbook-region': region,
      Referer: origin + '/',
      Origin: origin
    }
  })
  const text = await res.text()
  console.log('Status:', res.status, res.statusText)
  console.log('Content-Type:', res.headers.get('content-type'))
  console.log('Body length:', text.length)
  if (text.length < 500) console.log('Body:', text)
  let data
  try {
    data = JSON.parse(text)
  } catch (e) {
    fs.writeFileSync(outPath, text, 'utf8')
    console.log('Response was not JSON. Wrote raw to', outPath)
    return
  }
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf8')
  console.log('Wrote', outPath)
  console.log('Top-level keys:', Object.keys(data).join(', '))
  const att = data.attachments || {}
  console.log('Attachment keys:', Object.keys(att).join(', '))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
