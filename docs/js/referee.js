// Schiedsrichter-Seiten: Feldübersicht (f.html?t=…) und Ergebniseingabe (g.html?t=…).
import * as T from '../engine/tournament.js';
import { validateSets } from '../engine/results.js';
import { api } from './api.js';
import { fieldPage, gamePage, savedPage, messageHtml, setTitle } from './render.js';

const app = document.getElementById('app');
const kind = document.body.dataset.page; // 'field' | 'game'
const token = new URLSearchParams(location.search).get('t') || '';

function fail(text) {
  app.innerHTML = messageHtml('Nicht gefunden', text, { href: 'index.html', text: 'Zur Übersicht' });
}

async function loadField() {
  const { state, fieldNumber } = await api.getField(token);
  T.refresh(state);
  const view = T.buildView(state);
  const field = view.tournament.fields.find((f) => f.number === fieldNumber);
  // Spiel-Tokens sind im öffentlichen Stand nicht enthalten – die Links laufen über das Feld-Token.
  for (const g of view.games) if (g.field === fieldNumber) g.token = `${token}.${g.id}`;
  setTitle(view, field.name);
  app.innerHTML = fieldPage(view, field);
}

let game = null; let fieldToken = null; let values = null;

async function loadGame(afterSave) {
  const { state, gameId, fieldToken: ft } = await api.getGame(token);
  fieldToken = ft;
  T.refresh(state);
  const view = T.buildView(state);
  const gv = view.games.find((g) => g.id === gameId);
  game = state.games.find((g) => g.id === gameId);
  setTitle(view, gv.fieldName);
  if (afterSave) {
    let table = null;
    if (gv.phase === 1) { const grp = view.groups.find((x) => x.id === gv.group); table = { title: `Tabelle ${grp.name}`, rows: grp.table }; }
    else if (gv.phase === 2) { const rd = view.rounds.find((x) => x.id === gv.round); if (rd && rd.table) table = { title: `Tabelle ${rd.name}`, rows: rd.table }; }
    app.innerHTML = savedPage(view, gv, table, { fieldToken });
    document.getElementById('correct').addEventListener('click', () => loadGame(false));
    return;
  }
  const edit = T.refereeCanEdit(state, game);
  app.innerHTML = gamePage(view, gv, { fieldToken, editable: edit.ok, reason: edit.reason, correctionMinutes: T.CORRECTION_MINUTES, values, error: afterSave === null ? null : undefined });
  const form = document.getElementById('resultform');
  if (form) form.addEventListener('submit', onSubmit(view, gv));
}

function onSubmit(view, gv) {
  return async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    values = [0, 1, 2].map((i) => [fd.get(`s${i}a`) ?? '', fd.get(`s${i}b`) ?? '']);
    const btn = e.target.querySelector('button[type=submit]');
    const showError = (msg) => {
      app.innerHTML = gamePage(view, gv, { fieldToken, editable: true, correctionMinutes: T.CORRECTION_MINUTES, values, error: msg });
      document.getElementById('resultform').addEventListener('submit', onSubmit(view, gv));
    };
    let sets;
    try { sets = validateSets(values, game.mode); } catch (err) { showError(err.message); return; }
    btn.disabled = true; btn.textContent = 'Speichere …';
    try {
      await api.submitResult(token, sets);
      await loadGame(true);
    } catch (err) {
      showError(err.message);
    }
  };
}

(async () => {
  try {
    if (!token) { fail('Kein Zugangscode. Bitte den QR-Code am Feld scannen.'); return; }
    if (kind === 'field') await loadField();
    else await loadGame(false);
  } catch (err) {
    fail(err.message);
  }
})();
