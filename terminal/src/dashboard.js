/** @typedef {'vps' | 'live' | 'leagues' | 'json'} DashboardPageId */

export const VPS_SLOTS = Array.from({ length: 10 }, (_, i) => `vps${i + 1}`)

const VPS_CARD_BOOKS = ['BetRivers', 'FanDuel', 'Bovada', 'PointsBet', 'BetMGM', '888sport']

const NAV_ITEMS = [
  { id: 'vps', href: '/', label: 'VPS status' },
  { id: 'live', href: '/live', label: 'Live feed' },
  { id: 'leagues', href: '/league-watcher', label: 'League watcher' },
  { id: 'json', href: '/json', label: 'JSON feed' }
]

function buildVpsBookRowsHtml() {
  return VPS_CARD_BOOKS.map(
    (book) =>
      `<div class="vps-book-row" data-book="${book}"><span class="vps-book-dot off"></span><span class="vps-book-name">${book}</span><span class="vps-book-count">—</span></div>`
  ).join('')
}

const VPS_DEMO_TAGS = {
  1: ['cool', 'Cool'],
  2: ['warm', 'Warm'],
  3: ['hot', 'Hot'],
  4: ['critical', 'Critical'],
  5: ['warm', 'Heating…'],
  6: ['cooldown', 'Cooldown'],
  7: ['cool', 'Cool'],
  8: ['warm', 'Warm'],
  9: ['hot', 'Hot'],
  10: ['cool', 'Cool']
}

function buildVpsSlotHtml(n) {
  const slot = `vps${n}`
  const [heatCls, heatText] = VPS_DEMO_TAGS[n] || ['cool', 'Cool']
  return `<div class="vps-slot" data-slot="${slot}"><div class="vps-slot-inner"><div class="vps-label">VPS ${n}</div><div class="vps-heat-tag ${heatCls}">${heatText}</div><div class="vps-n">—</div><div class="vps-time">—</div><div class="vps-books">${buildVpsBookRowsHtml()}</div></div></div>`
}

export function buildVpsGridHtml() {
  return VPS_SLOTS.map((_, i) => buildVpsSlotHtml(i + 1)).join('\n          ')
}

function buildNavHtml(activePage) {
  return NAV_ITEMS.map((item) => {
    const cls = item.id === activePage ? ' class="active"' : ''
    return `<a href="${item.href}"${cls}>${item.label}</a>`
  }).join('')
}

