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

/** Pausen-Zeilen (benannte Pausen) nach einem Zeitfenster – für Listen und Tabellen. */
export function breakRows(slot, colspan) {
  return (slot.breaks || []).filter((b) => b.visible).map((b) => `<tr class="break"><th>${esc(b.start)} – ${esc(b.end)}</th><td colspan="${colspan}">${esc(b.label)} (${b.minutes} Min.)</td></tr>`).join('');
}
export function breakCards(slot) {
  return (slot.breaks || []).filter((b) => b.visible).map((b) => `<div class="slot break"><div class="slothead">${esc(b.start)} – ${esc(b.end)}</div><div class="breakcard">☕ ${esc(b.label)} (${b.minutes} Min.)</div></div>`).join('');
}

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
  // Spalten mit "opt" werden auf schmalen Bildschirmen (Handy hochkant) ausgeblendet.
  const head = '<tr><th>#</th><th class="left">Team</th><th>Sp</th><th>S</th><th class="opt">U</th><th class="opt">N</th><th>Sätze</th><th class="opt">Diff</th><th class="opt">Punkte</th><th title="Punktdifferenz">Diff</th></tr>';
  const body = rows.map((r) => `<tr class="${r.tie ? 'tie' : ''}">
    <td>${r.place}</td><td class="left">${esc(r.teamName)}${r.tie ? ' <span title="Gleichstand – Entscheidung durch Turnierleitung">⚖</span>' : ''}</td>
    <td>${r.played}</td><td>${r.wins}</td><td class="opt">${r.draws}</td><td class="opt">${r.losses}</td>
    <td>${r.setsFor}:${r.setsAgainst}</td><td class="opt">${r.setDiff > 0 ? '+' : ''}${r.setDiff}</td>
    <td class="opt">${r.pointsFor}:${r.pointsAgainst}</td><td>${r.pointDiff > 0 ? '+' : ''}${r.pointDiff}</td></tr>`).join('');
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

// ---------------------------------------------------------------------------
// 2. Phase: Weiterkommen, Turnierbaum

/** Tabelle "Wer kommt wohin": Gruppenplatz -> Runde, mit Teamnamen sobald bekannt. */
export function advancementTable(view) {
  const rows = [];
  for (const g of view.groups) {
    const size = g.teams.length;
    for (let p = 1; p <= size; p += 1) {
      const round = view.rounds.find((r) => r.seeds.some((sd) => sd.group === g.id && sd.place === p));
      const known = view.placements && view.placements.phase1 && view.placements.phase1[g.id];
      const teamId = known ? known[p - 1] : null;
      const row = g.table.find((r) => r.teamId === teamId) || g.table[p - 1];
      const name = teamId ? (view.teams.find((t) => t.id === teamId) || {}).name : (row ? `${row.teamName}` : '');
      rows.push({ group: g.id, place: p, name, provisional: !teamId, round });
    }
  }
  const byGroup = view.groups.map((g) => `<table class="standings advance"><thead><tr><th colspan="3" class="left">${esc(g.name)}</th></tr></thead><tbody>
    ${rows.filter((r) => r.group === g.id).map((r) => `<tr class="tier-${r.round ? r.round.tier : 'none'}"><td>${r.place}.</td><td class="left ${r.provisional ? 'muted' : ''}">${esc(r.name || '–')}${r.provisional && r.name ? ' *' : ''}</td><td class="left">→ ${esc(r.round ? r.round.name : '–')}</td></tr>`).join('')}
  </tbody></table>`).join('');
  const provisional = rows.some((r) => r.provisional && r.name);
  return `<div class="grid2">${byGroup}</div>${provisional ? '<p class="legend">* vorläufig nach aktuellem Tabellenstand – endgültig nach Abschluss der Gruppenphase.</p>' : ''}`;
}

function matchBox(g, title) {
  const r = g.result;
  const w1 = r && r.winner === 1; const w2 = r && r.winner === 2;
  return `<div class="match ${g.status}"><div class="mt">${esc(title || g.sublabel)}</div>
    <div class="mrow ${w1 ? 'win' : ''}"><span class="${g.team1Known ? '' : 'muted'}">${esc(g.team1)}</span><span class="sc">${r ? r.sets1 : ''}</span></div>
    <div class="mrow ${w2 ? 'win' : ''}"><span class="${g.team2Known ? '' : 'muted'}">${esc(g.team2)}</span><span class="sc">${r ? r.sets2 : ''}</span></div>
    ${g.setsText ? `<div class="msets">${esc(g.setsText)}</div>` : ''}</div>`;
}

