'use strict';
const QRCode = require('qrcode');
const { esc, page } = require('./html');
const { evaluate } = require('./results');

const STATUS_TEXT = { done: 'Ergebnis eingetragen', ready: 'Offen', pending: 'Teams stehen noch nicht fest' };

function resultBadge(g) {
  if (g.status !== 'done') return `<span class="badge ${g.status}">${STATUS_TEXT[g.status]}</span>`;
  const r = g.result;
  const winner = r.winner === 0 ? 'Unentschieden' : (r.winner === 1 ? g.team1 : g.team2);
  return `<span class="badge done">${esc(g.setsText)}</span> <span class="muted">${esc(winner)}</span>`;
}

function siteHeader(view, subtitle) {
  return `<header class="topbar"><div><strong>${esc(view.tournament.name)}</strong>${subtitle ? ` · ${esc(subtitle)}` : ''}</div><a href="/">Übersicht</a></header>`;
}

// ---------------------------------------------------------------------------
// Schiedsrichter: Feldseite

function fieldPage(view, field) {
  const games = view.games.filter((g) => g.field === field.number);
  const next = games.find((g) => g.status === 'ready');
  const rows = games.map((g) => {
    const cls = g === next ? 'next' : g.status;
    const link = g.status === 'pending' ? esc(g.title) : `<a href="/g/${g.token}">${esc(g.title)}</a>`;
    return `<li class="game ${cls}">
      <div class="time">${esc(g.time)}</div>
      <div class="main"><div class="title">${link}</div>
      <div class="teams">${esc(g.team1)} <span class="vs">vs</span> ${esc(g.team2)}</div>
      <div class="meta">Schiri: ${esc(g.referee || '–')} · ${resultBadge(g)}</div></div>
      ${g.status === 'ready' ? `<a class="btn" href="/g/${g.token}">Ergebnis</a>` : ''}
    </li>`;
  }).join('');
  return page({
    title: `${field.name} – ${view.tournament.name}`,
    body: `${siteHeader(view, field.name)}
<main class="narrow">
<h1>${esc(field.name)}</h1>
<p class="muted">Tippe auf ein Spiel, um das Ergebnis einzutragen. Das nächste offene Spiel ist markiert.</p>
<ul class="gamelist">${rows}</ul>
</main>`,
  });
}

// ---------------------------------------------------------------------------
// Schiedsrichter: Ergebniseingabe

function setInputs(g, values, editable) {
  const setCount = g.mode === 'ko' ? 3 : 2;
  let html = '<table class="setform"><thead><tr><th></th><th>' + esc(g.team1) + '</th><th></th><th>' + esc(g.team2) + '</th></tr></thead><tbody>';
  for (let i = 0; i < setCount; i += 1) {
    const v = values && values[i] ? values[i] : ['', ''];
    const optional = i === 2 ? ' <small class="muted">(nur bei 1:1)</small>' : '';
    html += `<tr><th>Satz ${i + 1}${optional}</th>
      <td><input type="number" inputmode="numeric" min="0" max="99" name="s${i}a" value="${esc(v[0])}" ${editable ? '' : 'disabled'} ${i < 2 ? 'required' : ''}></td>
      <td class="colon">:</td>
      <td><input type="number" inputmode="numeric" min="0" max="99" name="s${i}b" value="${esc(v[1])}" ${editable ? '' : 'disabled'} ${i < 2 ? 'required' : ''}></td></tr>`;
  }
  html += '</tbody></table>';
  return html;
}

function gamePage(view, g, opts = {}) {
  const field = view.tournament.fields.find((f) => f.number === g.field);
  const fieldToken = opts.fieldToken;
  const editable = opts.editable;
  let statusHtml = '';
  if (g.status === 'pending') statusHtml = '<p class="notice">Die Teams dieses Spiels stehen noch nicht fest.</p>';
  else if (g.status === 'done' && !editable) statusHtml = `<p class="notice">Ergebnis bereits eingetragen: <strong>${esc(g.setsText)}</strong>. Eine Korrektur ist nur noch über die Turnierleitung möglich.</p>`;
  else if (g.status === 'done') statusHtml = `<p class="notice ok">Ergebnis eingetragen: <strong>${esc(g.setsText)}</strong>. Du kannst es innerhalb von ${opts.correctionMinutes} Minuten noch korrigieren.</p>`;
  const err = opts.error ? `<p class="error">${esc(opts.error)}</p>` : '';
  const rules = g.mode === 'ko'
    ? 'K.o.-Spiel: Es muss einen Sieger geben. Bei 1:1 Sätzen entscheidet der 3. Satz; ohne 3. Satz zählt die Punktdifferenz.'
    : 'Gruppenspiel: Es werden genau 2 Sätze gespielt, ein 1:1 ist möglich.';
  const form = g.status !== 'pending' && editable ? `
<form method="post" action="/g/${g.token}" class="resultform">
  ${setInputs(g, opts.values || g.sets, true)}
  <p class="muted small">${rules}</p>
  <label class="check"><input type="checkbox" name="confirm" value="1" required> Beide Teams haben das Ergebnis bestätigt.</label>
  <button type="submit" class="btn primary big">Ergebnis speichern</button>
</form>` : (g.sets ? setInputs(g, g.sets, false) : '');
  return page({
    title: `${g.title} – ${view.tournament.name}`,
    body: `${siteHeader(view, field ? field.name : '')}
<main class="narrow">
<p class="crumbs">${fieldToken ? `<a href="/f/${fieldToken}">← ${esc(field ? field.name : 'Feld')}</a>` : ''}</p>
<h1>${esc(g.title)}</h1>
<p class="gameinfo">${esc(g.time)} · ${esc(g.fieldName)} · Schiri: <strong>${esc(g.referee || '–')}</strong></p>
<div class="matchup"><span>${esc(g.team1)}</span><span class="vs">vs</span><span>${esc(g.team2)}</span></div>
${statusHtml}${err}${form}
</main>`,
  });
}

