import WebSocket from 'ws'
import { BaseAdapter } from './base.js'
import { createNormalizedEntry } from '../schema.js'

export class WebSocketAdapter extends BaseAdapter {
  constructor(config = {}) {
    super(config)
    this.ws = null
    this._onOdds = null
  }
  get name() { return 'websocket' }
  parseMessage(data, leagueKey) {
    if (!data || !Array.isArray(data.events)) return []
    const entries = []
    const sport = this.config.sportKey || leagueKey
    const league = this.config.leagueTitle || leagueKey
    const sportsbook = this.config.sportsbookName || 'sportsbook'
    for (const ev of data.events) {
      if (ev.status !== 'live' && ev.status !== 'inprogress') continue
      const eventId = ev.id || ev.event_id || `${ev.home_team}_${ev.away_team}`
      for (const market of ev.markets || []) {
        const marketType = { h2h: 'moneyline', spreads: 'spread', totals: 'total' }[market.key || market.type] || market.key
        for (const outcome of market.outcomes || []) {
          entries.push(createNormalizedEntry({
            sport, league, event_id: eventId,
            home_team: ev.home_team, away_team: ev.away_team,
            market_type: marketType, outcome_name: outcome.name || outcome.outcome,
            line_value: outcome.point ?? outcome.line ?? null, sportsbook,
            odds_american: outcome.price ?? outcome.odds ?? outcome.american,
            commence_time: ev.commence_time || ev.start_time,
            bookmaker_link: outcome.link || ev.link || null, is_live: true
          }))
        }
      }
    }
    return entries
  }
  async start(leagueKey, onOdds) {
    const url = this.config.wsUrl || process.env.SPORTSBOOK_WS_URL
    if (!url) throw new Error('SPORTSBOOK_WS_URL required for WebSocket adapter')
    this._onOdds = onOdds
    this._running = true
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url, this.config.wsProtocols || [])
      this.ws.on('open', () => { console.log('[LiveOdds] WebSocket connected'); resolve() })
      this.ws.on('message', (raw) => {
        if (!this._running || !this._onOdds) return
        try {
          const data = typeof raw === 'string' ? JSON.parse(raw) : JSON.parse(raw.toString())
          const entries = this.parseMessage(data, leagueKey)
          if (entries.length) this._onOdds(entries)
        } catch (e) { console.warn('[LiveOdds] WS parse error:', e.message) }
      })
      this.ws.on('error', (err) => { console.error('[LiveOdds] WebSocket error:', err.message); reject(err) })
      this.ws.on('close', () => {
        if (this._running) setTimeout(() => this.start(leagueKey, this._onOdds).catch(() => {}), 5000)
      })
    })
  }
  subscribe(leagueKey) {
    if (this.ws?.readyState === WebSocket.OPEN && this.config.subscribeMessage) {
      const msg = typeof this.config.subscribeMessage === 'function' ? this.config.subscribeMessage(leagueKey) : this.config.subscribeMessage
      this.ws.send(JSON.stringify(msg))
    }
  }
  stop() {
    super.stop()
    if (this.ws) { this.ws.close(); this.ws = null }
    this._onOdds = null
  }
}
