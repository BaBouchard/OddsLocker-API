export const DEFAULT_BOOKS = [
  'betrivers',
  'fanduel',
  'bovada',
  'pointsbet',
  'betmgm',
  '888sport',
  'thescore',
  'polymarket',
  'kalshi'
]

export function createDefaultState() {
  const now = Date.now()
  const channels = Array.from({ length: 10 }, (_, i) => ({
    id: `ch${i + 1}`,
    n: i + 1,
    enabled: true,
    heat: 0,
    lastUsedAt: 0,
    status: 'idle',
    currentProxyId: null,
    lastBatchId: null,
    lastError: '',
    successCount: 0,
    failCount: 0
  }))
  return {
    rev: 1,
    updatedAt: now,
    fleet: {
      autoPoll: process.env.AUTO_POLL === 'true' || process.env.AUTO_POLL === '1',
      pollIntervalMs: Number(process.env.POLL_INTERVAL_MS) || 5000,
      fleetEnabled: true,
      webhookEnabled: true
    },
    channels,
    batches: [
      {
        id: 'batch1',
        name: 'All books',
        books: [...DEFAULT_BOOKS]
      }
    ],
    proxies: [],
    snapshot: null,
    leagueWatcher: null,
    stats: {
      sessions: 0,
      lastSessionAt: 0,
      lastSessionOk: true
    }
  }
}