function savedPage(view, g, table, opts = {}) {
  const field = view.tournament.fields.find((f) => f.number === g.field);
  const r = g.result;
  const winner = r.winner === 0 ? 'Unentschieden' : `Sieger: ${r.winner === 1 ? g.team1 : g.team2}`;
  const nextOnField = view.games.filter((x) => x.field === g.field && x.status === 'ready')[0];
  return page({
    title: `Gespeichert – ${view.tournament.name}`,
    body: `${siteHeader(view, field ? field.name : '')}
<main class="narrow">
<h1>Danke! Ergebnis gespeichert.</h1>
<div class="card"><div class="title">${esc(g.title)}</div>
<div class="matchup"><span>${esc(g.team1)}</span><span class="vs">${esc(g.setsText)}</span><span>${esc(g.team2)}</span></div>
<p><strong>${esc(winner)}</strong></p></div>
${table ? `<h2>${esc(table.title)}</h2>${standingsTable(table.rows)}` : ''}
<p><a class="btn" href="/g/${g.token}">Ergebnis korrigieren</a>
${opts.fieldToken ? `<a class="btn primary" href="/f/${opts.fieldToken}">Zurück zu ${esc(field.name)}</a>` : ''}</p>
${nextOnField ? `<p class="muted">Nächstes Spiel auf diesem Feld: ${esc(nextOnField.time)} – ${esc(nextOnField.team1)} vs ${esc(nextOnField.team2)} (Schiri: ${esc(nextOnField.referee || '–')})</p>` : ''}
</main>`,
  });
}

