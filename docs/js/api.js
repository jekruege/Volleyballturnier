// Backend-Adapter: entweder Supabase (RPC-Funktionen aus supabase/schema.sql)
// oder der lokale Node-Server (server.js), der dieselben Funktionen unter /rpc/<name> anbietet.

const cfg = (typeof window !== 'undefined' && window.VT_CONFIG) || {};
export const usingSupabase = !!(cfg.supabaseUrl && cfg.supabaseKey);

export class ApiError extends Error {
  constructor(message, code) { super(message); this.code = code; }
}

async function rpc(fn, params = {}) {
  let res;
  if (usingSupabase) {
    const url = `${cfg.supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/${fn}`;
    // Neue Supabase-Keys (sb_publishable_…) werden nur im apikey-Header gesendet,
    // alte anon-Keys (JWT, beginnen mit eyJ…) zusätzlich als Bearer-Token.
    const headers = { 'Content-Type': 'application/json', apikey: cfg.supabaseKey };
    if (cfg.supabaseKey.startsWith('eyJ')) headers.Authorization = `Bearer ${cfg.supabaseKey}`;
    res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(params) });
  } else {
    res = await fetch(`./rpc/${fn}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) });
  }
  let data = null;
  const text = await res.text();
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!res.ok) {
    if (!usingSupabase && (res.status === 405 || res.status === 404) && /github\.io$/.test(location.hostname)) {
      throw new ApiError('Keine Datenbank konfiguriert: Bitte Supabase-URL und Publishable Key in docs/config.js eintragen (siehe README, Schritt 2).', 'NO_CONFIG');
    }
    const msg = (data && (data.message || data.error)) || `Fehler ${res.status}`;
    throw new ApiError(msg, data && data.code);
  }
  return data;
}

export const api = {
  pinStatus: () => rpc('vt_pin_status'),
  setAdminPin: (pin) => rpc('vt_set_admin_pin', { pin }),
  changeAdminPin: (oldPin, newPin) => rpc('vt_change_admin_pin', { old_pin: oldPin, new_pin: newPin }),
  login: (pin) => rpc('vt_login', { pin }),
  getState: () => rpc('vt_get_state'),
  getAdminState: (pin) => rpc('vt_get_admin_state', { pin }),
  saveAdminState: (pin, state, expectedVersion) => rpc('vt_save_admin_state', { pin, new_state: state, expected_version: expectedVersion }),
  getGame: (token) => rpc('vt_get_game', { token }),
  getField: (token) => rpc('vt_get_field', { token }),
  submitResult: (token, sets) => rpc('vt_submit_result', { token, sets }),
};

/**
 * Führt eine Änderung der Turnierleitung aus: aktuellen Stand laden, Funktion anwenden,
 * speichern. Bei gleichzeitigen Änderungen (Versionskonflikt) wird automatisch wiederholt.
 * mutate(state) darf den Stand verändern oder einen neuen zurückgeben (null = Turnier löschen).
 */
export async function adminMutate(pin, mutate) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { state, version } = await api.getAdminState(pin);
    const result = mutate(state);
    const next = result === undefined ? state : result;
    try {
      await api.saveAdminState(pin, next, version);
      return next;
    } catch (err) {
      if (!/VERSION_CONFLICT/.test(err.message) || attempt === 3) throw err;
    }
  }
  return undefined;
}
