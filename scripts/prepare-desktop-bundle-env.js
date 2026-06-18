#!/usr/bin/env node
/**
 * Write desktop/bundled/default.env for electron-builder extraResources.
 * Priority: desktop/bundled/scraper.env.local → repo .env → .env.example (+ book toggles).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const bundledDir = path.join(root, 'desktop/bundled')
const outPath = process.env.OUT_PATH
  ? path.resolve(process.env.OUT_PATH)
  : path.join(bundledDir, 'default.env')
const localOverride = path.join(bundledDir, 'scraper.env.local')
const rootEnv = path.join(root, '.env')
const exampleEnv = path.join(root, '.env.example')

let source = 'unknown'
let body = ''

if (process.env.FORCE_PUBLIC_ENV === '1') {
  if (!fs.existsSync(exampleEnv)) {
    console.error('.env.example missing')
    process.exit(1)
  }
  source = '.env.example (public template)'
  body = fs.readFileSync(exampleEnv, 'utf8')
} else if (fs.existsSync(localOverride)) {
  source = 'desktop/bundled/scraper.env.local'
  body = fs.readFileSync(localOverride, 'utf8')
} else if (fs.existsSync(rootEnv)) {
  source = '.env (repo root)'
  body = fs.readFileSync(rootEnv, 'utf8')
} else if (fs.existsSync(exampleEnv)) {
  source = '.env.example'
  body = fs.readFileSync(exampleEnv, 'utf8')
} else {
  console.error('No env source found (.env.example missing)')
  process.exit(1)
}

const version = JSON.parse(
  fs.readFileSync(path.join(root, 'desktop/package.json'), 'utf8')
).version

function upsertEnvKey(content, key, value) {
  const lines = content.split(/\r?\n/)
  const kept = lines.filter((line) => {
    const t = line.trim()
    if (!t || t.startsWith('#')) return true
    const eq = t.indexOf('=')
    if (eq === -1) return true
    return t.slice(0, eq).trim() !== key
  })
  kept.push(`${key}=${value}`)
  return kept.join('\n')
}

if (source === '.env.example' || source === '.env.example (public template)') {
  body = upsertEnvKey(body, 'POLYMARKET_ENABLED', '1')
  body = upsertEnvKey(body, 'KALSHI_ENABLED', '1')
  body = upsertEnvKey(
    body,
    'TERMINAL_URL',
    'https://oddslocker-api-production.up.railway.app'
  )
}

const header = [
  `# OddsLocker Scraper bundled configuration v${version}`,
  `# Source: ${source}`,
  '# Setup wizard merges SOURCE_ID, TERMINAL_URL, and TERMINAL_INGEST_SECRET on first run.',
  ''
].join('\n')

fs.mkdirSync(bundledDir, { recursive: true })
fs.writeFileSync(outPath, header + body.replace(/^\s*\n/, ''), 'utf8')
console.log('Wrote', outPath, 'from', source)
