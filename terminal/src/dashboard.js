/** @typedef {'vps' | 'live' | 'leagues' | 'json'} DashboardPageId */

import { VPS_SLOTS } from './vps-control.js'

export { VPS_SLOTS }

const VPS_CARD_BOOKS = ['BetRivers', 'FanDuel', 'Bovada', 'PointsBet', 'BetMGM', '888sport']

const NAV_ITEMS = [
  { id: 'vps', href: '/', label: 'VPS status' },
  { id: 'live', href: '/live', label: 'Live feed' },
  { id: 'leagues', href: '/league-watcher', label: 'League watcher' },
  { id: 'json', href: '/json', label: 'JSON feed' }
]

const VPS_BOOK_ABBR = {
  BetRivers: 'BR',
  FanDuel: 'FD',
  Bovada: 'BOV',
  PointsBet: 'PB',
  BetMGM: 'MGM',
  '888sport': '888'
}

function buildVpsBookRowsHtml() {
  return VPS_CARD_BOOKS.map(
    (book) =>
      `<div class="vps-book-row" data-book="${book}" title="${book}"><span class="vps-book-dot off"></span><span class="vps-book-name">${VPS_BOOK_ABBR[book] || book}</span><span class="vps-book-count">—</span></div>`
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
  return `<div class="vps-slot" data-slot="${slot}"><div class="vps-slot-inner"><div class="vps-head"><span class="vps-label">${n}</span><span class="vps-heat-tag ${heatCls}">${heatText}</span></div><div class="vps-n">—</div><div class="vps-time">—</div><div class="vps-books">${buildVpsBookRowsHtml()}</div></div></div>`
}

export function buildVpsGridHtml() {
  return VPS_SLOTS.map((_, i) => buildVpsSlotHtml(i + 1)).join('\n          ')
}

function buildDeckChannelHtml(n) {
  const slot = `vps${n}`
  return `<div class="deck-channel" data-slot="${slot}">
            <div class="ch-label">CH ${n}</div>
            <div class="ch-vu" data-vu="${slot}"><div class="ch-vu-fill"></div></div>
            <div class="ch-mini" data-poll-label="${slot}">—</div>
            <div class="ch-toggles">
              <label class="deck-switch" title="Slot in fleet loop"><input type="checkbox" data-ch-enabled="${slot}" checked><span class="deck-switch-pill"></span>Loop</label>
              <label class="deck-switch" title="Push ingest to terminal"><input type="checkbox" data-ch-push="${slot}" checked><span class="deck-switch-pill"></span>Push</label>
            </div>
            <input class="ch-note" type="text" maxlength="120" placeholder="Maint note" data-ch-note="${slot}">
            <div class="ch-btns">
              <button type="button" class="deck-btn" data-cmd="fetchOnce" data-slot="${slot}">Fetch</button>
              <button type="button" class="deck-btn" data-cmd="disengage" data-slot="${slot}">Pause</button>
              <button type="button" class="deck-btn accent" data-cmd="resume" data-slot="${slot}">Resume</button>
            </div>
          </div>`
}

function buildCarRadioHtml() {
  return `<div class="car-radio" id="carRadio">
          <div class="car-radio-bezel">
            <div class="car-radio-brand">ODDSLOCKER</div>
            <div class="car-radio-mode-lamp" id="radioModeLamp"></div>
            <div class="car-radio-screens">
              <div class="radio-screen-block">
                <div class="radio-screen-label">NEXT IN</div>
                <div class="radio-screen recess" id="radioCountdownScreen">
                  <div class="seg-display" id="radioCountdownSeg">02</div>
                </div>
              </div>
              <div class="radio-screen-block">
                <div class="radio-screen-label">NEXT VPS</div>
                <div class="radio-screen recess" id="radioVpsScreen">
                  <div class="seg-display" id="radioVpsSeg">01</div>
                </div>
              </div>
              <div class="radio-screen-block radio-screen-mode">
                <div class="radio-screen-label">MODE</div>
                <div class="radio-screen recess small" id="radioModeScreen">
                  <div class="seg-display seg-display-sm" id="radioModeSeg">MAN</div>
                </div>
              </div>
            </div>
            <div class="car-radio-orchestration">
              <label class="deck-switch orchestration-switch" title="When ON, deck schedules remote scraper polls. When OFF, VPS scrapers run on their own.">
                <input type="checkbox" id="deckRemoteOrchestration">
                <span class="deck-switch-pill"></span>
                <span class="orchestration-label">Deck orchestration</span>
              </label>
              <span class="orchestration-hint" id="orchestrationHint">Manual — scrapers poll on their own</span>
            </div>
          </div>
        </div>`
}

function buildVpsControlDeckHtml() {
  const channels = VPS_SLOTS.map((_, i) => buildDeckChannelHtml(i + 1)).join('\n          ')
  return `<div class="control-deck" id="controlDeck">
      <div class="control-deck-inner">
        <div class="deck-header">
          <span class="deck-led" id="deckFleetLed"></span>
          <span class="deck-title">Fleet Control Station</span>
          <span class="deck-meta" id="deckMeta">rev — · sync —</span>
        </div>
        <div class="deck-command-row">
        ${buildCarRadioHtml()}
          <div class="deck-master-panel">
            <div class="deck-fader deck-remote-only">
              <label>Poll interval</label>
              <span class="deck-fader-val" id="deckPollVal">2.0s</span>
              <input type="range" id="deckDefaultPoll" min="0.5" max="120" step="0.5" value="2">
            </div>
            <div class="deck-fader deck-remote-only">
              <label>VPS stagger</label>
              <span class="deck-fader-val" id="deckStaggerVal">0.5s</span>
              <input type="range" id="deckStagger" min="0" max="30" step="0.5" value="0.5">
            </div>
            <div class="deck-fader deck-remote-only">
              <label>Config poll</label>
              <span class="deck-fader-val" id="deckConfigPollVal">5s</span>
              <input type="range" id="deckConfigPoll" min="3" max="120" step="1" value="5">
            </div>
            <div class="deck-toggle-row">
              <label class="deck-switch danger" title="Master fleet kill switch"><input type="checkbox" id="deckFleetEnabled" checked><span class="deck-switch-pill"></span>Fleet live</label>
              <label class="deck-switch deck-remote-only" title="Auto-poll all adapters when push enabled"><input type="checkbox" id="deckAutoPoll"><span class="deck-switch-pill"></span>Auto poll</label>
              <label class="deck-switch" title="Accept league watcher snapshots on ingest"><input type="checkbox" id="deckLeagueWatcher" checked><span class="deck-switch-pill"></span>League watcher</label>
              <label class="deck-switch danger deck-remote-only" title="Each ingest replaces entire terminal feed"><input type="checkbox" id="deckReplaceAll"><span class="deck-switch-pill"></span>Replace all</label>
            </div>
            <div class="deck-actions">
              <button type="button" class="deck-btn accent deck-remote-only" id="deckFetchAll">Fetch all VPS</button>
              <button type="button" class="deck-btn" id="deckResetDefaults">Reset defaults</button>
            </div>
          </div>
          <div class="deck-summary" id="deckSummary">
            <div class="deck-stat"><strong id="deckActiveCount">0</strong> / 10 channels pushing</div>
            <div class="deck-stat">Fleet: <strong id="deckFleetState">—</strong></div>
            <div class="deck-stat">Default poll: <strong id="deckSummaryPoll">—</strong></div>
            <div class="deck-stat">Stagger: <strong id="deckSummaryStagger">—</strong></div>
          </div>
        </div>
        <div class="deck-channels" id="deckChannels">
          ${channels}
        </div>
      </div>
    </div>`
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
        .vps-grid {
          display: grid;
          grid-template-columns: repeat(10, minmax(0, 1fr));
          gap: 0.4rem;
          margin-bottom: 1rem;
        }
        @media (max-width: 1100px) {
          .vps-grid {
            grid-template-columns: repeat(10, minmax(5.25rem, 1fr));
            overflow-x: auto;
            padding-bottom: 0.25rem;
          }
        }
        .vps-slot {
          --heat: 0;
          position: relative;
          min-width: 0;
          padding: 1px;
          border-radius: 8px;
          text-align: center;
          background: linear-gradient(145deg, rgba(167,139,250,0.32), rgba(124,58,237,0.18) 55%, rgba(255,255,255,0.04) 100%);
          box-shadow:
            0 0 calc(4px + var(--heat) * 12px) rgba(167,139,250, calc(0.08 + var(--heat) * 0.22)),
            0 4px 14px rgba(0,0,0,0.28);
          transition: box-shadow 0.35s ease-out, opacity 0.45s ease-out, transform 0.45s ease-out;
        }
        .vps-slot.heat-cooldown {
          background: linear-gradient(145deg, rgba(127,29,29,0.45), rgba(67,20,20,0.35));
          animation: vps-cooldown-pulse 2.6s ease-in-out infinite;
        }
        @keyframes vps-cooldown-pulse {
          0%, 100% { box-shadow: 0 0 14px rgba(127,29,29,0.35); }
          50% { box-shadow: 0 0 5px rgba(127,29,29,0.08); }
        }
        .vps-slot-inner {
          background: linear-gradient(180deg, #1c1c24 0%, #121218 100%);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 7px;
          padding: 0.38rem 0.32rem 0.42rem;
          height: 100%;
        }
        .vps-slot.deal-in {
          opacity: 1 !important;
          transform: translateY(0) !important;
        }
        .vps-slot .vps-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.2rem;
          margin-bottom: 0.28rem;
          padding-bottom: 0.22rem;
          border-bottom: 1px solid rgba(167,139,250,0.12);
        }
        .vps-slot .vps-label {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.62rem;
          font-weight: 600;
          letter-spacing: 0.06em;
          color: #c4b5fd;
        }
        .vps-slot .vps-heat-tag {
          font-size: 0.48rem;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: #71717a;
          white-space: nowrap;
        }
        .vps-slot .vps-heat-tag.cool { color: #8b7eb5; }
        .vps-slot .vps-heat-tag.warm { color: #a89458; }
        .vps-slot .vps-heat-tag.hot { color: #c084fc; }
        .vps-slot .vps-heat-tag.critical { color: #f87171; }
        .vps-slot .vps-heat-tag.cooldown { color: #fca5a5; }
        .vps-slot .vps-n {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.58rem;
          color: var(--text);
          margin-bottom: 0.1rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .vps-slot .vps-time {
          font-size: 0.5rem;
          color: var(--muted);
          margin-bottom: 0.32rem;
        }
        .vps-slot .vps-books {
          text-align: left;
          border-top: 1px solid rgba(255,255,255,0.05);
          padding-top: 0.28rem;
        }
        .vps-slot .vps-book-row {
          display: flex;
          align-items: center;
          gap: 0.22rem;
          font-size: 0.48rem;
          color: var(--muted);
          margin-bottom: 0.14rem;
          line-height: 1.1;
        }
        .vps-slot .vps-book-row:last-child { margin-bottom: 0; }
        .vps-slot .vps-book-name { flex: 1; min-width: 0; font-weight: 500; }
        .vps-slot .vps-book-count {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.48rem;
          color: #a1a1aa;
          margin-left: auto;
          font-variant-numeric: tabular-nums;
        }
        .vps-slot .vps-book-dot { width: 4px; height: 4px; border-radius: 50%; flex-shrink: 0; }
        .vps-slot .vps-book-dot.active { background: #a78bfa; box-shadow: 0 0 5px rgba(167,139,250,0.55); animation: green-blink 2s ease-in-out infinite; }
        .vps-slot .vps-book-dot.stale { background: #eab308; }
        .vps-slot .vps-book-dot.off { background: var(--muted); opacity: 0.45; }
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
        .control-deck {
          --deck-metal: #1a1a22;
          --deck-glow: #a78bfa;
          --deck-magenta: #c4b5fd;
          --deck-amber: #fbbf24;
          margin-top: 0.25rem;
          margin-bottom: 0;
          border-radius: 14px;
          padding: 1px;
          background: linear-gradient(145deg, rgba(167,139,250,0.4), rgba(124,58,237,0.25) 40%, rgba(251,191,36,0.12) 100%);
          box-shadow: 0 24px 60px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06);
        }
        .control-deck-inner {
          background:
            radial-gradient(ellipse 120% 80% at 50% -20%, rgba(167,139,250,0.1), transparent 55%),
            linear-gradient(180deg, #14141a 0%, #0e0e13 100%);
          border-radius: 13px;
          padding: 1rem 1.1rem 1.15rem;
        }
        .deck-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1rem;
          padding-bottom: 0.65rem;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .deck-title {
          font-size: 0.72rem;
          font-weight: 600;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #c4b5fd;
        }
        .deck-led {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--deck-glow);
          box-shadow: 0 0 12px var(--deck-glow);
          animation: green-blink 2.4s ease-in-out infinite;
        }
        .deck-led.off { background: #52525b; box-shadow: none; animation: none; }
        .deck-meta {
          margin-left: auto;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.62rem;
          color: var(--muted);
        }
        .deck-command-row {
          display: grid;
          grid-template-columns: minmax(17rem, auto) minmax(0, 1fr) auto;
          gap: 0.65rem;
          align-items: stretch;
          margin-bottom: 0.85rem;
        }
        @media (max-width: 1100px) {
          .deck-command-row { grid-template-columns: 1fr; }
        }
        .deck-master-panel {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(8.5rem, 1fr));
          gap: 0.65rem;
          padding: 0.75rem 0.85rem;
          border-radius: 10px;
          background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(0,0,0,0.2));
          border: 1px solid rgba(255,255,255,0.05);
          min-width: 0;
        }
        .deck-fader {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          min-width: 0;
        }
        .deck-fader label {
          font-size: 0.62rem;
          font-weight: 500;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--muted);
        }
        .deck-fader-val {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.72rem;
          color: var(--deck-glow);
        }
        .deck-fader input[type=range] {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 6px;
          border-radius: 999px;
          background: linear-gradient(90deg, #27272a, #3f3f46);
          outline: none;
        }
        .deck-fader input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 14px;
          height: 22px;
          border-radius: 3px;
          background: linear-gradient(180deg, #e4e4e7, #a1a1aa);
          box-shadow: 0 2px 6px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.4);
          cursor: grab;
        }
        .deck-toggle-row {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem 0.85rem;
          align-items: center;
          grid-column: 1 / -1;
          padding-top: 0.25rem;
        }
        .deck-switch {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.68rem;
          color: var(--muted);
          cursor: pointer;
          user-select: none;
        }
        .deck-switch input { display: none; }
        .deck-switch-pill {
          width: 34px;
          height: 18px;
          border-radius: 999px;
          background: #27272a;
          border: 1px solid #3f3f46;
          position: relative;
          transition: background 0.2s, border-color 0.2s, box-shadow 0.2s;
        }
        .deck-switch-pill::after {
          content: '';
          position: absolute;
          top: 2px;
          left: 2px;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #71717a;
          transition: transform 0.2s, background 0.2s;
        }
        .deck-switch input:checked + .deck-switch-pill {
          background: rgba(167,139,250,0.15);
          border-color: rgba(167,139,250,0.55);
          box-shadow: 0 0 10px rgba(167,139,250,0.28);
        }
        .deck-switch input:checked + .deck-switch-pill::after {
          transform: translateX(16px);
          background: var(--deck-glow);
        }
        .deck-switch.danger input:checked + .deck-switch-pill {
          background: rgba(248,113,113,0.12);
          border-color: rgba(248,113,113,0.5);
          box-shadow: 0 0 10px rgba(248,113,113,0.2);
        }
        .deck-switch.danger input:checked + .deck-switch-pill::after { background: #f87171; }
        .deck-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.45rem;
          grid-column: 1 / -1;
        }
        .deck-btn {
          font-family: inherit;
          font-size: 0.68rem;
          font-weight: 500;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          padding: 0.4rem 0.75rem;
          border-radius: 6px;
          border: 1px solid rgba(255,255,255,0.08);
          background: linear-gradient(180deg, rgba(255,255,255,0.06), rgba(0,0,0,0.15));
          color: var(--text);
          cursor: pointer;
          transition: border-color 0.15s, box-shadow 0.15s, color 0.15s;
        }
        .deck-btn:hover {
          border-color: rgba(167,139,250,0.45);
          color: #c4b5fd;
          box-shadow: 0 0 14px rgba(167,139,250,0.15);
        }
        .deck-btn.accent {
          border-color: rgba(196,181,253,0.45);
          color: #e9d5ff;
        }
        .deck-btn.accent:hover { box-shadow: 0 0 14px rgba(167,139,250,0.2); }
        .deck-summary {
          min-width: 9.5rem;
          flex-shrink: 0;
          padding: 0.75rem 0.85rem;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.05);
          background: rgba(0,0,0,0.25);
          font-size: 0.68rem;
          color: var(--muted);
          align-self: stretch;
        }
        .deck-summary strong { color: var(--text); font-weight: 500; }
        .deck-summary .deck-stat { margin-bottom: 0.35rem; }
        .deck-channels {
          display: grid;
          grid-template-columns: repeat(10, 1fr);
          gap: 0.5rem;
          overflow-x: auto;
          padding-bottom: 0.25rem;
        }
        @media (max-width: 1200px) {
          .deck-channels { grid-template-columns: repeat(5, minmax(5.5rem, 1fr)); }
        }
        .deck-channel {
          min-width: 5.25rem;
          padding: 0.55rem 0.45rem 0.65rem;
          border-radius: 8px;
          background: linear-gradient(180deg, #1c1c24, #121218);
          border: 1px solid rgba(255,255,255,0.05);
          text-align: center;
          transition: border-color 0.2s, opacity 0.2s, box-shadow 0.2s;
        }
        .deck-channel.disabled {
          opacity: 0.45;
          border-color: rgba(248,113,113,0.25);
        }
        .deck-channel.active-push {
          border-color: rgba(167,139,250,0.4);
          box-shadow: 0 0 16px rgba(167,139,250,0.12);
        }
        .deck-channel .ch-label {
          font-size: 0.58rem;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--muted);
          margin-bottom: 0.35rem;
        }
        .deck-channel .ch-vu {
          height: 48px;
          width: 100%;
          margin: 0 auto 0.45rem;
          border-radius: 4px;
          background: #0a0a0e;
          border: 1px solid rgba(255,255,255,0.04);
          position: relative;
          overflow: hidden;
        }
        .deck-channel .ch-vu-fill {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 0%;
          background: linear-gradient(0deg, #6d28d9, #a78bfa 60%, #c4b5fd);
          transition: height 0.35s ease-out;
          box-shadow: 0 0 12px rgba(167,139,250,0.4);
        }
        .deck-channel .ch-vu.peak .ch-vu-fill {
          background: linear-gradient(0deg, #b45309, var(--deck-amber) 55%, #fde68a);
          box-shadow: 0 0 12px rgba(251,191,36,0.35);
        }
        .deck-channel .ch-mini {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.55rem;
          color: var(--muted);
          margin-bottom: 0.4rem;
        }
        .deck-channel .ch-toggles {
          display: flex;
          flex-direction: column;
          gap: 0.3rem;
          margin-bottom: 0.4rem;
          align-items: center;
        }
        .deck-channel .ch-toggles .deck-switch { font-size: 0.58rem; }
        .deck-channel .ch-note {
          width: 100%;
          font-size: 0.58rem;
          padding: 0.25rem 0.3rem;
          border-radius: 4px;
          border: 1px solid rgba(255,255,255,0.06);
          background: rgba(0,0,0,0.35);
          color: var(--text);
          margin-bottom: 0.4rem;
        }
        .deck-channel .ch-note::placeholder { color: #52525b; }
        .deck-channel .ch-btns {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        .deck-channel .ch-btns .deck-btn {
          font-size: 0.55rem;
          padding: 0.28rem 0.35rem;
          width: 100%;
        }
        .vps-slot.maintenance .vps-slot-inner {
          opacity: 0.55;
          filter: grayscale(0.35);
        }
        .vps-slot.maintenance::after {
          content: 'MAINT';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-12deg);
          font-size: 0.52rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          color: rgba(248,113,113,0.8);
          border: 1px solid rgba(248,113,113,0.45);
          padding: 0.1rem 0.35rem;
          border-radius: 4px;
          pointer-events: none;
          z-index: 2;
        }
        .car-radio {
          margin-bottom: 0;
          min-width: 0;
        }
        .car-radio-bezel {
          border-radius: 10px;
          padding: 0.65rem 0.75rem 0.7rem;
          height: 100%;
          display: flex;
          flex-direction: column;
          background:
            linear-gradient(180deg, #3d3d45 0%, #25252c 18%, #1a1a20 55%, #121218 100%);
          border: 1px solid #4a4a54;
          box-shadow:
            inset 0 2px 4px rgba(255,255,255,0.12),
            inset 0 -3px 8px rgba(0,0,0,0.55),
            0 6px 18px rgba(0,0,0,0.3);
          position: relative;
        }
        .car-radio-bezel::before {
          content: '';
          position: absolute;
          inset: 4px;
          border-radius: 9px;
          border: 1px solid rgba(0,0,0,0.35);
          pointer-events: none;
        }
        .car-radio-brand {
          font-size: 0.55rem;
          font-weight: 700;
          letter-spacing: 0.28em;
          color: #9ca3af;
          text-shadow: 0 1px 0 rgba(255,255,255,0.15);
          margin-bottom: 0.55rem;
        }
        .car-radio-mode-lamp {
          position: absolute;
          top: 0.85rem;
          right: 1rem;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #f59e0b;
          box-shadow: 0 0 10px rgba(245,158,11,0.65);
        }
        .car-radio-mode-lamp.orch {
          background: #a78bfa;
          box-shadow: 0 0 12px rgba(167,139,250,0.75);
        }
        .car-radio-screens {
          display: flex;
          flex-wrap: nowrap;
          gap: 0.55rem 0.75rem;
          align-items: flex-end;
          margin-bottom: 0.55rem;
        }
        .radio-screen-block { min-width: 0; }
        .radio-screen-label {
          font-size: 0.52rem;
          font-weight: 600;
          letter-spacing: 0.14em;
          color: #6b7280;
          margin-bottom: 0.3rem;
          text-transform: uppercase;
        }
        .radio-screen.recess {
          background: linear-gradient(180deg, #060608 0%, #0c0c10 100%);
          border-radius: 6px;
          padding: 0.45rem 0.55rem;
          border: 2px inset #1f1f28;
          box-shadow: inset 0 3px 10px rgba(0,0,0,0.85), 0 1px 0 rgba(255,255,255,0.04);
        }
        .radio-screen.recess.small { padding: 0.35rem 0.45rem; }
        .seg-display {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 0.12rem;
          min-height: 2.1rem;
          font-family: 'JetBrains Mono', monospace;
          font-size: 1.28rem;
          font-weight: 600;
          font-variant-numeric: tabular-nums;
          letter-spacing: 0.14em;
          color: #fbbf24;
          text-shadow:
            0 0 10px rgba(251, 191, 36, 0.65),
            0 0 2px rgba(255, 255, 255, 0.25);
          line-height: 1;
        }
        .seg-display-sm {
          min-height: 1.55rem;
          font-size: 0.95rem;
          letter-spacing: 0.1em;
        }
        .seg-display.seg-dim { color: rgba(251, 191, 36, 0.35); text-shadow: none; }
        .car-radio-orchestration {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 0.35rem;
          padding-top: 0.45rem;
          margin-top: auto;
          border-top: 1px solid rgba(255,255,255,0.06);
        }
        .orchestration-switch .orchestration-label {
          font-size: 0.68rem;
          font-weight: 500;
          color: #d4d4d8;
          letter-spacing: 0.02em;
        }
        .orchestration-hint {
          font-size: 0.58rem;
          color: #71717a;
          font-style: italic;
          line-height: 1.3;
          max-width: 16rem;
        }
        .control-deck.manual-mode .deck-remote-only {
          opacity: 0.38;
          pointer-events: none;
          filter: grayscale(0.4);
        }
        .control-deck.manual-mode .deck-channel .ch-btns .deck-btn:not([data-cmd="fetchOnce"]) {
          opacity: 0.38;
          pointer-events: none;
        }
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

function vpsControlDeckScript() {
  return `
        let controlState = null
        let controlRev = -1
        let saveTimer = null
        let controlDirty = false
        let pendingPatch = {}
        let vpsSourcesCache = null
        let radioTickTimer = null
        const PAGE_RADIO_EPOCH = Date.now()
        const VPS_SLOT_LIST = ${JSON.stringify(VPS_SLOTS)}
        function fmtSec(v) { return Number(v).toFixed(Number(v) % 1 ? 1 : 0) + 's' }
        function renderSegDisplay(el, text, dim) {
          if (!el) return
          el.textContent = String(text == null ? '' : text).toUpperCase()
          el.classList.toggle('seg-dim', !!dim)
        }
        function readPollIntervalSec() {
          const poll = document.getElementById('deckDefaultPoll')
          const n = poll ? Number(poll.value) : NaN
          return Number.isFinite(n) && n > 0 ? n : (controlState?.global?.defaultPollIntervalSec ?? 2)
        }
        function readStaggerSec() {
          const stagger = document.getElementById('deckStagger')
          const n = stagger ? Number(stagger.value) : NaN
          return Number.isFinite(n) && n >= 0 ? n : (controlState?.global?.vpsStaggerSec ?? 0.5)
        }
        function readScheduleEpoch() {
          const epoch = Number(controlState?.global?.scheduleEpoch)
          return Number.isFinite(epoch) && epoch > 0 ? epoch : PAGE_RADIO_EPOCH
        }
        function defaultClientControlState() {
          const slots = {}
          for (const slot of VPS_SLOT_LIST) {
            slots[slot] = {
              enabled: true,
              pushEnabled: true,
              pollIntervalSec: null,
              autoPoll: null,
              maintenanceNote: ''
            }
          }
          return {
            rev: 0,
            updatedAt: Date.now(),
            global: {
              fleetEnabled: true,
              remoteOrchestration: false,
              scheduleEpoch: PAGE_RADIO_EPOCH,
              defaultPollIntervalSec: 2,
              vpsStaggerSec: 0.5,
              autoPoll: false,
              leagueWatcherPush: true,
              replaceAllOnIngest: false,
              configPollSec: 5
            },
            slots
          }
        }
        function ensureControlState() {
          if (!controlState) controlState = defaultClientControlState()
          return controlState
        }
        function getEffectiveGlobal() {
          ensureControlState()
          const g = { ...controlState.global }
          const fleet = document.getElementById('deckFleetEnabled')
          const remoteOrch = document.getElementById('deckRemoteOrchestration')
          const autoPoll = document.getElementById('deckAutoPoll')
          if (fleet) g.fleetEnabled = fleet.checked
          if (remoteOrch) g.remoteOrchestration = remoteOrch.checked
          if (autoPoll) g.autoPoll = autoPoll.checked
          g.defaultPollIntervalSec = readPollIntervalSec()
          g.vpsStaggerSec = readStaggerSec()
          g.scheduleEpoch = readScheduleEpoch()
          return g
        }
        function bumpScheduleEpoch() {
          const epoch = Date.now()
          ensureControlState()
          controlState.global.scheduleEpoch = epoch
          return epoch
        }
        function formatCountdownSeg(ms) {
          if (ms == null || !Number.isFinite(ms)) return '----'
          const totalSec = Math.max(0, Math.ceil(ms / 1000))
          if (totalSec >= 3600) {
            const h = Math.min(99, Math.floor(totalSec / 3600))
            const m = Math.floor((totalSec % 3600) / 60)
            return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0')
          }
          if (totalSec >= 60) {
            const m = Math.floor(totalSec / 60)
            const s = totalSec % 60
            return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0')
          }
          return String(totalSec).padStart(2, '0')
        }
        function formatVpsSeg(slot) {
          if (!slot) return '--'
          const n = Number(String(slot).replace('vps', ''))
          if (!Number.isFinite(n) || n < 1) return '--'
          return String(n).padStart(2, '0')
        }
        function computeFleetSchedule(now) {
          const pollMs = Math.max(500, readPollIntervalSec() * 1000)
          const staggerMs = Math.max(0, readStaggerSec() * 1000)
          const epoch = readScheduleEpoch()
          let bestAt = Infinity
          let bestSlot = null
          for (const slot of VPS_SLOT_LIST) {
            const n = Number(String(slot).replace('vps', ''))
            const firstAt = epoch + Math.max(0, n - 1) * staggerMs
            let nextAt
            if (now < firstAt) {
              nextAt = firstAt
            } else {
              const elapsed = now - firstAt
              const cycles = Math.floor(elapsed / pollMs)
              nextAt = firstAt + (cycles + 1) * pollMs
              if (nextAt <= now) nextAt += pollMs
            }
            if (nextAt < bestAt) { bestAt = nextAt; bestSlot = slot }
          }
          return { nextSlot: bestSlot, nextInMs: bestSlot ? Math.max(0, bestAt - now) : null }
        }
        function isRemoteOrchestrationActive() {
          const el = document.getElementById('deckRemoteOrchestration')
          if (el) return el.checked
          return !!controlState?.global?.remoteOrchestration
        }
        function updateCarRadioDisplay() {
          const g = getEffectiveGlobal()
          const remote = isRemoteOrchestrationActive()
          const deck = document.getElementById('controlDeck')
          const lamp = document.getElementById('radioModeLamp')
          const hint = document.getElementById('orchestrationHint')
          const modeSeg = document.getElementById('radioModeSeg')
          const countdownSeg = document.getElementById('radioCountdownSeg')
          const vpsSeg = document.getElementById('radioVpsSeg')
          if (deck) deck.classList.toggle('manual-mode', !remote)
          if (lamp) lamp.classList.toggle('orch', remote)
          if (hint) {
            if (!remote) {
              hint.textContent = 'Manual — scrapers self-poll; deck shows planned rotation timing'
            } else if (!g.fleetEnabled) {
              hint.textContent = 'Orchestration — fleet halted (schedule preview still runs)'
            } else if (!g.autoPoll) {
              hint.textContent = 'Orchestration — schedule preview (scrapers not on remote poll yet)'
            } else {
              hint.textContent = 'Orchestration — deck schedules fleet polls'
            }
          }
          renderSegDisplay(modeSeg, remote ? 'ORCH' : 'MAN')
          const sch = computeFleetSchedule(Date.now())
          renderSegDisplay(countdownSeg, formatCountdownSeg(sch.nextInMs))
          renderSegDisplay(vpsSeg, formatVpsSeg(sch.nextSlot))
        }
        function startRadioTick() {
          if (radioTickTimer) return
          function tick() {
            try { updateCarRadioDisplay() } catch (e) { console.warn('[Control] radio tick', e) }
            radioTickTimer = setTimeout(tick, 200)
          }
          updateCarRadioDisplay()
          tick()
        }
        function mergePatch(base, patch) {
          const out = { ...base }
          if (patch.global) out.global = { ...(out.global || {}), ...patch.global }
          if (patch.slots) {
            out.slots = { ...(out.slots || {}) }
            for (const k of Object.keys(patch.slots)) {
              out.slots[k] = { ...(out.slots[k] || {}), ...patch.slots[k] }
            }
          }
          if (patch.command) out.command = patch.command
          return out
        }
        function queueSave(patch) {
          controlDirty = true
          pendingPatch = mergePatch(pendingPatch, patch)
          if (saveTimer) clearTimeout(saveTimer)
          saveTimer = setTimeout(() => {
            const toSend = pendingPatch
            pendingPatch = {}
            saveControlPatch(toSend)
          }, 420)
        }
        async function saveControlPatch(patch) {
          if (!patch) return
          try {
            const res = await fetch('/api/vps-control', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(patch)
            })
            if (!res.ok) throw new Error('save failed ' + res.status)
            const data = await res.json()
            applyControlState(data, true)
            controlDirty = false
          } catch (e) {
            console.warn('[Control] save error', e)
          }
        }
        async function sendCommand(slot, type) {
          await saveControlPatch({ command: { slot, type } })
        }
        function applyControlToCards(slots) {
          const remote = !!controlState?.global?.remoteOrchestration
          document.querySelectorAll('.vps-slot').forEach(el => {
            const slot = el.dataset.slot
            const st = slots && slots[slot]
            const maint = remote && st && !st.enabled
            el.classList.toggle('maintenance', !!maint)
          })
        }
        function applyChannelVu(sources) {
          if (!sources) return
          let maxN = 1
          for (const slot of Object.keys(sources)) {
            if (slot.startsWith('_')) continue
            const n = sources[slot]?.n ?? 0
            if (n > maxN) maxN = n
          }
          document.querySelectorAll('.deck-channel').forEach(ch => {
            const slot = ch.dataset.slot
            const st = sources[slot]
            const n = st?.n ?? 0
            const lastSeen = st?.lastSeen ?? 0
            const ageSec = lastSeen ? (Date.now() - lastSeen) / 1000 : 9999
            const pct = Math.min(100, Math.round((n / maxN) * 100))
            const fill = ch.querySelector('.ch-vu-fill')
            const vu = ch.querySelector('.ch-vu')
            if (fill) fill.style.height = pct + '%'
            if (vu) vu.classList.toggle('peak', ageSec < 30 && n > 0)
            const slotCfg = controlState?.slots?.[slot]
            const pollLabel = ch.querySelector('[data-poll-label="' + slot + '"]')
            if (pollLabel && controlState) {
              const custom = slotCfg?.pollIntervalSec
              const eff = custom != null ? custom : controlState.global.defaultPollIntervalSec
              pollLabel.textContent = (custom != null ? eff + 's*' : eff + 's')
            }
          })
        }
        function updateDeckSummary() {
          if (!controlState) return
          const g = controlState.global
          const slots = controlState.slots || {}
          let active = 0
          for (const s of Object.keys(slots)) {
            if (slots[s]?.enabled && slots[s]?.pushEnabled) active++
          }
          const fleetLed = document.getElementById('deckFleetLed')
          const meta = document.getElementById('deckMeta')
          const activeEl = document.getElementById('deckActiveCount')
          const fleetState = document.getElementById('deckFleetState')
          const sumPoll = document.getElementById('deckSummaryPoll')
          const sumStag = document.getElementById('deckSummaryStagger')
          if (fleetLed) fleetLed.classList.toggle('off', !g.fleetEnabled)
          if (meta) meta.textContent = 'rev ' + controlState.rev + ' · ' + formatAgo(controlState.updatedAt)
          if (activeEl) activeEl.textContent = String(active)
          if (fleetState) fleetState.textContent = g.fleetEnabled
            ? (g.remoteOrchestration ? 'ORCH' : 'MANUAL')
            : 'HALTED'
          if (sumPoll) sumPoll.textContent = fmtSec(g.defaultPollIntervalSec)
          if (sumStag) sumStag.textContent = fmtSec(g.vpsStaggerSec)
          document.querySelectorAll('.deck-channel').forEach(ch => {
            const slot = ch.dataset.slot
            const st = slots[slot]
            if (!st) return
            const on = g.fleetEnabled && st.enabled && st.pushEnabled
            ch.classList.toggle('disabled', !st.enabled || !g.fleetEnabled)
            ch.classList.toggle('active-push', !!on)
          })
        }
        function bindControlInputs() {
          const poll = document.getElementById('deckDefaultPoll')
          const pollVal = document.getElementById('deckPollVal')
          const stagger = document.getElementById('deckStagger')
          const staggerVal = document.getElementById('deckStaggerVal')
          const configPoll = document.getElementById('deckConfigPoll')
          const configPollVal = document.getElementById('deckConfigPollVal')
          const fleet = document.getElementById('deckFleetEnabled')
          const autoPoll = document.getElementById('deckAutoPoll')
          const lw = document.getElementById('deckLeagueWatcher')
          const replaceAll = document.getElementById('deckReplaceAll')
          const remoteOrch = document.getElementById('deckRemoteOrchestration')
          if (poll) poll.addEventListener('input', () => {
            if (pollVal) pollVal.textContent = fmtSec(poll.value)
            const epoch = bumpScheduleEpoch()
            if (controlState?.global) controlState.global.defaultPollIntervalSec = Number(poll.value)
            queueSave({ global: { defaultPollIntervalSec: Number(poll.value), scheduleEpoch: epoch } })
            updateCarRadioDisplay()
          })
          if (stagger) stagger.addEventListener('input', () => {
            if (staggerVal) staggerVal.textContent = fmtSec(stagger.value)
            const epoch = bumpScheduleEpoch()
            if (controlState?.global) controlState.global.vpsStaggerSec = Number(stagger.value)
            queueSave({ global: { vpsStaggerSec: Number(stagger.value), scheduleEpoch: epoch } })
            updateCarRadioDisplay()
          })
          if (configPoll) configPoll.addEventListener('input', () => {
            if (configPollVal) configPollVal.textContent = fmtSec(configPoll.value)
            queueSave({ global: { configPollSec: Number(configPoll.value) } })
          })
          if (fleet) fleet.addEventListener('change', () => {
            queueSave({ global: { fleetEnabled: fleet.checked } })
            updateCarRadioDisplay()
          })
          if (autoPoll) autoPoll.addEventListener('change', () => queueSave({ global: { autoPoll: autoPoll.checked } }))
          if (lw) lw.addEventListener('change', () => queueSave({ global: { leagueWatcherPush: lw.checked } }))
          if (replaceAll) replaceAll.addEventListener('change', () => queueSave({ global: { replaceAllOnIngest: replaceAll.checked } }))
          if (remoteOrch) remoteOrch.addEventListener('change', () => {
            const epoch = remoteOrch.checked ? bumpScheduleEpoch() : undefined
            if (controlState?.global) {
              controlState.global.remoteOrchestration = remoteOrch.checked
              if (epoch) controlState.global.scheduleEpoch = epoch
            }
            const patch = { global: { remoteOrchestration: remoteOrch.checked } }
            if (epoch) patch.global.scheduleEpoch = epoch
            queueSave(patch)
            updateCarRadioDisplay()
          })
          document.querySelectorAll('[data-ch-enabled]').forEach(inp => {
            inp.addEventListener('change', () => {
              const slot = inp.dataset.chEnabled
              queueSave({ slots: { [slot]: { enabled: inp.checked } } })
              updateCarRadioDisplay()
            })
          })
          document.querySelectorAll('[data-ch-push]').forEach(inp => {
            inp.addEventListener('change', () => {
              const slot = inp.dataset.chPush
              queueSave({ slots: { [slot]: { pushEnabled: inp.checked } } })
              updateCarRadioDisplay()
            })
          })
          document.querySelectorAll('[data-ch-note]').forEach(inp => {
            inp.addEventListener('change', () => {
              const slot = inp.dataset.chNote
              queueSave({ slots: { [slot]: { maintenanceNote: inp.value } } })
            })
          })
          document.querySelectorAll('[data-cmd]').forEach(btn => {
            btn.addEventListener('click', () => sendCommand(btn.dataset.slot, btn.dataset.cmd))
          })
          const fetchAll = document.getElementById('deckFetchAll')
          if (fetchAll) fetchAll.addEventListener('click', async () => {
            for (const slot of ${JSON.stringify(VPS_SLOTS)}) {
              await sendCommand(slot, 'fetchOnce')
            }
          })
          const resetBtn = document.getElementById('deckResetDefaults')
          if (resetBtn) resetBtn.addEventListener('click', async () => {
            if (!confirm('Reset all fleet control settings to defaults?')) return
            try {
              const res = await fetch('/api/vps-control/reset', { method: 'POST' })
              if (!res.ok) throw new Error('reset failed')
              applyControlState(await res.json(), true)
            } catch (e) { console.warn('[Control] reset error', e) }
          })
        }
        function applyControlState(state, fromSave) {
          if (!state || typeof state !== 'object') return
          if (!fromSave && state.rev <= controlRev) return
          controlRev = state.rev
          controlState = state
          const g = state.global || {}
          const poll = document.getElementById('deckDefaultPoll')
          const stagger = document.getElementById('deckStagger')
          const configPoll = document.getElementById('deckConfigPoll')
          const pollVal = document.getElementById('deckPollVal')
          const staggerVal = document.getElementById('deckStaggerVal')
          const configPollVal = document.getElementById('deckConfigPollVal')
          if (poll && !controlDirty) { poll.value = g.defaultPollIntervalSec; if (pollVal) pollVal.textContent = fmtSec(g.defaultPollIntervalSec) }
          if (stagger && !controlDirty) { stagger.value = g.vpsStaggerSec; if (staggerVal) staggerVal.textContent = fmtSec(g.vpsStaggerSec) }
          if (configPoll && !controlDirty) { configPoll.value = g.configPollSec; if (configPollVal) configPollVal.textContent = fmtSec(g.configPollSec) }
          const fleet = document.getElementById('deckFleetEnabled')
          const autoPoll = document.getElementById('deckAutoPoll')
          const lw = document.getElementById('deckLeagueWatcher')
          const replaceAll = document.getElementById('deckReplaceAll')
          const remoteOrch = document.getElementById('deckRemoteOrchestration')
          if (fleet && !controlDirty) fleet.checked = !!g.fleetEnabled
          if (autoPoll && !controlDirty) autoPoll.checked = !!g.autoPoll
          if (lw && !controlDirty) lw.checked = g.leagueWatcherPush !== false
          if (replaceAll && !controlDirty) replaceAll.checked = !!g.replaceAllOnIngest
          if (remoteOrch && !controlDirty) remoteOrch.checked = !!g.remoteOrchestration
          const slots = state.slots || {}
          for (const slot of Object.keys(slots)) {
            const st = slots[slot]
            const en = document.querySelector('[data-ch-enabled="' + slot + '"]')
            const push = document.querySelector('[data-ch-push="' + slot + '"]')
            const note = document.querySelector('[data-ch-note="' + slot + '"]')
            if (en && !controlDirty) en.checked = !!st.enabled
            if (push && !controlDirty) push.checked = !!st.pushEnabled
            if (note && !controlDirty) note.value = st.maintenanceNote || ''
          }
          applyControlToCards(slots)
          updateDeckSummary()
          updateCarRadioDisplay()
        }
        async function loadControlState() {
          try {
            const res = await fetch('/api/vps-control')
            if (!res.ok) return
            applyControlState(await res.json(), true)
          } catch (e) { console.warn('[Control] load error', e) }
        }
        ensureControlState()
        startRadioTick()
        try { bindControlInputs() } catch (e) { console.warn('[Control] bind inputs', e) }
        loadControlState()
  `
}

function vpsPageScript() {
  return `
        ${vpsControlDeckScript()}
        function heatLabelForLevel(level, cooldown) {
          if (cooldown) return { text: 'Cooldown', cls: 'cooldown' }
          if (level < 0.15) return { text: 'Cool', cls: 'cool' }
          if (level < 0.45) return { text: 'Warm', cls: 'warm' }
          if (level < 0.75) return { text: 'Hot', cls: 'hot' }
          return { text: 'Critical', cls: 'critical' }
        }
        function applyVpsHeat(el, level, cooldown) {
          if (!el) return
          const clamped = Math.max(0, Math.min(1, level))
          el.style.setProperty('--heat', String(clamped))
          el.classList.toggle('heat-cooldown', !!cooldown)
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
            slot.style.transform = 'translateY(8px)'
          })
          slots.forEach((slot, idx) => {
            setTimeout(() => slot.classList.add('deal-in'), idx * 60)
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
          if (msg.sources) {
            vpsSourcesCache = msg.sources
            updateVpsSlots(msg.sources)
            applyChannelVu(msg.sources)
          }
          if (msg.vpsControl) applyControlState(msg.vpsControl, false)
          else updateCarRadioDisplay()
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
    </div>
    <div class="section-title" style="margin-top: 1.5rem;">Fleet control <span class="lw-sub">DJ deck — remote scraper command & telemetry</span></div>
    ${buildVpsControlDeckHtml()}`
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
