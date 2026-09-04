'use strict';
const path = require('path');
const express = require('express');
const { Store } = require('./src/store');
const T = require('./src/tournament');
const { listFormats } = require('./src/formats');
const { validateSets, ResultError } = require('./src/results');
const views = require('./src/views');

const PORT = Number(process.env.PORT) || 3000;
const ADMIN_PIN = process.env.ADMIN_PIN || '1234';
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data', 'turnier.json');
const CORRECTION_MINUTES = Number(process.env.CORRECTION_MINUTES) || 15;

function createApp({ store, adminPin = ADMIN_PIN, publicUrl = process.env.PUBLIC_URL } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: false }));
  app.use(express.static(path.join(__dirname, 'public'), { index: false }));

  const state = () => store.state;
  const save = () => store.save(store.state);
  const view = () => T.buildView(store.state);
  const baseUrl = (req) => (publicUrl || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');

  // ---------------------------------------------------------------- Admin-Auth
  const isAdmin = (req) => {
    const pin = req.get('x-admin-pin') || (req.body && req.body.pin) || req.query.pin;
    return typeof pin === 'string' && pin.length > 0 && pin === adminPin;
  };
  const requireAdmin = (req, res, next) => {
    if (!isAdmin(req)) return res.status(401).json({ error: 'Falsche PIN.' });
    return next();
  };
  const requireTournament = (req, res, next) => {
    if (!state()) return res.status(404).json({ error: 'Es ist noch kein Turnier angelegt.' });
    return next();
  };
  const handle = (fn) => async (req, res) => {
    try { await fn(req, res); } catch (err) {
      const status = err instanceof ResultError ? 400 : (err.status || 400);
      res.status(status).json({ error: err.message });
    }
  };

  // ---------------------------------------------------------------- Seiten
  app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
  app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

  // ---------------------------------------------------------------- Öffentliche API
  app.get('/api/view', (req, res) => {
    if (!state()) return res.json({ empty: true, formats: listFormats() });
    return res.json(view());
  });

  // ---------------------------------------------------------------- Admin-API
  app.post('/api/admin/login', (req, res) => {
    if (!isAdmin(req)) return res.status(401).json({ error: 'Falsche PIN.' });
    return res.json({ ok: true, hasTournament: !!state() });
  });
  app.get('/api/admin/formats', requireAdmin, (req, res) => res.json(listFormats()));

  app.post('/api/admin/setup', requireAdmin, handle((req, res) => {
    if (state() && state().games.some((g) => g.sets) && !req.body.force) {
      throw new Error('Es liegen bereits Ergebnisse vor. Zum Neuanlegen zuerst das Turnier zurücksetzen.');
    }
    const s = T.createTournament(req.body);
    store.save(s);
    res.json(view());
  }));

  app.post('/api/admin/settings', requireAdmin, requireTournament, handle((req, res) => {
    const s = state();
    const b = req.body || {};
    if (b.name !== undefined) s.tournament.name = String(b.name).trim() || s.tournament.name;
    if (b.date !== undefined) s.tournament.date = String(b.date).trim();
    if (b.startTime !== undefined && /^\d{1,2}:\d{2}$/.test(b.startTime)) s.tournament.startTime = b.startTime;
    if (b.slotMinutes !== undefined && Number(b.slotMinutes) >= 5) s.tournament.slotMinutes = Number(b.slotMinutes);
    if (Array.isArray(b.fieldNames)) s.tournament.fields.forEach((f, i) => { if (b.fieldNames[i]) f.name = String(b.fieldNames[i]).trim(); });
    save();
    res.json(view());
  }));

  app.post('/api/admin/team', requireAdmin, requireTournament, handle((req, res) => {
    const s = state();
    const t = s.teams.find((x) => x.id === req.body.teamId);
    if (!t) throw new Error('Team nicht gefunden.');
    const name = String(req.body.name ?? t.name).trim();
    if (!name) throw new Error('Name darf nicht leer sein.');
    if (s.teams.some((x) => x.id !== t.id && x.name.toLowerCase() === name.toLowerCase())) throw new Error('Teamname bereits vergeben.');
    t.name = name;
    if (req.body.club !== undefined) t.club = String(req.body.club).trim();
    if (req.body.contact !== undefined) t.contact = String(req.body.contact).trim();
    save();
    res.json(view());
  }));

  app.post('/api/admin/result', requireAdmin, requireTournament, handle((req, res) => {
    const g = T.gameById(state(), req.body.gameId);
    if (!g) throw new Error('Spiel nicht gefunden.');
    const sets = validateSets(req.body.sets, g.mode);
    T.setResult(state(), g.id, sets, { admin: true, by: 'admin' });
    save();
    res.json(view());
  }));

  app.delete('/api/admin/result/:gameId', requireAdmin, requireTournament, handle((req, res) => {
    T.clearResult(state(), req.params.gameId);
    save();
    res.json(view());
  }));

  app.post('/api/admin/referee', requireAdmin, requireTournament, handle((req, res) => {
    T.setReferee(state(), req.body.gameId, req.body.refereeId ?? null);
    save();
    res.json(view());
  }));

  app.post('/api/admin/referees/reset', requireAdmin, requireTournament, handle((req, res) => {
    T.resetReferees(state(), req.body.phase ? Number(req.body.phase) : undefined);
    save();
    res.json(view());
  }));

  app.get('/api/admin/placements/:phase', requireAdmin, requireTournament, handle((req, res) => {
    res.json(T.proposePlacements(state(), Number(req.params.phase)));
  }));

  app.post('/api/admin/phase1/confirm', requireAdmin, requireTournament, handle((req, res) => {
    T.confirmPhase1(state(), req.body.placements); save(); res.json(view());
  }));
  app.post('/api/admin/phase1/reopen', requireAdmin, requireTournament, handle((req, res) => {
    T.reopenPhase1(state()); save(); res.json(view());
  }));
  app.post('/api/admin/phase2/confirm', requireAdmin, requireTournament, handle((req, res) => {
    T.confirmPhase2(state(), req.body.placements); save(); res.json(view());
  }));
  app.post('/api/admin/phase2/reopen', requireAdmin, requireTournament, handle((req, res) => {
    T.reopenPhase2(state()); save(); res.json(view());
  }));

  app.get('/api/admin/export', requireAdmin, requireTournament, (req, res) => {
    res.setHeader('Content-Disposition', `attachment; filename="turnier-${new Date().toISOString().slice(0, 10)}.json"`);
    res.json(state());
  });
  app.post('/api/admin/import', requireAdmin, handle((req, res) => {
    const s = req.body.state;
    if (!s || !Array.isArray(s.games) || !Array.isArray(s.teams) || !s.tournament) throw new Error('Ungültige Sicherungsdatei.');
    T.refresh(s);
    store.save(s);
    res.json(view());
  }));
  app.post('/api/admin/reset', requireAdmin, handle((req, res) => {
    if (req.body.confirm !== 'LÖSCHEN') throw new Error('Bitte zur Bestätigung LÖSCHEN eingeben.');
    store.clear();
    res.json({ ok: true });
  }));

  // ---------------------------------------------------------------- Schiedsrichter (QR)
  const findGameByToken = (tok) => state() && state().games.find((g) => g.token === tok);
  const findFieldByToken = (tok) => state() && state().tournament.fields.find((f) => f.token === tok);
  const fieldTokenFor = (g) => { const f = state().tournament.fields.find((x) => x.number === g.field); return f ? f.token : null; };
  const canEdit = (g) => !g.sets || (g.enteredBy !== 'admin' && g.enteredAt && (Date.now() - Date.parse(g.enteredAt)) < CORRECTION_MINUTES * 60 * 1000);
  const phaseLocked = (g) => (g.phase === 1 && state().phase > 1) || (g.phase === 2 && state().phase > 2);

  app.get('/f/:token', (req, res) => {
    const field = findFieldByToken(req.params.token);
    if (!field) return res.status(404).send(views.messagePage('Nicht gefunden', 'Dieses Feld gibt es nicht (mehr). Bitte QR-Code der Turnierleitung verwenden.', { href: '/', text: 'Zur Übersicht' }));
    return res.send(views.fieldPage(view(), field));
  });

  app.get('/g/:token', (req, res) => {
    const g = findGameByToken(req.params.token);
    if (!g) return res.status(404).send(views.messagePage('Nicht gefunden', 'Dieses Spiel gibt es nicht (mehr). Bitte QR-Code der Turnierleitung verwenden.', { href: '/', text: 'Zur Übersicht' }));
    const gv = T.gameView(state(), g);
    return res.send(views.gamePage(view(), gv, { fieldToken: fieldTokenFor(g), editable: canEdit(g) && !phaseLocked(g), correctionMinutes: CORRECTION_MINUTES }));
  });

  app.post('/g/:token', (req, res) => {
    const g = findGameByToken(req.params.token);
    if (!g) return res.status(404).send(views.messagePage('Nicht gefunden', 'Dieses Spiel gibt es nicht (mehr).', { href: '/', text: 'Zur Übersicht' }));
    const b = req.body || {};
    const raw = [0, 1, 2].map((i) => [b[`s${i}a`], b[`s${i}b`]]);
    const opts = { fieldToken: fieldTokenFor(g), editable: true, correctionMinutes: CORRECTION_MINUTES, values: raw };
    if (!canEdit(g) || phaseLocked(g)) {
      return res.status(403).send(views.gamePage(view(), T.gameView(state(), g), { ...opts, editable: false, error: 'Dieses Ergebnis kann nur noch von der Turnierleitung geändert werden.' }));
    }
    if (!b.confirm) return res.status(400).send(views.gamePage(view(), T.gameView(state(), g), { ...opts, error: 'Bitte bestätigen, dass beide Teams das Ergebnis kennen.' }));
    try {
      const sets = validateSets(raw, g.mode);
      T.setResult(state(), g.id, sets, { by: 'referee' });
      save();
    } catch (err) {
      return res.status(400).send(views.gamePage(view(), T.gameView(state(), g), { ...opts, error: err.message }));
    }
    const v = view();
    const gv = v.games.find((x) => x.id === g.id);
    let table = null;
    if (g.phase === 1) { const grp = v.groups.find((x) => x.id === g.group); table = { title: `Tabelle ${grp.name}`, rows: grp.table }; }
    else if (g.phase === 2) { const rd = v.rounds.find((x) => x.id === g.round); if (rd && rd.table) table = { title: `Tabelle ${rd.name}`, rows: rd.table }; }
    return res.send(views.savedPage(v, gv, table, { fieldToken: fieldTokenFor(g) }));
  });

  // ---------------------------------------------------------------- Druckseiten
  const requireTournamentPage = (req, res, next) => {
    if (!state()) return res.status(404).send(views.messagePage('Kein Turnier', 'Es ist noch kein Turnier angelegt.', { href: '/admin', text: 'Zum Admin-Bereich' }));
    return next();
  };
  app.get('/print/qr', requireTournamentPage, async (req, res) => res.send(await views.qrPage(view(), state(), baseUrl(req))));
  app.get('/print/feld/:n', requireTournamentPage, async (req, res) => {
    const field = state().tournament.fields.find((f) => f.number === Number(req.params.n));
    if (!field) return res.status(404).send(views.messagePage('Nicht gefunden', 'Feld nicht gefunden.'));
    return res.send(await views.fieldSheetPage(view(), state(), field, baseUrl(req)));
  });
  app.get('/print/plan', requireTournamentPage, (req, res) => res.send(views.planPage(view())));
  app.get('/print/tabellen', requireTournamentPage, (req, res) => res.send(views.tablesPage(view())));

  app.use((req, res) => res.status(404).send(views.messagePage('Seite nicht gefunden', 'Diese Seite gibt es nicht.', { href: '/', text: 'Zur Übersicht' })));
  return app;
}

if (require.main === module) {
  const store = new Store(DATA_FILE);
  store.load();
  if (store.state) { T.refresh(store.state); }
  const app = createApp({ store });
  app.listen(PORT, () => {
    console.log(`Volleyballturnier läuft auf http://localhost:${PORT}`);
    console.log(`Admin-Bereich: http://localhost:${PORT}/admin  (PIN: ${ADMIN_PIN === '1234' ? '1234 – bitte per ADMIN_PIN ändern!' : 'gesetzt'})`);
    console.log(`Daten: ${DATA_FILE}`);
  });
}

module.exports = { createApp };
