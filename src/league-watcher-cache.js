/**
 * Persistent League Watcher catalog (Bovada-derived): remembers every sport/league
 * ever seen on disk; each tick marks leagues active from the latest snapshot only.
 */

import fs from 'fs'
import path from 'path'

const DEFAULT_CACHE_FILE = '.league-watcher-cache.json'

/** @typedef {{ name: string, leagues: Record<string, { name: string }> }} CachedSport */
/** @typedef {{ version: number, sports: Record<string, CachedSport> }} CacheFile */

function cacheFilePath() {
  const p = process.env.LEAGUE_WATCHER_CACHE_PATH
  if (p && String(p).trim()) return path.resolve(String(p).trim())
  return path.join(process.cwd(), DEFAULT_CACHE_FILE)
}

/** @returns {CacheFile} */
function emptyCache() {
  return { version: 1, sports: {} }
}

/** @returns {CacheFile} */
/** Drop bogus leagues caused by old defaultLeague=NBA fallback on non-basketball sports */
function sanitizeLeagueWatcherCache(cache) {
  if (!cache?.sports || typeof cache.sports !== 'object') return
  for (const [sportKey, sport] of Object.entries(cache.sports)) {
    const sk = (sportKey || '').toLowerCase()
    const isBasketball = sk.includes('basketball')
    const leagues = sport.leagues && typeof sport.leagues === 'object' ? sport.leagues : {}
    for (const lk of Object.keys(leagues)) {
      const keyLower = (lk || '').toLowerCase()
      const nameLower = String(leagues[lk]?.name || '').toLowerCase().trim()
      if (!isBasketball && (keyLower === 'nba' || nameLower === 'nba')) {
        delete leagues[lk]
      }
    }
    if (Object.keys(leagues).length === 0) {
      delete cache.sports[sportKey]
    }
  }
}

export function loadLeagueWatcherCache() {
  const file = cacheFilePath()
  try {
    if (!fs.existsSync(file)) return emptyCache()
    const raw = fs.readFileSync(file, 'utf8')
    const data = JSON.parse(raw)
    if (!data || typeof data !== 'object' || data.sports == null || typeof data.sports !== 'object') {
      return emptyCache()
    }
    const cache = { version: 1, sports: data.sports }
    sanitizeLeagueWatcherCache(cache)
    return cache
  } catch (e) {
    console.warn('[LeagueWatcherCache] Load failed, starting fresh:', e.message)
    return emptyCache()
  }
}

/** @param {CacheFile} cache */
export function saveLeagueWatcherCache(cache) {
  const file = cacheFilePath()
  try {
    const tmp = file + '.tmp'
    fs.writeFileSync(tmp, JSON.stringify({ version: 1, sports: cache.sports }, null, 2), 'utf8')
    fs.renameSync(tmp, file)
  } catch (e) {
    console.warn('[LeagueWatcherCache] Save failed:', e.message)
  }
}

/** Rough sport bucket for league ordering rules */
function sportCategory(sportKey) {
  const k = (sportKey || '').toLowerCase()
  if (k.includes('basketball')) return 'basketball'
  if (k.includes('soccer')) return 'soccer'
  if (
    k.includes('american_football') ||
    k === 'football' ||
    (k.includes('football') && !k.includes('soccer') && !k.includes('aussie'))
  ) {
    return 'american_football'
  }
  if (k.includes('baseball')) return 'baseball'
  if (k.includes('hockey') || k.includes('ice_hockey')) return 'hockey'
  if (k.includes('tennis')) return 'tennis'
  if (k.includes('mma') || k.includes('mixed_martial')) return 'mma'
  if (k.includes('boxing')) return 'boxing'
  if (k.includes('golf')) return 'golf'
  return 'other'
}

/**
 * Lower rank = more "main" / shown first.
 * @param {string} sportKey
 * @param {string} leagueKey
 * @param {string} leagueName
 */
