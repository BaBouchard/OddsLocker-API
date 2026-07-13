export const VPS_SLOTS = Array.from({ length: 10 }, (_, i) => `vps${i + 1}`)

/** @typedef {{ enabled: boolean, pollIntervalSec: number|null, autoPoll: boolean|null, pushEnabled: boolean, maintenanceNote: string }} VpsSlotControl */
/** @typedef {{ fleetEnabled: boolean, remoteOrchestration: boolean, scheduleEpoch: number, defaultPollIntervalSec: number, vpsStaggerSec: number, autoPoll: boolean, leagueWatcherPush: boolean, replaceAllOnIngest: boolean, configPollSec: number }} VpsGlobalControl */

function defaultSlotControl() {
  return {
    enabled: true,
    pollIntervalSec: null,
    autoPoll: null,
    pushEnabled: true,
    maintenanceNote: ''
  }
}

function defaultGlobalControl() {
  return {
    fleetEnabled: true,
    remoteOrchestration: false,
    scheduleEpoch: Date.now(),
    defaultPollIntervalSec: 2,
    vpsStaggerSec: 0.5,
    autoPoll: false,
    leagueWatcherPush: true,
    replaceAllOnIngest: false,
    configPollSec: 5
  }
}

function createDefaultState() {
  /** @type {Record<string, VpsSlotControl>} */
  const slots = {}
  for (const slot of VPS_SLOTS) slots[slot] = defaultSlotControl()
  return {
    rev: 1,
    updatedAt: Date.now(),
    global: defaultGlobalControl(),
    slots,
    /** @type {Record<string, { type: string, at: number, bookIds?: string[] }|null>} */
    pendingCommands: {}
  }
}

let controlState = createDefaultState()

/** @type {Record<string, { type: string, at: number, bookIds?: string[] }|null>} */
const consumedCommands = {}

export function getVpsControlState() {
  return controlState
}

export function resetVpsControlState() {
  controlState = createDefaultState()
  return controlState
}

function clampNum(n, min, max, fallback) {
  const x = Number(n)
  if (!Number.isFinite(x)) return fallback
  return Math.min(max, Math.max(min, x))
}

function mergeSlotControl(prev, patch) {
  if (!patch || typeof patch !== 'object') return prev
  return {
    enabled: patch.enabled !== undefined ? !!patch.enabled : prev.enabled,
    pollIntervalSec:
      patch.pollIntervalSec === null || patch.pollIntervalSec === ''
        ? null
        : patch.pollIntervalSec !== undefined
          ? clampNum(patch.pollIntervalSec, 0.5, 120, prev.pollIntervalSec ?? null)
          : prev.pollIntervalSec,
    autoPoll:
      patch.autoPoll === null
        ? null
        : patch.autoPoll !== undefined
          ? !!patch.autoPoll
          : prev.autoPoll,
    pushEnabled: patch.pushEnabled !== undefined ? !!patch.pushEnabled : prev.pushEnabled,
    maintenanceNote:
      patch.maintenanceNote !== undefined ? String(patch.maintenanceNote).slice(0, 120) : prev.maintenanceNote
  }
}

/**
 * @param {{ global?: Partial<VpsGlobalControl>, slots?: Record<string, Partial<VpsSlotControl>>, command?: { slot: string, type: string, bookIds?: string[] } }} patch
 */
export function updateVpsControlState(patch) {
  if (!patch || typeof patch !== 'object') return controlState
  if (patch.global && typeof patch.global === 'object') {
    const g = patch.global
    const wasRemote = controlState.global.remoteOrchestration
    controlState.global = {
      fleetEnabled: g.fleetEnabled !== undefined ? !!g.fleetEnabled : controlState.global.fleetEnabled,
      remoteOrchestration:
        g.remoteOrchestration !== undefined ? !!g.remoteOrchestration : controlState.global.remoteOrchestration,
      scheduleEpoch: controlState.global.scheduleEpoch,
      defaultPollIntervalSec: g.defaultPollIntervalSec !== undefined
        ? clampNum(g.defaultPollIntervalSec, 0.5, 120, controlState.global.defaultPollIntervalSec)
        : controlState.global.defaultPollIntervalSec,
      vpsStaggerSec: g.vpsStaggerSec !== undefined
        ? clampNum(g.vpsStaggerSec, 0, 30, controlState.global.vpsStaggerSec)
        : controlState.global.vpsStaggerSec,
      autoPoll: g.autoPoll !== undefined ? !!g.autoPoll : controlState.global.autoPoll,
      leagueWatcherPush: g.leagueWatcherPush !== undefined ? !!g.leagueWatcherPush : controlState.global.leagueWatcherPush,
      replaceAllOnIngest: g.replaceAllOnIngest !== undefined ? !!g.replaceAllOnIngest : controlState.global.replaceAllOnIngest,
      configPollSec: g.configPollSec !== undefined
        ? clampNum(g.configPollSec, 3, 120, controlState.global.configPollSec)
        : controlState.global.configPollSec
    }
    const nowRemote = controlState.global.remoteOrchestration
    if (nowRemote && !wasRemote) {
      controlState.global.scheduleEpoch = Date.now()
    }
    if (g.scheduleEpoch !== undefined && Number.isFinite(Number(g.scheduleEpoch))) {
      controlState.global.scheduleEpoch = Number(g.scheduleEpoch)
    }
  }
  if (patch.slots && typeof patch.slots === 'object') {
    for (const slot of VPS_SLOTS) {
      if (patch.slots[slot]) {
        controlState.slots[slot] = mergeSlotControl(controlState.slots[slot], patch.slots[slot])
      }
    }
  }
  if (patch.command && typeof patch.command === 'object') {
    const slot = String(patch.command.slot || '').trim()
    const type = String(patch.command.type || '').trim()
    if (VPS_SLOTS.includes(slot) && type) {
      controlState.pendingCommands[slot] = {
        type,
        at: Date.now(),
        bookIds: Array.isArray(patch.command.bookIds) ? patch.command.bookIds : undefined
      }
    }
  }
  controlState.rev += 1
  controlState.updatedAt = Date.now()
  return controlState
}

