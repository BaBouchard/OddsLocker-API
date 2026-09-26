import { runWithProxy } from './proxy-fetch.js'
import { getAdapter, discoverConfiguredBooks } from './books.js'
import { acquireProxy, releaseProxy } from '../state/proxies.js'

/**
 * Run one batch. Proxy-pool mode takes one proxy; local mode fetches direct.
 * Returns { entries, leagueWatcher, errors, proxyId }
 */
export async function runChannelBatch({ batch, useProxy = false }) {
  const books = (batch.books || []).filter(Boolean)
  const configured = new Set(discoverConfiguredBooks().map((b) => b.bookId))
  const toRun = books.filter((b) => configured.has(b))
  const skipped = books.filter((b) => !configured.has(b))

  let proxy = null
  if (useProxy) {
    proxy = acquireProxy()
    if (!proxy) {
      return {
        batchId: batch.id,
        entries: [],
        errors: [{ book: '*', error: 'No available proxy in pool' }],
        skipped,
        proxyId: null
      }
    }
  }

  const entries = []
  const errors = []
  let leagueWatcher = null
  let proxyFailed = false
  let proxyError = ''

  const runBooks = async () => {
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
  }

  try {
    if (proxy) await runWithProxy(proxy.url, runBooks)
    else await runBooks()
  } catch (e) {
    proxyFailed = true
    proxyError = e.message || String(e)
    errors.push({ book: '*', error: proxyError })
  }

  if (proxy) releaseProxy(proxy.id, { bad: proxyFailed, error: proxyError })

  return {
    batchId: batch.id,
    entries,
    leagueWatcher,
    errors,
    skipped,
    proxyId: proxy ? proxy.id : null,
    proxyFailed
  }
}