function leagueMainnessRank(sportKey, leagueKey, leagueName) {
  const cat = sportCategory(sportKey)
  const key = (leagueKey || '').toLowerCase()
  const name = (leagueName || '').toLowerCase()
  const blob = `${key} ${name}`

  if (cat === 'basketball') {
    if (/^nba$|^nba\s/i.test(key) || /^nba\b/i.test(name)) return 0
    if (/\bncaa\b.*\b(men|m\b|mens)\b/i.test(blob) || /\bncaam\b|\bncaamb\b/i.test(blob)) return 10
    if (/\bncaa\b.*\b(women|w\b|womens)\b/i.test(blob) || /\bncaabw\b/i.test(blob)) return 20
    if (/\bwnba\b/i.test(blob)) return 35
    if (/\bcollege\b.*\b(women|womens)\b/i.test(blob)) return 22
    if (/\bcollege\b.*\b(men|mens)\b/i.test(blob)) return 12
    if (/\beuroleague\b|\beuro\s*cup\b|\b(euro|european)\b.*\b(basket|league)\b/i.test(blob)) return 30
    if (/\bg[\s-]?league\b|\bgleague\b/i.test(blob)) return 40
    return 500
  }

  if (cat === 'american_football') {
    if (/\bnfl\b/i.test(blob)) return 0
    if (/\bncaa\b|\bcollege\b.*\bfootball\b|\bcf\b|\bcollege football\b/i.test(blob)) return 10
    if (/\bcfl\b/i.test(blob)) return 20
    if (/\bxfl\b|\busfl\b/i.test(blob)) return 30
    return 500
  }

  if (cat === 'baseball') {
    if (/\bmlb\b|\bmajor league\b/i.test(blob)) return 0
    if (/\bncaa\b|\bcollege\b.*\bbaseball\b/i.test(blob)) return 10
    if (/\bnpb\b|\bjapan\b.*\bbaseball\b/i.test(blob)) return 20
    return 500
  }

  if (cat === 'hockey') {
    if (/\bnhl\b/i.test(blob)) return 0
    if (/\bncaa\b|\bcollege\b.*\bhockey\b/i.test(blob)) return 10
    if (/\bahl\b|\bohl\b|\bwhl\b|\bechl\b/i.test(blob)) return 20
    if (/\bkhl\b|\bshl\b|\bliiga\b/i.test(blob)) return 30
    return 500
  }

  if (cat === 'soccer') {
    if (/\buefa\b.*\bchampions\b|\bucl\b|\bchampions league\b/i.test(blob)) return 0
    if (/\bpremier league\b|\bepl\b|\benglish premier\b/i.test(blob)) return 5
    if (/\bla liga\b|\bserie a\b|\bbundesliga\b|\bligue 1\b/i.test(blob)) return 10
    if (/\bmls\b|\bmajor league soccer\b/i.test(blob)) return 25
    if (/\bworld cup\b|\buefa nations\b|\beuro 20/i.test(blob)) return 2
    return 500
  }

  if (cat === 'tennis') {
    if (/\batp\b|\bwta\b|\bgrand slam\b|\bus open\b|\bwimbledon\b|\baustralian open\b|\bfrench open\b|\broland garros\b/i.test(blob)) {
      return 0
    }
    return 500
  }

  if (cat === 'mma') {
    if (/\bufc\b/i.test(blob)) return 0
    return 500
  }

  if (cat === 'boxing') {
    if (/\bwbc\b|\bwba\b|\bibf\b|\bwbo\b|\btitle\b/i.test(blob)) return 0
    return 500
  }

  if (cat === 'golf') {
    if (/\bpga\b|\blpga\b|\bmajor\b|\bmasters\b|\bus open\b|\bopen championship\b/i.test(blob)) return 0
    return 500
  }

  return 500
}

/** Sport display order: lower first */
function sportMainnessRank(sportKey, sportName) {
  const k = (sportKey || '').toLowerCase()
  const n = (sportName || '').toLowerCase()
  const order = [
    'basketball',
    'american_football',
    'football',
    'baseball',
    'soccer',
    'hockey',
    'ice_hockey',
    'tennis',
    'mma',
    'boxing',
    'golf',
    'esports',
    'motor',
    'rugby',
    'cricket',
    'volleyball',
    'table_tennis',
    'darts'
  ]
  for (let i = 0; i < order.length; i++) {
    if (k.includes(order[i]) || n.includes(order[i].replace('_', ' '))) return i
  }
  return 100
}

/**
 * Merge latest Bovada watcher snapshot into persistent cache and return full UI payload.
 * @param {{ sports: Array<{ key: string, name: string, active?: boolean, leagues: Array<{ key: string, name: string, active?: boolean }> }>, updatedAt?: number }} snapshot
 * @returns {{ sports: Array<{ key: string, name: string, active: boolean, leagues: Array<{ key: string, name: string, active: boolean }> }>, updatedAt: number }}
 */
export function mergeSnapshotWithPersistentCache(snapshot) {
  const cache = loadLeagueWatcherCache()
  const now = snapshot?.updatedAt || Date.now()

  const incoming = Array.isArray(snapshot?.sports) ? snapshot.sports : []

  for (const sp of incoming) {
    if (!sp || !sp.key) continue
    const sk = String(sp.key)
    if (!cache.sports[sk]) {
      cache.sports[sk] = { name: sp.name || sk, leagues: {} }
    }
    cache.sports[sk].name = sp.name || cache.sports[sk].name
    const leagues = Array.isArray(sp.leagues) ? sp.leagues : []
    for (const lg of leagues) {
      if (!lg || lg.key == null) continue
      const lk = String(lg.key)
      cache.sports[sk].leagues[lk] = { name: lg.name || lk }
    }
  }

  /** @type {Map<string, Set<string>>} */
  const activeBySport = new Map()
  for (const sp of incoming) {
    if (!sp || !sp.key) continue
    const set = new Set()
    for (const lg of sp.leagues || []) {
      if (lg && lg.active) set.add(String(lg.key))
    }
    activeBySport.set(String(sp.key), set)
  }

  const sportsOut = Object.entries(cache.sports).map(([sportKey, s]) => {
    const leagueEntries = Object.entries(s.leagues).map(([leagueKey, lg]) => ({
      key: leagueKey,
      name: lg.name || leagueKey,
      active: activeBySport.get(sportKey)?.has(leagueKey) || false
    }))
    leagueEntries.sort((a, b) => {
      const ra = leagueMainnessRank(sportKey, a.key, a.name)
      const rb = leagueMainnessRank(sportKey, b.key, b.name)
      if (ra !== rb) return ra - rb
      return a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })
    })
    const active = leagueEntries.some((l) => l.active)
    return {
      key: sportKey,
      name: s.name || sportKey,
      active,
      leagues: leagueEntries
    }
  })

  sportsOut.sort((a, b) => {
    const sa = sportMainnessRank(a.key, a.name)
    const sb = sportMainnessRank(b.key, b.name)
    if (sa !== sb) return sa - sb
    return a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })
  })

  saveLeagueWatcherCache(cache)

  return { sports: sportsOut, updatedAt: now }
}
