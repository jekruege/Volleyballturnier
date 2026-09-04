// Admin-Bereich: PIN, Turnier anlegen, Ergebnisse korrigieren, Phasen abschließen, Druck, Sicherung.
import * as T from '../engine/tournament.js';
import { listFormats } from '../engine/formats/index.js';
import { validateSets } from '../engine/results.js';
import { api, adminMutate, usingSupabase } from './api.js';
import { esc } from './render.js';

const app = document.getElementById('app');
const toastEl = document.getElementById('toast');
let pin = sessionStorage.getItem('vt.pin') || '';
let state = null; let view = null;
const formats = listFormats();
let section = sessionStorage.getItem('vt.admin.section') || 'status';
const gameFilter = { phase: 'all', field: 'all', open: false };
let placementDraft = null;

function toast(msg, err) {
  toastEl.textContent = msg; toastEl.className = `toast show${err ? ' err' : ''}`;
  setTimeout(() => { toastEl.className = 'toast'; }, err ? 5000 : 2500);
}

function setView(s) {
  state = s;
  if (s) { T.refresh(s); view = T.buildView(s); } else view = null;
}

async function refresh() {
  const { state: s } = await api.getAdminState(pin);
  setView(s);
  render();
}

async function mutate(fn, okMsg) {
  try {
    const next = await adminMutate(pin, fn);
    setView(next);
    if (okMsg) toast(okMsg);
    render();
  } catch (err) { toast(err.message, true); }
}

// ---------------------------------------------------------------- PIN
function renderPinSetup() {
  app.innerHTML = `<div class="card" style="max-width:460px;margin:2rem auto"><h1>Erste Einrichtung</h1>
    <p>Lege die PIN der Turnierleitung fest. Sie schützt den Admin-Bereich und wird in der Datenbank gespeichert.</p>
    <form class="stack" id="pinsetup"><label>Neue PIN (mind. 4 Zeichen) <input type="password" name="pin" required minlength="4" autofocus></label>
    <label>PIN wiederholen <input type="password" name="pin2" required></label><button class="btn primary">PIN speichern</button></form></div>`;
  document.getElementById('pinsetup').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    if (fd.get('pin') !== fd.get('pin2')) { toast('Die PINs stimmen nicht überein.', true); return; }
    try { await api.setAdminPin(fd.get('pin')); pin = fd.get('pin'); sessionStorage.setItem('vt.pin', pin); toast('PIN gespeichert.'); await refresh(); } catch (err) { toast(err.message, true); }
  });
}

function renderLogin(error) {
  app.innerHTML = `<div class="card" style="max-width:420px;margin:2rem auto"><h1>Anmeldung</h1>
    <form class="stack" id="login"><label>PIN der Turnierleitung <input type="password" name="pin" autofocus required></label>
    ${error ? `<p class="error">${esc(error)}</p>` : ''}<button class="btn primary">Anmelden</button></form>
    <p class="muted small">${usingSupabase ? 'Die PIN wurde bei der ersten Einrichtung festgelegt und kann unter „Teams & Einstellungen“ geändert werden.' : 'Die PIN wird beim Start des lokalen Servers über die Umgebungsvariable ADMIN_PIN gesetzt.'}</p></div>`;
  document.getElementById('login').addEventListener('submit', async (e) => {
    e.preventDefault();
    pin = new FormData(e.target).get('pin');
    try { await api.login(pin); sessionStorage.setItem('vt.pin', pin); await refresh(); } catch (err) { pin = ''; renderLogin(err.message); }
  });
}