function dashboardStyles() {
  return `
        :root {
          --bg: #0f0f12;
          --surface: #18181c;
          --border: #2a2a30;
          --text: #e4e4e7;
          --muted: #71717a;
          --accent: #a78bfa;
          --accent-dim: #7c3aed;
          --green: #22c55e;
          --green-dim: #16a34a;
        }
        * { box-sizing: border-box; }
        html { scrollbar-gutter: stable; }
        body {
          font-family: 'Outfit', system-ui, sans-serif;
          background: var(--bg);
          color: var(--text);
          margin: 0;
          min-height: 100vh;
          line-height: 1.5;
        }
        .wrap { max-width: 88rem; margin: 0 auto; padding: 2rem 1.5rem; }
        .dash-chrome { margin-bottom: 1.25rem; }
        .header {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 0.75rem;
          flex-wrap: nowrap;
        }
        .header img { height: 42px; width: auto; display: block; flex-shrink: 0; }
        .header h1 { flex: 0 0 auto; }
        .header-actions {
          margin-left: auto;
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          min-width: 12.5rem;
        }
        a.download-scraper {
          display: inline-flex;
          align-items: center;
          padding: 0.45rem 0.9rem;
          border-radius: 999px;
          background: linear-gradient(135deg, #a855f7, #6366f1);
          color: #fff;
          font-size: 0.82rem;
          font-weight: 500;
          text-decoration: none;
          white-space: nowrap;
        }
        a.download-scraper:hover { background: linear-gradient(135deg, #9333ea, #4f46e5); }
        .header-actions-spacer { display: block; width: 12.5rem; height: 2rem; }
        h1 {
          font-size: 1.75rem;
          font-weight: 600;
          margin: 0;
          letter-spacing: -0.02em;
        }
        .tagline { color: var(--muted); font-size: 0.95rem; margin: 0 0 1rem 0; min-height: 1.45rem; }
        .dash-nav {
          display: flex;
          gap: 0.35rem;
          flex-wrap: nowrap;
          width: 100%;
          max-width: 36rem;
        }
        .dash-nav a {
          flex: 1 1 0;
          min-width: 0;
          text-align: center;
          padding: 0.35rem 0.75rem;
          border-radius: 999px;
          border: 1px solid var(--border);
          color: var(--muted);
          text-decoration: none;
          font-size: 0.82rem;
          transition: color 0.15s, border-color 0.15s, background 0.15s;
        }
        .dash-nav a:hover { color: var(--text); border-color: rgba(167,139,250,0.45); }
        .dash-nav a.active {
          background: rgba(167,139,250,0.12);
          border-color: rgba(167,139,250,0.45);
          color: var(--accent);
        }
        @media (max-width: 640px) {
          .dash-nav { max-width: none; overflow-x: auto; }
          .header-actions { min-width: 0; }
          .header-actions-spacer { display: none; }
        }
        .section-title { font-size: 0.85rem; font-weight: 500; color: var(--muted); margin-bottom: 0.75rem; }
        .section-title .lw-sub { font-weight: 400; color: var(--muted); opacity: 0.85; font-size: 0.8rem; }
        .section-title .total-odds { font-family: 'JetBrains Mono', monospace; font-weight: 500; color: var(--accent); margin-left: 0.35rem; }
        @keyframes green-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }
        .vps-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.75rem; margin-bottom: 1.5rem; perspective: 1100px; }
        @media (max-width: 1100px) { .vps-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 700px) { .vps-grid { grid-template-columns: repeat(2, 1fr); } }
        .vps-slot {
          --heat: 0;
          padding: 2px;
          border-radius: 10px;
          text-align: center;
          transform-style: preserve-3d;
          will-change: transform, opacity;
          transition: transform 0.55s cubic-bezier(0.23, 1, 0.32, 1), opacity 0.55s ease-out, box-shadow 0.3s ease-out;
          background: linear-gradient(
            to top,
            #7a3535 0%,
            #946040 calc(var(--heat) * 42%),
            #857848 calc(var(--heat) * 72%),
            #524672 calc(var(--heat) * 100%),
            #524672 100%
          );
        }
        .vps-slot.heat-cooldown { box-shadow: none; }
        .vps-slot-inner {
          background: var(--surface);
          border-radius: 8px;
          padding: 0.65rem 0.75rem;
          height: 100%;
        }
        .vps-slot.deal-in {
          opacity: 1 !important;
          transform: rotateX(0deg) translateY(0) !important;
          box-shadow: 0 18px 40px rgba(0,0,0,0.45);
        }
        .vps-slot .vps-label { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); margin-bottom: 0.35rem; }
        .vps-slot .vps-heat-tag {
          font-size: 0.58rem;
          font-weight: 500;
          letter-spacing: 0.03em;
          text-transform: uppercase;
          color: #a1a1aa;
          margin-bottom: 0.3rem;
        }
        .vps-slot .vps-heat-tag.cool { color: #8b7eb5; }
        .vps-slot .vps-heat-tag.warm { color: #a89458; }
        .vps-slot .vps-heat-tag.hot { color: #b07850; }
        .vps-slot .vps-heat-tag.critical { color: #a86565; }
        .vps-slot .vps-heat-tag.cooldown { color: #9e5050; }
        .vps-slot .vps-n { font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; color: var(--text); margin-bottom: 0.15rem; }
        .vps-slot .vps-time { font-size: 0.65rem; color: var(--muted); margin-bottom: 0.5rem; }
        .vps-slot .vps-books { text-align: left; border-top: 1px solid var(--border); padding-top: 0.4rem; }
        .vps-slot .vps-book-row { display: flex; align-items: center; gap: 0.4rem; font-size: 0.65rem; color: var(--muted); margin-bottom: 0.25rem; }
        .vps-slot .vps-book-row:last-child { margin-bottom: 0; }
        .vps-slot .vps-book-name { flex: 1; min-width: 0; }
        .vps-slot .vps-book-count { font-family: 'JetBrains Mono', monospace; font-size: 0.6rem; color: var(--muted); margin-left: auto; font-variant-numeric: tabular-nums; }
        .vps-slot .vps-book-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
        .vps-slot .vps-book-dot.active { background: #9484c4; animation: green-blink 2s ease-in-out infinite; }
        .vps-slot .vps-book-dot.stale { background: #eab308; }
        .vps-slot .vps-book-dot.off { background: var(--muted); opacity: 0.5; }
        .vps-slot .vps-book-dot.banned { background: #7a3333; }
        .league-watcher-wrap {
          margin-bottom: 1.25rem;
          opacity: 1;
          transform: translateY(0);
          transition: opacity 0.55s ease-out, transform 0.55s ease-out;
        }
        .league-watcher-wrap.reveal-in { opacity: 1 !important; transform: translateY(0) !important; }
        .league-watcher-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(11.5rem, 1fr));
          gap: 0.65rem;
        }
        .lw-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 8px;
          overflow: hidden;
          min-height: 4rem;
        }
        .lw-card-head {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          padding: 0.5rem 0.6rem;
          border-bottom: 1px solid var(--border);
          font-size: 0.78rem;
          font-weight: 600;
          color: var(--text);
          letter-spacing: 0.02em;
        }
        .lw-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .lw-dot.on {
          background: var(--green);
          box-shadow: 0 0 8px rgba(34, 197, 94, 0.45);
          animation: green-blink 2s ease-in-out infinite;
        }
        .lw-dot.off { background: var(--muted); opacity: 0.45; }
        .lw-card-body {
          padding: 0.35rem 0.45rem 0.5rem 0.5rem;
          max-height: 200px;
          overflow-y: auto;
          overflow-x: hidden;
          scrollbar-width: thin;
          scrollbar-color: rgba(167, 139, 250, 0.2) transparent;
        }
        .lw-card-body:hover,
        .lw-card-body.is-scrolling { scrollbar-color: rgba(167, 139, 250, 0.55) transparent; }
        .lw-card-body::-webkit-scrollbar { width: 3px; height: 3px; background: transparent; }
        .lw-card-body:hover::-webkit-scrollbar,
        .lw-card-body.is-scrolling::-webkit-scrollbar { width: 5px; }
        .lw-card-body::-webkit-scrollbar-track { background: transparent; border: none; box-shadow: none; margin: 6px 0; }
        .lw-card-body::-webkit-scrollbar-thumb {
          background: rgba(167, 139, 250, 0.22);
          border: none;
          border-radius: 999px;
          min-height: 28px;
          box-shadow: none;
          transition: background 0.22s ease, width 0.22s ease, box-shadow 0.22s ease;
        }
        .lw-card-body:hover::-webkit-scrollbar-thumb,
        .lw-card-body.is-scrolling::-webkit-scrollbar-thumb {
          background: rgba(196, 181, 253, 0.72);
          box-shadow: 0 0 10px rgba(167, 139, 250, 0.28);
        }
        .lw-league-row {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.68rem;
          color: var(--muted);
          padding: 0.2rem 0;
        }
        .lw-league-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .lw-empty {
          grid-column: 1 / -1;
          text-align: center;
          padding: 1rem 0.75rem;
          font-size: 0.8rem;
          color: var(--muted);
          background: var(--surface);
          border: 1px dashed var(--border);
          border-radius: 8px;
        }
        .table-wrap {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 10px;
          overflow: hidden;
          max-height: 70vh;
          overflow-y: auto;
          opacity: 1;
          transform: translateY(0);
          will-change: opacity, transform;
          transition: opacity 0.6s ease-out, transform 0.6s ease-out;
        }
        .table-wrap.reveal-in { opacity: 1 !important; transform: translateY(0) !important; }
        #oddsTable { width: 100%; border-collapse: collapse; font-size: 0.8125rem; table-layout: fixed; }
        #oddsTable th, #oddsTable td { width: 14.28%; }
        #oddsTable th {
          text-align: left;
          padding: 0.65rem 0.5rem;
          background: var(--surface);
          font-weight: 500;
          color: var(--muted);
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          position: sticky;
          top: 0;
          z-index: 1;
        }
        #oddsTable th:last-child { text-align: right; }
        #oddsTable td { padding: 0.5rem 0.5rem; border-top: 1px solid var(--border); overflow: hidden; text-overflow: ellipsis; }
        #oddsTable tbody tr:hover { background: rgba(167,139,250,0.06); }
        #oddsTable td:last-child { text-align: right; font-family: 'JetBrains Mono', monospace; font-weight: 500; color: var(--accent); }
        #oddsTable td:last-child a.odds-link { color: var(--accent); text-decoration: none; }
        #oddsTable td:last-child a.odds-link:hover { text-decoration: underline; }
        #oddsTable tbody tr:nth-child(even) { background: rgba(255,255,255,0.02); }
        #oddsTable tbody tr:nth-child(even):hover { background: rgba(167,139,250,0.08); }
        .json-wrap {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 10px;
          max-height: 75vh;
          overflow: auto;
          opacity: 1;
          transform: translateY(0);
          transition: opacity 0.55s ease-out, transform 0.55s ease-out;
        }
        .json-wrap.reveal-in { opacity: 1 !important; transform: translateY(0) !important; }
        .json-pre {
          margin: 0;
          padding: 1rem 1.1rem;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.72rem;
          line-height: 1.45;
          color: var(--text);
          white-space: pre;
          tab-size: 2;
        }
        .foot { margin-top: 1rem; font-size: 0.8rem; color: var(--muted); }
        .foot a { color: var(--accent); text-decoration: none; }
        .foot a:hover { text-decoration: underline; }
  `
}

