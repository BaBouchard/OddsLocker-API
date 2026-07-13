#!/usr/bin/env node
/**
 * Prepare OddsLocker Scraper v2 desktop build:
 * - refresh icons from desktop/assets
 * - copy scraper adapters into desktop-v2/vendor/scraper-src
 * - ensure odds-engine dependencies are installed
 * - copy bundled default.env
 */
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const v2 = path.join(root, 'desktop-v2')
const assetsSrc = path.join(root, 'desktop', 'assets')
const assetsDst = path.join(v2, 'assets')
const vendorSrc = path.join(v2, 'vendor', 'scraper-src')
const engine = path.join(root, 'odds-engine')

fs.mkdirSync(assetsDst, { recursive: true })
for (const name of ['icon.png', 'icon.ico', 'icon-square.png']) {
  const from = path.join(assetsSrc, name)
  if (fs.existsSync(from)) fs.copyFileSync(from, path.join(assetsDst, name))
}

// Icons via existing script if ico missing
if (!fs.existsSync(path.join(assetsDst, 'icon.ico')) && fs.existsSync(path.join(assetsDst, 'icon.png'))) {
  try {
    execSync('node scripts/prepare-desktop-icons.js', { cwd: root, stdio: 'inherit' })
    fs.copyFileSync(path.join(assetsSrc, 'icon.ico'), path.join(assetsDst, 'icon.ico'))
  } catch (e) {
    console.warn('[prepare-desktop-v2] icon.ico prepare skipped:', e.message)
  }
}

fs.mkdirSync(vendorSrc, { recursive: true })
const adaptersSrc = path.join(root, 'src', 'adapters')
const adaptersDst = path.join(vendorSrc, 'adapters')
fs.mkdirSync(adaptersDst, { recursive: true })
for (const f of fs.readdirSync(adaptersSrc)) {
  if (f.endsWith('.js')) {
    fs.copyFileSync(path.join(adaptersSrc, f), path.join(adaptersDst, f))
  }
}
for (const f of ['schema.js', 'bovada-league-watcher.js', 'league-watcher-cache.js']) {
  const p = path.join(root, 'src', f)
  if (fs.existsSync(p)) fs.copyFileSync(p, path.join(vendorSrc, f))
}

const bundledDir = path.join(v2, 'bundled')
fs.mkdirSync(bundledDir, { recursive: true })
const legacyBundled = path.join(root, 'desktop', 'bundled', 'default.env')
const engineExample = path.join(engine, '.env.example')
const rootEnv = path.join(root, '.env')
let envOut = path.join(bundledDir, 'default.env')
if (fs.existsSync(legacyBundled)) {
  fs.copyFileSync(legacyBundled, envOut)
} else if (fs.existsSync(rootEnv)) {
  // Do not ship secrets from developer .env into git; only use for local dist builds
  fs.copyFileSync(rootEnv, envOut)
  console.warn('[prepare-desktop-v2] Using repo .env for bundled default.env (local build only)')
} else if (fs.existsSync(engineExample)) {
  fs.copyFileSync(engineExample, envOut)
}

console.log('[prepare-desktop-v2] Installing odds-engine deps…')
execSync('npm install --omit=dev', { cwd: engine, stdio: 'inherit' })

console.log('[prepare-desktop-v2] Ready.')
