import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

const BROWSER = 'chrome_149'

let wreqModule = null

function browserOs() {
  if (process.platform === 'win32') return 'windows'
  if (process.platform === 'darwin') return 'macos'
  return 'linux'
}

function enginePackageJson() {
  if (process.env.SCRAPER_SRC_ROOT) {
    return path.resolve(process.env.SCRAPER_SRC_ROOT, '..', 'odds-engine', 'package.json')
  }
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../odds-engine/package.json')
}

async function loadWreq() {
  if (wreqModule) return wreqModule
  const href = pathToFileURL(path.join(path.dirname(enginePackageJson()), 'node_modules/wreq-js/dist/wreq-js.js')).href
  wreqModule = await import(href)
  return wreqModule
}

function headerObject(headers) {
  const out = {}
  if (!headers) return out
  if (typeof headers.forEach === 'function') {
    headers.forEach((value, key) => { out[key] = value })
  } else {
    Object.assign(out, headers)
  }
  for (const key of Object.keys(out)) {
    if (/^user-agent$/i.test(key)) delete out[key]
  }
  return out
}

function requestInit(init, proxyUrl) {
  return {
    method: init.method,
    headers: headerObject(init.headers),
    body: init.body,
    signal: init.signal,
    redirect: init.redirect,
    browser: BROWSER,
    os: browserOs(),
    proxy: proxyUrl || undefined,
    timeout: 60000
  }
}

/** Fetch with Chrome's TLS handshake. Uses the session proxy when one is checked out. */
export async function browserFetch(url, init = {}) {
  const { fetch: wfetch } = await loadWreq()
  const run = (proxyUrl) => wfetch(url, requestInit(init, proxyUrl))
  if (typeof globalThis.__olWithProxy === 'function') return globalThis.__olWithProxy(run)
  return run(null)
}

/** One Chrome session, so cookies from a warmup request are sent on the next call. */
export async function withBrowserSession(fn) {
  const { createSession } = await loadWreq()
  const run = async (proxyUrl) => {
    const session = await createSession({
      browser: BROWSER,
      os: browserOs(),
      proxy: proxyUrl || undefined,
      timeout: 60000
    })
    try {
      return await fn(session)
    } finally {
      await session.close()
    }
  }
  if (typeof globalThis.__olWithProxy === 'function') return globalThis.__olWithProxy(run)
  return run(null)
}
