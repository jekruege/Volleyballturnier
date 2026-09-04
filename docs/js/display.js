// Große Anzeige für iPad/Beamer: schaltet automatisch zwischen Spielplan und Tabellen durch.
// Parameter: ?s=12 (Sekunden je Seite), ?plan=4 (Zeitfenster im Spielplan)
import * as T from '../engine/tournament.js';
import { api } from './api.js';
import { esc, breakRows, koBracket, advancementTable, roundOutlook } from './render.js';

const app = document.getElementById('app');
const params = new URLSearchParams(location.search);
const SECONDS = Math.max(4, Number(params.get('s')) || 12);
const PLAN_ROWS = Math.max(2, Number(params.get('plan')) || 4);

let view = null;
let screens = [];
let index = 0;
let paused = false;
let startedAt = Date.now();
let tickTimer = null;

async function load() {
  try {
    const { state } = await api.getState();
    if (!state) { view = null; screens = []; render(); return; }
    T.refresh(state);
    view = T.buildView(state);
    buildScreens();
    render();
  } catch (e) {
    app.innerHTML = `<p class="d-empty">Verbindung fehlgeschlagen (${esc(e.message)}). Neuer Versuch …</p>`;
  }
}

function nowMinutes() { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); }
function toMin(t) { const [a, b] = t.split(':').map(Number); return a * 60 + b; }
function clock() { return new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }); }

// ---------------------------------------------------------------- Seiten
function buildScreens() {
  screens = [];
  screens.push({ title: 'Spielplan', render: renderPlan });
  for (const g of view.groups) screens.push({ title: g.name, render: () => renderTable(g.table, g.games) });
  screens.push({ title: 'Weiterkommen aus den Gruppen', render: () => `<div class="d-advance" style="--cols:${view.groups.length}">${advancementTable(view)}</div>` });
  if (view.phase >= 2) {
    for (const r of view.rounds) {
      if (r.table) screens.push({ title: r.name, render: () => renderTable(r.table, r.games) + `<div class="d-outlook">${roundOutlook(r)}</div>` });
      else screens.push({ title: r.name, render: () => renderKo(r) });
    }
  }
  if (view.phase >= 3) screens.push({ title: 'Finale & Endplatzierung', render: renderRanking });
  if (index >= screens.length) index = 0;
}

