export async function pushWebhook(snapshot) {
  const url = String(process.env.WEBHOOK_URL || '').trim()
  if (!url) return
  const headers = { 'Content-Type': 'application/json' }
  const secret = String(process.env.WEBHOOK_SECRET || '').trim()
  if (secret) headers['X-OddsLocker-Secret'] = secret
  const body = {
    type: 'odds_snapshot',
    ts: snapshot.ts,
    data: snapshot.data || [],
    books: snapshot.books || [],
    entryCount: Array.isArray(snapshot.data) ? snapshot.data.length : 0,
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
      console.log('[Engine] Webhook OK →', url)
    }
  } catch (e) {
    console.warn('[Engine] Webhook error:', e.message)
  }
}
