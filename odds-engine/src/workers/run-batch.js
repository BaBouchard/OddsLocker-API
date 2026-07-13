import { runWithProxy } from './proxy-fetch.js'
import { getAdapter, discoverConfiguredBooks } from './books.js'
import { acquireProxy, releaseProxy } from '../state/proxies.js'
import { bumpChannelHeat } from '../state/channels.js'
import { patchState } from '../state/store.js'

/**
 * Run one batch on one channel through one residential proxy.
 * Returns { entries, leagueWatcher, errors, proxyId }
 */
export async function runChannelBatch({ channel, batch }) {
  const books = (batch.books || []).filter(Boolean)
  const configured = new Set(discoverConfiguredBooks().map((b) => b.bookId))
  const toRun = books.filter((b) => configured.has(b))
  const skipped = books.filter((b) => !configured.has(b))

  const proxy = acquireProxy()
  if (!proxy) {
    bumpChannelHeat(channel.id, false)
    return {
      channelId: channel.id,
      batchId: batch.id,
      entries: [],
      errors: [{ book: '*', error: 'No available proxy in pool' }],
      skipped,
      proxyId: null
    }
  }

  patchState((s) => {
    const ch = s.channels.find((c) => c.id === channel.id)
    if (ch) {
      ch.status = 'running'
      ch.currentProxyId = proxy.id
      ch.lastBatchId = batch.id
    }
  })

  const entries = []
  const errors = []
  let leagueWatcher = null
  let proxyFailed = false
  let proxyError = ''

  try {
    await runWithProxy(proxy.url, async () => {
      for (const bookId of toRun) {
        try {
          const wrapped = await getAdapter(bookId)
          if (!wrapped) {
            errors.push({ book: bookId, error: 'Adapter not available' })
            continue
          }
          const { entries: bookEntries, meta } = await wrapped.fetchOnce()
          if (Array.isArray(bookEntries)) entries.push(...bookEntries)
          if (meta?.leagueWatcher) leagueWatcher = meta.leagueWatcher
        } catch (e) {
          const msg = e.message || String(e)
          errors.push({ book: bookId, error: msg })
          if (/403|407|ECONNREFUSED|ETIMEDOUT|proxy|tunnel|CONNECT/i.test(msg)) {
            proxyFailed = true
            proxyError = msg
          }
        }
      }
    })
  } catch (e) {
    proxyFailed = true
    proxyError = e.message || String(e)
    errors.push({ book: '*', error: proxyError })
  }

  releaseProxy(proxy.id, { bad: proxyFailed, error: proxyError })
  const ok = errors.length === 0 || entries.length > 0
  bumpChannelHeat(channel.id, ok)

  return {
    channelId: channel.id,
    batchId: batch.id,
    entries,
    leagueWatcher,
    errors,
    skipped,
    proxyId: proxy.id,
    proxyFailed
  }
}