function renderPlan() {
  const fields = view.tournament.fields;
  const n = nowMinutes();
  let start = view.slots.findIndex((s) => s.games[0] && toMin(s.games[0].end) > n);
  if (start < 0) start = Math.max(0, view.slots.length - PLAN_ROWS);
  const slots = view.slots.slice(start, start + PLAN_ROWS);
  const rows = slots.map((s) => {
    const g0 = s.games[0];
    const isNow = g0 && n >= toMin(g0.start) && n < toMin(g0.end);
    const cells = fields.map((f) => {
      const g = s.games.find((x) => x.field === f.number);
      if (!g) return '<td></td>';
      const r = g.result;
      const sets = g.sets || [];
      const sc = (i) => sets.map((x) => x[i]).join(' | ');
      return `<td><div class="g-title">${esc(g.title)}</div>
        <div class="g-team ${r && r.winner === 1 ? 'win' : ''} ${g.team1Known ? '' : 'unknown'}"><span>${esc(g.team1)}</span><span class="sc">${r ? sc(0) : ''}</span></div>
        <div class="g-team ${r && r.winner === 2 ? 'win' : ''} ${g.team2Known ? '' : 'unknown'}"><span>${esc(g.team2)}</span><span class="sc">${r ? sc(1) : ''}</span></div>
        <div class="g-ref">Schiri: ${esc(g.referee || '–')}</div></td>`;
    }).join('');
    return `<tr class="${isNow ? 'now' : ''}"><td class="time">${esc(s.time)}</td>${cells}</tr>${breakRows(s, fields.length).replace(/<th>/g, '<td class="time">').replace(/<\/th>/g, '</td>')}`;
  }).join('');
  return `<table class="d-plan"><thead><tr><th>Zeit</th>${fields.map((f) => `<th>${esc(f.name)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`;
}

function renderTable(rows, games, compact = false) {
  if (!rows.length) return '<p class="d-empty">Teams stehen noch nicht fest.</p>';
  const head = `<tr><th class="pos">#</th><th class="left">Team</th><th>Sp</th><th>S</th>${compact ? '' : '<th>U</th><th>N</th>'}<th>Sätze</th><th>Diff</th><th>Punkte</th><th>Diff</th></tr>`;
  const body = rows.map((r) => `<tr>
    <td class="pos">${r.place}</td><td class="left team">${esc(r.teamName)}${r.tie ? ' ⚖' : ''}</td>
    <td class="num">${r.played}</td><td class="num">${r.wins}</td>${compact ? '' : `<td class="num">${r.draws}</td><td class="num">${r.losses}</td>`}
    <td class="num">${r.setsFor}:${r.setsAgainst}</td><td class="num">${r.setDiff > 0 ? '+' : ''}${r.setDiff}</td>
    <td class="num">${r.pointsFor}:${r.pointsAgainst}</td><td class="num">${r.pointDiff > 0 ? '+' : ''}${r.pointDiff}</td></tr>`).join('');
  const done = games ? games.filter((g) => g.status === 'done').length : 0;
  const total = games ? games.length : 0;
  return `<table class="d-table"><thead>${head}</thead><tbody>${body}</tbody></table>${games ? `<p class="d-foot" style="justify-content:flex-start">${done} von ${total} Spielen gespielt</p>` : ''}`;
}

function renderKo(r) {
  return `<div class="d-bracket">${koBracket(view, r)}</div>`;
}

function renderRanking() {
  const finals = view.finals.map((g) => `<tr><td class="left">${esc(g.title)}</td><td class="left team">${esc(g.team1)}</td><td class="num">${esc(g.setsText || '–')}</td><td class="left team">${esc(g.team2)}</td></tr>`).join('');
  const rank = view.ranking.map((r) => `<div><span class="pos">${r.place}.</span><span>${esc(r.teamName || '–')}</span><span class="src">${esc(r.source)}</span></div>`).join('');
  return `<table class="d-table" style="margin-bottom:0.8em"><tbody>${finals}</tbody></table><div class="d-rank">${rank}</div>`;
}

// ---------------------------------------------------------------- Ablauf
function render() {
  if (!view) { app.innerHTML = '<p class="d-empty">Noch kein Turnier angelegt.</p>'; return; }
  const s = screens[index];
  const p = view.progress;
  app.innerHTML = `<div class="d-head"><h1>${esc(s.title)}</h1><div class="clock">${clock()}</div></div>
    <div class="d-body">${s.render()}</div>
    <div class="d-foot ${paused ? 'paused' : ''}"><span>${esc(view.tournament.name)} · Gruppenphase ${p[0].done}/${p[0].total} · 2. Phase ${p[1].done}/${p[1].total}</span>
    <div class="bar"><div id="bar"></div></div><span>${index + 1}/${screens.length}${paused ? ' · Pause' : ''}</span>
    <button class="btn" id="fs">Vollbild</button></div>`;
  document.getElementById('fs').addEventListener('click', (e) => { e.stopPropagation(); fullscreen(); });
}

function next(step = 1) {
  if (!screens.length) return;
  index = (index + step + screens.length) % screens.length;
  startedAt = Date.now();
  render();
}

function tick() {
  const bar = document.getElementById('bar');
  const elapsed = (Date.now() - startedAt) / 1000;
  if (bar) bar.style.width = `${Math.min(100, (elapsed / SECONDS) * 100)}%`;
  if (!paused && elapsed >= SECONDS) next(1);
  const clk = document.querySelector('.d-head .clock');
  if (clk) clk.textContent = clock();
}

function fullscreen() {
  const el = document.documentElement;
  const fn = el.requestFullscreen || el.webkitRequestFullscreen;
  if (fn) fn.call(el).catch(() => {});
  else showHint('Vollbild: Auf dem iPad die Seite über „Teilen → Zum Home-Bildschirm“ hinzufügen und von dort starten.');
}

let hintTimer = null;
function showHint(text) {
  let h = document.getElementById('hint');
  if (!h) { h = document.createElement('div'); h.id = 'hint'; h.className = 'd-hint'; document.body.appendChild(h); }
  h.textContent = text;
  clearTimeout(hintTimer); hintTimer = setTimeout(() => h.remove(), 5000);
}

// Tippen: rechts = weiter, links = zurück, Mitte = Pause
app.addEventListener('click', (e) => {
  if (e.target.closest('button')) return;
  const x = e.clientX / window.innerWidth;
  if (x > 0.66) next(1);
  else if (x < 0.33) next(-1);
  else { paused = !paused; startedAt = Date.now(); render(); showHint(paused ? 'Pause – zum Fortsetzen erneut in die Mitte tippen' : 'Weiter'); }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight' || e.key === ' ') next(1);
  else if (e.key === 'ArrowLeft') next(-1);
  else if (e.key === 'p') { paused = !paused; render(); }
  else if (e.key === 'f') fullscreen();
});

// Bildschirm wach halten (wo unterstützt)
async function keepAwake() {
  try { if (navigator.wakeLock) await navigator.wakeLock.request('screen'); } catch { /* nicht unterstützt */ }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') keepAwake(); });
keepAwake();

load();
setInterval(load, 20000);
tickTimer = setInterval(tick, 250);
