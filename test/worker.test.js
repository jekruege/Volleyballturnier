import test from 'node:test';
import assert from 'node:assert/strict';
import { TournamentCore, hashPin, verifyPin } from '../worker/src/core.js';
import { handleRequest, corsHeaders } from '../worker/src/http.js';
import * as T from '../docs/engine/tournament.js';

const NAMES15 = ['Rübenzwerge', 'Häää', 'Die Klein Heidemänner', 'Little Gozillas', 'Kontiki', 'Beachrobben', 'Team Hotte', 'raSand_', 'Rübenriesen', 'Hallenstauballergiker', 'Blockwürstchen', 'Gurkengruppe', 'ImPoSand', 'The Joker', 'Beachparty'];

/** Nachbildung von DurableObjectStorage: speichert Kopien (strukturiertes Klonen). */
class FakeStorage {
  constructor() { this.map = new Map(); this.failNext = false; }
  async get(key) { return this.map.has(key) ? structuredClone(this.map.get(key)) : undefined; }
  async put(key, value) {
    if (this.failNext) { this.failNext = false; throw new Error('Storage kaputt'); }
    this.map.set(key, structuredClone(value));
  }
}

function client(core) {
  return async (fn, params = {}) => {
    const { status, body } = await core.handle(fn, params);
    if (status !== 200) throw new Error(body.message);
    return body;
  };
}

