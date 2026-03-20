/**
 * Base URL for HTTP ingest (not WebSocket). Fixes common mistake: TERMINAL_URL=wss://host
 * which breaks Node fetch — ingest must use https:// or http://.
 */
export function normalizeTerminalBaseUrl(terminalUrl) {
  let u = String(terminalUrl ?? '').trim()
  if (!u) return ''
  const lower = u.toLowerCase()
  if (lower.startsWith('wss://')) u = 'https://' + u.slice(6)
  else if (lower.startsWith('ws://')) u = 'http://' + u.slice(5)
  return u.replace(/\/+$/, '')
}

export async function pushToApi(entries, apiBaseUrl, apiKey = null) {
  if (!apiBaseUrl || !entries.length) return
  const url = `${apiBaseUrl.replace(/\/$/, '')}/api/odds-storage/store`
  const headers = { 'Content-Type': 'application/json' }
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`
  const oddsData = entries.map(({ is_live, ...e }) => e)
  try {
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ oddsData }) })
    if (!res.ok) throw new Error(await res.text())
  } catch (e) {
    console.warn('[LiveOdds] Push to API failed:', e.message)
  }
}

/** Push normalized odds to the central terminal (for VPS → terminal flow). */
export async function pushToTerminal(entries, terminalUrl, sourceId, extra = {}) {
  const base = normalizeTerminalBaseUrl(terminalUrl)
  if (!base || !sourceId) {
    if (!base && terminalUrl) {
      console.warn('[LiveOdds] Push to terminal skipped: invalid TERMINAL_URL after normalize (check for typos)')
    }
    return
  }
  const url = `${base}/ingest`
  const data = Array.isArray(entries) ? entries : []
  const headers = { 'Content-Type': 'application/json' }
  const ingestSecret = String(process.env.TERMINAL_INGEST_SECRET || '').trim()
  if (ingestSecret) headers['X-Terminal-Ingest-Secret'] = ingestSecret
  const body = { sourceId, data }
  if (extra.leagueWatcher && typeof extra.leagueWatcher === 'object') {
    body.leagueWatcher = extra.leagueWatcher
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    })
    const text = await res.text()
    if (!res.ok) {
      const hint =
        res.status === 401
          ? ' (check TERMINAL_INGEST_SECRET matches terminal; trim whitespace in .env)'
          : ''
      throw new Error(`${res.status} ${text.slice(0, 200)}${hint}`)
    }
    console.log('[LiveOdds] Pushed', data.length, 'entries to terminal →', base)
  } catch (e) {
    console.warn('[LiveOdds] Push to terminal failed:', e.message, '| POST', url)
  }
}
