import { getState, patchState, getFullSnapshot } from '../state/store.js'
import { pickColdestChannels } from '../state/channels.js'
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
  const s = getState()
  const ms = Math.max(1000, Number(s.fleet.pollIntervalMs) || 5000)
  timer = setTimeout(async () => {
    const fleet = getState().fleet
    if (fleet.autoPoll && fleet.fleetEnabled) {
      try {
        await runPollSession()
      } catch (e) {
        console.warn('[Engine] Session error:', e.message)
      }
    }
    scheduleNext()
  }, ms)
}

export async function runPollSession() {
  if (running) {
    return { ok: false, reason: 'already_running' }
  }
  const s = getState()
  if (!s.fleet.fleetEnabled) {
    return { ok: false, reason: 'fleet_disabled' }
  }

  const batches = s.batches.filter((b) => Array.isArray(b.books) && b.books.length > 0)
  if (batches.length === 0) {
    return { ok: false, reason: 'no_batches' }
  }

  const channels = pickColdestChannels(batches.length)
  if (channels.length < batches.length) {
    return {
      ok: false,
      reason: 'not_enough_channels',
      need: batches.length,
      have: channels.length
    }
  }

  running = true
  const started = Date.now()
  const channelMap = {}
  const assignments = batches.map((batch, i) => {
    channelMap[batch.id] = channels[i].id
    return { batch, channel: channels[i] }
  })

  console.log(
    '[Engine] Sync session:',
    assignments.map((a) => `${a.channel.id}→${a.batch.id}(${a.batch.books.length} books)`).join(', ')
  )

  let results
  try {
    results = await Promise.all(assignments.map((a) => runChannelBatch(a)))
  } finally {
    running = false
  }

  const allEntries = results.flatMap((r) => r.entries || [])
  const allErrors = results.flatMap((r) =>
    (r.errors || []).map((e) => ({ ...e, channelId: r.channelId, batchId: r.batchId }))
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
    channelMap,
    durationMs: Date.now() - started,
    errors: allErrors,
    results: results.map((r) => ({
      channelId: r.channelId,
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
    await pushWebhook(snapshot)
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
  })
  scheduleNext()
}
