/**
 * Build League Watcher snapshot from raw Bovada live API JSON (array of path groups).
 * Sport/league labels follow Bovada path segments; activity = any live event in that group.
 */

const SPORT_CODE_TO_SLUG = {
  BASK: 'basketball',
  SOCC: 'soccer',
  TENN: 'tennis',
  HCKY: 'hockey',
  GOLF: 'golf',
  BASE: 'baseball',
  MMA: 'mma',
  CRIC: 'cricket',
  BOXI: 'boxing',
  MOSP: 'motor_sports',
  ESPT: 'esports',
  TABL: 'table_tennis',
  VOLL: 'volleyball',
  RUGU: 'rugby',
  DART: 'darts',
  FOOT: 'football',
  MBOX: 'boxing',
  BOX: 'boxing'
}

function sportFromEvent(ev, pathSportDescription, defaultSport) {
  const code = (ev?.sport || ev?.sportCode || '').toUpperCase()
  if (code && SPORT_CODE_TO_SLUG[code]) return SPORT_CODE_TO_SLUG[code]
  if (pathSportDescription) return pathSportDescription.toLowerCase().replace(/\s+/g, '_')
  return (defaultSport || 'other').toLowerCase().replace(/\s+/g, '_')
}

function prettifySlug(slug) {
  if (!slug || typeof slug !== 'string') return 'Unknown'
  return slug
    .split('_')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ''))
    .join(' ')
}

/**
 * @param {unknown} pathGroups - Bovada response: array of { path, events }
 * @param {{ defaultSport?: string, defaultLeague?: string }} opts
 * @returns {{ sports: Array<{ key: string, name: string, active: boolean, leagues: Array<{ key: string, name: string, active: boolean }> }>, updatedAt: number }}
 */
export function buildBovadaLeagueWatcher(pathGroups, opts = {}) {
  const defaultSport = opts.defaultSport || 'other'
  const defaultLeague = opts.defaultLeague || 'Other'
  const groups = Array.isArray(pathGroups) ? pathGroups : pathGroups ? [pathGroups] : []

  /** @type {Map<string, { key: string, name: string, leagues: Map<string, { key: string, name: string, active: boolean }> }>} */
  const bySport = new Map()

  for (const group of groups) {
    if (!group || typeof group !== 'object') continue
    const pathSegments = group.path || []
    const leaguePath = pathSegments.find((p) => p.type === 'LEAGUE')
    const sportPath = pathSegments.find((p) => p.type === 'SPORT')
    const events = Array.isArray(group.events) ? group.events : []

    const leagueName = (leaguePath?.description && String(leaguePath.description).trim()) || defaultLeague
    const leagueKey = leagueName.toLowerCase()

    const firstEv = events[0]
    const sportSlug = sportPath?.description
      ? String(sportPath.description).toLowerCase().replace(/\s+/g, '_')
      : sportFromEvent(firstEv, sportPath?.description, defaultSport)
    const sportLabel = (sportPath?.description && String(sportPath.description).trim()) || prettifySlug(sportSlug)
    const sportKey = sportSlug

    const leagueActive = events.some((ev) => ev && (ev.live === true || ev.live === 'true'))

    if (!bySport.has(sportKey)) {
      bySport.set(sportKey, { key: sportKey, name: sportLabel, leagues: new Map() })
    }
    const bucket = bySport.get(sportKey)
    if (sportPath?.description) bucket.name = String(sportPath.description).trim()

    const prev = bucket.leagues.get(leagueKey)
    const mergedActive = (prev?.active || false) || leagueActive
    bucket.leagues.set(leagueKey, { key: leagueKey, name: leagueName, active: mergedActive })
  }

  const sports = [...bySport.values()]
    .map((s) => {
      const leagues = [...s.leagues.values()].sort((a, b) => a.name.localeCompare(b.name, 'en'))
      const active = leagues.some((l) => l.active)
      return { key: s.key, name: s.name, active, leagues }
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'en'))

  return { sports, updatedAt: Date.now() }
}
