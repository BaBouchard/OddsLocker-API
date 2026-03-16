/**
 * Normalized odds entry - matches sports-betting-website odds_data / store API.
 * All adapters must output this shape for compatibility with arbitrage ingestion.
 */
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
  commence_time = null,
  bookmaker_link = null,
  is_live = true
}) {
  const dec = odds_decimal ?? americanToDecimal(odds_american)
  return {
    sport: sport || 'unknown',
    league: league || null,
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
}

export function americanToDecimal(american) {
  if (american === null || american === undefined) return null
  if (american > 0) return american / 100 + 1
  return 100 / Math.abs(american) + 1
}
