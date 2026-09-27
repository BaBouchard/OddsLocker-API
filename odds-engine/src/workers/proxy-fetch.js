import { AsyncLocalStorage } from 'node:async_hooks'
import { fetch as undiciFetch, ProxyAgent } from 'undici'

const als = new AsyncLocalStorage()
/** @type {Map<string, ProxyAgent>} */
const agents = new Map()
let installed = false
/** @type {{ acquire: () => object|null, release: (id: string, info?: object) => void }|null} */
let requestProxy = null
/** Epoch ms. In-flight fetches abort when this time is reached. 0 = no cap. */
let fetchDeadlineAt = 0
/** @type {{ resolve: (p: object) => void, reject: (e: Error) => void }[]} */
const proxyWaiters = []

function getAgent(proxyUrl) {
  let agent = agents.get(proxyUrl)
  if (!agent) {
    agent = new ProxyAgent(proxyUrl)
    agents.set(proxyUrl, agent)
  }
  return agent
}

export function setFetchDeadline(msFromNow) {
  fetchDeadlineAt = msFromNow > 0 ? Date.now() + msFromNow : 0
}

function deadlineSignal(existing) {
  if (!fetchDeadlineAt) return { signal: existing, cancel() {} }
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), Math.max(1, fetchDeadlineAt - Date.now()))
  const onAbort = () => ac.abort()
  if (existing?.aborted) ac.abort()
  else existing?.addEventListener('abort', onAbort, { once: true })
  return {
    signal: ac.signal,
    cancel() {
      clearTimeout(timer)
      existing?.removeEventListener('abort', onAbort)
    }
  }
}

function isAbort(error) {
  const name = error?.name || ''
  return name === 'AbortError' || name === 'TimeoutError'
}

export function setRequestProxy(hooks) {
  requestProxy = hooks
  globalThis.__olSpreadFetches = !!hooks
  if (!hooks) {
    while (proxyWaiters.length) {
      proxyWaiters.shift().reject(new Error('Proxy session ended'))
    }
  }
}

function takeProxy() {
  const ready = requestProxy.acquire()
  if (ready) return Promise.resolve(ready)
  return new Promise((resolve, reject) => proxyWaiters.push({ resolve, reject }))
}

function finishProxy(id, info) {
  requestProxy?.release(id, info)
  const waiter = proxyWaiters.shift()
  if (!waiter || !requestProxy) return
  const next = requestProxy.acquire()
  if (next) waiter.resolve(next)
  else proxyWaiters.unshift(waiter)
}

function fetchThrough(proxyUrl, input, init) {
  return undiciFetch(input, { ...init, dispatcher: getAgent(proxyUrl) })
}

export function installProxiedGlobalFetch() {
  if (installed) return
  installed = true
  const original = globalThis.fetch.bind(globalThis)
  globalThis.fetch = (input, init = {}) => {
    const timed = deadlineSignal(init.signal)
    const nextInit = { ...init, signal: timed.signal }
    const explicit = als.getStore()
    if (explicit) return fetchThrough(explicit, input, nextInit).finally(() => timed.cancel())
    if (!requestProxy) return original(input, nextInit).finally(() => timed.cancel())
    return takeProxy().then(async (proxy) => {
      try {
        const res = await fetchThrough(proxy.url, input, nextInit)
        const bad = res.status === 407
        finishProxy(proxy.id, { bad, error: bad ? '407 proxy auth failed' : '' })
        return res
      } catch (e) {
        const msg = e.message || String(e)
        finishProxy(proxy.id, {
          bad: !isAbort(e) && /407|ECONNREFUSED|ETIMEDOUT|ECONNRESET|tunnel|proxy/i.test(msg),
          error: isAbort(e) ? '' : msg
        })
        throw e
      } finally {
        timed.cancel()
      }
    })
  }
}

export function runWithProxy(proxyUrl, fn) {
  if (!proxyUrl) return fn()
  return als.run(proxyUrl, fn)
}
