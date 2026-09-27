/** @typedef {'session'|'batches'|'proxies'|'live'|'leagues'|'json'|'settings'} PageId */

const NAV = [
  { id: 'session', href: '/', label: 'Session' },
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
textarea,input[type=text],input[type=number],select{width:100%;background:#0a0a0e;border:1px solid var(--border);border-radius:8px;color:#e4e4e7;caret-color:#e4e4e7;padding:.5rem;font-family:JetBrains Mono,ui-monospace,monospace;font-size:.8rem;-webkit-user-select:text;user-select:text;-webkit-app-region:no-drag;pointer-events:auto}
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
<p class="foot">OddsLocker Engine · <a href="/health" style="color:var(--accent)">/health</a></p>
</div>
<script>
${clientScript(pageId)}
</script>
</body></html>`
}

export function renderPage(pageId) {
  if (pageId === 'session') {
    return shell(
      'session',
      'Session',
      'One fetch across every batch. Local network or the proxy pool — no channel fleet.',
      sessionHtml()
    )
  }
  if (pageId === 'batches') {
    return shell(
      'batches',
      'Batches',
      'Books in a batch are fetched together. In proxy mode, each request takes its own proxy.',
      batchesHtml()
    )
  }
  if (pageId === 'proxies') {
    return shell(
      'proxies',
      'Proxies',
      'Used when Settings is set to Proxy pool. Each request checks out its own proxy and releases it when that request finishes.',
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
  return shell('settings', 'Settings', 'Choose how requests leave this machine, then fetch once to test.', settingsHtml())
}

function sessionHtml() {
  return `
<div class="deck"><div class="deck-inner">
  <div class="deck-row">
    <div class="panel">
      <label>Request route</label>
      <div id="modeLabel" style="font-size:1.05rem;margin:.35rem 0 .85rem">—</div>
      <button type="button" class="btn accent" id="btnFetchOnce">Fetch odds once</button>
      <p style="font-size:.72rem;color:var(--muted);margin:.65rem 0 0">Runs every batch one time. Switch local network vs proxy pool in Settings.</p>
    </div>
    <div class="panel summary">
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
  <label for="proxyText">Add proxies (one per line)</label>
  <textarea id="proxyText" rows="6" spellcheck="false" autocomplete="off" placeholder="http://user:pass@1.2.3.4:8000&#10;1.2.3.4:8000:user:pass"></textarea>
  <p id="proxyMsg" style="font-size:.75rem;color:var(--muted);min-height:1.1rem;margin:.4rem 0 0"></p>
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
  return `<div style="display:flex;justify-content:space-between;align-items:center;gap:.75rem;margin-bottom:.65rem">
  <div class="section-title" style="margin:0">Live feed <span id="liveCount" style="color:var(--accent)"></span></div>
  <button type="button" class="btn accent" id="btnFetchOnce">Fetch odds once</button>
</div>
<div class="table-wrap"><table><thead><tr><th>Sport</th><th>League</th><th>Event</th><th>Book</th><th>Market</th><th>Outcome</th><th>Odds</th></tr></thead><tbody id="liveBody"></tbody></table></div>`
}

function leaguesHtml() {
  return `<div class="section-title">League watcher</div><div class="lw-grid" id="lwGrid"><div class="panel">Waiting for Bovada league snapshot…</div></div>`
}

function jsonHtml() {
  return `<div class="section-title">Snapshot JSON</div><div class="json-wrap"><pre class="json-pre" id="jsonPre">Waiting…</pre></div>`
}

function settingsHtml() {
  return `<div class="panel" style="margin-bottom:1rem">
  <label>Request route</label>
  <div style="margin:.45rem 0 .25rem">
    <label class="switch"><input type="radio" name="fetchMode" value="local"> Local network</label>
    <label class="switch"><input type="radio" name="fetchMode" value="proxy"> Proxy pool</label>
  </div>
  <p style="font-size:.78rem;color:var(--muted);margin:0">Local network sends every request from this machine. Proxy pool gives each request its own proxy. Channels are not part of either route.</p>
</div>
<div class="panel" style="margin-bottom:1rem">
  <label>Poll interval (ms)</label>
  <div class="fader-val" id="pollVal">5000</div>
  <input type="range" id="pollMs" min="1000" max="60000" step="500" value="5000">
  <div style="margin-top:.65rem">
    <label class="switch"><input type="checkbox" id="fleetEnabled" checked> Engine live</label>
    <label class="switch"><input type="checkbox" id="autoPoll"> Auto poll</label>
    <label class="switch"><input type="checkbox" id="webhookEnabled" checked> Webhook</label>
  </div>
  <div style="margin-top:.75rem;display:flex;gap:.4rem;flex-wrap:wrap">
    <button type="button" class="btn" id="btnSaveSettings">Save settings</button>
    <button type="button" class="btn accent" id="btnFetchOnce">Fetch odds once</button>
  </div>
</div>
<p style="font-size:.78rem;color:var(--muted)">Webhook URL is <code>WEBHOOK_URL</code> in <code>.env</code>. Auto poll only runs while Engine live is on.</p>`
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
function routeLabel(mode){return mode==='proxy'?'Proxy pool':'Local network'}
function renderSession(){
  if(!state) return;
  const f=state.fleet||{};
  const mode=document.getElementById('modeLabel');
  if(mode) mode.textContent=routeLabel(f.fetchMode);
  const sSessions=document.getElementById('sSessions'); if(sSessions) sSessions.textContent=String(state.stats?.sessions||0);
  const sLast=document.getElementById('sLast'); if(sLast) sLast.textContent=ago(state.stats?.lastSessionAt);
  const sEntries=document.getElementById('sEntries'); if(sEntries) sEntries.textContent=state.snapshot?String(state.snapshot.entryCount):'—';
  const sProx=document.getElementById('sProxFree'); if(sProx) sProx.textContent=String(state.proxyStats?.available??'—');
}
function renderSettings(){
  if(!state) return;
  const f=state.fleet||{};
  const mode=f.fetchMode==='proxy'?'proxy':'local';
  document.querySelectorAll('input[name=fetchMode]').forEach(el=>{el.checked=el.value===mode});
  const poll=document.getElementById('pollMs');
  const pollVal=document.getElementById('pollVal');
  if(poll&&document.activeElement!==poll){poll.value=f.pollIntervalMs||5000; if(pollVal) pollVal.textContent=String(poll.value)}
  const fe=document.getElementById('fleetEnabled'); if(fe) fe.checked=!!f.fleetEnabled;
  const ap=document.getElementById('autoPoll'); if(ap) ap.checked=!!f.autoPoll;
  const wh=document.getElementById('webhookEnabled'); if(wh) wh.checked=!!f.webhookEnabled;
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
function showJson(pre, payload){
  if(!pre||!payload) return;
  const n=Array.isArray(payload.data)?payload.data.length:(payload.entryCount||0);
  pre.textContent=n+' odds';
  setTimeout(()=>{ pre.textContent=JSON.stringify(payload,null,2); }, 0);
}
async function refresh(){
  state=await api('/api/state');
  if(PAGE==='session') renderSession();
  if(PAGE==='settings') renderSettings();
  if(PAGE==='batches')renderBatches();
  if(PAGE==='proxies')renderProxies();
  if(PAGE==='live' || PAGE==='json' || PAGE==='leagues'){
    const snap=await api('/api/snapshot');
    if(PAGE==='live') renderLive(snap.data||[]);
    if(PAGE==='json') showJson(document.getElementById('jsonPre'), snap);
    if(PAGE==='leagues') renderLeagues(state.leagueWatcher);
  }
}
function bind(){
  const poll=document.getElementById('pollMs');
  if(poll) poll.oninput=()=>{const v=document.getElementById('pollVal'); if(v) v.textContent=poll.value;};
  document.getElementById('btnSaveSettings')?.addEventListener('click', async()=>{
    state=await saveSettingsFromForm();
    renderSettings();
  });
  document.getElementById('btnFetchOnce')?.addEventListener('click', ()=>fetchOnce());
  document.getElementById('btnSplit')?.addEventListener('click', async()=>{
    state=await api('/api/batches',{method:'PUT',body:JSON.stringify({count:Number(document.getElementById('batchCount').value)})});
    renderBatches();
  });
  document.getElementById('btnSaveBatches')?.addEventListener('click', async()=>{
    state=await api('/api/batches',{method:'PUT',body:JSON.stringify({batches:collectBatches()})});
    renderBatches();
  });
  document.getElementById('btnAddProxies')?.addEventListener('click', async()=>{
    const box=document.getElementById('proxyText');
    const msg=document.getElementById('proxyMsg');
    const text=box?box.value:'';
    const r=await api('/api/proxies',{method:'POST',body:JSON.stringify({text})});
    state=r;
    const added=Number(r.added)||0;
    const rejected=Array.isArray(r.rejected)?r.rejected:[];
    if(box){
      if(added>0 && rejected.length===0) box.value='';
      else if(rejected.length) box.value=rejected.join('\\n');
    }
    if(msg){
      if(!text.trim()) msg.textContent='Type or paste at least one proxy.';
      else if(rejected.length) msg.textContent='Could not read ' + rejected.length + ' line' + (rejected.length===1?'':'s') + '. Those lines were left in the box.';
      else if(!added) msg.textContent='Already in the pool.';
      else msg.textContent='Added ' + added + '.';
    }
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
async function saveSettingsFromForm(){
  const modeEl=document.querySelector('input[name=fetchMode]:checked');
  const body={};
  if(modeEl) body.fetchMode=modeEl.value;
  const poll=document.getElementById('pollMs');
  if(poll) body.pollIntervalMs=Number(poll.value);
  const fe=document.getElementById('fleetEnabled');
  if(fe) body.fleetEnabled=fe.checked;
  const ap=document.getElementById('autoPoll');
  if(ap) body.autoPoll=ap.checked;
  const wh=document.getElementById('webhookEnabled');
  if(wh) body.webhookEnabled=wh.checked;
  state=await api('/api/fleet',{method:'PUT',body:JSON.stringify(body)});
  return state;
}
async function fetchOnce(){
  const btn=document.getElementById('btnFetchOnce');
  if(btn){btn.disabled=true; btn.textContent='Fetching…';}
  try{
    if(document.querySelector('input[name=fetchMode]')) await saveSettingsFromForm();
    const r=await api('/api/session/run',{method:'POST',body:'{}'});
    state=r.state||await api('/api/state');
    renderSession();
    renderSettings();
    if(PAGE==='live' && r.snapshot && Array.isArray(r.snapshot.data)) renderLive(r.snapshot.data);
    const n=(r.snapshot&&r.snapshot.entryCount!=null)?r.snapshot.entryCount:((r.snapshot&&r.snapshot.data)?r.snapshot.data.length:(state.snapshot?state.snapshot.entryCount:0));
    const ms=r.snapshot&&r.snapshot.durationMs;
    const errs=((r.snapshot&&r.snapshot.errors)||[]).slice(0,4).map(e=>(e.book||'*')+': '+e.error);
    if(!r.ok){
      let extra='';
      if(r.reason==='not_enough_proxies') extra=' — need at least one available proxy, have '+r.have;
      else if(r.need!=null) extra=' (need '+r.need+', have '+r.have+')';
      alert('Fetch: '+(r.reason||'failed')+extra);
    }else{
      alert('Fetched '+n+' odds'+(ms!=null?' in '+(ms/1000).toFixed(1)+'s':'')+(errs.length?'\\n'+errs.join('\\n'):''));
    }
  }catch(e){
    alert('Fetch failed: '+e.message);
  }finally{
    if(btn){btn.disabled=false; btn.textContent='Fetch odds once';}
  }
}
function connectWs(){
  const proto=location.protocol==='https:'?'wss://':'ws://';
  const ws=new WebSocket(proto+location.host+'/ws');
  ws.onmessage=(ev)=>{
    let msg; try{msg=JSON.parse(ev.data)}catch(_){return}
    if(msg.type==='state'){
      if(msg.engine){state={...state,...msg.engine,configuredBooks:state?.configuredBooks};}
      if(PAGE==='session') renderSession();
      if(PAGE==='settings') renderSettings();
      if(PAGE==='proxies')renderProxies();
      return;
    }
    if(msg.type!=='odds') return;
    if(msg.engine){state={...state,...msg.engine,configuredBooks:state?.configuredBooks};}
    if(PAGE==='session') renderSession();
    if(PAGE==='settings') renderSettings();
    if(PAGE==='proxies')renderProxies();
    if(PAGE==='live')renderLive(msg.data);
    if(PAGE==='leagues')renderLeagues(msg.leagueWatcher);
    if(PAGE==='json'){
      showJson(document.getElementById('jsonPre'), {ts:msg.ts,entryCount:(msg.data||[]).length,durationMs:msg.engine&&msg.engine.snapshot?msg.engine.snapshot.durationMs:null,data:msg.data,leagueWatcher:msg.leagueWatcher,engine:msg.engine});
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
