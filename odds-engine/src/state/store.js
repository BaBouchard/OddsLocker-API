import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createDefaultState } from './defaults.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.OL_ENGINE_DATA_DIR
  ? path.resolve(process.env.OL_ENGINE_DATA_DIR)
  : path.join(__dirname, '../../data')
const STATE_PATH = path.join(DATA_DIR, 'state.json')

let state = null
let saveTimer = null
/** @type {Set<(s: object) => void>} */
const listeners = new Set()

export function getState() {
  if (!state) loadState()
  return state
}

export function loadState() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
    if (fs.existsSync(STATE_PATH)) {
      const raw = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'))
      state = migrateState(raw)
    } else {
      state = createDefaultState()
      persistNow()
    }
  } catch (e) {
    console.warn('[Engine] Failed to load state, using defaults:', e.message)
    state = createDefaultState()
  }
  return state
}

function migrateState(raw) {
  const base = createDefaultState()
  return {
    ...base,
    ...raw,
    channels: Array.isArray(raw.channels) && raw.channels.length ? raw.channels : base.channels,
    batches: Array.isArray(raw.batches) && raw.batches.length ? raw.batches : base.batches,
    proxies: Array.isArray(raw.proxies) ? raw.proxies : [],
    fleet: { ...base.fleet, ...(raw.fleet || {}) },
    stats: { ...base.stats, ...(raw.stats || {}) }
  }
}

export function persistSoon() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    persistNow()
    saveTimer = null
  }, 400)
}

export function persistNow() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
    fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2))
  } catch (e) {
    console.warn('[Engine] Persist failed:', e.message)
  }
}

export function notify() {
  const snap = getPublicState()
  for (const fn of listeners) {
    try {
      fn(snap)
    } catch (_) {}
  }
}

export function onStateChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function patchState(mutator) {
  const s = getState()
  mutator(s)
  s.updatedAt = Date.now()
  s.rev = (s.rev || 0) + 1
  persistSoon()
  notify()
  return s
}

export function getPublicState() {
  const s = getState()
  const proxies = s.proxies || []
  const proxyStats = {
    total: proxies.length,
    available: proxies.filter((p) => p.status === 'available').length,
    inUse: proxies.filter((p) => p.status === 'in_use').length,
    bad: proxies.filter((p) => p.status === 'bad').length
  }
  return {
    rev: s.rev,
    updatedAt: s.updatedAt,
    fleet: { ...s.fleet },
    channels: s.channels.map((c) => ({ ...c })),
    batches: s.batches.map((b) => ({ ...b, books: [...(b.books || [])] })),
    proxies: proxies.map((p) => ({
      id: p.id,
      label: p.label || '',
      status: p.status,
      failCount: p.failCount || 0,
      lastError: p.lastError || '',
      lastUsedAt: p.lastUsedAt || 0,
      // never expose full credentials in list beyond truncated tip
      tip: String(p.url || '').replace(/:[^:@/]+@/, ':***@').slice(0, 48)
    })),
    proxyStats,
    snapshot: s.snapshot
      ? {
          ts: s.snapshot.ts,
          entryCount: Array.isArray(s.snapshot.data) ? s.snapshot.data.length : 0,
          books: s.snapshot.books || [],
          channelMap: s.snapshot.channelMap || {},
          durationMs: s.snapshot.durationMs || 0,
          errors: s.snapshot.errors || []
        }
      : null,
    leagueWatcher: s.leagueWatcher || null,
    stats: { ...s.stats }
  }
}

export function getSnapshotData() {
  return getState().snapshot?.data || []
}

export function getFullSnapshot() {
  return getState().snapshot || null
}
