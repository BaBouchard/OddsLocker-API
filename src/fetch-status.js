/** Status flags adapters attach to a fetch so a later batch analysis can tell a block from an empty slate. */

export function blockedMeta(status, body) {
  const code = Number(status) || 0
  const snippet = String(body || '').slice(0, 800)
  const wall = /just a moment|cloudflare|attention required|cf-browser-verification/i.test(snippet)
  if (code === 401 || code === 403 || code === 429 || wall) {
    const shown = code || 403
    return {
      blocked: true,
      blockReason: wall ? `HTTP ${shown} Cloudflare` : `HTTP ${shown}`
    }
  }
  return { failed: true, blockReason: code ? `HTTP ${code}` : 'Request failed' }
}

export function errorMeta(err) {
  const name = err?.name || ''
  const msg = err?.message || String(err || '')
  const http = msg.match(/\b(401|403|429)\b/)
  if (http || /forbidden|just a moment|cloudflare/i.test(msg)) {
    const code = http ? http[1] : '403'
    const wall = /just a moment|cloudflare/i.test(msg)
    return {
      blocked: true,
      timedOut: false,
      blockReason: wall ? `HTTP ${code} Cloudflare` : `HTTP ${code}`
    }
  }
  if (name === 'AbortError' || /aborted|timeout|timed out/i.test(msg)) {
    return {
      blocked: false,
      timedOut: true,
      blockReason: 'Timed out before the snapshot finished'
    }
  }
  return { blocked: false, timedOut: false, blockReason: '' }
}

/**
 * Combine per-request flags. A book is blocked only when nothing came back
 * and at least one request was rejected. A successful empty response is an empty slate.
 */
export function summarizeFlags(flags) {
  const list = Array.isArray(flags) ? flags : []
  const blocked = list.filter((f) => f && f.blocked)
  const timed = list.filter((f) => f && f.timedOut)
  const ok = list.some((f) => f && f.ok)
  if (ok && blocked.length) {
    return {
      blocked: false,
      timedOut: false,
      blockReason: '',
      partialBlock: blocked[0].blockReason || 'Blocked'
    }
  }
  if (ok) return { blocked: false, timedOut: false, blockReason: '' }
  if (blocked.length) {
    return { blocked: true, timedOut: false, blockReason: blocked[0].blockReason || 'Blocked' }
  }
  if (timed.length) {
    return {
      blocked: false,
      timedOut: true,
      blockReason: timed[0].blockReason || 'Timed out before the snapshot finished'
    }
  }
  return { blocked: false, timedOut: false, blockReason: '' }
}
