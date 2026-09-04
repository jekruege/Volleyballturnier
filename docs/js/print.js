// Druckseiten: print.html?type=qr | feld&n=1 | plan | tabellen
import * as T from '../engine/tournament.js';
import { api } from './api.js';
import { esc, qrPage, fieldSheetPage, planPage, tablesPage } from './render.js';

const app = document.getElementById('app');
const params = new URLSearchParams(location.search);
const type = params.get('type') || 'plan';

async function loadState(needTokens) {
  if (!needTokens) return (await api.getState()).state;
  let pin = sessionStorage.getItem('vt.pin') || '';
  if (!pin) pin = prompt('PIN der Turnierleitung (für die QR-Codes):') || '';
  const { state } = await api.getAdminState(pin);
  sessionStorage.setItem('vt.pin', pin);
  return state;
}

(async () => {
  try {
    const state = await loadState(type === 'qr' || type === 'feld');
    if (!state) { app.innerHTML = '<p>Es ist noch kein Turnier angelegt.</p>'; return; }
    T.refresh(state);
    const view = T.buildView(state);
    for (const g of view.games) { const raw = state.games.find((x) => x.id === g.id); g.token = raw && raw.token; }
    let html = '';
    if (type === 'qr') html = await qrPage(view, state.tournament.fields);
    else if (type === 'feld') {
      const field = state.tournament.fields.find((f) => f.number === Number(params.get('n')));
      if (!field) throw new Error('Feld nicht gefunden.');
      html = await fieldSheetPage(view, field);
    } else if (type === 'tabellen') html = tablesPage(view);
    else html = planPage(view);
    document.title = `${view.tournament.name} – Druck`;
    app.innerHTML = html;
  } catch (err) {
    app.innerHTML = `<p class="error">${esc(err.message)}</p>`;
  }
})();
