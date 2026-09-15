// Gemeinsame RPC-Funktionen für den lokalen Node-Server (server.js) und den Cloudflare Worker
// (worker/). Sie entsprechen den SQL-Funktionen in supabase/schema.sql.
//
// store: { state, version, updatedAt?, save(state) }  – save darf ein Promise zurückgeben
// pins:  { status(), set(pin), change(oldPin, newPin), check(pin) } – alle dürfen Promises zurückgeben
import * as T from '../docs/engine/tournament.js';
import { validateSets, ResultError } from '../docs/engine/results.js';

/** Fehler, der als Meldung an die Web-App zurückgeht (HTTP 400). */
export class RpcError extends Error {}

export function createRpc({ store, pins }) {
  const requirePin = async (pin) => { if (typeof pin !== 'string' || !pin || !(await pins.check(pin))) throw new RpcError('Falsche PIN.'); };
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
  const stamp = () => ({ version: store.version, updatedAt: store.updatedAt || new Date().toISOString() });

  return {
    vt_pin_status: () => pins.status(),
    vt_set_admin_pin: ({ pin }) => pins.set(pin),
    vt_change_admin_pin: ({ old_pin, new_pin }) => pins.change(old_pin, new_pin),
    vt_login: async ({ pin }) => { await requirePin(pin); return { ok: true }; },
    vt_get_state: () => ({ state: T.stripTokens(store.state), ...stamp() }),
    vt_get_admin_state: async ({ pin }) => { await requirePin(pin); return { state: store.state, ...stamp() }; },
    vt_save_admin_state: async ({ pin, new_state, expected_version }) => {
      await requirePin(pin);
      if (Number(expected_version) !== store.version) throw new RpcError('VERSION_CONFLICT');
      if (new_state !== null) {
        if (!new_state || !Array.isArray(new_state.games) || !Array.isArray(new_state.teams) || !new_state.tournament) throw new RpcError('Ungültiger Turnierstand.');
        try { T.refresh(new_state); } catch (err) { throw new RpcError(`Ungültiger Turnierstand: ${err.message}`); }
      }
      await store.save(new_state);
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
    vt_submit_result: async ({ token, sets }) => {
      const state = requireState();
      const g = findGame(state, token);
      if (!g) throw new RpcError('Dieses Spiel gibt es nicht (mehr).');
      if (!g.team1Id || !g.team2Id) throw new RpcError('Die Teams dieses Spiels stehen noch nicht fest.');
      const edit = T.refereeCanEdit(state, g);
      if (!edit.ok) throw new RpcError(edit.reason);
      let valid;
      try { valid = validateSets(sets, g.mode); } catch (err) { if (err instanceof ResultError) throw new RpcError(err.message); throw err; }
      T.setResult(state, g.id, valid, { by: 'referee' });
      await store.save(state);
      return { ok: true, version: store.version };
    },
  };
}

/** PIN-Verwaltung des lokalen Servers: feste PIN aus der Umgebung, nicht änderbar. */
export function fixedPins(adminPin) {
  const fixed = () => { throw new RpcError('Im lokalen Modus wird die PIN über die Umgebungsvariable ADMIN_PIN gesetzt.'); };
  return {
    status: () => ({ configured: true }),
    set: fixed,
    change: fixed,
    check: (pin) => pin === adminPin,
  };
}

/** Führt eine RPC-Funktion aus und liefert { status, body } für die HTTP-Antwort. */
export async function runRpc(fns, name, params) {
  const fn = fns[name];
  if (!fn) return { status: 404, body: { message: `Unbekannte Funktion ${name}` } };
  try {
    return { status: 200, body: await fn(params && typeof params === 'object' ? params : {}) };
  } catch (err) {
    if (err instanceof RpcError) return { status: 400, body: { message: err.message } };
    throw err;
  }
}
