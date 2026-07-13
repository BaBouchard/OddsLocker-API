import { AsyncLocalStorage } from 'node:async_hooks'
import { fetch as undiciFetch, ProxyAgent } from 'undici'

const als = new AsyncLocalStorage()
/** @type {Map<string, ProxyAgent>} */
const agents = new Map()
let installed = false

function getAgent(proxyUrl) {
  let agent = agents.get(proxyUrl)
  if (!agent) {
    agent = new ProxyAgent(proxyUrl)
    agents.set(proxyUrl, agent)
  }
  return agent
}

export function installProxiedGlobalFetch() {
  if (installed) return
  installed = true
  const original = globalThis.fetch.bind(globalThis)
  globalThis.fetch = (input, init = {}) => {
    const proxyUrl = als.getStore()
    if (!proxyUrl) return original(input, init)
    const dispatcher = getAgent(proxyUrl)
    return undiciFetch(input, { ...init, dispatcher })
  }
}

export function runWithProxy(proxyUrl, fn) {
  if (!proxyUrl) return fn()
  return als.run(proxyUrl, fn)
}
