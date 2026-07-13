import { patchState, getState } from './store.js'

export function setChannelCount(n) {
  const count = Math.max(1, Math.min(50, Math.floor(Number(n)) || 1))
  return patchState((s) => {
    const existing = new Map(s.channels.map((c) => [c.n, c]))
    const next = []
    for (let i = 1; i <= count; i++) {
      if (existing.has(i)) next.push(existing.get(i))
      else {
        next.push({
          id: `ch${i}`,
          n: i,
          enabled: true,
          heat: 0,
          lastUsedAt: 0,
          status: 'idle',
          currentProxyId: null,
          lastBatchId: null,
          lastError: '',
          successCount: 0,
          failCount: 0
        })
      }
    }
    s.channels = next
  })
}

export function updateChannel(id, patch) {
  return patchState((s) => {
    const ch = s.channels.find((c) => c.id === id)
    if (!ch) return
    if (patch.enabled !== undefined) ch.enabled = !!patch.enabled
    if (patch.heat !== undefined) ch.heat = Math.max(0, Math.min(1, Number(patch.heat) || 0))
  })
}

/** Coldest first: oldest lastUsedAt, then lowest heat, then channel number. */
export function pickColdestChannels(need) {
  const s = getState()
  const pool = s.channels.filter((c) => c.enabled && c.status !== 'running')
  pool.sort((a, b) => {
    const au = a.lastUsedAt || 0
    const bu = b.lastUsedAt || 0
    if (au !== bu) return au - bu
    if ((a.heat || 0) !== (b.heat || 0)) return (a.heat || 0) - (b.heat || 0)
    return a.n - b.n
  })
  return pool.slice(0, need)
}

export function bumpChannelHeat(id, ok) {
  patchState((s) => {
    const ch = s.channels.find((c) => c.id === id)
    if (!ch) return
    ch.lastUsedAt = Date.now()
    ch.status = 'idle'
    ch.currentProxyId = null
    if (ok) {
      ch.successCount = (ch.successCount || 0) + 1
      ch.heat = Math.min(1, (ch.heat || 0) + 0.12)
      ch.lastError = ''
    } else {
      ch.failCount = (ch.failCount || 0) + 1
      ch.heat = Math.min(1, (ch.heat || 0) + 0.28)
    }
    // cool all unused channels slightly
    for (const c of s.channels) {
      if (c.id !== id) c.heat = Math.max(0, (c.heat || 0) - 0.02)
    }
  })
}