test('Worker: PIN-Hash', async () => {
  const h = await hashPin('geheim', 1000);
  assert.match(h, /^pbkdf2\$1000\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
  assert.equal(await verifyPin('geheim', h), true);
  assert.equal(await verifyPin('falsch', h), false);
  assert.equal(await verifyPin('geheim', 'kaputt'), false);
  assert.equal(await verifyPin(undefined, h), false);
});

test('Worker: PIN einrichten, anmelden, ändern', async () => {
  const storage = new FakeStorage();
  const rpc = client(new TournamentCore(storage));
  assert.deepEqual(await rpc('vt_pin_status'), { configured: false });
  await assert.rejects(rpc('vt_login', { pin: 'geheim' }), /Falsche PIN/);
  await assert.rejects(rpc('vt_set_admin_pin', { pin: '123' }), /mindestens 4 Zeichen/);
  await assert.rejects(rpc('vt_set_admin_pin', { pin: 1234 }), /mindestens 4 Zeichen/);
  assert.deepEqual(await rpc('vt_set_admin_pin', { pin: 'geheim' }), { ok: true });
  assert.deepEqual(await rpc('vt_pin_status'), { configured: true });
  await assert.rejects(rpc('vt_set_admin_pin', { pin: 'anders' }), /bereits eine PIN/);
  await assert.rejects(rpc('vt_login', { pin: 'falsch' }), /Falsche PIN/);
  await assert.rejects(rpc('vt_login', {}), /Falsche PIN/);
  assert.deepEqual(await rpc('vt_login', { pin: 'geheim' }), { ok: true });
  await assert.rejects(rpc('vt_change_admin_pin', { old_pin: 'falsch', new_pin: 'neu1234' }), /Falsche PIN/);
  await assert.rejects(rpc('vt_change_admin_pin', { old_pin: 'geheim', new_pin: 'ab' }), /mindestens 4 Zeichen/);
  assert.deepEqual(await rpc('vt_change_admin_pin', { old_pin: 'geheim', new_pin: 'neu1234' }), { ok: true });
  await assert.rejects(rpc('vt_login', { pin: 'geheim' }), /Falsche PIN/);
  assert.deepEqual(await rpc('vt_login', { pin: 'neu1234' }), { ok: true });
  // Hash liegt im Storage, nicht die PIN
  const settings = storage.map.get('settings');
  assert.match(settings.adminPinHash, /^pbkdf2\$/);
  assert.ok(!JSON.stringify(settings).includes('neu1234'));
  // Neues Objekt auf demselben Storage kennt die PIN
  assert.deepEqual(await client(new TournamentCore(storage))('vt_login', { pin: 'neu1234' }), { ok: true });
});

test('Worker: kompletter Ablauf mit Persistenz', async () => {
  const storage = new FakeStorage();
  const rpc = client(new TournamentCore(storage));
  await rpc('vt_set_admin_pin', { pin: 'geheim' });
  let r = await rpc('vt_get_state');
  assert.equal(r.state, null); assert.equal(r.version, 0);
  await assert.rejects(rpc('vt_get_game', { token: 'x' }), /kein Turnier/);
  const state = T.createTournament({ formatId: 'teams15', name: 'RPC', teams: NAMES15.map((n, i) => ({ name: n, group: 'ABC'[Math.floor(i / 5)] })) });
  await assert.rejects(rpc('vt_save_admin_state', { pin: 'falsch', new_state: state, expected_version: 0 }), /Falsche PIN/);
  await assert.rejects(rpc('vt_save_admin_state', { pin: 'geheim', new_state: state, expected_version: 5 }), /VERSION_CONFLICT/);
  await assert.rejects(rpc('vt_save_admin_state', { pin: 'geheim', new_state: { games: 1 }, expected_version: 0 }), /Ungültiger Turnierstand/);
  r = await rpc('vt_save_admin_state', { pin: 'geheim', new_state: state, expected_version: 0 });
  assert.equal(r.version, 1);
  r = await rpc('vt_get_state');
  assert.equal(r.version, 1);
  assert.ok(typeof r.updatedAt === 'string');
  assert.ok(r.state.games.every((g) => g.token === undefined));
  r = await rpc('vt_get_admin_state', { pin: 'geheim' });
  assert.ok(r.state.games.every((g) => typeof g.token === 'string'));
  const game = r.state.games.find((g) => g.phase === 1);
  const field = r.state.tournament.fields.find((f) => f.number === game.field);
  r = await rpc('vt_get_game', { token: `${field.token}.${game.id}` });
  assert.equal(r.gameId, game.id); assert.equal(r.fieldToken, field.token);
  r = await rpc('vt_get_field', { token: field.token });
  assert.equal(r.fieldNumber, field.number);
  await assert.rejects(rpc('vt_submit_result', { token: game.token, sets: [[15, 15], [15, 3]] }), /unentschieden/);
  await assert.rejects(rpc('vt_submit_result', { token: game.token, sets: 'x' }), /Ungültige Eingabe/);
  r = await rpc('vt_submit_result', { token: game.token, sets: [[15, 10], [12, 15]] });
  assert.deepEqual(r, { ok: true, version: 2 });
  // Persistenz: neues Objekt auf demselben Storage sieht Ergebnis und Version
  const rpc2 = client(new TournamentCore(storage));
  r = await rpc2('vt_get_state');
  assert.equal(r.version, 2);
  assert.deepEqual(r.state.games.find((g) => g.id === game.id).sets, [[15, 10], [12, 15]]);
  assert.equal(r.state.games.find((g) => g.id === game.id).enteredBy, 'referee');
  // Löschen
  await rpc2('vt_save_admin_state', { pin: 'geheim', new_state: null, expected_version: 2 });
  assert.equal((await rpc2('vt_get_state')).state, null);
  assert.equal(storage.map.get('tournament').version, 3);
});

test('Worker: fehlgeschlagener Schreibzugriff lädt den Stand neu', async () => {
  const storage = new FakeStorage();
  const core = new TournamentCore(storage);
  const rpc = client(core);
  await rpc('vt_set_admin_pin', { pin: 'geheim' });
  const state = T.createTournament({ formatId: 'teams15', name: 'RPC', teams: NAMES15.map((n, i) => ({ name: n, group: 'ABC'[Math.floor(i / 5)] })) });
  await rpc('vt_save_admin_state', { pin: 'geheim', new_state: state, expected_version: 0 });
  const game = (await rpc('vt_get_admin_state', { pin: 'geheim' })).state.games.find((g) => g.phase === 1);
  storage.failNext = true;
  await assert.rejects(core.handle('vt_submit_result', { token: game.token, sets: [[15, 10], [12, 15]] }), /Storage kaputt/);
  const r = await rpc('vt_get_state');
  assert.equal(r.version, 1);
  assert.ok(!r.state.games.find((g) => g.id === game.id).sets);
});

test('Worker: HTTP-Schicht', async () => {
  const storage = new FakeStorage();
  const core = new TournamentCore(storage);
  const run = (name, params) => core.handle(name, params);
  const call = (method, path, body, headers = {}, env = {}) => handleRequest(new Request(`https://api.example${path}`, { method, body, headers }), env, run);

  let res = await call('OPTIONS', '/rpc/vt_get_state', null, { Origin: 'https://jens.github.io', 'Access-Control-Request-Method': 'POST' });
  assert.equal(res.status, 204);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), '*');
  assert.match(res.headers.get('Access-Control-Allow-Headers'), /Content-Type/);

  res = await call('GET', '/');
  assert.equal(res.status, 200);
  assert.match(await res.text(), /Backend läuft/);
  res = await call('GET', '/health');
  assert.equal(res.status, 200);
  const assets = { fetch: async (req) => new Response(`asset ${new URL(req.url).pathname}`) };
  res = await call('GET', '/', null, {}, { ASSETS: assets });
  assert.equal(await res.text(), 'asset /index.html');
  res = await call('GET', '/config.js');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('Content-Type'), /javascript/);
  assert.match(await res.text(), /apiUrl: ""/);

  res = await call('POST', '/rpc/vt_pin_status', '{}', { 'Content-Type': 'application/json', Origin: 'https://jens.github.io' });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), '*');
  assert.equal(res.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await res.json(), { configured: false });

  res = await call('POST', '/rpc/vt_pin_status'); // ohne Body
  assert.equal(res.status, 200);
  res = await call('POST', '/rpc/vt_login', '{"pin":"x"}');
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { message: 'Falsche PIN.' });
  res = await call('POST', '/rpc/vt_login', '{kaputt');
  assert.equal(res.status, 400);
  assert.match((await res.json()).message, /JSON/);
  res = await call('POST', '/rpc/vt_login', '[1]');
  assert.equal(res.status, 400);
  res = await call('POST', '/rpc/vt_gibt_es_nicht', '{}');
  assert.equal(res.status, 404);
  res = await call('POST', '/rpc/../etc', '{}');
  assert.equal(res.status, 404);
  res = await call('GET', '/rpc/vt_get_state');
  assert.equal(res.status, 405);
  res = await call('GET', '/irgendwas');
  assert.equal(res.status, 404);

  // Unerwarteter Fehler → 500 ohne Details
  const origError = console.error; console.error = () => {};
  let boom;
  try { boom = await handleRequest(new Request('https://api.example/rpc/vt_get_state', { method: 'POST' }), {}, () => { throw new Error('intern'); }); } finally { console.error = origError; }
  assert.equal(boom.status, 500);
  assert.ok(!(await boom.text()).includes('intern'));

  // Herkunft einschränken
  const env = { ALLOWED_ORIGINS: 'https://jens.github.io/, http://localhost:3000' };
  res = await call('POST', '/rpc/vt_pin_status', '{}', { Origin: 'https://jens.github.io' }, env);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'https://jens.github.io');
  assert.equal(res.headers.get('Vary'), 'Origin');
  res = await call('POST', '/rpc/vt_pin_status', '{}', { Origin: 'https://boese.example' }, env);
  assert.equal(res.status, 403);
  res = await call('POST', '/rpc/vt_pin_status', '{}', {}, env); // ohne Origin (kein Browser)
  assert.equal(res.status, 200);
  assert.equal(corsHeaders(new Request('https://api.example/'), env)['Access-Control-Allow-Origin'], undefined);
});
