/** @typedef {'channels'|'batches'|'proxies'|'live'|'leagues'|'json'|'settings'} PageId */

const NAV = [
  { id: 'channels', href: '/', label: 'Channels' },
  { id: 'batches', href: '/batches', label: 'Batches' },
  { id: 'proxies', href: '/proxies', label: 'Proxies' },
  { id: 'live', href: '/live', label: 'Live feed' },
  { id: 'leagues', href: '/league-watcher', label: 'League watcher' },
  { id: 'json', href: '/json', label: 'JSON' },
  { id: 'settings', href: '/settings', label: 'Settings' }
]

export function renderLoginHtml() {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>OddsLocker Engine</title>
<style>
body{font-family:system-ui;background:#0f0f12;color:#e4e4e7;display:flex;min-height:100vh;align-items:center;justify-content:center}
form{background:#18181c;border:1px solid #2a2a30;padding:1.5rem;border-radius:12px;width:min(20rem,90vw)}
input,button{width:100%;padding:.6rem;margin-top:.5rem;border-radius:8px;border:1px solid #3f3f46;background:#0f0f12;color:#fff}
button{background:#7c3aed;border:none;cursor:pointer;font-weight:600}
</style></head><body>
<form method="post" action="/login"><h1 style="margin:0 0 .75rem;font-size:1.1rem">OddsLocker Engine</h1>
<input type="password" name="password" placeholder="Password" autofocus>
<button type="submit">Enter</button></form></body></html>`
}

function styles() {
  return `
:root{--bg:#0f0f12;--surface:#18181c;--border:#2a2a30;--text:#e4e4e7;--muted:#71717a;--accent:#a78bfa;--green:#22c55e;--danger:#f87171}
*{box-sizing:border-box}html{scrollbar-gutter:stable}
body{margin:0;font-family:Outfit,system-ui,sans-serif;background:var(--bg);color:var(--text);line-height:1.45}
.wrap{max-width:88rem;margin:0 auto;padding:1.25rem 1.25rem 2rem}
.header{display:flex;align-items:center;gap:.75rem;margin-bottom:.75rem}
.header h1{margin:0;font-size:1.35rem;font-weight:600}
.nav{display:flex;flex-wrap:wrap;gap:.35rem;margin-bottom:1rem}
.nav a{padding:.35rem .75rem;border-radius:999px;border:1px solid var(--border);color:var(--muted);text-decoration:none;font-size:.8rem}
.nav a.active,.nav a:hover{color:var(--accent);border-color:rgba(167,139,250,.45);background:rgba(167,139,250,.1)}
.tagline{color:var(--muted);font-size:.9rem;margin:0 0 1rem}
.section-title{font-size:.82rem;color:var(--muted);margin:0 0 .65rem;font-weight:500}
.grid-channels{display:grid;grid-template-columns:repeat(auto-fill,minmax(7.5rem,1fr));gap:.45rem;margin-bottom:1rem}
.ch-card{background:linear-gradient(180deg,#1c1c24,#121218);border:1px solid rgba(167,139,250,.25);border-radius:8px;padding:.55rem;font-size:.7rem}
.ch-card.disabled{opacity:.4}.ch-card.running{border-color:#a78bfa;box-shadow:0 0 14px rgba(167,139,250,.2)}
.ch-card .n{font-family:JetBrains Mono,monospace;color:var(--accent);font-weight:600}
.ch-heat{height:4px;background:#27272a;border-radius:99px;margin:.35rem 0;overflow:hidden}
.ch-heat>i{display:block;height:100%;background:linear-gradient(90deg,#6d28d9,#a78bfa);width:0%}
.deck{border-radius:14px;padding:1px;background:linear-gradient(145deg,rgba(167,139,250,.4),rgba(124,58,237,.2));margin-bottom:1rem}
.deck-inner{background:#0e0e13;border-radius:13px;padding:1rem}
.deck-row{display:grid;grid-template-columns:1fr 1fr auto;gap:.75rem}
@media(max-width:900px){.deck-row{grid-template-columns:1fr}}
.panel{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:.75rem}
.panel label{display:block;font-size:.62rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:.25rem}
.fader-val{font-family:JetBrains Mono,monospace;font-size:.75rem;color:var(--accent)}
input[type=range]{width:100%}
.switch{display:inline-flex;align-items:center;gap:.4rem;font-size:.72rem;color:var(--muted);margin:.25rem .75rem .25rem 0;cursor:pointer}
.switch input{accent-color:var(--accent)}
.btn{font:inherit;font-size:.72rem;padding:.4rem .75rem;border-radius:6px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:var(--text);cursor:pointer}
.btn:hover{border-color:rgba(167,139,250,.5);color:#c4b5fd}
.btn.accent{border-color:rgba(167,139,250,.5);color:#e9d5ff}
.btn.danger{border-color:rgba(248,113,113,.4);color:#fecaca}
.summary{min-width:10rem;font-size:.7rem;color:var(--muted)}
.summary strong{color:var(--text);font-weight:500}
.table-wrap,.json-wrap{background:var(--surface);border:1px solid var(--border);border-radius:10px;max-height:70vh;overflow:auto}
table{width:100%;border-collapse:collapse;font-size:.78rem}
th,td{padding:.45rem .5rem;border-top:1px solid var(--border);text-align:left}
th{color:var(--muted);font-size:.68rem;text-transform:uppercase;position:sticky;top:0;background:var(--surface)}
.json-pre{margin:0;padding:1rem;font-family:JetBrains Mono,monospace;font-size:.7rem;white-space:pre-wrap}
.lw-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(11rem,1fr));gap:.65rem}
.lw-card{background:var(--surface);border:1px solid var(--border);border-radius:8px;overflow:hidden}
.lw-head{padding:.5rem .6rem;border-bottom:1px solid var(--border);font-size:.78rem;font-weight:600}
.lw-body{padding:.4rem .5rem;max-height:160px;overflow:auto;font-size:.68rem;color:var(--muted)}
.stat-row{display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:1rem}
.stat{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:.75rem 1rem;min-width:8rem}
.stat b{display:block;font-size:1.4rem;font-family:JetBrains Mono,monospace;color:var(--accent)}
.stat span{font-size:.7rem;color:var(--muted)}
textarea,input[type=text],input[type=number],select{width:100%;background:#0a0a0e;border:1px solid var(--border);border-radius:8px;color:var(--text);padding:.5rem;font:inherit;font-size:.8rem}
.batch-card{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:.85rem;margin-bottom:.65rem}
.book-pills{display:flex;flex-wrap:wrap;gap:.35rem;margin-top:.5rem}
.book-pills label{font-size:.68rem;border:1px solid var(--border);padding:.2rem .45rem;border-radius:999px;cursor:pointer}
.book-pills label.on{border-color:rgba(167,139,250,.55);background:rgba(167,139,250,.12);color:var(--accent)}
.proxy-list{font-family:JetBrains Mono,monospace;font-size:.68rem}
.proxy-list .row{display:flex;gap:.5rem;align-items:center;padding:.35rem 0;border-bottom:1px solid var(--border)}
.badge{font-size:.58rem;padding:.1rem .35rem;border-radius:4px;text-transform:uppercase}
.badge.available{background:rgba(34,197,94,.15);color:#86efac}
.badge.in_use{background:rgba(167,139,250,.15);color:#c4b5fd}
.badge.bad{background:rgba(248,113,113,.15);color:#fca5a5}
.foot{margin-top:1rem;font-size:.75rem;color:var(--muted)}
`
}

function shell(pageId, title, tagline, body) {
  const nav = NAV.map(
    (n) => `<a href="${n.href}" class="${n.id === pageId ? 'active' : ''}">${n.label}</a>`
  ).join('')
  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} · OddsLocker Engine</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Outfit:wght@400;500;600&display=swap" rel="stylesheet">
<style>${styles()}</style>
</head><body><div class="wrap">
<div class="header"><h1>OddsLocker Engine</h1></div>
<nav class="nav">${nav}</nav>
<p class="tagline">${tagline}</p>
${body}
<p class="foot">Standalone channel engine · legacy VPS/terminal hub not required · <a href="/health" style="color:var(--accent)">/health</a></p>
</div>
<script>
${clientScript(pageId)}
</script>
</body></html>`
}

export function renderPage(pageId) {
  if (pageId === 'channels') {
    return shell(
      'channels',
      'Channels',
      'Adaptive channels (coldest first) + fleet control. Each poll session runs one channel per batch in sync.',
      channelsHtml()
    )
  }
  if (pageId === 'batches') {
    return shell(
      'batches',
      'Batches',
      'Split sportsbooks across batches. Session channel count = number of non-empty batches.',
      batchesHtml()
    )
  }
  if (pageId === 'proxies') {
    return shell(
      'proxies',
      'Proxies',
      'Residential proxy pool. Channels acquire a sticky session per batch run and auto-rotate on failure.',
      proxiesHtml()
    )
  }
  if (pageId === 'live') {
    return shell('live', 'Live feed', 'Latest synced snapshot.', liveHtml())
  }
  if (pageId === 'leagues') {
    return shell('leagues', 'League watcher', 'Bovada-derived league activity when present in a session.', leaguesHtml())
  }
  if (pageId === 'json') {
    return shell('json', 'JSON', 'Raw snapshot payload.', jsonHtml())
  }
  return shell('settings', 'Settings', 'Engine cadence and delivery.', settingsHtml())
}

function channelsHtml() {
  return `
<div class="section-title">Channels</div>
<div class="grid-channels" id="chGrid"></div>
<div class="deck"><div class="deck-inner">
  <div class="section-title" style="color:#c4b5fd;letter-spacing:.12em;text-transform:uppercase;font-size:.7rem">Fleet Control Station</div>
  <div class="deck-row">
    <div class="panel">
      <label>Poll interval (ms)</label>
      <div class="fader-val" id="pollVal">5000</div>
      <input type="range" id="pollMs" min="1000" max="60000" step="500" value="5000">
      <div style="margin-top:.65rem">
        <label class="switch"><input type="checkbox" id="fleetEnabled" checked> Fleet live</label>
        <label class="switch"><input type="checkbox" id="autoPoll"> Auto poll</label>
        <label class="switch"><input type="checkbox" id="webhookEnabled" checked> Webhook</label>
      </div>
      <div style="margin-top:.65rem;display:flex;gap:.4rem;flex-wrap:wrap">
        <button type="button" class="btn accent" id="btnRun">Run session now</button>
        <button type="button" class="btn" id="btnSaveFleet">Save cadence</button>
      </div>
    </div>
    <div class="panel">
      <label>Channel count</label>
      <input type="number" id="chCount" min="1" max="50" value="10">
      <button type="button" class="btn" id="btnChCount" style="margin-top:.5rem">Apply channel count</button>
      <p style="font-size:.68rem;color:var(--muted);margin:.65rem 0 0">Need at least as many enabled channels as batches. Coldest channels are chosen each session.</p>
    </div>
    <div class="panel summary" id="fleetSummary">
      <div>Sessions: <strong id="sSessions">0</strong></div>
      <div>Last: <strong id="sLast">—</strong></div>
      <div>Entries: <strong id="sEntries">—</strong></div>
      <div>Proxies free: <strong id="sProxFree">—</strong></div>
    </div>
  </div>
</div></div>`
}

function batchesHtml() {
  return `
<div class="panel" style="margin-bottom:1rem">
  <label>Number of batches</label>
  <div style="display:flex;gap:.5rem;align-items:center;max-width:24rem">
    <input type="number" id="batchCount" min="1" max="20" value="1">
    <button type="button" class="btn" id="btnSplit">Even-split books</button>
  </div>
</div>
<div id="batchEditor"></div>
<button type="button" class="btn accent" id="btnSaveBatches">Save batches</button>
<p style="font-size:.72rem;color:var(--muted);margin-top:.75rem">Configured books come from engine/.env (or repo root .env). Unconfigured books stay in the checklist but are skipped at runtime.</p>`
}

function proxiesHtml() {
  return `
<div class="stat-row" id="proxyStats"></div>
<div class="panel" style="margin-bottom:1rem">
  <label>Add proxies (one per line — http://user:pass@host:port)</label>
  <textarea id="proxyText" rows="6" placeholder="http://user:pass@1.2.3.4:8000"></textarea>
  <div style="margin-top:.5rem;display:flex;gap:.4rem;flex-wrap:wrap">
    <button type="button" class="btn accent" id="btnAddProxies">Add to pool</button>
    <button type="button" class="btn" id="btnResetBad">Reset bad → available</button>
    <button type="button" class="btn danger" id="btnClearProxies">Clear all</button>
  </div>
</div>
<div class="section-title">Pool</div>
<div class="proxy-list" id="proxyList"></div>`
}

function liveHtml() {
  return `<div class="section-title">Live feed <span id="liveCount" style="color:var(--accent)"></span></div>
<div class="table-wrap"><table><thead><tr><th>Sport</th><th>League</th><th>Event</th><th>Book</th><th>Market</th><th>Outcome</th><th>Odds</th></tr></thead><tbody id="liveBody"></tbody></table></div>`
}

function leaguesHtml() {
  return `<div class="section-title">League watcher</div><div class="lw-grid" id="lwGrid"><div class="panel">Waiting for Bovada league snapshot…</div></div>`
}

function jsonHtml() {
  return `<div class="section-title">Snapshot JSON</div><div class="json-wrap"><pre class="json-pre" id="jsonPre">Waiting…</pre></div>`
}

function settingsHtml() {
  return `<div class="panel">
<p style="margin-top:0;font-size:.85rem;color:var(--muted)">Cadence is also on the Channels fleet deck. Webhook URL is set via <code>WEBHOOK_URL</code> in <code>odds-engine/.env</code>.</p>
<ul style="font-size:.8rem;color:var(--muted)">
<li>Start: <code>cd odds-engine && npm install && npm start</code></li>
<li>Open: <code>http://localhost:3100</code></li>
<li>Backup of legacy system: git tag <code>v-pre-channel-engine</code> / branch <code>backup/vps-terminal-era</code></li>
</ul>
</div>`
}

function clientScript(pageId) {
  return `
const PAGE=${JSON.stringify(pageId)};
let state=null;
async function api(path,opts){
  const res=await fetch(path,{headers:{'Content-Type':'application/json'},credentials:'same-origin',...opts});
  if(!res.ok) throw new Error(await res.text());
  return res.json();
}
function ago(ts){if(!ts)return '—';const s=Math.floor((Date.now()-ts)/1000);if(s<60)return s+'s ago';if(s<3600)return Math.floor(s/60)+'m ago';return Math.floor(s/3600)+'h ago'}
function renderChannels(){
  const grid=document.getElementById('chGrid'); if(!grid||!state) return;
  grid.innerHTML=state.channels.map(c=>{
    const heat=Math.round((c.heat||0)*100);
    return '<div class="ch-card '+(c.enabled?'':'disabled')+' '+(c.status==='running'?'running':'')+'" data-id="'+c.id+'">'+
      '<div class="n">CH '+c.n+'</div>'+
      '<div style="color:var(--muted)">'+(c.status||'idle')+'</div>'+
      '<div class="ch-heat"><i style="width:'+heat+'%"></i></div>'+
      '<div>heat '+heat+'%</div>'+
      '<div>'+ago(c.lastUsedAt)+'</div>'+
      '<label class="switch" style="margin-top:.35rem"><input type="checkbox" data-en="'+c.id+'" '+(c.enabled?'checked':'')+'> On</label>'+
      '</div>';
  }).join('');
  grid.querySelectorAll('[data-en]').forEach(inp=>{
    inp.onchange=async()=>{
      state=await api('/api/channels/'+inp.dataset.en,{method:'PUT',body:JSON.stringify({enabled:inp.checked})});
      renderChannels(); renderFleet();
    };
  });
}
function renderFleet(){
  if(!state) return;
  const f=state.fleet||{};
  const poll=document.getElementById('pollMs');
  const pollVal=document.getElementById('pollVal');
  if(poll&&document.activeElement!==poll){poll.value=f.pollIntervalMs||5000; if(pollVal) pollVal.textContent=String(poll.value)}
  const fe=document.getElementById('fleetEnabled'); if(fe) fe.checked=!!f.fleetEnabled;
  const ap=document.getElementById('autoPoll'); if(ap) ap.checked=!!f.autoPoll;
  const wh=document.getElementById('webhookEnabled'); if(wh) wh.checked=!!f.webhookEnabled;
  const cc=document.getElementById('chCount'); if(cc && document.activeElement!==cc) cc.value=state.channels.length;
  const sSessions=document.getElementById('sSessions'); if(sSessions) sSessions.textContent=String(state.stats?.sessions||0);
  const sLast=document.getElementById('sLast'); if(sLast) sLast.textContent=ago(state.stats?.lastSessionAt);
  const sEntries=document.getElementById('sEntries'); if(sEntries) sEntries.textContent=state.snapshot?String(state.snapshot.entryCount):'—';
  const sProx=document.getElementById('sProxFree'); if(sProx) sProx.textContent=String(state.proxyStats?.available??'—');
}
function renderBatches(){
  const ed=document.getElementById('batchEditor'); if(!ed||!state) return;
  const books=state.configuredBooks||[];
  const allIds=[...new Set([...(books.map(b=>b.id)), ...state.batches.flatMap(b=>b.books||[])])];
  const bc=document.getElementById('batchCount'); if(bc && document.activeElement!==bc) bc.value=state.batches.length;
  ed.innerHTML=state.batches.map((b,i)=>{
    const pills=allIds.map(id=>{
      const on=(b.books||[]).includes(id);
      const conf=books.find(x=>x.id===id);
      return '<label class="'+(on?'on':'')+'"><input type="checkbox" data-b="'+i+'" data-book="'+id+'" '+(on?'checked':'')+' hidden> '+id+(conf?'':'*')+'</label>';
    }).join('');
    return '<div class="batch-card" data-idx="'+i+'"><input type="text" data-name="'+i+'" value="'+String(b.name||'').replace(/"/g,'&quot;')+'"><div class="book-pills">'+pills+'</div></div>';
  }).join('');
  ed.querySelectorAll('.book-pills label').forEach(lab=>{
    lab.onclick=(e)=>{e.preventDefault();lab.classList.toggle('on');const inp=lab.querySelector('input');if(inp) inp.checked=lab.classList.contains('on');};
  });
}
function collectBatches(){
  const cards=[...document.querySelectorAll('.batch-card')];
  return cards.map((card,i)=>{
    const name=card.querySelector('[data-name]')?.value||('Batch '+(i+1));
    const books=[...card.querySelectorAll('input[data-book]:checked')].map(x=>x.dataset.book);
    // also from .on labels
    const fromOn=[...card.querySelectorAll('.book-pills label.on input')].map(x=>x.dataset.book);
    return {id:'batch'+(i+1), name, books: fromOn.length?fromOn:books};
  });
}
function renderProxies(){
  const stats=document.getElementById('proxyStats');
  const list=document.getElementById('proxyList');
  if(!state) return;
  const ps=state.proxyStats||{};
  if(stats){
    stats.innerHTML=['total','available','inUse','bad'].map(k=>{
      const label={total:'Total',available:'Available',inUse:'In use',bad:'Bad'}[k];
      return '<div class="stat"><b>'+(ps[k]??0)+'</b><span>'+label+'</span></div>';
    }).join('');
  }
  if(list){
    list.innerHTML=(state.proxies||[]).map(p=>
      '<div class="row"><span class="badge '+p.status+'">'+p.status+'</span><span style="flex:1">'+p.tip+'</span><span>fails '+(p.failCount||0)+'</span><button class="btn" data-del="'+p.id+'">Remove</button></div>'
    ).join('') || '<div style="color:var(--muted)">No proxies yet</div>';
    list.querySelectorAll('[data-del]').forEach(btn=>{
      btn.onclick=async()=>{state=await api('/api/proxies/'+btn.dataset.del,{method:'DELETE'});renderProxies();};
    });
  }
}
function renderLive(data){
  const body=document.getElementById('liveBody'); if(!body) return;
  const rows=Array.isArray(data)?data:[];
  const el=document.getElementById('liveCount'); if(el) el.textContent=rows.length+' rows';
  body.innerHTML=rows.slice(0,120).map(e=>{
    const ev=(e.away_team&&e.home_team)?(e.away_team+' @ '+e.home_team):(e.event_id||'');
    const odds=e.odds_american!=null?e.odds_american:(e.share_price??'');
    return '<tr><td>'+esc(e.sport)+'</td><td>'+esc(e.league)+'</td><td>'+esc(ev)+'</td><td>'+esc(e.sportsbook)+'</td><td>'+esc(e.market_type)+'</td><td>'+esc(e.outcome_name)+'</td><td>'+esc(odds)+'</td></tr>';
  }).join('');
}
function renderLeagues(lw){
  const g=document.getElementById('lwGrid'); if(!g) return;
  if(!lw||!Array.isArray(lw.sports)||!lw.sports.length){g.innerHTML='<div class="panel">Waiting for Bovada league snapshot…</div>';return;}
  g.innerHTML=lw.sports.map(sp=>{
    const rows=(sp.leagues||[]).map(lg=>'<div>'+(lg.active?'●':'○')+' '+esc(lg.name||lg.key)+'</div>').join('')||'<div>No leagues</div>';
    return '<div class="lw-card"><div class="lw-head">'+(sp.active?'●':'○')+' '+esc(sp.name||sp.key)+'</div><div class="lw-body">'+rows+'</div></div>';
  }).join('');
}
function esc(s){if(s==null)return '';return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
async function refresh(){
  state=await api('/api/state');
  if(PAGE==='channels'){renderChannels();renderFleet();}
  if(PAGE==='batches')renderBatches();
  if(PAGE==='proxies')renderProxies();
  if(PAGE==='live' || PAGE==='json' || PAGE==='leagues'){
    const snap=await api('/api/snapshot');
    if(PAGE==='live') renderLive(snap.data||[]);
    if(PAGE==='json'){
      const pre=document.getElementById('jsonPre');
      if(pre) pre.textContent=JSON.stringify(snap,null,2);
    }
    if(PAGE==='leagues') renderLeagues(state.leagueWatcher);
  }
}
function bind(){
  const poll=document.getElementById('pollMs');
  if(poll) poll.oninput=()=>{const v=document.getElementById('pollVal'); if(v) v.textContent=poll.value;};
  document.getElementById('btnSaveFleet')?.addEventListener('click', async()=>{
    state=await api('/api/fleet',{method:'PUT',body:JSON.stringify({
      pollIntervalMs:Number(document.getElementById('pollMs').value),
      fleetEnabled:document.getElementById('fleetEnabled').checked,
      autoPoll:document.getElementById('autoPoll').checked,
      webhookEnabled:document.getElementById('webhookEnabled').checked
    })});
    renderFleet();
  });
  document.getElementById('btnRun')?.addEventListener('click', async()=>{
    const r=await api('/api/session/run',{method:'POST',body:'{}'});
    state=r.state||await api('/api/state');
    renderChannels(); renderFleet();
    alert(r.ok?'Session complete':'Session: '+(r.reason||'failed'));
  });
  document.getElementById('btnChCount')?.addEventListener('click', async()=>{
    state=await api('/api/channels/count',{method:'PUT',body:JSON.stringify({count:Number(document.getElementById('chCount').value)})});
    renderChannels(); renderFleet();
  });
  document.getElementById('btnSplit')?.addEventListener('click', async()=>{
    state=await api('/api/batches',{method:'PUT',body:JSON.stringify({count:Number(document.getElementById('batchCount').value)})});
    renderBatches();
  });
  document.getElementById('btnSaveBatches')?.addEventListener('click', async()=>{
    state=await api('/api/batches',{method:'PUT',body:JSON.stringify({batches:collectBatches()})});
    renderBatches();
  });
  document.getElementById('btnAddProxies')?.addEventListener('click', async()=>{
    const text=document.getElementById('proxyText').value;
    state=await api('/api/proxies',{method:'POST',body:JSON.stringify({text})});
    document.getElementById('proxyText').value='';
    renderProxies();
  });
  document.getElementById('btnResetBad')?.addEventListener('click', async()=>{
    state=await api('/api/proxies/reset-bad',{method:'POST',body:'{}'}); renderProxies();
  });
  document.getElementById('btnClearProxies')?.addEventListener('click', async()=>{
    if(!confirm('Clear entire proxy pool?')) return;
    state=await api('/api/proxies/clear',{method:'POST',body:'{}'}); renderProxies();
  });
}
function connectWs(){
  const proto=location.protocol==='https:'?'wss://':'ws://';
  const ws=new WebSocket(proto+location.host+'/ws');
  ws.onmessage=(ev)=>{
    let msg; try{msg=JSON.parse(ev.data)}catch(_){return}
    if(msg.type!=='odds') return;
    if(msg.engine){state={...state,...msg.engine,configuredBooks:state?.configuredBooks};}
    if(PAGE==='channels'){renderChannels();renderFleet();}
    if(PAGE==='proxies')renderProxies();
    if(PAGE==='live')renderLive(msg.data);
    if(PAGE==='leagues')renderLeagues(msg.leagueWatcher);
    if(PAGE==='json'){
      const pre=document.getElementById('jsonPre');
      if(pre) pre.textContent=JSON.stringify({ts:msg.ts,entryCount:(msg.data||[]).length,data:msg.data,leagueWatcher:msg.leagueWatcher,engine:msg.engine},null,2);
    }
  };
}
bind();
refresh().then(()=>{
  if(PAGE==='live'&&state?.snapshot) {/* wait for ws */}
  connectWs();
}).catch(e=>console.warn(e));
`
}
