const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const { spawn } = require('child_process')

// Windows taskbar / Jump List grouping — must match build.appId. Also helps the correct icon show when the .exe embeds it.
if (process.platform === 'win32') {
  app.setAppUserModelId('com.oddslocker.scraper')
}

const CONFIG_NAME = 'config.json'
let mainWindow = null
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
/** Read a key from userData `.env` (KEY=value), strip optional quotes. */
function readEnvKeyFromUserData(key, defaultVal) {
  try {
    const text = fs.readFileSync(userDataPath('.env'), 'utf8')
    for (const line of text.split(/\r?\n/)) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const eq = t.indexOf('=')
      if (eq === -1) continue
      const k = t.slice(0, eq).trim()
      if (k !== key) continue
      let v = t.slice(eq + 1).trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1)
      }
      return v || defaultVal
    }
  } catch (_) {}
  return defaultVal
}

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
function refreshDashboardIfOpen() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.reloadIgnoringCache()
  }
}

function disengagePushing() {
  stopScraper()
  const cfg = loadConfig()
  saveConfig({ ...cfg, pushingEnabled: false })
  updateMainWindowTitle()
  setApplicationMenu()
  refreshDashboardIfOpen()
}

function resumePushing() {
  const cfg = loadConfig()
  saveConfig({ ...cfg, pushingEnabled: true })
  startScraper()
  updateMainWindowTitle()
  setApplicationMenu()
  refreshDashboardIfOpen()
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
            refreshDashboardIfOpen()
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload dashboard',
          accelerator: 'CmdOrCtrl+R',
          click: () => mainWindow?.webContents.reloadIgnoringCache()
        },
        { type: 'separator' },
        {
          label: 'Toggle DevTools',
          click: () => mainWindow?.webContents.toggleDevTools()
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Open hosted terminal in browser',
          click: () => {
            const u = normalizeTerminalUrl(loadConfig().terminalUrl || '')
            if (u) shell.openExternal(u)
            else dialog.showErrorBox('No terminal URL', 'Open File → Settings and save a terminal URL first.')
          }
        },
        {
          label: 'Open data folder',
          click: () => shell.openPath(app.getPath('userData'))
        }
      ]
    }
  ])
  Menu.setApplicationMenu(menu)
}

/** Same artwork as terminal `/assets/logo.png` (bundled as `assets/icon.png`). */
function getWindowIconPath() {
  const p = path.join(__dirname, 'assets', 'icon.png')
  return fs.existsSync(p) ? p : undefined
}

function normalizeTerminalUrl(url) {
  let u = (url || '').trim()
  if (!u) return ''
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u
  return u.replace(/\/$/, '')
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: 'OddsLocker Scraper',
    icon: getWindowIconPath(),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload-dashboard.cjs')
    }
  })

  updateMainWindowTitle()

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'dashboard.html')).catch((err) => {
    console.error('Failed to load dashboard:', err)
    dialog.showErrorBox('Dashboard load failed', String(err.message || err))
  })

  mainWindow.show()
  mainWindow.focus()

  setApplicationMenu()

  mainWindow.on('closed', () => {
    mainWindow = null
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
    icon: getWindowIconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload-setup.cjs'),
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

ipcMain.handle('dashboard:get-info', () => {
  const cfg = loadConfig()
  const portRaw = readEnvKeyFromUserData('WS_SERVER_PORT', '8765')
  const wsPort = Number(portRaw) || 8765
  return {
    appVersion: app.getVersion(),
    wsPort,
    sourceId: cfg.sourceId || '',
    terminalUrl: normalizeTerminalUrl(cfg.terminalUrl || ''),
    pushingEnabled: cfg.pushingEnabled !== false
  }
})

ipcMain.handle('dashboard:open-hosted-terminal', () => {
  const u = normalizeTerminalUrl(loadConfig().terminalUrl || '')
  if (!u) return { ok: false, error: 'No terminal URL configured.' }
  shell.openExternal(u)
  return { ok: true }
})

ipcMain.handle('config:pick-env', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Select .env from your working scraper',
    // "All files" first — Windows often hides downloads without .env/.txt (e.g. Discord renames).
    filters: [
      { name: 'All files', extensions: ['*'] },
      { name: 'Env / text', extensions: ['env', 'txt'] }
    ],
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
    createMainWindow()
  } else {
    mainWindow.webContents.reloadIgnoringCache()
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
    createMainWindow()
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
      createMainWindow()
      if (cfg.pushingEnabled !== false) startScraper()
    } else {
      firstRunFlow()
    }
  }
})
