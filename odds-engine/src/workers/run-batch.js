import { runWithProxy } from './proxy-fetch.js'
import { getAdapter, discoverConfiguredBooks } from './books.js'
import { acquireProxy, releaseProxy } from '../state/proxies.js'

function statusFromRow(row) {
  const meta = row.meta || {}
  if (meta.blocked) {
    return { blocked: true, timedOut: false, blockReason: meta.blockReason || 'Blocked', partialBlock: '' }
  }
  if (meta.timedOut) {
    return {
      blocked: false,
      timedOut: true,
      blockReason: meta.blockReason || 'Timed out before the snapshot finished',
      partialBlock: ''
    }
  }
  if (meta.partialBlock) {
    return { blocked: false, timedOut: false, blockReason: '', partialBlock: meta.partialBlock }
  }
  const err = String(row.error || '')
  if (/403|401|429|forbidden|cloudflare|just a moment/i.test(err)) {
    return { blocked: true, timedOut: false, blockReason: err.slice(0, 140), partialBlock: '' }
  }
  if (/abort|timeout|timed out/i.test(err)) {
    return { blocked: false, timedOut: true, blockReason: 'Timed out before the snapshot finished', partialBlock: '' }
  }
  return { blocked: false, timedOut: false, blockReason: '', partialBlock: '' }
}

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
  const timings = []
  const nameById = new Map(discoverConfiguredBooks().map((b) => [b.bookId, b.name]))
  let leagueWatcher = null
  let proxyFailed = false
  let proxyError = ''

  const runBooks = async () => {
    const settled = await Promise.all(
      toRun.map(async (bookId) => {
        const started = Date.now()
        try {
          const wrapped = await getAdapter(bookId)
          if (!wrapped) return { bookId, error: 'Adapter not available', ms: Date.now() - started }
          const { entries: bookEntries, meta } = await wrapped.fetchOnce()
          return { bookId, entries: bookEntries, meta, ms: Date.now() - started }
        } catch (e) {
          return { bookId, error: e.message || String(e), ms: Date.now() - started }
        }
      })
    )
    for (const row of settled) {
      const status = statusFromRow(row)
      timings.push({
        book: row.bookId,
        name: nameById.get(row.bookId) || row.bookId,
        ms: row.ms || 0,
        entries: Array.isArray(row.entries) ? row.entries.length : 0,
        blocked: status.blocked,
        timedOut: status.timedOut,
        blockReason: status.blockReason,
        partialBlock: status.partialBlock
      })
      if (row.error) {
        errors.push({ book: row.bookId, error: row.error })
        if (/403|407|ECONNREFUSED|ETIMEDOUT|proxy|tunnel|CONNECT/i.test(row.error)) {
          proxyFailed = true
          proxyError = row.error
        }
        continue
      }
      if (Array.isArray(row.entries)) entries.push(...row.entries)
      if (row.meta?.leagueWatcher) leagueWatcher = row.meta.leagueWatcher
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
    proxyFailed,
    timings
  }
}
