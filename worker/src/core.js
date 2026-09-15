// Kern des Cloudflare-Backends: hält den Turnierstand im Speicher des Durable Objects,
// schreibt Änderungen in dessen Storage und verwaltet die PIN der Turnierleitung (als Hash).
// Läuft ohne Cloudflare-Abhängigkeiten, damit er in Node getestet werden kann.
import { createRpc, RpcError, runRpc } from '../../src/rpc.js';
import * as T from '../../docs/engine/tournament.js';

const KEY_TOURNAMENT = 'tournament';
const KEY_SETTINGS = 'settings';
const PBKDF2_ITERATIONS = 100000;

const b64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(pin, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
}

/** PIN-Hash im Format pbkdf2$<iterationen>$<salt>$<hash> (Base64). */
export async function hashPin(pin, iterations = PBKDF2_ITERATIONS) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await derive(pin, salt, iterations);
  return `pbkdf2$${iterations}$${b64(salt)}$${b64(bits)}`;
}

export async function verifyPin(pin, stored) {
  if (typeof pin !== 'string' || typeof stored !== 'string') return false;
  const [algo, iterations, salt, hash] = stored.split('$');
  if (algo !== 'pbkdf2' || !salt || !hash) return false;
  const bits = new Uint8Array(await derive(pin, unb64(salt), Number(iterations)));
  const expected = unb64(hash);
  if (bits.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < bits.length; i += 1) diff |= bits[i] ^ expected[i];
  return diff === 0;
}

function checkNewPin(pin) {
  if (typeof pin !== 'string' || pin.length < 4) throw new RpcError('Die PIN muss mindestens 4 Zeichen haben.');
  if (pin.length > 64) throw new RpcError('Die PIN darf höchstens 64 Zeichen haben.');
}

/**
 * storage: { get(key), put(key, value) } (asynchron, z. B. DurableObjectStorage).
 * Alle Aufrufe laufen über handle(name, params) und liefern { status, body }.
 */
export class TournamentCore {
  constructor(storage) {
    this.storage = storage;
    this.state = null;
    this.version = 0;
    this.updatedAt = null;
    this.pinHash = null;
    this.ready = null;
    this.fns = createRpc({ store: this.storeAdapter(), pins: this.pinAdapter() });
  }

  async load() {
    const t = (await this.storage.get(KEY_TOURNAMENT)) || {};
    const s = (await this.storage.get(KEY_SETTINGS)) || {};
    this.state = t.state || null;
    this.version = Number(t.version) || 0;
    this.updatedAt = t.updatedAt || null;
    this.pinHash = s.adminPinHash || null;
    if (this.state) T.refresh(this.state);
  }

  /** Schreibt einen Wert; schlägt das fehl, wird der Speicher beim nächsten Aufruf neu geladen. */
  async put(key, value) {
    try {
      await this.storage.put(key, value);
    } catch (err) {
      this.ready = null;
      throw err;
    }
  }

  storeAdapter() {
    const core = this;
    return {
      get state() { return core.state; },
      get version() { return core.version; },
      get updatedAt() { return core.updatedAt; },
      async save(state) {
        const version = core.version + 1;
        const updatedAt = new Date().toISOString();
        await core.put(KEY_TOURNAMENT, { state, version, updatedAt });
        core.state = state; core.version = version; core.updatedAt = updatedAt;
      },
    };
  }

  pinAdapter() {
    const core = this;
    const store = async (hash) => { await core.put(KEY_SETTINGS, { adminPinHash: hash }); core.pinHash = hash; };
    return {
      status: () => ({ configured: !!core.pinHash }),
      async set(pin) {
        if (core.pinHash) throw new RpcError('Es ist bereits eine PIN gesetzt.');
        checkNewPin(pin);
        const hash = await hashPin(pin);
        if (core.pinHash) throw new RpcError('Es ist bereits eine PIN gesetzt.');
        await store(hash);
        return { ok: true };
      },
      async change(oldPin, newPin) {
        if (!(await this.check(oldPin))) throw new RpcError('Falsche PIN.');
        checkNewPin(newPin);
        await store(await hashPin(newPin));
        return { ok: true };
      },
      check: (pin) => (core.pinHash ? verifyPin(pin, core.pinHash) : false),
    };
  }

  /** Führt eine RPC-Funktion aus: { status, body }. Unerwartete Fehler werden geworfen. */
  async handle(name, params) {
    if (!this.ready) this.ready = this.load().catch((err) => { this.ready = null; throw err; });
    await this.ready;
    return runRpc(this.fns, name, params);
  }
}
