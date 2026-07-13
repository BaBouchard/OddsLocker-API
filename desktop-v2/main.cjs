const { app, BrowserWindow, Menu, shell, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const http = require('http')
const { spawn } = require('child_process')

if (process.platform === 'win32') {
  app.setAppUserModelId('com.oddslocker.scraper')
}

const ENGINE_PORT = Number(process.env.OL_ENGINE_PORT) || 3100
let mainWindow = null
let engineProcess = null
let quitting = false

function userDataPath(...parts) {
  return path.join(app.getPath('userData'), ...parts)
}

function getWindowIconPath() {
  const ico = path.join(__dirname, 'assets', 'icon.ico')
  const png = path.join(__dirname, 'assets', 'icon.png')
  if (process.platform === 'win32' && fs.existsSync(ico)) return ico
  if (fs.existsSync(png)) return png
  return undefined
}

function getEngineRoot() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'odds-engine')
  }
  return path.join(__dirname, '..', 'odds-engine')
}

function getScraperSrcRoot() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'scraper-src')
  }
  return path.join(__dirname, '..', 'src')
}

function getBundledEnvPath() {
  if (app.isPackaged) {
    const p = path.join(process.resourcesPath, 'default.env')
    if (fs.existsSync(p)) return p
  }
  const local = path.join(__dirname, 'bundled', 'default.env')
  if (fs.existsSync(local)) return local
  const legacy = path.join(__dirname, '..', 'desktop', 'bundled', 'default.env')
  if (fs.existsSync(legacy)) return legacy
  return null
}

function seedUserEnv() {
  const userEnv = userDataPath('.env')
  fs.mkdirSync(app.getPath('userData'), { recursive: true })
  if (fs.existsSync(userEnv)) return
  const bundled = getBundledEnvPath()
  if (!bundled) return
  fs.copyFileSync(bundled, userEnv)
}

function waitForHealth(port, timeoutMs = 45000) {
  const started = Date.now()
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const req = http.get({ host: '127.0.0.1', port, path: '/health', timeout: 2000 }, (res) => {
        res.resume()
        if (res.statusCode === 200) resolve()
        else if (Date.now() - started > timeoutMs) reject(new Error('Engine health timeout'))
        else setTimeout(tryOnce, 400)
      })
      req.on('error', () => {
        if (Date.now() - started > timeoutMs) reject(new Error('Engine failed to start'))
        else setTimeout(tryOnce, 400)
      })
      req.on('timeout', () => {
        req.destroy()
      })
    }
    tryOnce()
  })
}

function startEngine() {
  seedUserEnv()
  const engineRoot = getEngineRoot()
  const entry = path.join(engineRoot, 'src', 'index.js')
  if (!fs.existsSync(entry)) {
    throw new Error('Engine entry missing: ' + entry)
  }

  const dataDir = userDataPath('engine-data')
  fs.mkdirSync(dataDir, { recursive: true })

  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    PORT: String(ENGINE_PORT),
    OL_ENGINE_USER_DATA: app.getPath('userData'),
    OL_ENGINE_DATA_DIR: dataDir,
    SCRAPER_SRC_ROOT: getScraperSrcRoot(),
    LEAGUE_WATCHER_CACHE_PATH: userDataPath('.league-watcher-cache.json')
  }

  engineProcess = spawn(process.execPath, [entry], {
    cwd: engineRoot,
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  })

  engineProcess.stdout.on('data', (buf) => {
    console.log('[engine]', String(buf).trimEnd())
  })
  engineProcess.stderr.on('data', (buf) => {
    console.error('[engine]', String(buf).trimEnd())
  })
  engineProcess.on('exit', (code, signal) => {
    console.warn('[engine] exited', code, signal)
    engineProcess = null
    if (!quitting && mainWindow && !mainWindow.isDestroyed()) {
      dialog.showErrorBox(
        'OddsLocker Engine stopped',
        'The scrape engine exited unexpectedly. Restart the app.'
      )
    }
  })

  return waitForHealth(ENGINE_PORT)
}

function stopEngine() {
  if (!engineProcess) return
  try {
    engineProcess.kill('SIGTERM')
  } catch (_) {}
  engineProcess = null
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: 'OddsLocker Scraper',
    icon: getWindowIconPath(),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.loadURL(`http://127.0.0.1:${ENGINE_PORT}/`)
  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function buildMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open engine in browser',
          click: () => shell.openExternal(`http://127.0.0.1:${ENGINE_PORT}/`)
        },
        {
          label: 'Open data folder',
          click: () => shell.openPath(app.getPath('userData'))
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' }
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

app.whenReady().then(async () => {
  buildMenu()
  try {
    await startEngine()
    createWindow()
  } catch (e) {
    console.error(e)
    dialog.showErrorBox('OddsLocker Scraper', 'Failed to start engine:\n' + (e.message || e))
    app.quit()
  }
})

app.on('before-quit', () => {
  quitting = true
  stopEngine()
})

app.on('window-all-closed', () => {
  quitting = true
  stopEngine()
  app.quit()
})