function clientScript(pageId) {
  return `
        const DASH_PAGE = ${JSON.stringify(pageId)};
        const wsProtocol = location.protocol === 'https:' ? 'wss://' : 'ws://';
        const ws = new WebSocket(wsProtocol + location.host + '/')
        const wsStatusEl = document.getElementById('wsStatus')
        function escapeHtml(s) {
          if (s == null) return ''
          const div = document.createElement('div')
          div.textContent = s
          return div.innerHTML
        }
        function formatSharePriceCents(sharePrice) {
          if (sharePrice == null || Number.isNaN(Number(sharePrice))) return null
          const p = Number(sharePrice)
          if (p <= 0 || p >= 1) return null
          const cents = p * 100
          if (cents >= 10) return Math.round(cents) + '¢'
          if (cents >= 1) return parseFloat(cents.toFixed(1)) + '¢'
          return parseFloat(cents.toFixed(2)) + '¢'
        }
        function formatAmericanOdds(american) {
          if (american == null || Number.isNaN(Number(american))) return ''
          const n = Number(american)
          return n > 0 ? '+' + n : String(n)
        }
        function formatCompactUsd(usd) {
          if (usd == null || Number.isNaN(Number(usd))) return null
          const n = Number(usd)
          if (n >= 1000000) return '$' + (n / 1000000).toFixed(1) + 'M'
          if (n >= 1000) return '$' + Math.round(n / 1000) + 'k'
          return '$' + Math.round(n)
        }
        function formatOddsDisplay(entry) {
          const cents = formatSharePriceCents(entry && entry.share_price)
          const am = formatAmericanOdds(entry && entry.odds_american)
          let base = ''
          if (cents && am) base = cents + ' · ' + am
          else if (cents) base = cents
          else base = am
          const askSize = entry && entry.ask_size
          if (askSize != null && !Number.isNaN(Number(askSize))) {
            const sh = Number(askSize)
            const usd = formatCompactUsd(entry.max_stake_usd)
            if (sh > 0) {
              const shLabel = sh >= 1000 ? (sh / 1000).toFixed(1) + 'k sh' : Math.round(sh) + ' sh'
              base = base ? base + ' · ' + shLabel + (usd ? ' (' + usd + ')' : '') : shLabel + (usd ? ' (' + usd + ')' : '')
            }
          }
          return base
        }
        function formatLineValue(line) {
          if (line == null || Number.isNaN(Number(line))) return null
          const n = Number(line)
          return n > 0 ? '+' + n : String(n)
        }
        function formatMarketTypeDisplay(entry) {
          const mt = (entry && entry.market_type) || ''
          if (mt === 'total' && entry && entry.line_value != null && !Number.isNaN(Number(entry.line_value))) {
            return mt + ' ' + entry.line_value
          }
          const line = formatLineValue(entry && entry.line_value)
          if (mt === 'spread' && line) return mt + ' ' + line
          return mt
        }
        function formatOutcomeDisplay(entry) {
          const name = (entry && entry.outcome_name) || ''
          const mt = (entry && entry.market_type) || ''
          if (mt === 'total' && entry && entry.line_value != null && !Number.isNaN(Number(entry.line_value))) {
            return (name + ' ' + entry.line_value).trim()
          }
          const line = formatLineValue(entry && entry.line_value)
          if (mt === 'spread' && line) return (name + ' ' + line).trim()
          return name
        }
        function formatAgo(ts) {
          if (!ts) return '—'
          const s = Math.floor((Date.now() - ts) / 1000)
          if (s < 60) return s + 's ago'
          if (s < 3600) return Math.floor(s/60) + 'm ago'
          return Math.floor(s/3600) + 'h ago'
        }
        ws.onopen = function () { if (wsStatusEl) wsStatusEl.style.display = 'none' }
        ws.onerror = function () {
          if (!wsStatusEl) return
          wsStatusEl.textContent = 'WebSocket could not connect. If TERMINAL_WS_ALLOWED_TOKENS is set, external apps need ?token= or Authorization: Bearer. If you use a terminal password: log in, then hard-refresh. Check /health. Ingest may still work — try Export CSV.'
          wsStatusEl.style.display = 'block'
        }
        ws.onclose = function (ev) {
          if (!wsStatusEl || ev.wasClean) return
          if (wsStatusEl.style.display === 'none') {
            wsStatusEl.textContent = 'WebSocket disconnected (code ' + ev.code + '). Reload the page.'
            wsStatusEl.style.display = 'block'
          }
        }
        ${pageId === 'vps' ? vpsPageScript() : ''}
        ${pageId === 'live' ? livePageScript() : ''}
        ${pageId === 'leagues' ? leaguesPageScript() : ''}
        ${pageId === 'json' ? jsonPageScript() : ''}
  `
}

