// Öffentliche Live-Ansicht: Spielplan, Tabellen, Endplatzierung. Aktualisiert sich automatisch.
import * as T from '../engine/tournament.js';
import { api } from './api.js';
import { esc, gameCard, standingsTable, setTitle } from './render.js';

const app = document.getElementById('app');
let view = null;
let tab = localStorage.getItem('vt.tab') || 'plan';
let fieldFilter = localStorage.getItem('vt.field') || 'all';
let teamFilter = '';

async function load() {
  try {
    const { state } = await api.getState();
    if (!state) { view = null; render(); return; }
    T.refresh(state);
    view = T.buildView(state);
    render();
  } catch (e) {
    app.innerHTML = `<p class="error">Verbindung zur Datenbank fehlgeschlagen (${esc(e.message)}). Neuer Versuch in 20 Sekunden …</p>`;
  }
}

function nowMinutes() { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); }
function toMin(t) { const [a, b] = t.split(':').map(Number); return a * 60 + b; }
function isNow(slot) {
  const g = slot.games[0]; if (!g) return false;
  const n = nowMinutes();
  return n >= toMin(g.start) && n < toMin(g.end);
}

function renderPlan() {
  const fields = view.tournament.fields;
  const teams = view.teams.slice().sort((a, b) => a.name.localeCompare(b.name, 'de'));
  let html = `<div class="filters">
    <label>Feld <select id="fieldFilter"><option value="all">alle Felder</option>${fields.map((f) => `<option value="${f.number}" ${String(fieldFilter) === String(f.number) ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}</select></label>
    <label>Team <select id="teamFilter"><option value="">alle Teams</option>${teams.map((t) => `<option value="${t.id}" ${teamFilter === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>
  </div>`;
  for (const s of view.slots) {
    let games = s.games;
    if (fieldFilter !== 'all') games = games.filter((g) => String(g.field) === String(fieldFilter));
    if (teamFilter) games = games.filter((g) => g.team1Id === teamFilter || g.team2Id === teamFilter || g.refereeId === teamFilter);
    if (!games.length) continue;
    html += `<div class="slot ${isNow(s) ? 'now' : ''}"><div class="slothead">${esc(s.time)}</div><div class="slotgames">${games.map((g) => gameCard(view, g)).join('')}</div></div>`;
  }
  html += '<p class="legend">Farbcode: Gruppen (blau/rosa/grün), Gold (gelb), Silber (grau), Bronze (braun), Finale (grün).</p>';
  return html;
}

function renderTables() {
  let html = '<div class="grid2">';
  for (const g of view.groups) html += `<section><h2>${esc(g.name)}</h2>${standingsTable(g.table)}</section>`;
  html += '</div><h2>2. Phase</h2>';
  if (view.phase < 2) html += '<p class="muted">Die Einteilung der Gold-, Silber- und Bronze-Runden steht nach Abschluss der 1. Gruppenphase fest.</p>';
  html += '<div class="grid2">';
  for (const r of view.rounds) {
    html += `<section><h3>${esc(r.name)}</h3>`;
    if (r.table) html += r.table.length ? standingsTable(r.table) : `<p class="muted">${r.seeds.map((s) => esc(s.label)).join(', ')}</p>`;
    else html += `<ul class="plain">${r.games.map((g) => `<li>${esc(g.sublabel)}: ${esc(g.team1)} – ${esc(g.team2)} ${g.setsText ? `<strong>${esc(g.setsText)}</strong>` : ''}</li>`).join('')}</ul>`;
    html += '</section>';
  }
  html += '</div><p class="legend">Sortierung: Siege → Satzdifferenz → Punktdifferenz → direkter Vergleich. ⚖ = Gleichstand, Entscheidung durch die Turnierleitung.</p>';
  return html;
}

function renderRanking() {
  const finals = view.finals.map((g) => gameCard(view, g)).join('');
  const known = view.ranking.filter((r) => r.teamId).length;
  return `<h2>Finalspiele</h2><div class="slotgames">${finals}</div>
    <h2>Endplatzierung</h2>
    ${known === 0 ? '<p class="muted">Die Endplatzierung ergibt sich aus den Finalspielen und den Runden der 2. Phase.</p>' : ''}
    <div class="ranking"><ol>${view.ranking.map((r) => `<li><strong>${esc(r.teamName || '–')}</strong> <span class="src">${esc(r.source)}</span></li>`).join('')}</ol></div>`;
}

function renderTeams() {
  return `<div class="tablewrap"><table class="standings"><thead><tr><th class="left">Team</th><th class="left">Verein</th><th>Gruppe</th><th>Schiri-Einsätze</th></tr></thead><tbody>
    ${view.teams.map((t) => `<tr><td class="left">${esc(t.name)}</td><td class="left">${esc(t.club || '')}</td><td>${esc(t.group)}</td><td>${t.refereeCount}</td></tr>`).join('')}</tbody></table></div>`;
}

function render() {
  if (!view) {
    setTitle(null);
    app.innerHTML = '<div class="card"><h1>Noch kein Turnier angelegt</h1><p>Die Turnierleitung legt das Turnier im <a href="admin.html">Admin-Bereich</a> an.</p></div>';
    return;
  }
  setTitle(view);
  const p = view.progress;
  const tabs = [['plan', 'Spielplan'], ['tables', 'Tabellen'], ['ranking', 'Finale & Platzierung'], ['teams', 'Teams']];
  let html = `<div class="tabs">${tabs.map(([id, label]) => `<button data-tab="${id}" class="${tab === id ? 'active' : ''}">${label}</button>`).join('')}</div>
    <div class="progress"><span>1. Gruppenphase: ${p[0].done}/${p[0].total}</span><span>2. Phase: ${p[1].done}/${p[1].total}</span><span>Finale: ${p[2].done}/${p[2].total}</span><span>Stand: ${new Date().toLocaleTimeString('de-DE')}</span></div>`;
  if (tab === 'plan') html += renderPlan();
  else if (tab === 'tables') html += renderTables();
  else if (tab === 'ranking') html += renderRanking();
  else html += renderTeams();
  app.innerHTML = html;
  app.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; localStorage.setItem('vt.tab', tab); render(); }));
  const ff = document.getElementById('fieldFilter');
  if (ff) ff.addEventListener('change', () => { fieldFilter = ff.value; localStorage.setItem('vt.field', fieldFilter); render(); });
  const tf = document.getElementById('teamFilter');
  if (tf) tf.addEventListener('change', () => { teamFilter = tf.value; render(); });
}

load();
setInterval(load, 20000);
