import { normalizeTerminalBaseUrl } from './push.js'

/**
 * Poll terminal VPS control config and apply to local scraper runtime.
 * @param {{ terminalUrl: string, sourceId: string, getAdapters: () => unknown[], getBroadcastServer?: () => { broadcastControl?: (m: object) => void }|null, onConfigApplied?: (cfg: object) => void }} opts
 */
export function createTerminalControl(opts) {
  const base = normalizeTerminalBaseUrl(opts.terminalUrl)
  const sourceId = String(opts.sourceId || '').trim()
  const ingestSecret = String(process.env.TERMINAL_INGEST_SECRET || '').trim()

  let lastRev = -1
  let lastConfig = null
  let pollTimer = null
  let staggerTimer = null
  let pushingEnabled = true
  let autoPollEnabled = false
  let pollIntervalMs = Number(process.env.POLL_INTERVAL_MS) || 2000
  let leagueWatcherPush = true
  let configPollSec = 5

  async function fetchConfig() {
    if (!base || !sourceId) return null
    const url = `${base}/api/scraper-config?sourceId=${encodeURIComponent(sourceId)}`
    const headers = {}
    if (ingestSecret) headers['X-Terminal-Ingest-Secret'] = ingestSecret
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(12000) })
      if (!res.ok) {
        const text = await res.text()
        console.warn('[LiveOdds] Control config fetch failed:', res.status, text.slice(0, 120))
        return null
      }
      return await res.json()
    } catch (e) {
      console.warn('[LiveOdds] Control config fetch error:', e.message)
      return null
    }
  }

  function applyPollInterval(adapters, ms) {
    for (const a of adapters) {
      if (a?.config && typeof a.config === 'object') a.config.pollIntervalMs = ms
    }
  }

  function applyAutoPoll(adapters, enabled) {
    for (const a of adapters) {
      if (typeof a?.setAutoPoll === 'function') a.setAutoPoll(!!enabled)
    }
  }

  function runCommand(adapters, command) {
    if (!command || !command.type) return
    if (command.type === 'fetchOnce') {
      const bookIds = Array.isArray(command.bookIds) ? command.bookIds : null
      const toFetch = bookIds?.length
        ? adapters.filter((a) => a?.bookId && bookIds.includes(a.bookId))
        : adapters
      toFetch.forEach((a) => typeof a?.fetchOnce === 'function' && a.fetchOnce())
      console.log('[LiveOdds] Remote command: fetchOnce', bookIds?.length ? bookIds.join(',') : 'all')
    }
    if (command.type === 'disengage') {
      pushingEnabled = false
      applyAutoPoll(adapters, false)
      console.log('[LiveOdds] Remote command: disengage (push paused)')
    }
    if (command.type === 'resume') {
      pushingEnabled = true
      applyAutoPoll(adapters, autoPollEnabled)
      console.log('[LiveOdds] Remote command: resume')
    }
  }

  function scheduleAutoPoll(adapters, cfg) {
    if (staggerTimer) {
      clearTimeout(staggerTimer)
      staggerTimer = null
    }
    const delay = Number(cfg.staggerDelayMs) || 0
    if (!cfg.pushEnabled || !cfg.autoPoll) {
      applyAutoPoll(adapters, false)
      return
    }
    const start = () => {
      autoPollEnabled = true
      applyAutoPoll(adapters, true)
    }
    if (delay > 0) {
      staggerTimer = setTimeout(start, delay)
    } else {
      start()
    }
  }

  async function pollAndApply() {
    const cfg = await fetchConfig()
    if (!cfg) return
    configPollSec = Number(cfg.configPollSec) || configPollSec
    const adapters = opts.getAdapters() || []

    if (cfg.remoteOrchestration === false) {
      lastConfig = cfg
      lastRev = cfg.rev
      return
    }

    if (cfg.rev !== lastRev) {
      lastRev = cfg.rev
      lastConfig = cfg
      pushingEnabled = !!cfg.pushEnabled
      pollIntervalMs = Number(cfg.pollIntervalMs) || pollIntervalMs
      leagueWatcherPush = cfg.leagueWatcherPush !== false
      autoPollEnabled = !!cfg.autoPoll
      applyPollInterval(adapters, pollIntervalMs)
      scheduleAutoPoll(adapters, cfg)
      if (!cfg.pushEnabled) applyAutoPoll(adapters, false)
      if (cfg.maintenanceNote) {
        console.log('[LiveOdds] Control note:', cfg.maintenanceNote)
      }
      opts.onConfigApplied?.(cfg)
      console.log(
        '[LiveOdds] Control config rev',
        cfg.rev,
        '| push:',
        cfg.pushEnabled,
        '| autoPoll:',
        cfg.autoPoll,
        '| interval:',
        pollIntervalMs + 'ms'
      )
    }

    if (cfg.remoteOrchestration === false) return
    if (cfg.command) runCommand(adapters, cfg.command)
  }

  function start() {
    if (!base || !sourceId) return
    pollAndApply()
    const tick = () => {
      pollTimer = setTimeout(async () => {
        await pollAndApply()
        tick()
      }, Math.max(3000, configPollSec * 1000))
    }
    tick()
  }

  function stop() {
    if (pollTimer) clearTimeout(pollTimer)
    if (staggerTimer) clearTimeout(staggerTimer)
    pollTimer = null
    staggerTimer = null
  }

  return {
    start,
    stop,
    shouldPush() {
      return pushingEnabled && lastConfig?.pushEnabled !== false
    },
    shouldPushLeagueWatcher() {
      return leagueWatcherPush
    },
    getConfig() {
      return lastConfig
    }
  }
}
