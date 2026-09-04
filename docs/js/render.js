// Gemeinsame HTML-Renderer für alle Seiten (laufen im Browser).

export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Basis-URL der App (Verzeichnis der aktuellen Seite), z. B. https://name.github.io/Volleyballturnier/ */
export function baseUrl() {
  return location.href.replace(/[?#].*$/, '').replace(/[^/]*$/, '');
}

export function gameLink(token) { return `${baseUrl()}g.html?t=${encodeURIComponent(token)}`; }
export function fieldLink(token) { return `${baseUrl()}f.html?t=${encodeURIComponent(token)}`; }

export function tierOf(view, g) {
  if (g.phase === 1) return `group-${g.group}`;
  if (g.phase === 3) return 'final';
  const r = view.rounds.find((x) => x.id === g.round);
  return r ? r.tier : 'other';
}

const STATUS_TEXT = { done: 'Ergebnis eingetragen', ready: 'Offen', pending: 'Teams stehen noch nicht fest' };

export function resultBadge(g) {
  if (g.status !== 'done') return `<span class="badge ${g.status}">${STATUS_TEXT[g.status]}</span>`;
  const r = g.result;
  const winner = r.winner === 0 ? 'Unentschieden' : (r.winner === 1 ? g.team1 : g.team2);
  return `<span class="badge done">${esc(g.setsText)}</span> <span class="muted">${esc(winner)}</span>`;
}

export function standingsTable(rows) {
  const head = '<tr><th>#</th><th class="left">Team</th><th>Sp</th><th>S</th><th>U</th><th>N</th><th>Sätze</th><th>Diff</th><th>Punkte</th><th>Diff</th></tr>';
  const body = rows.map((r) => `<tr class="${r.tie ? 'tie' : ''}">
    <td>${r.place}</td><td class="left">${esc(r.teamName)}${r.tie ? ' <span title="Gleichstand – Entscheidung durch Turnierleitung">⚖</span>' : ''}</td>
    <td>${r.played}</td><td>${r.wins}</td><td>${r.draws}</td><td>${r.losses}</td>
    <td>${r.setsFor}:${r.setsAgainst}</td><td>${r.setDiff > 0 ? '+' : ''}${r.setDiff}</td>
    <td>${r.pointsFor}:${r.pointsAgainst}</td><td>${r.pointDiff > 0 ? '+' : ''}${r.pointDiff}</td></tr>`).join('');
  return `<div class="tablewrap"><table class="standings"><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
}

export function gameCard(view, g) {
  const r = g.result;
  const w1 = r && r.winner === 1; const w2 = r && r.winner === 2;
  const sets = g.sets || [];
  const sc = (i) => sets.map((s) => s[i]).join(' | ');
  return `<div class="g tier-${tierOf(view, g)}">
    <div class="head"><span>${esc(g.title)}</span><span>${esc(g.fieldName)}</span></div>
    <div class="row ${w1 ? 'win' : ''}"><span class="${g.team1Known ? '' : 'muted'}">${esc(g.team1)}</span><span class="sc">${r ? sc(0) : ''}</span></div>
    <div class="row ${w2 ? 'win' : ''}"><span class="${g.team2Known ? '' : 'muted'}">${esc(g.team2)}</span><span class="sc">${r ? sc(1) : ''}</span></div>
    <div class="ref">Schiri: ${esc(g.referee || '–')}${r && r.winner === 0 ? ' · Unentschieden' : ''}${r && r.decidedBy === 'points' ? ' · Entscheidung nach Punkten' : ''}</div>
  </div>`;
}

export function setTitle(view, suffix) {
  const t = view ? view.tournament.name : 'Volleyballturnier';
  document.title = suffix ? `${suffix} – ${t}` : t;
  const el = document.getElementById('title');
  if (el) el.innerHTML = `<strong>${esc(t)}</strong>${suffix ? ` · ${esc(suffix)}` : (view && view.tournament.date ? ` · ${esc(view.tournament.date)}` : '')}`;
}

// ---------------------------------------------------------------------------
// Schiedsrichter-Seiten

export function fieldPage(view, field) {
  const games = view.games.filter((g) => g.field === field.number);
  const next = games.find((g) => g.status === 'ready');
  const rows = games.map((g) => {
    const cls = g === next ? 'next' : g.status;
    const link = g.status === 'pending' || !g.token ? esc(g.title) : `<a href="g.html?t=${encodeURIComponent(g.token)}">${esc(g.title)}</a>`;
    return `<li class="game ${cls}">
      <div class="time">${esc(g.time)}</div>
      <div class="main"><div class="title">${link}</div>
      <div class="teams">${esc(g.team1)} <span class="vs">vs</span> ${esc(g.team2)}</div>
      <div class="meta">Schiri: ${esc(g.referee || '–')} · ${resultBadge(g)}</div></div>
      ${g.status === 'ready' && g.token ? `<a class="btn" href="g.html?t=${encodeURIComponent(g.token)}">Ergebnis</a>` : ''}
    </li>`;
  }).join('');
  return `<h1>${esc(field.name)}</h1>
<p class="muted">Tippe auf ein Spiel, um das Ergebnis einzutragen. Das nächste offene Spiel ist markiert.</p>
<ul class="gamelist">${rows}</ul>`;
}

function setInputs(g, values, editable) {
  const setCount = g.mode === 'ko' ? 3 : 2;
  let html = `<table class="setform"><thead><tr><th></th><th>${esc(g.team1)}</th><th></th><th>${esc(g.team2)}</th></tr></thead><tbody>`;
  for (let i = 0; i < setCount; i += 1) {
    const v = values && values[i] ? values[i] : ['', ''];
    const optional = i === 2 ? ' <small class="muted">(nur bei 1:1)</small>' : '';
    html += `<tr><th>Satz ${i + 1}${optional}</th>
      <td><input type="number" inputmode="numeric" min="0" max="99" name="s${i}a" value="${esc(v[0])}" ${editable ? '' : 'disabled'} ${i < 2 ? 'required' : ''}></td>
      <td class="colon">:</td>
      <td><input type="number" inputmode="numeric" min="0" max="99" name="s${i}b" value="${esc(v[1])}" ${editable ? '' : 'disabled'} ${i < 2 ? 'required' : ''}></td></tr>`;
  }
  return `${html}</tbody></table>`;
}

export function gamePage(view, g, opts = {}) {
  const field = view.tournament.fields.find((f) => f.number === g.field);
  const editable = opts.editable;
  let statusHtml = '';
  if (g.status === 'pending') statusHtml = '<p class="notice">Die Teams dieses Spiels stehen noch nicht fest.</p>';
  else if (g.status === 'done' && !editable) statusHtml = `<p class="notice">Ergebnis bereits eingetragen: <strong>${esc(g.setsText)}</strong>. ${esc(opts.reason || 'Eine Korrektur ist nur noch über die Turnierleitung möglich.')}</p>`;
  else if (g.status === 'done') statusHtml = `<p class="notice ok">Ergebnis eingetragen: <strong>${esc(g.setsText)}</strong>. Du kannst es innerhalb von ${opts.correctionMinutes} Minuten noch korrigieren.</p>`;
  else if (!editable && opts.reason) statusHtml = `<p class="notice">${esc(opts.reason)}</p>`;
  const err = opts.error ? `<p class="error">${esc(opts.error)}</p>` : '';
  const rules = g.mode === 'ko'
    ? 'K.o.-Spiel: Es muss einen Sieger geben. Bei 1:1 Sätzen entscheidet der 3. Satz; ohne 3. Satz zählt die Punktdifferenz.'
    : 'Gruppenspiel: Es werden genau 2 Sätze gespielt, ein 1:1 ist möglich.';
  const form = g.status !== 'pending' && editable ? `
<form id="resultform" class="resultform">
  ${setInputs(g, opts.values || g.sets, true)}
  <p class="muted small">${rules}</p>
  <label class="check"><input type="checkbox" name="confirm" value="1" required> Beide Teams haben das Ergebnis bestätigt.</label>
  <button type="submit" class="btn primary big">Ergebnis speichern</button>
</form>` : (g.sets ? setInputs(g, g.sets, false) : '');
  return `<p class="crumbs">${opts.fieldToken ? `<a href="f.html?t=${encodeURIComponent(opts.fieldToken)}">← ${esc(field ? field.name : 'Feld')}</a>` : ''}</p>
<h1>${esc(g.title)}</h1>
<p class="gameinfo">${esc(g.time)} · ${esc(g.fieldName)} · Schiri: <strong>${esc(g.referee || '–')}</strong></p>
<div class="matchup"><span>${esc(g.team1)}</span><span class="vs">vs</span><span>${esc(g.team2)}</span></div>
${statusHtml}${err}${form}`;
}

export function savedPage(view, g, table, opts = {}) {
  const field = view.tournament.fields.find((f) => f.number === g.field);
  const r = g.result;
  const winner = r.winner === 0 ? 'Unentschieden' : `Sieger: ${r.winner === 1 ? g.team1 : g.team2}`;
  const nextOnField = view.games.filter((x) => x.field === g.field && x.status === 'ready')[0];
  return `<h1>Danke! Ergebnis gespeichert.</h1>
<div class="card"><div class="title">${esc(g.title)}</div>
<div class="matchup"><span>${esc(g.team1)}</span><span class="vs">${esc(g.setsText)}</span><span>${esc(g.team2)}</span></div>
<p><strong>${esc(winner)}</strong></p></div>
${table ? `<h2>${esc(table.title)}</h2>${standingsTable(table.rows)}` : ''}
<p><button class="btn" id="correct">Ergebnis korrigieren</button>
${opts.fieldToken ? `<a class="btn primary" href="f.html?t=${encodeURIComponent(opts.fieldToken)}">Zurück zu ${esc(field.name)}</a>` : ''}</p>
${nextOnField ? `<p class="muted">Nächstes Spiel auf diesem Feld: ${esc(nextOnField.time)} – ${esc(nextOnField.team1)} vs ${esc(nextOnField.team2)} (Schiri: ${esc(nextOnField.referee || '–')})</p>` : ''}`;
}

export function messageHtml(title, text, link) {
  return `<h1>${esc(title)}</h1><p>${esc(text)}</p>${link ? `<p><a class="btn" href="${esc(link.href)}">${esc(link.text)}</a></p>` : ''}`;
}

// ---------------------------------------------------------------------------
// Druckseiten

async function qrSvg(url) {
  if (!window.QRCode) return '<p class="error">QR-Bibliothek nicht geladen.</p>';
  return window.QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
}

export async function qrPage(view, fields) {
  const cards = await Promise.all(fields.map(async (f) => {
    const url = fieldLink(f.token);
    return `<section class="qrcard"><h2>${esc(f.name)}</h2><div class="qr">${await qrSvg(url)}</div>
      <p>Scannen, um die Spiele auf ${esc(f.name)} zu sehen und Ergebnisse einzutragen.</p><p class="url">${esc(url)}</p></section>`;
  }));
  const overviewUrl = `${baseUrl()}index.html`;
  const overview = `<section class="qrcard"><h2>Live-Übersicht</h2><div class="qr">${await qrSvg(overviewUrl)}</div><p>Spielplan, Tabellen und Platzierungen für alle.</p><p class="url">${esc(overviewUrl)}</p></section>`;
  return `<h1 class="printtitle">${esc(view.tournament.name)} – QR-Codes</h1><div class="qrgrid">${cards.join('')}${overview}</div>`;
}

export async function fieldSheetPage(view, field) {
  const games = view.games.filter((g) => g.field === field.number);
  const rows = await Promise.all(games.map(async (g) => `<tr>
    <td>${esc(g.time)}</td><td>${esc(g.title)}</td><td>${esc(g.team1)}</td><td>${esc(g.team2)}</td><td>${esc(g.referee || '')}</td>
    <td class="fill"></td><td class="fill"></td><td class="fill"></td>
    <td class="qrcell">${g.token ? await qrSvg(gameLink(g.token)) : ''}</td></tr>`));
  return `<h1 class="printtitle">${esc(view.tournament.name)} – ${esc(field.name)}</h1>
<p class="muted">${esc(view.tournament.date || '')} · Schiri-Team scannt den QR-Code des Spiels und trägt das Ergebnis ein. Zur Sicherheit hier zusätzlich handschriftlich notieren.</p>
<table class="sheet"><thead><tr><th>Zeit</th><th>Spiel</th><th>Team 1</th><th>Team 2</th><th>Schiri</th><th>Satz 1</th><th>Satz 2</th><th>Satz 3</th><th>QR</th></tr></thead><tbody>${rows.join('')}</tbody></table>`;
}

export function planPage(view) {
  const fields = view.tournament.fields;
  const rows = view.slots.map((s) => {
    const cells = fields.map((f) => {
      const g = s.games.find((x) => x.field === f.number);
      if (!g) return '<td class="empty">–</td>';
      return `<td class="tier-${tierOf(view, g)}"><div class="title">${esc(g.title)}</div><div>${esc(g.team1)}</div><div>${esc(g.team2)}</div><div class="ref">Schiri: ${esc(g.referee || '–')}</div>${g.status === 'done' ? `<div class="res">${esc(g.setsText)}</div>` : ''}</td>`;
    }).join('');
    return `<tr><th>${esc(s.time)}</th>${cells}</tr>`;
  }).join('');
  return `<h1 class="printtitle">${esc(view.tournament.name)} – Spielplan</h1>
<p class="muted">${esc(view.tournament.date || '')} · Start ${esc(view.tournament.startTime)} · ${view.tournament.slotMinutes} Min. je Spiel · ${view.games.length} Spiele</p>
<table class="plan"><thead><tr><th>Zeit</th>${fields.map((f) => `<th>${esc(f.name)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`;
}

export function tablesPage(view) {
  const groups = view.groups.map((g) => `<section><h2>${esc(g.name)}</h2>${standingsTable(g.table)}</section>`).join('');
  const rounds = view.rounds.filter((r) => r.table).map((r) => `<section><h2>${esc(r.name)}</h2>${standingsTable(r.table)}</section>`).join('');
  const ko = view.rounds.filter((r) => !r.table).map((r) => `<section><h2>${esc(r.name)}</h2><ul class="plain">${r.games.map((g) => `<li>${esc(g.sublabel)}: ${esc(g.team1)} – ${esc(g.team2)} ${g.setsText ? `<strong>${esc(g.setsText)}</strong>` : ''}</li>`).join('')}</ul></section>`).join('');
  const ranking = `<section><h2>Endplatzierung</h2><table class="standings"><tbody>${view.ranking.map((r) => `<tr><td>${r.place}.</td><td class="left">${esc(r.teamName || '–')}</td><td class="left muted">${esc(r.source)}</td></tr>`).join('')}</tbody></table></section>`;
  return `<h1 class="printtitle">${esc(view.tournament.name)} – Tabellen</h1>${groups}${rounds}${ko}${ranking}`;
}
