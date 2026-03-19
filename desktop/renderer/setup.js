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
  if (cfg.sourceId) {
    const sel = document.getElementById('sourceId')
    if ([...sel.options].some((o) => o.value === cfg.sourceId)) sel.value = cfg.sourceId
  }
  if (cfg.terminalUrl) document.getElementById('terminalUrl').value = cfg.terminalUrl
  if (cfg.terminalIngestSecret) document.getElementById('ingestSecret').value = cfg.terminalIngestSecret
  if (cfg.setupComplete) {
    document.getElementById('envStatus').textContent = 'Using saved books configuration (.env on this PC). Pick a new file to replace.'
    document.getElementById('envStatus').classList.remove('env-missing')
    envText = ' ' // sentinel: save will fall back to on-disk .env unless user picks a file
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
