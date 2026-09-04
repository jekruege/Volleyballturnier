import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createApp } from '../server.js';
import { Store } from '../src/store.js';
import * as T from '../docs/engine/tournament.js';

const NAMES15 = ['Rübenzwerge', 'Häää', 'Die Klein Heidemänner', 'Little Gozillas', 'Kontiki', 'Beachrobben', 'Team Hotte', 'raSand_', 'Rübenriesen', 'Hallenstauballergiker', 'Blockwürstchen', 'Gurkengruppe', 'ImPoSand', 'The Joker', 'Beachparty'];

async function startServer() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vt-'));
  const store = new Store(path.join(dir, 'turnier.json'));
  store.load();
  const app = createApp({ store, adminPin: 'geheim' });
  const server = await new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const rpc = async (fn, params = {}) => {
    const res = await fetch(`${base}/rpc/${fn}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    return data;
  };
  return { rpc, close: () => server.close(), store };
}

test('lokaler RPC-Server: kompletter Ablauf', async () => {
  const { rpc, close, store } = await startServer();
  try {
    assert.deepEqual(await rpc('vt_pin_status'), { configured: true });
    await assert.rejects(rpc('vt_login', { pin: 'falsch' }), /Falsche PIN/);
    assert.deepEqual(await rpc('vt_login', { pin: 'geheim' }), { ok: true });
    let r = await rpc('vt_get_state');
    assert.equal(r.state, null);
    // Turnier anlegen
    const state = T.createTournament({ formatId: 'teams15', name: 'RPC', teams: NAMES15.map((n, i) => ({ name: n, group: 'ABC'[Math.floor(i / 5)] })) });
    await assert.rejects(rpc('vt_save_admin_state', { pin: 'geheim', new_state: state, expected_version: 5 }), /VERSION_CONFLICT/);
    r = await rpc('vt_save_admin_state', { pin: 'geheim', new_state: state, expected_version: 0 });
    assert.equal(r.version, 1);
    // Öffentlich ohne Tokens, Admin mit Tokens
    r = await rpc('vt_get_state');
    assert.ok(r.state.games.every((g) => g.token === undefined));
    assert.ok(r.state.tournament.fields.every((f) => f.token === undefined));
    r = await rpc('vt_get_admin_state', { pin: 'geheim' });
    assert.ok(r.state.games.every((g) => typeof g.token === 'string'));
    const game = r.state.games.find((g) => g.phase === 1);
    const field = r.state.tournament.fields.find((f) => f.number === game.field);
    // Spiel per Token und per Feld-Token.ID
    r = await rpc('vt_get_game', { token: game.token });
    assert.equal(r.gameId, game.id); assert.equal(r.fieldToken, field.token);
    r = await rpc('vt_get_game', { token: `${field.token}.${game.id}` });
    assert.equal(r.gameId, game.id);
    await assert.rejects(rpc('vt_get_game', { token: 'nix' }), /gibt es nicht/);
    r = await rpc('vt_get_field', { token: field.token });
    assert.equal(r.fieldNumber, field.number);
    // Ergebnis
    await assert.rejects(rpc('vt_submit_result', { token: game.token, sets: [[15, 15], [15, 3]] }), /unentschieden/);
    r = await rpc('vt_submit_result', { token: game.token, sets: [[15, 10], [12, 15]] });
    assert.equal(r.ok, true);
    r = await rpc('vt_get_state');
    assert.deepEqual(r.state.games.find((g) => g.id === game.id).sets, [[15, 10], [12, 15]]);
    assert.equal(r.state.games.find((g) => g.id === game.id).enteredBy, 'referee');
    // Phase-2-Spiel: Teams unbekannt
    const p2 = r.state.games.find((g) => g.phase === 2);
    await assert.rejects(rpc('vt_submit_result', { token: `${field.token}.${p2.id}`, sets: [[15, 3], [15, 4]] }), /noch nicht fest/);
    // Admin-Ergebnis sperrt Schiri-Korrektur
    const adminState = (await rpc('vt_get_admin_state', { pin: 'geheim' }));
    T.setResult(adminState.state, game.id, [[21, 19], [21, 17]], { admin: true, by: 'admin' });
    await rpc('vt_save_admin_state', { pin: 'geheim', new_state: adminState.state, expected_version: adminState.version });
    await assert.rejects(rpc('vt_submit_result', { token: game.token, sets: [[15, 10], [12, 15]] }), /Turnierleitung/);
    // Datei-Persistenz
    const reloaded = new Store(store.file); reloaded.load();
    assert.equal(reloaded.state.games.find((g) => g.id === game.id).enteredBy, 'admin');
    assert.equal(reloaded.version, 3);
    // Löschen
    await rpc('vt_save_admin_state', { pin: 'geheim', new_state: null, expected_version: 3 });
    assert.equal((await rpc('vt_get_state')).state, null);
  } finally { close(); }
});
