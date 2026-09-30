function hostOf(url) {
  try {
    return new URL(url).host
  } catch {
    return 'invalid-url'
  }
}

function terminalBase() {
  let url = String(process.env.TERMINAL_URL || '').trim()
  if (!url) return ''
  const lower = url.toLowerCase()
  if (lower.startsWith('wss://')) url = 'https://' + url.slice(6)
  else if (lower.startsWith('ws://')) url = 'http://' + url.slice(5)
  return url.replace(/\/+$/, '')
}

export async function pushWebhook(snapshot) {
  const url = String(process.env.WEBHOOK_URL || '').trim()
  if (!url) return
  const headers = { 'Content-Type': 'application/json' }
  const secret = String(process.env.WEBHOOK_SECRET || '').trim()
  if (secret) headers['X-OddsLocker-Secret'] = secret
  const data = snapshot.data || []
  const body = {
    type: 'odds_snapshot',
    ts: snapshot.ts,
    data,
    books: snapshot.books || [],
    entryCount: data.length,
    durationMs: snapshot.durationMs,
    errors: snapshot.errors || []
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000)
    })
    if (!res.ok) {
      const text = await res.text()
      console.warn('[Engine] Webhook failed:', res.status, text.slice(0, 160))
    } else {
      console.log('[Engine] Webhook OK →', hostOf(url), data.length, 'entries')
    }
  } catch (e) {
    console.warn('[Engine] Webhook error:', e.message)
  }
}

async function pushTerminal(snapshot, leagueWatcher) {
  const base = terminalBase()
  const sourceId = String(process.env.SOURCE_ID || '').trim()
  if (!base || !sourceId) return
  const data = Array.isArray(snapshot.data) ? snapshot.data : []
  const headers = { 'Content-Type': 'application/json' }
  const ingestSecret = String(process.env.TERMINAL_INGEST_SECRET || '').trim()
  if (ingestSecret) headers['X-Terminal-Ingest-Secret'] = ingestSecret
  const body = { sourceId, data }
  if (leagueWatcher && typeof leagueWatcher === 'object') body.leagueWatcher = leagueWatcher
  try {
    const res = await fetch(`${base}/ingest`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000)
    })
    const text = await res.text()
    let parsed = null
    try { parsed = JSON.parse(text) } catch { parsed = null }
    if (!res.ok) {
      console.warn('[Engine] Terminal push failed:', res.status, text.slice(0, 160))
      return
    }
    if (parsed?.skipped) {
      console.warn('[Engine] Terminal ignored this batch:', parsed.reason || 'skipped', '| source', sourceId)
      return
    }
    console.log('[Engine] Terminal OK →', hostOf(base), data.length, 'entries | source', sourceId)
  } catch (e) {
    console.warn('[Engine] Terminal push error:', e.message)
  }
}

/** Post a finished batch to the terminal and, when set, WEBHOOK_URL. */
export async function deliverSnapshot(snapshot, leagueWatcher) {
  const webhookUrl = String(process.env.WEBHOOK_URL || '').trim()
  const base = terminalBase()
  const sourceId = String(process.env.SOURCE_ID || '').trim()
  if (!webhookUrl && !base) {
    console.warn('[Engine] Batch stayed on this machine. Set TERMINAL_URL or WEBHOOK_URL.')
    return
  }
  if (base && !sourceId) {
    console.warn('[Engine] TERMINAL_URL is set but SOURCE_ID is empty, so the terminal was not posted.')
  }
  await Promise.all([
    webhookUrl ? pushWebhook(snapshot) : Promise.resolve(),
    base && sourceId ? pushTerminal(snapshot, leagueWatcher) : Promise.resolve()
  ])
}
