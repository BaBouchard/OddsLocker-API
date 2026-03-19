const { app, BrowserWindow, BrowserView, ipcMain, dialog, Menu, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const { spawn } = require('child_process')

const CONFIG_NAME = 'config.json'
let mainWindow = null
let browserView = null
let scraperProcess = null
let setupWindow = null

function userDataPath(...parts) {
  return path.join(app.getPath('userData'), ...parts)
}

function loadConfig() {
  const p = userDataPath(CONFIG_NAME)
  try {
    const raw = fs.readFileSync(p, 'utf8')
    return JSON.parse(raw)
  } catch {
    return { setupComplete: false }
  }
}

function saveConfig(cfg) {
  fs.mkdirSync(app.getPath('userData'), { recursive: true })
  fs.writeFileSync(userDataPath(CONFIG_NAME), JSON.stringify(cfg, null, 2), 'utf8')
}

/** Remove existing keys from .env text and append overrides */
function mergeEnvContent(existingContent, { sourceId, terminalUrl, ingestSecret }) {
  const keysToOverride = new Set(['SOURCE_ID', 'TERMINAL_URL', 'TERMINAL_INGEST_SECRET'])
  const lines = (existingContent || '').split(/\r?\n/)
  const kept = lines.filter((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return true
    const eq = trimmed.indexOf('=')
    if (eq === -1) return true
    const key = trimmed.slice(0, eq).trim()
    return !keysToOverride.has(key)
  })
  const out = [...kept]
  out.push(`SOURCE_ID=${sourceId}`)
  out.push(`TERMINAL_URL=${terminalUrl}`)
  if (ingestSecret) out.push(`TERMINAL_INGEST_SECRET=${ingestSecret}`)
  return out.join('\n') + '\n'
}

function getScraperExePath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'scraper.exe')
  }
  return path.join(__dirname, '..', 'dist', 'live-odds-scraper.exe')
}

function isPushingEnabled() {
  const cfg = loadConfig()
  return cfg.pushingEnabled !== false
}

function stopScraper() {
  if (scraperProcess && !scraperProcess.killed) {
    try {
      scraperProcess.kill('SIGTERM')
    } catch (_) {}
    scraperProcess = null
  }
}

function startScraper() {
  stopScraper()
  if (!isPushingEnabled()) {
    console.log('[OddsLocker Desktop] Pushing disabled (disengaged) — not starting scraper')
    return
  }
  const exe = getScraperExePath()
  if (!fs.existsSync(exe)) {
    console.warn('[OddsLocker Desktop] Scraper not found:', exe, '(build with npm run build:win from repo root)')
    return
  }
  const cwd = app.getPath('userData')
  scraperProcess = spawn(exe, [], {
    cwd,
    env: { ...process.env },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  })
  const logLine = (buf, stream) => {
    const s = buf.toString().trim()
    if (s) console.log(`[scraper ${stream}]`, s)
  }
  scraperProcess.stdout?.on('data', (d) => logLine(d, 'out'))
  scraperProcess.stderr?.on('data', (d) => logLine(d, 'err'))
  scraperProcess.on('exit', (code) => {
    console.log('[OddsLocker Desktop] Scraper exited', code)
    scraperProcess = null
    setApplicationMenu()
  })
}

/** Stop POSTing to the terminal; persists until Resume (safe before moving this slot to another PC). */
function disengagePushing() {
  stopScraper()
  const cfg = loadConfig()
  saveConfig({ ...cfg, pushingEnabled: false })
  updateMainWindowTitle()
  setApplicationMenu()
}

function resumePushing() {
  const cfg = loadConfig()
  saveConfig({ ...cfg, pushingEnabled: true })
  startScraper()
  updateMainWindowTitle()
  setApplicationMenu()
}

function updateMainWindowTitle() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  const cfg = loadConfig()
  const base = cfg.sourceId ? `OddsLocker Scraper — ${cfg.sourceId}` : 'OddsLocker Scraper'
  mainWindow.setTitle(cfg.pushingEnabled === false ? `${base} (disengaged)` : base)
}

function setApplicationMenu() {
  const cfg = loadConfig()
  const engaged = cfg.pushingEnabled !== false

  const menu = Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        {
          label: 'Settings…',
          click: () => openSetupWindow({ settings: true })
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Scraper',
      submenu: [
        {
          label: 'Disengage (stop pushing to terminal)',
          accelerator: 'CmdOrCtrl+Shift+D',
          enabled: engaged,
          click: () => disengagePushing()
        },
        {
          label: 'Resume pushing',
          accelerator: 'CmdOrCtrl+Shift+R',
          enabled: !engaged,
          click: () => resumePushing()
        },
        { type: 'separator' },
        {
          label: 'Restart scraper process',
          enabled: engaged,
          click: () => {
            if (!isPushingEnabled()) return
            startScraper()
            setApplicationMenu()
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload terminal',
          accelerator: 'CmdOrCtrl+R',
          click: () => browserView?.webContents.reloadIgnoringCache()
        },
        { type: 'separator' },
        {
          label: 'Toggle DevTools (terminal)',
          click: () => browserView?.webContents.toggleDevTools()
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Open data folder',
          click: () => shell.openPath(app.getPath('userData'))
        }
      ]
    }
  ])
  Menu.setApplicationMenu(menu)
}

