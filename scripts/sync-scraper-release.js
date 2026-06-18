#!/usr/bin/env node
/**
 * Sync terminal/scraper-release.json from desktop/package.json after a version bump.
 * Usage: node scripts/sync-scraper-release.js
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const desktopPkg = JSON.parse(
  fs.readFileSync(path.join(root, 'desktop/package.json'), 'utf8')
)
const version = String(desktopPkg.version || '').trim()
if (!version) {
  console.error('desktop/package.json has no version')
  process.exit(1)
}

const manifest = {
  version,
  filename: `OddsLocker Scraper-Setup-${version}.exe`,
  productName: 'OddsLocker Scraper'
}
const outPath = path.join(root, 'terminal/scraper-release.json')
fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8')
console.log('Wrote', outPath, '→', manifest.filename)
