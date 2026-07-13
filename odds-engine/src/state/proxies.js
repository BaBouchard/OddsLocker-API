import crypto from 'node:crypto'
import { patchState, getState } from './store.js'

function normalizeProxyUrl(line) {
  let u = String(line || '').trim()
  if (!u) return null
  if (!/^[a-z]+:\/\//i.test(u)) u = 'http://' + u
  try {
    // Validate URL
    // eslint-disable-next-line no-new
    new URL(u)
    return u
  } catch {
    return null
  }
}

export function addProxiesFromText(text) {
  const lines = String(text || '')
    .split(/[\n,;]+/)
    .map((l) => l.trim())
    .filter(Boolean)
  const added = []
  patchState((s) => {
    const existing = new Set(s.proxies.map((p) => p.url))
    for (const line of lines) {
      const url = normalizeProxyUrl(line)
      if (!url || existing.has(url)) continue
      const row = {
        id: 'px_' + crypto.randomBytes(6).toString('hex'),
        url,
        label: '',
        status: 'available',
        failCount: 0,
        lastError: '',
        lastUsedAt: 0
      }
      s.proxies.push(row)
      existing.add(url)
      added.push(row.id)
    }
  })
  return added.length
}

export function removeProxy(id) {
  patchState((s) => {
    s.proxies = s.proxies.filter((p) => p.id !== id)
  })
}

export function resetBadProxies() {
  patchState((s) => {
    for (const p of s.proxies) {
      if (p.status === 'bad') {
        p.status = 'available'
        p.failCount = 0
        p.lastError = ''
      }
    }
  })
}

export function clearAllProxies() {
  patchState((s) => {
    s.proxies = []
  })
}

/** Acquire one available proxy; marks in_use. Returns proxy row or null. */
export function acquireProxy() {
  const s = getState()
  const p = s.proxies.find((x) => x.status === 'available')
  if (!p) return null
  let acquired = null
  patchState((st) => {
    const row = st.proxies.find((x) => x.id === p.id && x.status === 'available')
    if (!row) return
    row.status = 'in_use'
    row.lastUsedAt = Date.now()
    acquired = { ...row }
  })
  return acquired
}

export function releaseProxy(id, { bad = false, error = '' } = {}) {
  if (!id) return
  patchState((s) => {
    const p = s.proxies.find((x) => x.id === id)
    if (!p) return
    if (bad) {
      p.failCount = (p.failCount || 0) + 1
      p.lastError = String(error || '').slice(0, 200)
      p.status = p.failCount >= 2 ? 'bad' : 'available'
    } else {
      p.status = 'available'
      p.lastError = ''
    }
  })
}

export function markProxyBad(id, error = '') {
  releaseProxy(id, { bad: true, error })
}
