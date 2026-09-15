// Lokaler Modus: liefert die Web-App aus docs/ aus und stellt dieselben Funktionen wie das
// Supabase-Schema (supabase/schema.sql) unter POST /rpc/<name> bereit. Daten liegen in einer JSON-Datei.
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { Store } from './src/store.js';
import { createRpc, fixedPins, runRpc } from './src/rpc.js';
import * as T from './docs/engine/tournament.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const ADMIN_PIN = process.env.ADMIN_PIN || '1234';
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data', 'turnier.json');

export function createApp({ store, adminPin = ADMIN_PIN } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '5mb' }));
  // Im lokalen Modus spricht die App mit diesem Server – auch wenn in docs/config.js
  // Supabase- oder Worker-Werte stehen (abschaltbar mit SUPABASE_CONFIG=1).
  if (process.env.SUPABASE_CONFIG !== '1') {
    app.get('/config.js', (req, res) => res.type('js').send('window.VT_CONFIG = { apiUrl: "", supabaseUrl: "", supabaseKey: "" };\n'));
  }
  app.use(express.static(path.join(__dirname, 'docs')));

  const fns = createRpc({ store, pins: fixedPins(adminPin) });
  app.post('/rpc/:fn', async (req, res, next) => {
    try {
      const { status, body } = await runRpc(fns, req.params.fn, req.body);
      res.status(status).json(body);
    } catch (err) { next(err); }
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
