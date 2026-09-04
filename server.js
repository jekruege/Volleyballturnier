// Lokaler Modus: liefert die Web-App aus docs/ aus und stellt dieselben Funktionen wie das
// Supabase-Schema (supabase/schema.sql) unter POST /rpc/<name> bereit. Daten liegen in einer JSON-Datei.
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { Store } from './src/store.js';
import * as T from './docs/engine/tournament.js';
import { validateSets } from './docs/engine/results.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const ADMIN_PIN = process.env.ADMIN_PIN || '1234';
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data', 'turnier.json');

class RpcError extends Error {}

export function createApp({ store, adminPin = ADMIN_PIN } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '5mb' }));
  app.use(express.static(path.join(__dirname, 'docs')));

  const requirePin = (pin) => { if (typeof pin !== 'string' || !pin || pin !== adminPin) throw new RpcError('Falsche PIN.'); };
  const requireState = () => { if (!store.state) throw new RpcError('Es ist kein Turnier angelegt.'); return store.state; };
  const findGame = (state, token) => {
    if (typeof token !== 'string' || !token) return null;
    const dot = token.indexOf('.');
    if (dot > 0) {
      const field = state.tournament.fields.find((f) => f.token === token.slice(0, dot));
      if (!field) return null;
      const id = token.slice(dot + 1);
      return state.games.find((g) => g.id === id && g.field === field.number) || null;
    }
    return state.games.find((g) => g.token === token) || null;
  };
  const stamp = () => ({ version: store.version, updatedAt: new Date().toISOString() });

  const fns = {
    vt_pin_status: () => ({ configured: true }),
    vt_set_admin_pin: () => { throw new RpcError('Im lokalen Modus wird die PIN über die Umgebungsvariable ADMIN_PIN gesetzt.'); },
    vt_change_admin_pin: () => { throw new RpcError('Im lokalen Modus wird die PIN über die Umgebungsvariable ADMIN_PIN gesetzt.'); },
    vt_login: ({ pin }) => { requirePin(pin); return { ok: true }; },
    vt_get_state: () => ({ state: T.stripTokens(store.state), ...stamp() }),
    vt_get_admin_state: ({ pin }) => { requirePin(pin); return { state: store.state, ...stamp() }; },
    vt_save_admin_state: ({ pin, new_state, expected_version }) => {
      requirePin(pin);
      if (Number(expected_version) !== store.version) throw new RpcError('VERSION_CONFLICT');
      if (new_state !== null) {
        if (!new_state || !Array.isArray(new_state.games) || !Array.isArray(new_state.teams) || !new_state.tournament) throw new RpcError('Ungültiger Turnierstand.');
        T.refresh(new_state);
      }
      store.save(new_state);
      return { version: store.version };
    },
    vt_get_game: ({ token }) => {
      const state = requireState();
      const g = findGame(state, token);
      if (!g) throw new RpcError('Dieses Spiel gibt es nicht (mehr).');
      const field = state.tournament.fields.find((f) => f.number === g.field);
      return { state: T.stripTokens(state), gameId: g.id, fieldToken: field ? field.token : null };
    },
    vt_get_field: ({ token }) => {
      const state = requireState();
      const field = state.tournament.fields.find((f) => f.token === token);
      if (!field) throw new RpcError('Dieses Feld gibt es nicht (mehr).');
      return { state: T.stripTokens(state), fieldNumber: field.number };
    },
    vt_submit_result: ({ token, sets }) => {
      const state = requireState();
      const g = findGame(state, token);
      if (!g) throw new RpcError('Dieses Spiel gibt es nicht (mehr).');
      if (!g.team1Id || !g.team2Id) throw new RpcError('Die Teams dieses Spiels stehen noch nicht fest.');
      const edit = T.refereeCanEdit(state, g);
      if (!edit.ok) throw new RpcError(edit.reason);
      const valid = validateSets(sets, g.mode);
      T.setResult(state, g.id, valid, { by: 'referee' });
      store.save(state);
      return { ok: true, version: store.version };
    },
  };

  app.post('/rpc/:fn', (req, res) => {
    const fn = fns[req.params.fn];
    if (!fn) return res.status(404).json({ message: `Unbekannte Funktion ${req.params.fn}` });
    try {
      return res.json(fn(req.body || {}));
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  });

  app.use((req, res) => res.status(404).send('Seite nicht gefunden. <a href="/">Zur Übersicht</a>'));
  return app;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const store = new Store(DATA_FILE);
  store.load();
  if (store.state) T.refresh(store.state);
  createApp({ store }).listen(PORT, () => {
    console.log(`Volleyballturnier (lokaler Modus) läuft auf http://localhost:${PORT}`);
    console.log(`Admin-Bereich: http://localhost:${PORT}/admin.html  (PIN: ${ADMIN_PIN === '1234' ? '1234 – bitte per ADMIN_PIN ändern!' : 'gesetzt'})`);
    console.log(`Daten: ${DATA_FILE}`);
  });
}
