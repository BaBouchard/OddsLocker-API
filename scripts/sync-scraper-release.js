#!/usr/bin/env node
/**
 * Sync terminal/scraper-release.json from desktop/package.json after a version bump.
 * Writes versioned .env template to terminal/downloads/ and builds release zip when installer exists.
 * Usage: node scripts/sync-scraper-release.js
 */
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
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

const filename = `OddsLocker Scraper-Setup-${version}.exe`
const envFilename = `.env ${version}`
const bundleFilename = `OddsLocker-Scraper-${version}.zip`
const downloadsDir = path.join(root, 'terminal/downloads')
const envExamplePath = path.join(root, '.env.example')
const installerPath = path.join(root, 'desktop/release', filename)
const envPath = path.join(downloadsDir, envFilename)
const bundlePath = path.join(downloadsDir, bundleFilename)
const readmePath = path.join(downloadsDir, `README ${version}.txt`)

fs.mkdirSync(downloadsDir, { recursive: true })

const envExample = fs.readFileSync(envExamplePath, 'utf8')
const envHeader = [
  `# OddsLocker Scraper environment template v${version}`,
  '# Copy to .env or import via File → Settings in the desktop app.',
  '# Fill in poll URLs, cookies, TERMINAL_URL, SOURCE_ID, and book toggles before running.',
  ''
].join('\n')
fs.writeFileSync(envPath, envHeader + envExample, 'utf8')
console.log('Wrote', envPath)

const readme = [
  `OddsLocker Scraper ${version}`,
  '',
  'Contents:',
  `  - ${filename}`,
  `  - ${envFilename}`,
  '',
  'Setup:',
  '  1. Run the installer.',
  '  2. Open File → Settings and import the .env file (or rename it to .env).',
  '  3. Set TERMINAL_URL, SOURCE_ID, and any book URLs/cookies you use.',
  '  4. Finish setup and enable Resume pushing.',
  ''
].join('\n')
fs.writeFileSync(readmePath, readme, 'utf8')

if (fs.existsSync(installerPath)) {
  if (fs.existsSync(bundlePath)) fs.unlinkSync(bundlePath)
  execSync(
    `zip -j ${JSON.stringify(bundlePath)} ${JSON.stringify(installerPath)} ${JSON.stringify(envPath)} ${JSON.stringify(readmePath)}`,
    { stdio: 'inherit' }
  )
  console.log('Wrote', bundlePath)
} else {
  console.warn('Installer not found (skip zip):', installerPath)
  console.warn('Build with: cd desktop && npm run dist')
}

const manifest = {
  version,
  filename,
  envFilename,
  bundleFilename,
  productName: 'OddsLocker Scraper'
}
const outPath = path.join(root, 'terminal/scraper-release.json')
fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8')
console.log('Wrote', outPath)
