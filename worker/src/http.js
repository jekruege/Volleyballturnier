// HTTP-Schicht des Workers: CORS, Routing von POST /rpc/<name>, Fehlerantworten.
const MAX_BODY = 5 * 1024 * 1024;
const FN_NAME = /^vt_[a-z_]{1,40}$/;

const json = (status, body, headers = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
});

/**
 * CORS-Header für die Anfrage. Ohne ALLOWED_ORIGINS (Umgebungsvariable, kommagetrennt) darf jede
 * Seite den Worker aufrufen – wie beim Supabase-Publishable-Key schützt die PIN, nicht die Herkunft.
 * Liefert null, wenn die Herkunft nicht erlaubt ist.
 */
export function corsHeaders(request, env = {}) {
  const origin = request.headers.get('Origin');
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean);
  const base = {
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
  if (allowed.length === 0) return { ...base, 'Access-Control-Allow-Origin': '*' };
  if (!origin) return base;
  if (!allowed.includes(origin)) return null;
  return { ...base, 'Access-Control-Allow-Origin': origin, Vary: 'Origin' };
}

/**
 * run(name, params) führt die RPC-Funktion aus und liefert { status, body }.
 */
export async function handleRequest(request, env, run) {
  const cors = corsHeaders(request, env);
  if (!cors) return json(403, { message: 'Diese Herkunft ist nicht erlaubt (ALLOWED_ORIGINS).' });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  const url = new URL(request.url);
  if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
    return new Response('Volleyballturnier-Backend läuft. Diese Adresse gehört als apiUrl in docs/config.js.\n', {
      status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8', ...cors },
    });
  }

  const m = url.pathname.match(/^\/rpc\/([^/]+)\/?$/);
  if (!m) return json(404, { message: 'Seite nicht gefunden.' }, cors);
  if (request.method !== 'POST') return json(405, { message: 'Nur POST erlaubt.' }, { ...cors, Allow: 'POST, OPTIONS' });
  const name = m[1];
  if (!FN_NAME.test(name)) return json(404, { message: `Unbekannte Funktion ${name}` }, cors);

  const length = Number(request.headers.get('Content-Length') || 0);
  if (length > MAX_BODY) return json(413, { message: 'Anfrage zu groß.' }, cors);
  let params = {};
  const text = await request.text();
  if (text.length > MAX_BODY) return json(413, { message: 'Anfrage zu groß.' }, cors);
  if (text.trim()) {
    try { params = JSON.parse(text); } catch { return json(400, { message: 'Ungültiges JSON.' }, cors); }
  }
  if (!params || typeof params !== 'object' || Array.isArray(params)) return json(400, { message: 'Ungültige Parameter.' }, cors);

  try {
    const { status, body } = await run(name, params);
    return json(status, body, cors);
  } catch (err) {
    console.error(`RPC ${name} fehlgeschlagen:`, err);
    return json(500, { message: 'Interner Fehler im Backend. Bitte später erneut versuchen.' }, cors);
  }
}
