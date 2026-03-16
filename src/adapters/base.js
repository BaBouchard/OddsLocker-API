export class BaseAdapter {
  constructor(config = {}) {
    this.config = config
    this._running = false
  }
  get name() { return 'base' }
  async start(leagueKey, onOdds) {
    throw new Error('Adapter must implement start(leagueKey, onOdds)')
  }
  stop() {
    this._running = false
  }
  get isRunning() { return this._running }
}