function vpsPageScript() {
  return `
        function heatLabelForLevel(level, cooldown) {
          if (cooldown) return { text: 'Cooldown', cls: 'cooldown' }
          if (level < 0.15) return { text: 'Cool', cls: 'cool' }
          if (level < 0.45) return { text: 'Warm', cls: 'warm' }
          if (level < 0.75) return { text: 'Hot', cls: 'hot' }
          return { text: 'Critical', cls: 'critical' }
        }
        const COOLDOWN_BLINK_MS = 2600
        const COOLDOWN_BORDER_ON = '#7a3333'
        let cooldownSyncStarted = false
        function ensureCooldownSyncLoop() {
          if (cooldownSyncStarted) return
          cooldownSyncStarted = true
          function tickCooldownBlink() {
            const phase = (Date.now() % COOLDOWN_BLINK_MS) / COOLDOWN_BLINK_MS
            const bg = phase < 0.48 ? COOLDOWN_BORDER_ON : 'transparent'
            document.querySelectorAll('.vps-slot.heat-cooldown').forEach((el) => { el.style.background = bg })
            requestAnimationFrame(tickCooldownBlink)
          }
          requestAnimationFrame(tickCooldownBlink)
        }
        function applyVpsHeat(el, level, cooldown) {
          if (!el) return
          const clamped = Math.max(0, Math.min(1, level))
          el.style.setProperty('--heat', String(clamped))
          el.classList.toggle('heat-cooldown', !!cooldown)
          if (cooldown) ensureCooldownSyncLoop()
          else el.style.background = ''
          const tag = el.querySelector('.vps-heat-tag')
          if (tag) {
            const { text, cls } = heatLabelForLevel(clamped, cooldown)
            tag.textContent = text
            tag.className = 'vps-heat-tag ' + cls
          }
        }
        function setupDemoVpsHeat() {
          const staticHeat = {
            vps1: 0, vps2: 0.28, vps3: 0.58, vps4: 0.9,
            vps6: { level: 1, cooldown: true },
            vps7: 0.12, vps8: 0.35, vps9: 0.62, vps10: 0.2
          }
          for (const slot of Object.keys(staticHeat)) {
            const el = document.querySelector('.vps-slot[data-slot="' + slot + '"]')
            if (!el) continue
            const val = staticHeat[slot]
            const level = typeof val === 'number' ? val : val.level
            const cooldown = typeof val === 'object' && val.cooldown
            applyVpsHeat(el, level, cooldown)
          }
          const vps5 = document.querySelector('.vps-slot[data-slot="vps5"]')
          if (!vps5) return
          const HEAT_MS = 14000, COOLDOWN_MS = 6500, REST_MS = 3500, CYCLE_MS = HEAT_MS + COOLDOWN_MS + REST_MS
          function tick() {
            const t = Date.now() % CYCLE_MS
            if (t < HEAT_MS) {
              const level = t / HEAT_MS
              applyVpsHeat(vps5, level, false)
              const tag = vps5.querySelector('.vps-heat-tag')
              if (tag && level > 0.08 && level < 0.92) { tag.textContent = 'Heating…'; tag.className = 'vps-heat-tag warm' }
            } else if (t < HEAT_MS + COOLDOWN_MS) {
              applyVpsHeat(vps5, 1, true)
            } else {
              applyVpsHeat(vps5, 0, false)
            }
            requestAnimationFrame(tick)
          }
          requestAnimationFrame(tick)
        }
        setupDemoVpsHeat()
        ;(function setupIntroAnimation() {
          const slots = Array.from(document.querySelectorAll('.vps-slot'))
          if (slots.length === 0) return
          slots.forEach((slot) => {
            slot.style.opacity = '0'
            slot.style.transform = 'rotateX(90deg) translateY(-12px)'
          })
          slots.forEach((slot, idx) => {
            setTimeout(() => slot.classList.add('deal-in'), idx * 120)
          })
        })()
        function agoRefreshIntervalMs(ageSec) {
          if (ageSec < 5) return 1000
          if (ageSec < 30) return 5000
          if (ageSec < 60) return 10000
          return 60000
        }
        const vpsSlotState = {}
        let vpsAgoTimer = null
        function scheduleVpsAgoTick() {
          if (vpsAgoTimer) clearTimeout(vpsAgoTimer)
          let minInterval = 60000
          const now = Date.now()
          let hasAny = false
          for (const slot of Object.keys(vpsSlotState)) {
            const lastSeen = vpsSlotState[slot]?.lastSeen ?? 0
            if (!lastSeen) continue
            hasAny = true
            const ageSec = (now - lastSeen) / 1000
            const interval = agoRefreshIntervalMs(ageSec)
            if (interval < minInterval) minInterval = interval
          }
          if (!hasAny) return
          vpsAgoTimer = setTimeout(refreshVpsSlotTimes, minInterval)
        }
        function refreshVpsSlotTimes() {
          const STALE_MS = 90000
          document.querySelectorAll('.vps-slot').forEach(el => {
            const slot = el.dataset.slot
            const st = vpsSlotState[slot]
            if (!st) return
            const lastSeen = st.lastSeen ?? 0
            const timeEl = el.querySelector('.vps-time')
            if (timeEl) timeEl.textContent = formatAgo(lastSeen)
            const hasData = st.n && lastSeen
            if (!hasData) return
            const isStale = (Date.now() - lastSeen) > STALE_MS
            const slotBooks = st.books ?? []
            el.querySelectorAll('.vps-book-row').forEach(row => {
              const book = row.dataset.book
              if (!slotBooks.includes(book)) return
              const dot = row.querySelector('.vps-book-dot')
              if (!dot) return
              dot.classList.remove('active', 'stale')
              dot.classList.add(isStale ? 'stale' : 'active')
            })
          })
          scheduleVpsAgoTick()
        }
        function vpsCountForBook(bookCounts, bookLabel) {
          if (!bookCounts || !bookLabel) return 0
          if (Object.prototype.hasOwnProperty.call(bookCounts, bookLabel)) return bookCounts[bookLabel]
          const low = String(bookLabel).toLowerCase()
          for (const k of Object.keys(bookCounts)) {
            if (String(k).toLowerCase() === low) return bookCounts[k]
          }
          return 0
        }
        function updateVpsSlots(sources) {
          if (!sources) return
          const STALE_MS = 90000
          document.querySelectorAll('.vps-slot').forEach(el => {
            const slot = el.dataset.slot
            const st = sources[slot]
            const n = st?.n ?? 0
            const lastSeen = st?.lastSeen ?? 0
            const slotBooks = st?.books ?? []
            const bookCounts = st?.bookCounts ?? {}
            vpsSlotState[slot] = { lastSeen, n, books: slotBooks, bookCounts }
            const nEl = el.querySelector('.vps-n')
            const timeEl = el.querySelector('.vps-time')
            if (nEl) nEl.textContent = n ? n + ' entries' : '—'
            if (timeEl) timeEl.textContent = formatAgo(lastSeen)
            const hasData = n && lastSeen
            const isStale = lastSeen ? (Date.now() - lastSeen) > STALE_MS : false
            el.querySelectorAll('.vps-book-row').forEach(row => {
              const book = row.dataset.book
              const dot = row.querySelector('.vps-book-dot')
              const countEl = row.querySelector('.vps-book-count')
              if (!dot) return
              dot.classList.remove('active', 'stale', 'off', 'banned')
              if (!hasData) dot.classList.add('off')
              else if (slotBooks.includes(book)) dot.classList.add(isStale ? 'stale' : 'active')
              else dot.classList.add('banned')
              if (countEl) countEl.textContent = hasData ? String(vpsCountForBook(bookCounts, book)) : '—'
            })
          })
          scheduleVpsAgoTick()
        }
        ws.onmessage = (e) => {
          let msg
          try { msg = JSON.parse(e.data) } catch (_) { return }
          if (msg.type !== 'odds') return
          if (msg.sources) updateVpsSlots(msg.sources)
        }
  `
}