/** Turnierbaum einer K.o.-Runde mit 4 Teams (HF1, HF2 -> Finale, Spiel um Platz 3). */
export function koBracket(view, round) {
  const by = (n) => round.games.find((g) => g.id.endsWith(`-${n}`));
  const hf1 = by(1); const hf2 = by(2); const fin = by(3); const p3 = by(4);
  if (!hf1 || !hf2 || !fin || !p3) return '';
  const out = (place) => { const pl = round.placements.find((x) => x.place === place); return pl && pl.next ? pl.next.label : ''; };
  const res = (place) => { const pl = round.placements.find((x) => x.place === place); return pl && pl.teamName ? `<strong>${esc(pl.teamName)}</strong>` : '<span class="muted">offen</span>'; };
  return `<div class="bracket">
    <div class="bcol"><div class="bhead">Halbfinale</div>${matchBox(hf1, 'Halbfinale 1')}${matchBox(hf2, 'Halbfinale 2')}</div>
    <div class="bcol"><div class="bhead">Finale / Platz 3</div>${matchBox(fin, 'Finale')}${matchBox(p3, 'Spiel um Platz 3')}</div>
    <div class="bcol bout"><div class="bhead">Ergebnis</div>
      <div class="bo"><span class="pl">1.</span>${res(1)}<span class="nx">→ ${esc(out(1))}</span></div>
      <div class="bo"><span class="pl">2.</span>${res(2)}<span class="nx">→ ${esc(out(2))}</span></div>
      <div class="bo"><span class="pl">3.</span>${res(3)}<span class="nx">→ ${esc(out(3))}</span></div>
      <div class="bo"><span class="pl">4.</span>${res(4)}<span class="nx">→ ${esc(out(4))}</span></div>
    </div></div>`;
}

/** Zeile unter einer Dreier-Runde: 1. → Finale, 2. → Kleines Finale, 3. → Platz 5–6 */
export function roundOutlook(round) {
  return `<p class="outlook">${round.placements.map((p) => `<span class="pl">${p.place}.</span> ${p.teamName ? `<strong>${esc(p.teamName)}</strong>` : '<span class="muted">offen</span>'} <span class="nx">→ ${esc(p.next ? p.next.label : '')}</span>`).join('<span class="sep"> · </span>')}</p>`;
}

/** Kompletter Abschnitt "2. Phase" (Übersicht, Admin, Druck). */
export function phase2Section(view) {
  let html = '<h2>Weiterkommen aus den Gruppen</h2>';
  html += advancementTable(view);
  html += '<h2>2. Phase</h2>';
  if (view.phase < 2) html += '<p class="muted">Die Teams der Runden stehen nach Abschluss der 1. Gruppenphase fest. Bis dahin zeigen die Runden die vorläufige Einteilung.</p>';
  for (const r of view.rounds) {
    html += `<section class="round tier-${r.tier}"><h3>${esc(r.name)} <span class="muted small">(${r.seeds.map((sd) => esc(sd.label)).join(', ')})</span></h3>`;
    if (r.table) {
      html += r.table.length ? standingsTable(r.table) : `<p class="muted">${r.seeds.map((sd) => esc(sd.teamName || sd.label)).join(', ')}</p>`;
      html += roundOutlook(r);
    } else {
      html += koBracket(view, r);
    }
    html += '</section>';
  }
  return html;
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
  const breakAfter = (g) => { const s = view.slots.find((x) => x.slot === g.slot); return s ? (s.breaks || []).filter((b) => b.visible).map((b) => `<li class="game pause"><div class="time">${esc(b.start)} – ${esc(b.end)}</div><div class="main"><div class="title">☕ ${esc(b.label)}</div></div></li>`).join('') : ''; };
  const rows = games.map((g) => {
    const cls = g === next ? 'next' : g.status;
    const link = g.status === 'pending' || !g.token ? esc(g.title) : `<a href="g.html?t=${encodeURIComponent(g.token)}">${esc(g.title)}</a>`;
    return `<li class="game ${cls}">
      <div class="time">${esc(g.time)}</div>
      <div class="main"><div class="title">${link}</div>
      <div class="teams">${esc(g.team1)} <span class="vs">vs</span> ${esc(g.team2)}</div>
      <div class="meta">Schiri: ${esc(g.referee || '–')} · ${resultBadge(g)}</div></div>
      ${g.status === 'ready' && g.token ? `<a class="btn" href="g.html?t=${encodeURIComponent(g.token)}">Ergebnis</a>` : ''}
    </li>${breakAfter(g)}`;
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
    <td class="qrcell">${g.token ? await qrSvg(gameLink(g.token)) : ''}</td></tr>${breakRows(view.slots.find((s) => s.slot === g.slot) || {}, 8)}`));
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
    return `<tr><th>${esc(s.time)}</th>${cells}</tr>${breakRows(s, fields.length)}`;
  }).join('');
  return `<h1 class="printtitle">${esc(view.tournament.name)} – Spielplan</h1>
<p class="muted">${esc(view.tournament.date || '')} · Start ${esc(view.tournament.startTime)} · ${view.tournament.slotMinutes} Min. je Spiel · ${view.games.length} Spiele</p>
<table class="plan"><thead><tr><th>Zeit</th>${fields.map((f) => `<th>${esc(f.name)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`;
}

export function tablesPage(view) {
  const groups = view.groups.map((g) => `<section><h2>${esc(g.name)}</h2>${standingsTable(g.table)}</section>`).join('');
  const ranking = `<section><h2>Endplatzierung</h2><table class="standings"><tbody>${view.ranking.map((r) => `<tr><td>${r.place}.</td><td class="left">${esc(r.teamName || '–')}</td><td class="left muted">${esc(r.source)}</td></tr>`).join('')}</tbody></table></section>`;
  return `<h1 class="printtitle">${esc(view.tournament.name)} – Tabellen</h1>${groups}<section>${phase2Section(view)}</section>${ranking}`;
}