// ---------------------------------------------------------------- Setup
function renderSetup() {
  const fmt = formats.find((f) => f.id === (sessionStorage.getItem('vt.setup.format') || 'teams15')) || formats[0];
  const rows = [];
  for (const g of fmt.groups) for (let i = 0; i < g.size; i += 1) rows.push({ group: g.id, idx: i + 1 });
  app.innerHTML = `<h1>Neues Turnier anlegen</h1>
  <form class="stack" id="setup">
    <div class="card"><h2>Turnier</h2>
      <div class="grid2">
        <label>Name <input type="text" name="name" value="Quattro-Mixed-Beachvolleyball-Turnier" required></label>
        <label>Datum <input type="text" name="date" placeholder="z. B. Samstag, 29.08.2026"></label>
        <label>Start <input type="time" name="startTime" value="11:00" required></label>
        <label>Minuten je Spiel <input type="number" name="slotMinutes" value="30" min="10" max="90" required></label>
      </div>
      <label>Format <select name="formatId" id="formatSel">${formats.map((f) => `<option value="${f.id}" ${f.id === fmt.id ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}</select></label>
      <p class="muted small">${esc(fmt.phase1)} → ${esc(fmt.phase2)} → Finale und Kleines Finale.</p>
      <div class="grid2">${Array.from({ length: fmt.fieldCount }, (_, i) => `<label>Feld ${i + 1} <input type="text" name="field${i}" value="${['Feld 1 Vorn', 'Feld 2 Mitte', 'Feld 3 Hinten'][i] || `Feld ${i + 1}`}"></label>`).join('')}</div>
    </div>
    <div class="card"><h2>Teams (${fmt.teamCount})</h2>
      <details><summary>Teams aus Zwischenablage einfügen</summary>
        <p class="muted small">Eine Zeile je Team: <code>Gruppe;Teamname;Verein;Ansprechpartner</code> (Verein/Ansprechpartner optional). Reihenfolge innerhalb der Gruppe = Nummer im Spielplan.</p>
        <textarea id="paste" rows="5" placeholder="A;Rübenzwerge;TSV Schneeren;Andrej"></textarea>
        <button type="button" class="btn small" id="pasteBtn">Übernehmen</button></details>
      <div class="tablewrap"><table class="admin teamsetup"><thead><tr><th>Gruppe</th><th>Nr.</th><th>Teamname</th><th>Verein</th><th>Ansprechpartner</th></tr></thead><tbody>
        ${rows.map((r, i) => `<tr><td>${r.group}<input type="hidden" name="g${i}" value="${r.group}"></td><td>${r.idx}</td><td><input type="text" name="n${i}" required placeholder="Team ${r.group}${r.idx}"></td><td><input type="text" name="c${i}"></td><td><input type="text" name="p${i}"></td></tr>`).join('')}
      </tbody></table></div>
    </div>
    <button class="btn primary big">Turnier anlegen und Spielplan erzeugen</button>
  </form>
  <div class="card"><h2>Sicherung wiederherstellen</h2><p class="muted small">Eine zuvor exportierte JSON-Datei einspielen.</p><input type="file" id="importFile" accept="application/json"></div>
  <p><button class="link" data-act="logout">Abmelden</button></p>`;
  document.getElementById('formatSel').addEventListener('change', (e) => { sessionStorage.setItem('vt.setup.format', e.target.value); renderSetup(); });
  document.getElementById('pasteBtn').addEventListener('click', () => {
    const lines = document.getElementById('paste').value.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const byGroup = {};
    for (const line of lines) {
      const [g, name, club, contact] = line.split(/[;\t]/).map((x) => (x || '').trim());
      const gid = (g || '').toUpperCase();
      (byGroup[gid] = byGroup[gid] || []).push({ name, club, contact });
    }
    rows.forEach((r, i) => {
      const t = (byGroup[r.group] || [])[r.idx - 1];
      if (!t) return;
      document.querySelector(`[name=n${i}]`).value = t.name || '';
      document.querySelector(`[name=c${i}]`).value = t.club || '';
      document.querySelector(`[name=p${i}]`).value = t.contact || '';
    });
    toast('Teams übernommen – bitte prüfen.');
  });
  document.getElementById('setup').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const cfg = {
      name: fd.get('name'), date: fd.get('date'), startTime: fd.get('startTime'), slotMinutes: Number(fd.get('slotMinutes')),
      formatId: fd.get('formatId'), fieldNames: Array.from({ length: fmt.fieldCount }, (_, i) => fd.get(`field${i}`)),
      teams: rows.map((r, i) => ({ group: fd.get(`g${i}`), name: fd.get(`n${i}`), club: fd.get(`c${i}`), contact: fd.get(`p${i}`) })),
    };
    section = 'status';
    await mutate((s) => {
      if (s && s.games.some((g) => g.sets)) throw new Error('Es liegen bereits Ergebnisse vor. Zum Neuanlegen zuerst das Turnier zurücksetzen.');
      return T.createTournament(cfg);
    }, 'Turnier angelegt.');
  });
  bindImport();
  app.querySelectorAll('[data-act=logout]').forEach((b) => b.addEventListener('click', actions.logout));
}

function bindImport() {
  const imp = document.getElementById('importFile');
  if (!imp) return;
  imp.addEventListener('change', async (e) => {
    const file = e.target.files[0]; if (!file) return;
    if (state && !confirm('Aktuelle Daten durch die Sicherung ersetzen?')) return;
    let imported;
    try { imported = JSON.parse(await file.text()); } catch { toast('Ungültige Datei.', true); return; }
    if (imported && imported.state && imported.state.games) imported = imported.state;
    if (!imported || !Array.isArray(imported.games) || !Array.isArray(imported.teams) || !imported.tournament) { toast('Ungültige Sicherungsdatei.', true); return; }
    await mutate(() => imported, 'Sicherung eingespielt.');
  });
}

// ---------------------------------------------------------------- Status / Phasen
function renderStatus() {
  const p = view.progress;
  const t = view.tournament;
  let phaseHtml = '';
  if (view.phase === 1) {
    phaseHtml = `<p>Die 1. Gruppenphase läuft: <strong>${p[0].done} von ${p[0].total}</strong> Ergebnissen liegen vor.</p>
      ${view.phaseComplete[1] ? '<p class="notice ok">Alle Gruppenspiele sind gespielt. Prüfe die Platzierungen und schließe die Phase ab – dann stehen die Teams der 2. Phase fest.</p>' : '<p class="muted">Sobald alle Ergebnisse vorliegen, kann die Phase abgeschlossen werden.</p>'}
      ${view.phaseComplete[1] ? renderPlacements(1) : ''}`;
  } else if (view.phase === 2) {
    phaseHtml = `<p>Die 2. Phase läuft: <strong>${p[1].done} von ${p[1].total}</strong> Ergebnissen liegen vor.</p>
      ${view.phaseComplete[2] ? '<p class="notice ok">Alle Spiele der 2. Phase sind gespielt. Prüfe die Platzierungen und schließe die Phase ab – dann stehen die Finalteilnehmer fest.</p>' + renderPlacements(2) : ''}
      <p><button class="btn" data-act="reopen1">1. Gruppenphase wieder öffnen</button> <span class="muted small">(nur möglich, solange keine Ergebnisse der 2. Phase vorliegen)</span></p>`;
  } else {
    phaseHtml = `<p>Finalphase: <strong>${p[2].done} von ${p[2].total}</strong> Finalspielen sind gespielt.</p>
      ${view.phaseComplete[3] ? '<p class="notice ok">Das Turnier ist beendet. Die Endplatzierung steht unten und in der Übersicht.</p>' : ''}
      <p><button class="btn" data-act="reopen2">2. Phase wieder öffnen</button></p>
      <h3>Endplatzierung</h3><ol>${view.ranking.map((r) => `<li>${esc(r.teamName || '–')} <span class="muted small">${esc(r.source)}</span></li>`).join('')}</ol>`;
  }
  return `<div class="card"><h2>${esc(t.name)}</h2>
    <p class="muted">${esc(t.formatName)} · ${esc(t.date || 'kein Datum')} · Start ${esc(t.startTime)} · ${t.slotMinutes} Min. je Spiel · ${view.games.length} Spiele in ${view.slots.length} Zeitfenstern (Ende ca. ${esc(view.slots[view.slots.length - 1].time.split('–')[1].trim())})</p>
    ${phaseHtml}</div>
    <div class="card"><h2>Drucken & QR-Codes</h2>
    <p class="inline"><a class="btn" href="print.html?type=qr" target="_blank">QR-Codes der Felder</a>
    ${t.fields.map((f) => `<a class="btn" href="print.html?type=feld&n=${f.number}" target="_blank">Spielzettel ${esc(f.name)}</a>`).join(' ')}
    <a class="btn" href="print.html?type=plan" target="_blank">Spielplan</a> <a class="btn" href="print.html?type=tabellen" target="_blank">Tabellen</a></p>
    <p class="muted small">Die QR-Codes verweisen auf diese Web-Adresse. Die Schiri-Teams brauchen nur Internet auf dem Handy.</p>
    <h3>Große Anzeige (iPad / Beamer)</h3>
    <p class="inline"><a class="btn" href="display.html" target="_blank">Anzeige öffnen</a> <span class="muted small">Schaltet automatisch zwischen Spielplan und Tabellen durch (alle 12 s; anpassbar über <code>display.html?s=20</code>). Tippen rechts/links = weiter/zurück, Mitte = Pause. Auf dem iPad über „Teilen → Zum Home-Bildschirm“ als Vollbild-App starten.</span></p></div>`;
}

function renderPlacements(phase) {
  const units = phase === 1
    ? view.groups.map((g) => ({ id: g.id, name: g.name, table: g.table }))
    : view.rounds.filter((r) => r.type === 'roundrobin').map((r) => ({ id: r.id, name: r.name, table: r.table }));
  if (!placementDraft || placementDraft.phase !== phase) {
    placementDraft = { phase, order: Object.fromEntries(units.map((u) => [u.id, u.table.map((r) => r.teamId)])) };
  }
  const nameOf = (id) => (view.teams.find((t) => t.id === id) || {}).name || id;
  const anyTie = units.some((u) => u.table.some((r) => r.tie));
  return `<div class="card"><h3>Platzierungen ${phase === 1 ? 'der Gruppen' : 'der Runden'} bestätigen</h3>
    ${units.length ? `<p class="muted small">Vorschlag nach Tabellenstand (Siege → Satzdifferenz → Punktdifferenz → direkter Vergleich). Mit ▲▼ kannst du die Reihenfolge ändern, z. B. nach Münzwurf bei Gleichstand.${anyTie ? ' <strong>Achtung: Es gibt Gleichstände (⚖).</strong>' : ''}</p>` : '<p class="muted small">Die Platzierungen der K.o.-Runden ergeben sich automatisch aus Finale und Spiel um Platz 3.</p>'}
    <div class="grid2">${units.map((u) => `<div><strong>${esc(u.name)}</strong><ul class="placement" data-unit="${u.id}">
      ${placementDraft.order[u.id].map((id, i) => `<li class="${(u.table.find((r) => r.teamId === id) || {}).tie ? 'tie' : ''}"><span class="n">${i + 1}.</span><span class="nm">${esc(nameOf(id))}</span>
        <button type="button" class="btn small" data-move="${u.id}|${i}|-1" ${i === 0 ? 'disabled' : ''}>▲</button><button type="button" class="btn small" data-move="${u.id}|${i}|1" ${i === placementDraft.order[u.id].length - 1 ? 'disabled' : ''}>▼</button></li>`).join('')}
    </ul></div>`).join('')}</div>
    <p><button class="btn primary" data-act="confirm${phase}">${phase === 1 ? '1. Gruppenphase abschließen → 2. Phase starten' : '2. Phase abschließen → Finale freigeben'}</button></p></div>`;
}

// ---------------------------------------------------------------- Spiele
function renderGames() {
  const fields = view.tournament.fields;
  let games = view.games;
  if (gameFilter.phase !== 'all') games = games.filter((g) => String(g.phase) === gameFilter.phase);
  if (gameFilter.field !== 'all') games = games.filter((g) => String(g.field) === gameFilter.field);
  if (gameFilter.open) games = games.filter((g) => g.status !== 'done');
  const teamOpts = (g) => `<option value="">– automatisch –</option><option value="orga" ${g.refereeId === 'orga' ? 'selected' : ''}>Orga / Helfer</option>${view.teams
    .filter((t) => t.id !== g.team1Id && t.id !== g.team2Id)
    .map((t) => `<option value="${t.id}" ${g.refereeId === t.id ? 'selected' : ''}>${esc(t.name)} (${t.refereeCount})</option>`).join('')}`;
  const setInputs = (g) => {
    const n = g.mode === 'ko' ? 3 : 2;
    return Array.from({ length: n }, (_, i) => {
      const v = g.sets && g.sets[i] ? g.sets[i] : ['', ''];
      return `<span class="set"><input type="number" min="0" max="99" data-set="${g.id}|${i}|0" value="${v[0]}" ${g.status === 'pending' ? 'disabled' : ''}>:<input type="number" min="0" max="99" data-set="${g.id}|${i}|1" value="${v[1]}" ${g.status === 'pending' ? 'disabled' : ''}></span>`;
    }).join(' ');
  };
  return `<div class="filters">
    <label>Phase <select id="fPhase"><option value="all">alle</option><option value="1" ${gameFilter.phase === '1' ? 'selected' : ''}>1. Gruppenphase</option><option value="2" ${gameFilter.phase === '2' ? 'selected' : ''}>2. Phase</option><option value="3" ${gameFilter.phase === '3' ? 'selected' : ''}>Finale</option></select></label>
    <label>Feld <select id="fField"><option value="all">alle</option>${fields.map((f) => `<option value="${f.number}" ${gameFilter.field === String(f.number) ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}</select></label>
    <label><input type="checkbox" id="fOpen" ${gameFilter.open ? 'checked' : ''}> nur offene</label>
    <button class="btn small" data-act="resetRefs">Schiris neu verteilen (automatische)</button>
  </div>
  <p class="muted small">Ergebnisse hier direkt eintragen oder korrigieren (Sätze eingeben, dann „Speichern“). Schiri-Zuteilungen können je Spiel überschrieben werden; „(n)“ = bisherige Einsätze. Die Tabelle lässt sich seitlich scrollen.</p>
  <div class="tablewrap"><table class="admin"><thead><tr><th>Zeit</th><th>Feld</th><th>Spiel</th><th>Team 1</th><th>Team 2</th><th>Sätze</th><th></th><th>Schiri</th><th>QR</th></tr></thead><tbody>
  ${games.map((g) => `<tr class="${g.status}"><td>${esc(g.time)}</td><td>${esc(g.fieldName)}</td><td>${esc(g.title)}</td>
    <td class="${g.team1Known ? '' : 'muted'}">${esc(g.team1)}</td><td class="${g.team2Known ? '' : 'muted'}">${esc(g.team2)}</td>
    <td class="sets">${setInputs(g)}</td>
    <td class="actions"><button class="btn small primary" data-save="${g.id}" ${g.status === 'pending' ? 'disabled' : ''}>Speichern</button>${g.status === 'done' ? `<button class="btn small danger" data-clear="${g.id}">Löschen</button>` : ''}</td>
    <td><select data-ref="${g.id}">${teamOpts(g)}</select>${g.refereeManual ? ' ✎' : ''}</td>
    <td><a href="g.html?t=${encodeURIComponent(g.token)}" target="_blank" title="Schiri-Seite öffnen">Link</a></td></tr>`).join('')}
  </tbody></table></div>`;
}

// ---------------------------------------------------------------- Teams / Einstellungen
function renderSettings() {
  const t = view.tournament;
  return `<div class="card"><h2>Einstellungen</h2><form class="stack" id="settings"><div class="grid2">
    <label>Name <input type="text" name="name" value="${esc(t.name)}"></label>
    <label>Datum <input type="text" name="date" value="${esc(t.date)}"></label>
    <label>Start <input type="time" name="startTime" value="${esc(t.startTime)}"></label>
    <label>Minuten je Spiel <input type="number" name="slotMinutes" value="${t.slotMinutes}" min="5"></label>
    ${t.fields.map((f, i) => `<label>Feld ${f.number} <input type="text" name="field${i}" value="${esc(f.name)}"></label>`).join('')}
    </div><button class="btn primary">Speichern</button></form></div>
    <div class="card"><h2>Teams</h2><p class="muted small">Namen können jederzeit korrigiert werden – der Spielplan bleibt gleich.</p>
    <div class="tablewrap"><table class="admin"><thead><tr><th>Gruppe</th><th>Nr.</th><th>Name</th><th>Verein</th><th>Ansprechpartner</th><th></th></tr></thead><tbody>
    ${view.teams.map((tm) => `<tr><td>${tm.group}</td><td>${tm.pos}</td><td><input type="text" data-team="${tm.id}|name" value="${esc(tm.name)}"></td><td><input type="text" data-team="${tm.id}|club" value="${esc(tm.club || '')}"></td><td><input type="text" data-team="${tm.id}|contact" value="${esc(tm.contact || '')}"></td><td><button class="btn small" data-saveteam="${tm.id}">Speichern</button></td></tr>`).join('')}
    </tbody></table></div></div>
    <div class="card"><h2>PIN der Turnierleitung</h2>${usingSupabase ? `<form class="stack" id="pinchange"><div class="grid2"><label>Aktuelle PIN <input type="password" name="old" required></label><label>Neue PIN <input type="password" name="new" required minlength="4"></label></div><button class="btn">PIN ändern</button></form>` : '<p class="muted small">Im lokalen Modus wird die PIN beim Start über die Umgebungsvariable ADMIN_PIN gesetzt.</p>'}</div>
    <div class="card"><h2>Sicherung</h2><p class="inline"><button class="btn" data-act="export">Turnierdaten exportieren (JSON)</button> <label class="btn">Sicherung einspielen <input type="file" id="importFile" accept="application/json" hidden></label></p></div>
    <div class="card dangerzone"><h2>Turnier zurücksetzen</h2><p class="muted small">Löscht alle Teams, Spiele und Ergebnisse. Vorher exportieren!</p>
    <p class="inline"><input type="text" id="resetConfirm" placeholder="LÖSCHEN eingeben"> <button class="btn danger" data-act="reset">Turnier löschen</button></p></div>`;
}

// ---------------------------------------------------------------- Render + Events
function render() {
  if (!pin) return renderLogin();
  if (!view) return renderSetup();
  const tabs = [['status', 'Status & Phasen'], ['games', 'Spiele & Ergebnisse'], ['settings', 'Teams & Einstellungen']];
  let html = `<div class="tabs">${tabs.map(([id, label]) => `<button data-tab="${id}" class="${section === id ? 'active' : ''}">${label}</button>`).join('')}<button class="link" data-act="logout" style="margin-left:auto">Abmelden</button></div>`;
  if (section === 'status') html += renderStatus();
  else if (section === 'games') html += renderGames();
  else html += renderSettings();
  app.innerHTML = html;
  bind();
  return undefined;
}

const actions = {
  logout: () => { pin = ''; sessionStorage.removeItem('vt.pin'); render(); },
  confirm1: () => { const pl = placementDraft && placementDraft.phase === 1 ? placementDraft.order : undefined; placementDraft = null; return mutate((s) => { T.confirmPhase1(s, pl); }, '2. Phase gestartet.'); },
  confirm2: () => { const pl = placementDraft && placementDraft.phase === 2 ? placementDraft.order : undefined; placementDraft = null; return mutate((s) => { T.confirmPhase2(s, pl); }, 'Finale freigegeben.'); },
  reopen1: () => { if (!confirm('1. Gruppenphase wirklich wieder öffnen?')) return undefined; return mutate((s) => { T.reopenPhase1(s); }, '1. Gruppenphase geöffnet.'); },
  reopen2: () => { if (!confirm('2. Phase wirklich wieder öffnen?')) return undefined; return mutate((s) => { T.reopenPhase2(s); }, '2. Phase geöffnet.'); },
  resetRefs: () => { if (!confirm('Automatische Schiri-Zuteilungen neu berechnen? Manuelle (✎) bleiben erhalten.')) return undefined; return mutate((s) => { T.resetReferees(s); }, 'Schiris neu verteilt.'); },
  export: () => {
    const blob = new Blob([JSON.stringify(state, null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `turnier-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  },
  reset: () => {
    if (document.getElementById('resetConfirm').value !== 'LÖSCHEN') { toast('Bitte zur Bestätigung LÖSCHEN eingeben.', true); return undefined; }
    placementDraft = null;
    return mutate(() => null, 'Turnier gelöscht.');
  },
};

function bind() {
  app.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { section = b.dataset.tab; sessionStorage.setItem('vt.admin.section', section); render(); }));
  app.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', async () => {
    try { await actions[b.dataset.act](); } catch (err) { toast(err.message, true); }
  }));
  app.querySelectorAll('[data-move]').forEach((b) => b.addEventListener('click', () => {
    const [unit, idx, dir] = b.dataset.move.split('|'); const i = Number(idx); const j = i + Number(dir);
    const arr = placementDraft.order[unit]; [arr[i], arr[j]] = [arr[j], arr[i]]; render();
  }));
  app.querySelectorAll('[data-save]').forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.save;
    const raw = [0, 1, 2].map((i) => {
      const a = app.querySelector(`[data-set="${id}|${i}|0"]`); const c = app.querySelector(`[data-set="${id}|${i}|1"]`);
      return a && c ? [a.value, c.value] : null;
    });
    return mutate((s) => { const g = T.gameById(s, id); if (!g) throw new Error('Spiel nicht gefunden.'); T.setResult(s, id, validateSets(raw, g.mode), { admin: true, by: 'admin' }); }, 'Ergebnis gespeichert.');
  }));
  app.querySelectorAll('[data-clear]').forEach((b) => b.addEventListener('click', () => {
    if (!confirm('Ergebnis wirklich löschen?')) return;
    mutate((s) => { T.clearResult(s, b.dataset.clear); }, 'Ergebnis gelöscht.');
  }));
  app.querySelectorAll('[data-ref]').forEach((sel) => sel.addEventListener('change', () => mutate((s) => { T.setReferee(s, sel.dataset.ref, sel.value || null); }, 'Schiri gesetzt.')));
  app.querySelectorAll('[data-saveteam]').forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.saveteam;
    const val = (k) => app.querySelector(`[data-team="${id}|${k}"]`).value;
    const name = val('name').trim(); const club = val('club').trim(); const contact = val('contact').trim();
    return mutate((s) => {
      const t = s.teams.find((x) => x.id === id); if (!t) throw new Error('Team nicht gefunden.');
      if (!name) throw new Error('Name darf nicht leer sein.');
      if (s.teams.some((x) => x.id !== id && x.name.toLowerCase() === name.toLowerCase())) throw new Error('Teamname bereits vergeben.');
      t.name = name; t.club = club; t.contact = contact;
    }, 'Team gespeichert.');
  }));
  const fPhase = document.getElementById('fPhase'); if (fPhase) fPhase.addEventListener('change', () => { gameFilter.phase = fPhase.value; render(); });
  const fField = document.getElementById('fField'); if (fField) fField.addEventListener('change', () => { gameFilter.field = fField.value; render(); });
  const fOpen = document.getElementById('fOpen'); if (fOpen) fOpen.addEventListener('change', () => { gameFilter.open = fOpen.checked; render(); });
  const settings = document.getElementById('settings');
  if (settings) settings.addEventListener('submit', (e) => {
    e.preventDefault(); const fd = new FormData(settings);
    const b = { name: fd.get('name'), date: fd.get('date'), startTime: fd.get('startTime'), slotMinutes: Number(fd.get('slotMinutes')), fieldNames: view.tournament.fields.map((f, i) => fd.get(`field${i}`)) };
    mutate((s) => {
      s.tournament.name = String(b.name).trim() || s.tournament.name;
      s.tournament.date = String(b.date).trim();
      if (/^\d{1,2}:\d{2}$/.test(b.startTime)) s.tournament.startTime = b.startTime;
      if (b.slotMinutes >= 5) s.tournament.slotMinutes = b.slotMinutes;
      s.tournament.fields.forEach((f, i) => { if (b.fieldNames[i]) f.name = String(b.fieldNames[i]).trim(); });
    }, 'Gespeichert.');
  });
  const pinchange = document.getElementById('pinchange');
  if (pinchange) pinchange.addEventListener('submit', async (e) => {
    e.preventDefault(); const fd = new FormData(pinchange);
    try { await api.changeAdminPin(fd.get('old'), fd.get('new')); pin = fd.get('new'); sessionStorage.setItem('vt.pin', pin); toast('PIN geändert.'); pinchange.reset(); } catch (err) { toast(err.message, true); }
  });
  bindImport();
}

(async () => {
  try {
    const status = await api.pinStatus();
    if (!status.configured) { renderPinSetup(); return; }
    if (pin) { try { await api.login(pin); } catch { pin = ''; } }
    if (pin) await refresh(); else render();
  } catch (err) {
    app.innerHTML = `<p class="error">Verbindung zur Datenbank fehlgeschlagen: ${esc(err.message)}</p><p class="muted">Prüfe die Werte in <code>config.js</code> (Supabase-URL und Key) bzw. ob der lokale Server läuft.</p>`;
  }
})();
setInterval(() => { if (pin && view && section !== 'games') refresh().catch(() => {}); }, 30000);