function layoutBrowserView() {
  if (!mainWindow || !browserView) return
  const { width, height } = mainWindow.getContentBounds()
  browserView.setBounds({ x: 0, y: 0, width, height })
}

function normalizeTerminalUrl(url) {
  let u = (url || '').trim()
  if (!u) return ''
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u
  return u.replace(/\/$/, '')
}

function createMainWindow(terminalUrl) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: 'OddsLocker Scraper',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  browserView = new BrowserView({
    webPreferences: {
      partition: 'persist:oddslocker-terminal',
      sandbox: true,
      contextIsolation: true
    }
  })
  mainWindow.setBrowserView(browserView)
  layoutBrowserView()
  mainWindow.on('resize', layoutBrowserView)

  updateMainWindowTitle()

  browserView.webContents.loadURL(terminalUrl).catch((err) => {
    console.error('Failed to load terminal:', err)
    dialog.showErrorBox('Terminal load failed', String(err.message || err))
  })

  mainWindow.once('ready-to-show', () => mainWindow.show())

  setApplicationMenu()

  mainWindow.on('closed', () => {
    mainWindow = null
    browserView = null
  })
}

function openSetupWindow({ settings = false } = {}) {
  if (setupWindow && !setupWindow.isDestroyed()) {
    setupWindow.focus()
    return
  }
  setupWindow = new BrowserWindow({
    width: 560,
    height: 780,
    resizable: true,
    modal: !!mainWindow,
    parent: mainWindow || undefined,
    title: settings ? 'OddsLocker — Settings' : 'OddsLocker — Setup',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  setupWindow.loadFile(path.join(__dirname, 'renderer', 'setup.html'))
  setupWindow.on('closed', () => {
    setupWindow = null
    const cfg = loadConfig()
    if (!cfg.setupComplete) app.quit()
  })
}

ipcMain.handle('config:load', () => loadConfig())

ipcMain.handle('config:pick-env', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Select .env from your working scraper',
    filters: [{ name: 'Environment', extensions: ['env', 'txt'] }, { name: 'All', extensions: ['*'] }],
    properties: ['openFile']
  })
  if (canceled || !filePaths[0]) return null
  return fs.readFileSync(filePaths[0], 'utf8')
})

ipcMain.handle('setup:save', async (_evt, payload) => {
  const {
    sourceId,
    terminalUrl,
    ingestSecret,
    envText
  } = payload
  const url = normalizeTerminalUrl(terminalUrl)
  if (!sourceId || !url) {
    return { ok: false, error: 'SOURCE_ID and Terminal URL are required.' }
  }

  let baseEnv = (envText || '').trim()
  if (!baseEnv) {
    try {
      baseEnv = fs.readFileSync(userDataPath('.env'), 'utf8')
    } catch {
      return { ok: false, error: 'Import a .env file (copy from your VPS or local scraper folder).' }
    }
  }

  const merged = mergeEnvContent(baseEnv, {
    sourceId,
    terminalUrl: url,
    ingestSecret: (ingestSecret || '').trim()
  })

  fs.mkdirSync(app.getPath('userData'), { recursive: true })
  fs.writeFileSync(userDataPath('.env'), merged, 'utf8')

  const prevCfg = loadConfig()
  saveConfig({
    ...prevCfg,
    setupComplete: true,
    sourceId,
    terminalUrl: url,
    terminalIngestSecret: (ingestSecret || '').trim() || undefined,
    pushingEnabled: true
  })

  startScraper()
  setApplicationMenu()

  if (setupWindow && !setupWindow.isDestroyed()) setupWindow.close()

  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow(url)
  } else {
    browserView?.webContents.loadURL(url).catch(console.error)
    updateMainWindowTitle()
  }

  return { ok: true }
})

ipcMain.handle('setup:cancel', async () => {
  if (setupWindow && !setupWindow.isDestroyed()) setupWindow.close()
  const cfg = loadConfig()
  if (!cfg.setupComplete) app.quit()
  return { ok: true }
})

function firstRunFlow() {
  openSetupWindow({ settings: false })
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}

app.whenReady().then(() => {
  const cfg = loadConfig()
  if (cfg.setupComplete && cfg.terminalUrl) {
    createMainWindow(normalizeTerminalUrl(cfg.terminalUrl))
    if (cfg.pushingEnabled !== false) startScraper()
  } else {
    firstRunFlow()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    stopScraper()
    app.quit()
  }
})

app.on('before-quit', () => {
  stopScraper()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    const cfg = loadConfig()
    if (cfg.setupComplete && cfg.terminalUrl) {
      createMainWindow(normalizeTerminalUrl(cfg.terminalUrl))
      if (cfg.pushingEnabled !== false) startScraper()
    } else {
      firstRunFlow()
    }
  }
})
