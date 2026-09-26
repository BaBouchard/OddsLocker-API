import { getState, patchState, getFullSnapshot } from '../state/store.js'
import { runChannelBatch } from '../workers/run-batch.js'
import { installProxiedGlobalFetch } from '../workers/proxy-fetch.js'
import { pushWebhook } from './webhook.js'

let timer = null
let running = false
/** @type {((snap: object) => void)|null} */
let onSessionComplete = null

export function setSessionCompleteHandler(fn) {
  onSessionComplete = fn
}

export function startScheduler() {
  installProxiedGlobalFetch()
  scheduleNext()
}

export function stopScheduler() {
  if (timer) clearTimeout(timer)
  timer = null
}

function scheduleNext() {
  if (timer) clearTimeout(timer)
  const tick = async () => {
    const fleet = getState().fleet
    const ms = Math.max(1000, Number(fleet.pollIntervalMs) || 5000)
    const started = Date.now()
    if (fleet.autoPoll && fleet.fleetEnabled) {
      try {
        await runPollSession()
      } catch (e) {
        console.warn('[Engine] Session error:', e.message)
      }
    }
    const wait = Math.max(0, ms - (Date.now() - started))
    timer = setTimeout(tick, wait)
  }
  const ms = Math.max(1000, Number(getState().fleet.pollIntervalMs) || 5000)
  timer = setTimeout(tick, ms)
}

export async function runPollSession() {
  if (running) {
    return { ok: false, reason: 'already_running' }
  }
  const s = getState()
  const useProxy = s.fleet.fetchMode === 'proxy'

  const batches = s.batches.filter((b) => Array.isArray(b.books) && b.books.length > 0)
  if (batches.length === 0) {
    return { ok: false, reason: 'no_batches' }
  }

  if (useProxy) {
    const available = (s.proxies || []).filter((p) => p.status === 'available').length
    if (available < batches.length) {
      return {
        ok: false,
        reason: 'not_enough_proxies',
        need: batches.length,
        have: available
      }
    }
  }

  running = true
  const started = Date.now()
  const assignments = batches.map((batch) => ({ batch, useProxy }))

  console.log(
    '[Engine] Sync session:',
    useProxy ? 'proxy pool' : 'local network',
    assignments.map((a) => `${a.batch.id}(${a.batch.books.length} books)`).join(', ')
  )

  let results
  try {
    results = await Promise.all(assignments.map((a) => runChannelBatch(a)))
  } finally {
    running = false
  }

  const allEntries = results.flatMap((r) => r.entries || [])
  const allErrors = results.flatMap((r) =>
    (r.errors || []).map((e) => ({ ...e, batchId: r.batchId }))
  )
  const books = [...new Set(allEntries.map((e) => e.sportsbook).filter(Boolean))]
  let leagueWatcher = null
  for (const r of results) {
    if (r.leagueWatcher) leagueWatcher = r.leagueWatcher
  }

  const snapshot = {
    ts: Date.now(),
    data: allEntries,
    books,
    fetchMode: useProxy ? 'proxy' : 'local',
    durationMs: Date.now() - started,
    errors: allErrors,
    results: results.map((r) => ({
      batchId: r.batchId,
      entries: (r.entries || []).length,
      errors: r.errors || [],
      proxyFailed: !!r.proxyFailed
    }))
  }

  patchState((st) => {
    st.snapshot = snapshot
    if (leagueWatcher) {
      st.leagueWatcher = {
        ...leagueWatcher,
        updatedAt: leagueWatcher.updatedAt || Date.now()
      }
    }
    st.stats.sessions = (st.stats.sessions || 0) + 1
    st.stats.lastSessionAt = snapshot.ts
    st.stats.lastSessionOk = allErrors.length === 0
  })

  if (getState().fleet.webhookEnabled) {
    pushWebhook(snapshot)
  }

  onSessionComplete?.(getFullSnapshot())
  console.log(
    '[Engine] Session done:',
    allEntries.length,
    'entries,',
    allErrors.length,
    'errors,',
    snapshot.durationMs + 'ms'
  )
  return { ok: true, snapshot }
}

export function updateFleet(patch) {
  patchState((s) => {
    if (patch.autoPoll !== undefined) s.fleet.autoPoll = !!patch.autoPoll
    if (patch.fleetEnabled !== undefined) s.fleet.fleetEnabled = !!patch.fleetEnabled
    if (patch.webhookEnabled !== undefined) s.fleet.webhookEnabled = !!patch.webhookEnabled
    if (patch.pollIntervalMs !== undefined) {
      s.fleet.pollIntervalMs = Math.max(1000, Math.min(300000, Number(patch.pollIntervalMs) || 5000))
    }
    if (patch.fetchMode !== undefined) {
      s.fleet.fetchMode = patch.fetchMode === 'proxy' ? 'proxy' : 'local'
    }
  })
  scheduleNext()
}
