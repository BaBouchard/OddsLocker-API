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
export async function pushToTerminal(entries, terminalUrl, sourceId) {
  if (!terminalUrl || !sourceId) return
  const url = `${terminalUrl.replace(/\/$/, '')}/ingest`
  const data = Array.isArray(entries) ? entries : []
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceId, data })
    })
    if (!res.ok) throw new Error(await res.text())
    if (data.length) console.log('[LiveOdds] Pushed', data.length, 'entries to terminal')
  } catch (e) {
    console.warn('[LiveOdds] Push to terminal failed:', e.message)
  }
}
