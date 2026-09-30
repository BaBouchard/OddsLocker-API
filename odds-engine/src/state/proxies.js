import crypto from 'node:crypto'
import { patchState, getState } from './store.js'

function asProxyUrl(url) {
  try {
    const parsed = new URL(url)
    if (!parsed.hostname || !parsed.protocol) return null
    return parsed.href
  } catch {
    return null
  }
}

/** One proxy per line. Semicolons stay in the line because providers put them in the login. */
export function linesFromProxyText(text) {
  return String(text || '')
    .split(/\r\n|\n|\r|\u2028|\u2029/)
    .map((line) => line.trim())
    .filter(Boolean)
}

/** Accept URL, user:pass@host:port, host:port, and host:port:user:pass. */
export function normalizeProxyUrl(line) {
  const raw = String(line || '').trim()
  if (!raw) return null
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) return asProxyUrl(raw)

  const hostPortUser = raw.match(/^([^:\s]+):(\d+):([^:]+):(.+)$/)
  if (hostPortUser) {
    const [, host, port, user, pass] = hostPortUser
    const url = new URL(`http://${host}:${port}`)
    url.username = user
    url.password = pass
    return asProxyUrl(url.href)
  }

  if (raw.includes('@')) return asProxyUrl('http://' + raw)
  if (/^[^:\s]+:\d+$/.test(raw)) return asProxyUrl('http://' + raw)
  return asProxyUrl('http://' + raw)
}

export function addProxiesFromText(text) {
  const lines = linesFromProxyText(text)
  const added = []
  const rejected = []
  patchState((s) => {
    for (const line of lines) {
      const url = normalizeProxyUrl(line)
      if (!url) {
        rejected.push(line)
        continue
      }
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
      added.push(row.id)
    }
  })
  return { added: added.length, rejected, skipped: 0 }
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
  }, { silent: true })
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
  }, { silent: true })
}

export function markProxyBad(id, error = '') {
  releaseProxy(id, { bad: true, error })
}
