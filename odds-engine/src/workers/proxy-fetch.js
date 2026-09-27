import { AsyncLocalStorage } from 'node:async_hooks'
import { fetch as undiciFetch, ProxyAgent } from 'undici'

const als = new AsyncLocalStorage()
/** @type {Map<string, ProxyAgent>} */
const agents = new Map()
let installed = false
/** @type {{ acquire: () => object|null, release: (id: string, info?: object) => void }|null} */
let requestProxy = null
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
    const explicit = als.getStore()
    if (explicit) return fetchThrough(explicit, input, init)
    if (!requestProxy) return original(input, init)
    return takeProxy().then(async (proxy) => {
      try {
        const res = await fetchThrough(proxy.url, input, init)
        const bad = res.status === 407
        finishProxy(proxy.id, { bad, error: bad ? '407 proxy auth failed' : '' })
        return res
      } catch (e) {
        const msg = e.message || String(e)
        finishProxy(proxy.id, {
          bad: /407|ECONNREFUSED|ETIMEDOUT|ECONNRESET|tunnel|proxy/i.test(msg),
          error: msg
        })
        throw e
      }
    })
  }
}

export function runWithProxy(proxyUrl, fn) {
  if (!proxyUrl) return fn()
  return als.run(proxyUrl, fn)
}
