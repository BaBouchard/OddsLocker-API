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
const installerPath = path.join(root, 'desktop/release', filename)
const envPath = path.join(downloadsDir, envFilename)
const bundlePath = path.join(downloadsDir, bundleFilename)
const readmePath = path.join(downloadsDir, `README ${version}.txt`)

fs.mkdirSync(downloadsDir, { recursive: true })

execSync(`FORCE_PUBLIC_ENV=1 OUT_PATH=${JSON.stringify(envPath)} node scripts/prepare-desktop-bundle-env.js`, {
  cwd: root,
  stdio: 'inherit'
})
console.log('Wrote public env template', envPath)

const readme = [
  `OddsLocker Scraper ${version}`,
  '',
  'Contents:',
  `  - ${filename}`,
  `  - ${envFilename}`,
  '',
  'Setup:',
  '  1. Run the installer (books .env is included — no manual import needed).',
  '  2. Choose VPS slot + terminal URL in the setup wizard, then Finish & start.',
  '  3. Optional: File → Settings → replace .env if you need different book cookies.',
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
