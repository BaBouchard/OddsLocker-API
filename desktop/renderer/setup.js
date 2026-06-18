/* global olDesktop */
let envText = null

function showError(msg) {
  const el = document.getElementById('errorBox')
  el.textContent = msg
  el.classList.toggle('show', !!msg)
}

async function init() {
  if (!window.olDesktop) {
    showError('Desktop API missing — run inside OddsLocker Scraper app.')
    return
  }
  const cfg = await window.olDesktop.loadConfig()
  const envInfo = await window.olDesktop.getEnvInfo()
  if (cfg.sourceId) {
    const sel = document.getElementById('sourceId')
    if ([...sel.options].some((o) => o.value === cfg.sourceId)) sel.value = cfg.sourceId
  }
  if (cfg.terminalUrl) {
    document.getElementById('terminalUrl').value = cfg.terminalUrl
  } else if (envInfo.defaultTerminalUrl) {
    document.getElementById('terminalUrl').value = envInfo.defaultTerminalUrl
  }
  if (cfg.terminalIngestSecret) document.getElementById('ingestSecret').value = cfg.terminalIngestSecret

  const envStatus = document.getElementById('envStatus')
  if (cfg.setupComplete && envInfo.hasUserEnv) {
    envStatus.textContent = 'Using saved books configuration on this PC. Pick a file to replace it.'
    envStatus.classList.remove('env-missing')
    envText = ' '
  } else if (envInfo.hasBundledEnv) {
    envStatus.textContent = `Included with app (${envInfo.settingLines} settings). No import needed.`
    envStatus.classList.remove('env-missing')
    envText = null
  } else if (envInfo.hasUserEnv) {
    envStatus.textContent = 'Using saved books configuration on this PC.'
    envStatus.classList.remove('env-missing')
    envText = ' '
  } else {
    envStatus.textContent = 'No bundled configuration — pick a .env file to continue.'
    envStatus.classList.add('env-missing')
  }
}

document.getElementById('pickEnv').addEventListener('click', async () => {
  showError('')
  const text = await window.olDesktop.pickEnvFile()
  if (text == null) return
  envText = text
  const lines = text.split(/\r?\n/).filter(Boolean).length
  document.getElementById('envStatus').textContent = `New file loaded (${lines} lines)`
  document.getElementById('envStatus').classList.remove('env-missing')
})

document.getElementById('btnStart').addEventListener('click', async () => {
  showError('')
  const sourceId = document.getElementById('sourceId').value
  const terminalUrl = document.getElementById('terminalUrl').value.trim()
  const ingestSecret = document.getElementById('ingestSecret').value

  const res = await window.olDesktop.saveSetup({
    sourceId,
    terminalUrl,
    ingestSecret,
    envText: envText === ' ' ? '' : envText
  })
  if (!res.ok) showError(res.error || 'Save failed')
})

document.getElementById('btnCancel').addEventListener('click', async () => {
  await window.olDesktop.cancelSetup()
})

init()