function livePageScript() {
  return `
        const tbody = document.querySelector('#oddsTable tbody')
        const totalOddsEl = document.getElementById('totalOdds')
        ;(function setupIntroAnimation() {
          const tableWrap = document.querySelector('.table-wrap')
          if (!tableWrap) return
          tableWrap.style.opacity = '0'
          tableWrap.style.transform = 'translateY(18px)'
          setTimeout(() => tableWrap.classList.add('reveal-in'), 120)
        })()
        function updateLiveTable(data) {
          if (!tbody) return
          const rows = Array.isArray(data) ? data : []
          if (totalOddsEl) totalOddsEl.textContent = rows.length
          tbody.innerHTML = ''
          const max = 80
          rows.slice(0, max).forEach(e => {
            const tr = document.createElement('tr')
            const ev = (e.away_team && e.home_team) ? e.away_team + ' @ ' + e.home_team : e.event_id || ''
            const oddsLabel = formatOddsDisplay(e)
            const oddsCell = (e.bookmaker_link && oddsLabel)
              ? '<a href="' + escapeHtml(e.bookmaker_link) + '" target="_blank" rel="noopener noreferrer" class="odds-link">' + escapeHtml(oddsLabel) + '</a>'
              : escapeHtml(oddsLabel)
            tr.innerHTML = '<td>'+ escapeHtml(e.sport||'') +'</td><td>'+ escapeHtml(e.league||'') +'</td><td>'+ escapeHtml(ev) +'</td><td>'+ escapeHtml(e.sportsbook||'') +'</td><td>'+ escapeHtml(formatMarketTypeDisplay(e)) +'</td><td>'+ escapeHtml(formatOutcomeDisplay(e)) +'</td><td>'+ oddsCell +'</td>'
            tbody.appendChild(tr)
          })
          if (rows.length > max) {
            const tr = document.createElement('tr')
            tr.innerHTML = '<td colspan="7" style="color: var(--muted); padding: 0.65rem 0.85rem;">… and ' + (rows.length - max) + ' more</td>'
            tbody.appendChild(tr)
          }
        }
        ws.onmessage = (e) => {
          let msg
          try { msg = JSON.parse(e.data) } catch (_) { return }
          if (msg.type !== 'odds') return
          updateLiveTable(msg.data)
        }
  `
}