export function sourceToSlot(sourceId) {
  if (!sourceId) return null
  const s = String(sourceId).toLowerCase()
  const m = s.match(/^(?:vps|scraper)(\d+)$/)
  const slot = m ? `vps${m[1]}` : (VPS_SLOTS.includes(s) ? s : null)
  return slot && VPS_SLOTS.includes(slot) ? slot : null
}

/** Resolved runtime config for a scraper instance. */
export function resolveScraperConfig(sourceId) {
  const slot = sourceToSlot(sourceId)
  const g = controlState.global
  const slotCfg = slot ? controlState.slots[slot] : null
  const slotNum = slot ? Number(slot.replace('vps', '')) : 0
  const slotEnabled = slotCfg ? slotCfg.enabled : true
  const fleetOk = g.fleetEnabled

  const base = {
    rev: controlState.rev,
    slot,
    sourceId: String(sourceId || ''),
    remoteOrchestration: !!g.remoteOrchestration,
    fleetEnabled: fleetOk,
    slotEnabled,
    configPollSec: g.configPollSec,
    maintenanceNote: slotCfg?.maintenanceNote || ''
  }

  if (!g.remoteOrchestration) {
    return {
      ...base,
      pushEnabled: true,
      autoPoll: false,
      pollIntervalMs: null,
      staggerDelayMs: 0,
      leagueWatcherPush: true,
      replaceAllOnIngest: false,
      command: null
    }
  }

  const pollSec =
    slotCfg?.pollIntervalSec != null ? slotCfg.pollIntervalSec : g.defaultPollIntervalSec
  const autoPoll = slotCfg?.autoPoll != null ? slotCfg.autoPoll : g.autoPoll
  const pushEnabled = slotCfg ? slotCfg.pushEnabled : true
  const active = fleetOk && slotEnabled && pushEnabled

  let command = null
  if (slot && controlState.pendingCommands[slot]) {
    command = controlState.pendingCommands[slot]
    consumedCommands[slot] = command
    delete controlState.pendingCommands[slot]
  }

  return {
    ...base,
    pushEnabled: active,
    autoPoll: active ? autoPoll : false,
    pollIntervalMs: Math.round(clampNum(pollSec, 0.5, 120, 2) * 1000),
    staggerDelayMs: Math.round(clampNum(g.vpsStaggerSec, 0, 30, 0) * Math.max(0, slotNum - 1) * 1000),
    leagueWatcherPush: g.leagueWatcherPush,
    replaceAllOnIngest: g.replaceAllOnIngest,
    command
  }
}

/** Next scheduled VPS poll for orchestration countdown UI. */
export function computeOrchestrationSchedule(now = Date.now()) {
  const g = controlState.global
  if (!g.remoteOrchestration || !g.fleetEnabled || !g.autoPoll) {
    return { mode: 'manual', nextSlot: null, nextInMs: null, scheduleEpoch: g.scheduleEpoch }
  }
  const pollMs = clampNum(g.defaultPollIntervalSec, 0.5, 120, 2) * 1000
  const staggerMs = clampNum(g.vpsStaggerSec, 0, 30, 0) * 1000
  const epoch = g.scheduleEpoch || now
  let bestAt = Infinity
  let bestSlot = null
  for (const slot of VPS_SLOTS) {
    const slotCfg = controlState.slots[slot]
    if (!slotCfg?.enabled || !slotCfg?.pushEnabled) continue
    const n = Number(slot.replace('vps', ''))
    const offset = Math.max(0, n - 1) * staggerMs
    const elapsed = now - epoch - offset
    const period = pollMs
    const cycles = Math.floor(elapsed / period)
    let nextAt = epoch + offset + (cycles + 1) * period
    if (nextAt <= now) nextAt += period
    if (nextAt < bestAt) {
      bestAt = nextAt
      bestSlot = slot
    }
  }
  return {
    mode: 'orchestration',
    nextSlot: bestSlot,
    nextInMs: bestSlot ? Math.max(0, bestAt - now) : null,
    scheduleEpoch: epoch
  }
}

export function getPublicControlSnapshot() {
  return {
    rev: controlState.rev,
    updatedAt: controlState.updatedAt,
    global: { ...controlState.global },
    slots: Object.fromEntries(VPS_SLOTS.map((s) => [s, { ...controlState.slots[s] }])),
    schedule: computeOrchestrationSchedule()
  }
}
