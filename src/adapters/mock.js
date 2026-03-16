import { BaseAdapter } from './base.js'
import { createNormalizedEntry } from '../schema.js'

const MOCK_EVENTS = [
  { home: 'Lakers', away: 'Celtics', id: 'mock_lal_bos' },
  { home: 'Heat', away: 'Bucks', id: 'mock_mia_mil' }
]
const MOCK_MARKETS = [
  { type: 'moneyline', outcomes: (h, a) => [{ name: h, odds: -110 }, { name: a, odds: 105 }] },
  { type: 'spread', outcomes: (h, a) => [{ name: h, point: 2.5, odds: -115 }, { name: a, point: -2.5, odds: -105 }] },
  { type: 'total', outcomes: () => [{ name: 'Over', point: 220.5, odds: -108 }, { name: 'Under', point: 220.5, odds: -112 }] }
]

export class MockAdapter extends BaseAdapter {
  constructor(config = {}) {
    super(config)
    this._timer = null
    this._onOdds = null
  }
  get name() { return 'mock' }
  get autoPoll() { return this._autoPoll !== false }
  setAutoPoll(value) {
    this._autoPoll = !!value
    if (!this._autoPoll && this._timer) {
      clearInterval(this._timer)
      this._timer = null
    }
    if (this._autoPoll && this._running && this._onOdds) {
      const interval = Number(this.config.pollIntervalMs || process.env.POLL_INTERVAL_MS) || 3000
      this._timer = setInterval(() => {
        if (!this._autoPoll) return
        this._emit()
      }, interval)
    }
  }
  fetchOnce() {
    if (!this._running || !this._onOdds) return
    this._emit()
  }
  _emit() {
    if (!this._running || !this._onOdds) return
    const sportsbook = this.config.sportsbookName || 'mock_book'
    const sport = this.config.sportKey || 'basketball'
    const league = this.config.leagueTitle || 'NBA'
    const entries = []
    for (const ev of MOCK_EVENTS) {
      for (const market of MOCK_MARKETS) {
        const outcomes = market.type === 'moneyline' ? market.outcomes(ev.home, ev.away)
          : market.type === 'spread' ? market.outcomes(ev.home, ev.away) : market.outcomes()
        for (const o of outcomes) {
          const jitter = Math.floor(Math.random() * 20) - 10
          entries.push(createNormalizedEntry({
            sport, league, event_id: ev.id, home_team: ev.home, away_team: ev.away,
            market_type: market.type, outcome_name: o.name, line_value: o.point ?? null,
            sportsbook, odds_american: (o.odds || 0) + jitter,
            commence_time: new Date().toISOString(), is_live: true
          }))
        }
      }
    }
    this._onOdds(entries)
  }
  async start(leagueKey, onOdds) {
    this._onOdds = onOdds
    this._running = true
    this._autoPoll = true
    this._emit()
    const interval = Number(this.config.pollIntervalMs || process.env.POLL_INTERVAL_MS) || 3000
    this._timer = setInterval(() => {
      if (!this._autoPoll) return
      this._emit()
    }, interval)
  }
  stop() {
    super.stop()
    if (this._timer) { clearInterval(this._timer); this._timer = null }
    this._onOdds = null
  }
}