function leaguesPageScript() {
  return `
        const lwGrid = document.getElementById('leagueWatcherGrid')
        const lwUpdated = document.getElementById('lwUpdated')
        if (lwGrid && !lwGrid.dataset.lwScrollUiBound) {
          lwGrid.dataset.lwScrollUiBound = '1'
          const lwScrollTimers = new WeakMap()
          lwGrid.addEventListener('scroll', (e) => {
            const el = e.target
            if (!el.classList || !el.classList.contains('lw-card-body')) return
            el.classList.add('is-scrolling')
            clearTimeout(lwScrollTimers.get(el))
            lwScrollTimers.set(el, setTimeout(() => el.classList.remove('is-scrolling'), 900))
          }, true)
        }
        ;(function setupIntroAnimation() {
          const lwWrap = document.getElementById('leagueWatcherWrap')
          if (!lwWrap) return
          lwWrap.style.opacity = '0'
          lwWrap.style.transform = 'translateY(14px)'
          setTimeout(() => lwWrap.classList.add('reveal-in'), 120)
        })()
        function updateLeagueWatcher(watcher) {
          if (!lwGrid || !lwUpdated) return
          lwUpdated.textContent = watcher && watcher.updatedAt ? 'updated ' + formatAgo(watcher.updatedAt) : '—'
          if (!watcher || !Array.isArray(watcher.sports) || watcher.sports.length === 0) {
            lwGrid.innerHTML = '<div class="lw-empty" id="leagueWatcherEmpty">Waiting for Bovada snapshot from ingest…</div>'
            return
          }
          lwGrid.innerHTML = ''
          watcher.sports.forEach((sp) => {
            const card = document.createElement('div')
            card.className = 'lw-card'
            const head = document.createElement('div')
            head.className = 'lw-card-head'
            const sportDot = document.createElement('span')
            sportDot.className = 'lw-dot ' + (sp.active ? 'on' : 'off')
            const sportName = document.createElement('span')
            sportName.textContent = sp.name || sp.key || 'Sport'
            head.appendChild(sportDot)
            head.appendChild(sportName)
            card.appendChild(head)
            const body = document.createElement('div')
            body.className = 'lw-card-body'
            if (!sp.leagues || sp.leagues.length === 0) {
              const row = document.createElement('div')
              row.className = 'lw-league-row'
              row.innerHTML = '<span class="lw-dot off"></span><span class="lw-league-name">No leagues</span>'
              body.appendChild(row)
            } else {
              sp.leagues.forEach((lg) => {
                const row = document.createElement('div')
                row.className = 'lw-league-row'
                const d = document.createElement('span')
                d.className = 'lw-dot ' + (lg.active ? 'on' : 'off')
                const nm = document.createElement('span')
                nm.className = 'lw-league-name'
                nm.textContent = lg.name || lg.key || ''
                row.appendChild(d)
                row.appendChild(nm)
                body.appendChild(row)
              })
            }
            card.appendChild(body)
            lwGrid.appendChild(card)
          })
        }
        ws.onmessage = (e) => {
          let msg
          try { msg = JSON.parse(e.data) } catch (_) { return }
          if (msg.type !== 'odds') return
          if (Object.prototype.hasOwnProperty.call(msg, 'leagueWatcher')) updateLeagueWatcher(msg.leagueWatcher)
        }
  `
}

