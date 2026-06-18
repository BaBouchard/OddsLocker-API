/**
 * When the book does not provide a competition/league name, use this (never guess "NBA").
 * @param {unknown} league
 * @returns {string}
 */
export function normalizeLeague(league) {
  if (league == null) return 'Other'
  const s = String(league).trim()
  if (!s) return 'Other'
  return s
}

/**
 * Normalized odds entry - matches sports-betting-website odds_data / store API.
 * All adapters must output this shape for compatibility with arbitrage ingestion.
 */
/** Polymarket share price (0–1) as cents label, e.g. 49¢ or 0.3¢ */
export function formatSharePriceCents(sharePrice) {
  if (sharePrice == null || Number.isNaN(Number(sharePrice))) return null
  const p = Number(sharePrice)
  if (p <= 0 || p >= 1) return null
  const cents = p * 100
  if (cents >= 10) return `${Math.round(cents)}¢`
  if (cents >= 1) return `${parseFloat(cents.toFixed(1))}¢`
  return `${parseFloat(cents.toFixed(2))}¢`
}

export function formatAmericanOdds(american) {
  if (american == null || Number.isNaN(Number(american))) return ''
  const n = Number(american)
  return n > 0 ? `+${n}` : String(n)
}

export function formatLineValue(line) {
  if (line == null || Number.isNaN(Number(line))) return null
  const n = Number(line)
  if (n > 0) return `+${n}`
  return String(n)
}

/** Market column: "spread -1.5", "total 10.5", or plain market_type. */
export function formatMarketTypeDisplay(entry) {
  const mt = entry?.market_type || ''
  if (mt === 'total' && entry?.line_value != null && !Number.isNaN(Number(entry.line_value))) {
    return `${mt} ${entry.line_value}`
  }
  const line = formatLineValue(entry?.line_value)
  if (mt === 'spread' && line) return `${mt} ${line}`
  return mt
}

/** Outcome column: append signed line for spread/total rows. */
export function formatOutcomeDisplay(entry) {
  const name = entry?.outcome_name || ''
  const mt = entry?.market_type || ''
  if (mt === 'total' && entry?.line_value != null && !Number.isNaN(Number(entry.line_value))) {
    return `${name} ${entry.line_value}`.trim()
  }
  const line = formatLineValue(entry?.line_value)
  if (mt === 'spread' && line) return `${name} ${line}`.trim()
  return name
}

function formatCompactUsd(usd) {
  if (usd == null || Number.isNaN(Number(usd))) return null
  const n = Number(usd)
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `$${Math.round(n / 1000)}k`
  return `$${Math.round(n)}`
}

/** Display string: Polymarket cents + American; optional top-of-book size for exchange legs. */
export function formatOddsDisplay(entry) {
  const cents = formatSharePriceCents(entry?.share_price)
  const am = formatAmericanOdds(entry?.odds_american)
  let base = ''
  if (cents && am) base = `${cents} · ${am}`
  else if (cents) base = cents
  else base = am
  const askSize = entry?.ask_size
  if (askSize != null && !Number.isNaN(Number(askSize))) {
    const sh = Number(askSize)
    const usd = formatCompactUsd(entry?.max_stake_usd)
    if (sh > 0) {
      const shLabel = sh >= 1000 ? `${(sh / 1000).toFixed(1)}k sh` : `${Math.round(sh)} sh`
      base = base ? `${base} · ${shLabel}${usd ? ` (${usd})` : ''}` : `${shLabel}${usd ? ` (${usd})` : ''}`
    }
  }
  return base
}

export function createNormalizedEntry({
  sport,
  league,
  event_id,
  home_team,
  away_team,
  market_type,
  outcome_name,
  line_value = null,
  sportsbook,
  odds_american,
  odds_decimal = null,
  share_price = null,
  ask_size = null,
  max_stake_usd = null,
  commence_time = null,
  bookmaker_link = null,
  is_live = true
}) {
  const dec = odds_decimal ?? americanToDecimal(odds_american)
  const entry = {
    sport: sport || 'unknown',
    league: normalizeLeague(league),
    event_id,
    home_team: home_team || null,
    away_team: away_team || null,
    market_type,
    outcome_name,
    line_value,
    sportsbook,
    odds_american,
    odds_decimal: dec,
    commence_time,
    bookmaker_link,
    is_live: !!is_live
  }
  if (share_price != null && !Number.isNaN(Number(share_price))) {
    entry.share_price = Number(share_price)
  }
  if (ask_size != null && !Number.isNaN(Number(ask_size))) {
    entry.ask_size = Number(ask_size)
  }
  if (max_stake_usd != null && !Number.isNaN(Number(max_stake_usd))) {
    entry.max_stake_usd = Number(max_stake_usd)
  }
  return entry
}

export function americanToDecimal(american) {
  if (american === null || american === undefined) return null
  if (american > 0) return american / 100 + 1
  return 100 / Math.abs(american) + 1
}
