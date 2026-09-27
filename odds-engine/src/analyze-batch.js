import { cleanTeamName, leagueFamily, resolveTeam } from './team-aliases.js'

const MISSING_CAP = 60

function normName(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function compact(value) {
  return normName(value).replace(/\s/g, '')
}

function tokens(name) {
  return normName(name).split(' ').filter((word) => word.length > 2)
}

function sideMatch(a, b) {
  if (!a.length || !b.length) return false
  const shorter = a.length <= b.length ? a : b
  const longer = a.length <= b.length ? b : a
  const set = new Set(longer)
  const hits = shorter.filter((word) => set.has(word)).length
  const last = shorter[shorter.length - 1]
  if (set.has(last)) return true
  return hits >= Math.ceil(shorter.length * 0.6)
}

function gamesMatch(left, right) {
  if (left.family && right.family && left.family !== right.family) return false
  if (left.awayId && left.homeId && right.awayId && right.homeId) {
    return (
      (left.awayId === right.awayId && left.homeId === right.homeId) ||
      (left.awayId === right.homeId && left.homeId === right.awayId)
    )
  }
  if (left.away.length && left.home.length && right.away.length && right.home.length) {
    return (
      (sideMatch(left.away, right.away) && sideMatch(left.home, right.home)) ||
      (sideMatch(left.away, right.home) && sideMatch(left.home, right.away))
    )
  }
  return false
}

function gameFromEntry(entry) {
  const awayName = cleanTeamName(entry?.away_team)
  const homeName = cleanTeamName(entry?.home_team)
  if (!awayName || !homeName) return null
  const away = tokens(awayName)
  const home = tokens(homeName)
  if (!away.length || !home.length) return null
  const family = leagueFamily(entry.league, entry.sport)
  const awayId = resolveTeam(awayName, family)
  const homeId = resolveTeam(homeName, family)
  const key = awayId && homeId
    ? `${family}|${[awayId, homeId].sort().join('|')}`
    : `${family}|${[normName(awayName), normName(homeName)].sort().join('||')}`
  return {
    key,
    away,
    home,
    awayId,
    homeId,
    family,
    label: `${awayName} @ ${homeName}`,
    league: String(entry.league || '').trim()
  }
}

function gamesFor(entries) {
  const byKey = new Map()
  for (const entry of entries) {
    const game = gameFromEntry(entry)
    if (!game || byKey.has(game.key)) continue
    byKey.set(game.key, game)
  }
  return [...byKey.values()]
}

function reportsFrom(snapshot) {
  if (Array.isArray(snapshot.bookReports) && snapshot.bookReports.length) {
    return snapshot.bookReports.map((row) => ({
      book: row.book || row.bookId || row.name || 'book',
      name: row.name || row.book || row.bookId || 'Book',
      entries: Number(row.entries) || 0,
      ms: Number(row.ms) || 0,
      blocked: !!row.blocked,
      timedOut: !!row.timedOut,
      blockReason: row.blockReason || '',
      partialBlock: row.partialBlock || ''
    }))
  }
  const byName = new Map()
  for (const entry of snapshot.data || []) {
    const name = entry?.sportsbook || 'Unknown'
    if (!byName.has(name)) {
      byName.set(name, {
        book: name,
        name,
        entries: 0,
        ms: 0,
        blocked: false,
        timedOut: false,
        blockReason: '',
        partialBlock: ''
      })
    }
    byName.get(name).entries += 1
  }
  return [...byName.values()]
}

function assignEntries(entries, reports) {
  const buckets = reports.map(() => [])
  for (const entry of entries) {
    const sportsbook = compact(entry?.sportsbook)
    if (!sportsbook) continue
    let idx = reports.findIndex((row) => compact(row.name) === sportsbook)
    if (idx < 0) idx = reports.findIndex((row) => compact(row.book) === sportsbook)
    if (idx < 0) {
      idx = reports.findIndex((row) => {
        const id = compact(row.book)
        const name = compact(row.name)
        return (id.length >= 5 && sportsbook.includes(id)) || (name.length >= 5 && sportsbook.includes(name))
      })
    }
    if (idx >= 0) buckets[idx].push(entry)
  }
  return buckets
}

function missingAgainst(baseline, games) {
  const missing = []
  for (const game of baseline) {
    if (!games.some((other) => gamesMatch(game, other))) missing.push(game)
  }
  missing.sort((a, b) => a.label.localeCompare(b.label))
  return missing
}

export function analyzeSnapshot(snapshot) {
  const data = Array.isArray(snapshot?.data) ? snapshot.data : []
  const reports = reportsFrom(snapshot || {})
  if (!reports.length) {
    return { ok: false, reason: data.length ? 'no_books' : 'no_snapshot' }
  }

  const buckets = assignEntries(data, reports)
  const gameLists = buckets.map((entries) => gamesFor(entries))

  let baselineIndex = -1
  let baselineCount = -1
  for (let i = 0; i < reports.length; i++) {
    if (reports[i].blocked || reports[i].timedOut) continue
    const count = gameLists[i].length
    if (count > baselineCount) {
      baselineCount = count
      baselineIndex = i
    }
  }

  const baselineGames = baselineIndex >= 0 ? gameLists[baselineIndex] : []
  const baselineReport = baselineIndex >= 0 ? reports[baselineIndex] : null

  const books = reports.map((report, i) => {
    const isBaseline = i === baselineIndex
    const missing = !isBaseline && baselineGames.length && !report.blocked && !report.timedOut
      ? missingAgainst(baselineGames, gameLists[i])
      : []
    return {
      book: report.book,
      name: report.name,
      entries: buckets[i].length || report.entries,
      games: gameLists[i].length,
      ms: report.ms,
      blocked: report.blocked,
      timedOut: report.timedOut,
      blockReason: report.blockReason,
      partialBlock: report.partialBlock,
      isBaseline,
      missingCount: isBaseline || report.blocked || report.timedOut
        ? (baselineGames.length && (report.blocked || report.timedOut) ? baselineGames.length : 0)
        : missing.length,
      missing: missing.slice(0, MISSING_CAP).map((game) => ({
        label: game.label,
        league: game.league
      }))
    }
  })

  books.sort((a, b) => {
    if (a.isBaseline) return -1
    if (b.isBaseline) return 1
    if (a.blocked !== b.blocked) return a.blocked ? -1 : 1
    if (a.timedOut !== b.timedOut) return a.timedOut ? -1 : 1
    return b.missingCount - a.missingCount
  })

  return {
    ok: true,
    snapshotTs: snapshot.ts || null,
    durationMs: snapshot.durationMs || 0,
    baseline: baselineReport
      ? {
          book: baselineReport.book,
          name: baselineReport.name,
          games: baselineGames.length,
          entries: buckets[baselineIndex].length || baselineReport.entries
        }
      : null,
    books
  }
}