function standingsTable(rows, opts = {}) {
  const head = `<tr><th>#</th><th class="left">Team</th><th>Sp</th><th>S</th><th>U</th><th>N</th><th>Sätze</th><th>Diff</th><th>Punkte</th><th>Diff</th></tr>`;
  const body = rows.map((r) => `<tr class="${r.tie ? 'tie' : ''} ${opts.highlight && opts.highlight <= r.place ? '' : ''}">
    <td>${r.place}</td><td class="left">${esc(r.teamName)}${r.tie ? ' <span title="Gleichstand – Entscheidung durch Turnierleitung">⚖</span>' : ''}</td>
    <td>${r.played}</td><td>${r.wins}</td><td>${r.draws}</td><td>${r.losses}</td>
    <td>${r.setsFor}:${r.setsAgainst}</td><td>${r.setDiff > 0 ? '+' : ''}${r.setDiff}</td>
    <td>${r.pointsFor}:${r.pointsAgainst}</td><td>${r.pointDiff > 0 ? '+' : ''}${r.pointDiff}</td></tr>`).join('');
  return `<div class="tablewrap"><table class="standings"><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
}

// ---------------------------------------------------------------------------
// Druckseiten

async function qrSvg(url) {
  return QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
}

async function qrPage(view, state, baseUrl) {
  const fields = await Promise.all(state.tournament.fields.map(async (f) => {
    const url = `${baseUrl}/f/${f.token}`;
    return `<section class="qrcard"><h2>${esc(f.name)}</h2><div class="qr">${await qrSvg(url)}</div>
      <p>Scannen, um die Spiele auf ${esc(f.name)} zu sehen und Ergebnisse einzutragen.</p><p class="url">${esc(url)}</p></section>`;
  }));
  const overview = `<section class="qrcard"><h2>Live-Übersicht</h2><div class="qr">${await qrSvg(baseUrl + '/')}</div><p>Spielplan, Tabellen und Platzierungen für alle.</p><p class="url">${esc(baseUrl)}/</p></section>`;
  return page({
    title: `QR-Codes – ${view.tournament.name}`,
    bodyClass: 'print',
    body: `<div class="printbar no-print"><a href="/admin">← Admin</a> <button onclick="window.print()">Drucken</button></div>
<h1 class="printtitle">${esc(view.tournament.name)} – QR-Codes</h1>
<div class="qrgrid">${fields.join('')}${overview}</div>`,
  });
}

async function fieldSheetPage(view, state, field, baseUrl) {
  const games = view.games.filter((g) => g.field === field.number);
  const rows = await Promise.all(games.map(async (g) => `<tr>
    <td>${esc(g.time)}</td><td>${esc(g.title)}</td><td>${esc(g.team1)}</td><td>${esc(g.team2)}</td><td>${esc(g.referee || '')}</td>
    <td class="fill"></td><td class="fill"></td><td class="fill"></td>
    <td class="qrcell">${await qrSvg(`${baseUrl}/g/${g.token}`)}</td></tr>`));
  return page({
    title: `${field.name} – Spielzettel`,
    bodyClass: 'print',
    body: `<div class="printbar no-print"><a href="/admin">← Admin</a> <button onclick="window.print()">Drucken</button></div>
<h1 class="printtitle">${esc(view.tournament.name)} – ${esc(field.name)}</h1>
<p class="muted">${esc(view.tournament.date || '')} · Schiri-Team scannt den QR-Code des Spiels und trägt das Ergebnis ein. Zur Sicherheit hier zusätzlich handschriftlich notieren.</p>
<table class="sheet"><thead><tr><th>Zeit</th><th>Spiel</th><th>Team 1</th><th>Team 2</th><th>Schiri</th><th>Satz 1</th><th>Satz 2</th><th>Satz 3</th><th>QR</th></tr></thead><tbody>${rows.join('')}</tbody></table>`,
  });
}

function planPage(view) {
  const fields = view.tournament.fields;
  const rows = view.slots.map((s) => {
    const cells = fields.map((f) => {
      const g = s.games.find((x) => x.field === f.number);
      if (!g) return '<td class="empty">–</td>';
      return `<td class="tier-${tierOf(view, g)}"><div class="title">${esc(g.title)}</div><div>${esc(g.team1)}</div><div>${esc(g.team2)}</div><div class="ref">Schiri: ${esc(g.referee || '–')}</div>${g.status === 'done' ? `<div class="res">${esc(g.setsText)}</div>` : ''}</td>`;
    }).join('');
    return `<tr><th>${esc(s.time)}</th>${cells}</tr>`;
  }).join('');
  return page({
    title: `Spielplan – ${view.tournament.name}`,
    bodyClass: 'print',
    body: `<div class="printbar no-print"><a href="/admin">← Admin</a> <button onclick="window.print()">Drucken</button></div>
<h1 class="printtitle">${esc(view.tournament.name)} – Spielplan</h1>
<p class="muted">${esc(view.tournament.date || '')} · Start ${esc(view.tournament.startTime)} · ${view.tournament.slotMinutes} Min. je Spiel · ${view.games.length} Spiele</p>
<table class="plan"><thead><tr><th>Zeit</th>${fields.map((f) => `<th>${esc(f.name)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`,
  });
}

function tierOf(view, g) {
  if (g.phase === 1) return `group-${g.group}`;
  if (g.phase === 3) return 'final';
  const r = view.rounds.find((x) => x.id === g.round);
  return r ? r.tier : 'other';
}

function tablesPage(view) {
  const groups = view.groups.map((g) => `<section><h2>${esc(g.name)}</h2>${standingsTable(g.table)}</section>`).join('');
  const rounds = view.rounds.filter((r) => r.table).map((r) => `<section><h2>${esc(r.name)}</h2>${standingsTable(r.table)}</section>`).join('');
  const ko = view.rounds.filter((r) => !r.table).map((r) => `<section><h2>${esc(r.name)}</h2><ul class="plain">${r.games.map((g) => `<li>${esc(g.sublabel)}: ${esc(g.team1)} – ${esc(g.team2)} ${g.setsText ? `<strong>${esc(g.setsText)}</strong>` : ''}</li>`).join('')}</ul></section>`).join('');
  const ranking = `<section><h2>Endplatzierung</h2><table class="standings"><tbody>${view.ranking.map((r) => `<tr><td>${r.place}.</td><td class="left">${esc(r.teamName || '–')}</td><td class="left muted">${esc(r.source)}</td></tr>`).join('')}</tbody></table></section>`;
  return page({
    title: `Tabellen – ${view.tournament.name}`,
    bodyClass: 'print',
    body: `<div class="printbar no-print"><a href="/admin">← Admin</a> <button onclick="window.print()">Drucken</button></div>
<h1 class="printtitle">${esc(view.tournament.name)} – Tabellen</h1>${groups}${rounds}${ko}${ranking}`,
  });
}

function messagePage(title, text, link) {
  return page({ title, body: `<main class="narrow"><h1>${esc(title)}</h1><p>${esc(text)}</p>${link ? `<p><a class="btn" href="${esc(link.href)}">${esc(link.text)}</a></p>` : ''}</main>` });
}

module.exports = { fieldPage, gamePage, savedPage, qrPage, fieldSheetPage, planPage, tablesPage, messagePage, standingsTable, evaluate };