function jsonPageScript() {
  return `
        const jsonPre = document.getElementById('jsonFeed')
        const jsonCountEl = document.getElementById('jsonCount')
        ;(function setupIntroAnimation() {
          const wrap = document.querySelector('.json-wrap')
          if (!wrap) return
          wrap.style.opacity = '0'
          wrap.style.transform = 'translateY(14px)'
          setTimeout(() => wrap.classList.add('reveal-in'), 120)
        })()
        function updateJsonFeed(msg) {
          const payload = {
            type: msg.type,
            ts: msg.ts,
            data: Array.isArray(msg.data) ? msg.data : [],
            sources: msg.sources || {}
          }
          if (jsonPre) jsonPre.textContent = JSON.stringify(payload, null, 2)
          if (jsonCountEl) jsonCountEl.textContent = payload.data.length
        }
        ws.onmessage = (e) => {
          let msg
          try { msg = JSON.parse(e.data) } catch (_) { return }
          if (msg.type !== 'odds') return
          updateJsonFeed(msg)
        }
  `
}

export function renderLoginHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>OddsLocker Login</title>
  <style>
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif; background: #0f0f12; color: #e4e4e7; margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .card { background: #18181c; border: 1px solid #27272f; border-radius: 12px; padding: 1.75rem 1.5rem; width: 100%; max-width: 360px; box-shadow: 0 18px 45px rgba(0,0,0,0.55); }
    h1 { margin: 0 0 0.75rem 0; font-size: 1.4rem; font-weight: 600; letter-spacing: -0.02em; }
    p { margin: 0 0 1.25rem 0; font-size: 0.9rem; color: #a1a1aa; }
    label { display: block; font-size: 0.8rem; margin-bottom: 0.25rem; color: #d4d4d8; }
    input[type="password"] { width: 100%; padding: 0.5rem 0.6rem; border-radius: 8px; border: 1px solid #27272f; background: #09090b; color: #e4e4e7; font-size: 0.9rem; }
    input[type="password"]:focus { outline: none; border-color: #a78bfa; box-shadow: 0 0 0 1px rgba(167,139,250,0.35); }
    button { margin-top: 0.9rem; width: 100%; padding: 0.55rem 0.6rem; border-radius: 999px; border: none; background: linear-gradient(135deg,#a855f7,#6366f1); color: white; font-weight: 500; font-size: 0.9rem; cursor: pointer; }
    button:hover { background: linear-gradient(135deg,#9333ea,#4f46e5); }
  </style>
</head>
<body>
  <div class="card">
    <h1>OddsLocker terminal</h1>
    <p>Enter the terminal password to view live odds.</p>
    <form method="post" action="/login">
      <label for="password">Password</label>
      <input id="password" name="password" type="password" autocomplete="current-password" required>
      <button type="submit">Enter</button>
    </form>
  </div>
</body>
</html>`
}

/**
 * @param {import('express').Response} res
 * @param {{ activePage: DashboardPageId, pageTitle: string, tagline: string, contentHtml: string, scraperDownloadButtonHtml?: string }} opts
 */
export function renderDashboardPage(res, opts) {
  const {
    activePage,
    pageTitle,
    tagline,
    contentHtml,
    scraperDownloadButtonHtml = ''
  } = opts
  const headerActionHtml =
    scraperDownloadButtonHtml ||
    '<span class="header-actions-spacer" aria-hidden="true"></span>'
  res.type('html').send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${pageTitle} · OddsLocker</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Outfit:wght@400;500;600&display=swap" rel="stylesheet">
  <style>${dashboardStyles()}</style>
</head>
<body>
  <div class="wrap">
    <div class="dash-chrome">
      <div class="header">
        <img src="/assets/logo.png" alt="OddsLocker">
        <h1>OddsLocker API</h1>
        <div class="header-actions">${headerActionHtml}</div>
      </div>
      <nav class="dash-nav" aria-label="Dashboard">${buildNavHtml(activePage)}</nav>
    </div>
    <main class="dash-main">
      <p class="tagline">${tagline}</p>
      ${contentHtml}
    </main>
    <p class="foot">
      <a href="/health">/health</a> · <a href="/export/csv" download>Export CSV</a> · Ingest: <code>POST /ingest</code> · WS: <code>wss://host/?token=…</code>
    </p>
  </div>
  <script>${clientScript(activePage)}</script>
</body>
</html>`)
}

export function vpsPageContent() {
  return `
    <div class="section-title">VPS status <span class="lw-sub">(heat border: demo levels until scrapers report heat)</span></div>
    <div class="vps-grid" id="vpsGrid">
      ${buildVpsGridHtml()}
    </div>`
}

export function livePageContent() {
  return `
    <div class="section-title">Live feed (WebSocket) <span id="totalOdds" class="total-odds">—</span></div>
    <p id="wsStatus" class="ws-status" style="display:none; color:#f87171; font-size:0.85rem; margin:0 0 0.65rem 0; max-width:42rem;"></p>
    <div class="table-wrap">
      <table id="oddsTable">
        <thead>
          <tr>
            <th>Sport</th>
            <th>League</th>
            <th>Event</th>
            <th>Sportsbook</th>
            <th>Market</th>
            <th>Outcome</th>
            <th>Odds (¢ · US)</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>`
}

export function leaguesPageContent() {
  return `
    <div class="section-title">League watcher <span class="lw-sub">(Bovada live JSON)</span> <span id="lwUpdated" class="total-odds" style="font-size:0.75rem;">—</span></div>
    <div class="league-watcher-wrap" id="leagueWatcherWrap">
      <div class="league-watcher-grid" id="leagueWatcherGrid">
        <div class="lw-empty" id="leagueWatcherEmpty">Waiting for Bovada snapshot from ingest…</div>
      </div>
    </div>`
}

export function jsonPageContent() {
  return `
    <div class="section-title">Live feed JSON <span id="jsonCount" class="total-odds">—</span> entries</div>
    <p id="wsStatus" class="ws-status" style="display:none; color:#f87171; font-size:0.85rem; margin:0 0 0.65rem 0; max-width:42rem;"></p>
    <div class="json-wrap">
      <pre class="json-pre" id="jsonFeed">Waiting for WebSocket data…</pre>
    </div>`
}
