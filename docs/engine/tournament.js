import { getFormat } from './formats/index.js';
import { computeStandings, cmpBasic } from './standings.js';
import { evaluate, formatSets } from './results.js';
import { assignSlots, assignRefereesForSlot } from './scheduler.js';

const KO_LABELS = ['Halbfinale 1', 'Halbfinale 2', 'Finale', 'Spiel um Platz 3'];

function token(len = 10) {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = new Uint8Array(len);
  globalThis.crypto.getRandomValues(bytes);
  let s = '';
  for (let i = 0; i < len; i += 1) s += alphabet[bytes[i] % alphabet.length];
  return s;
}

function pad(n) { return String(n).padStart(2, '0'); }

const fmtMin = (t) => `${pad(Math.floor(((t % 1440) + 1440) % 1440 / 60))}:${pad(((t % 60) + 60) % 60)}`;

/** Dauer eines Zeitfensters (Standard oder individuell gesetzt). */
function slotDuration(tournament, slot) {
  const d = tournament.slotDurations && tournament.slotDurations[slot];
  return Number(d) > 0 ? Number(d) : tournament.slotMinutes;
}

/** Pausen/Verschiebungen nach einem Zeitfenster: [{ afterSlot, minutes, label }]. */
function breaksAfter(tournament, slot) {
  return (tournament.breaks || []).filter((b) => Number(b.afterSlot) === slot);
}

function slotStartMinutes(tournament, slot) {
  const [h, m] = (tournament.startTime || '11:00').split(':').map(Number);
  let t = h * 60 + m;
  for (let s = 1; s < slot; s += 1) {
    t += slotDuration(tournament, s);
    for (const b of breaksAfter(tournament, s)) t += Number(b.minutes) || 0;
  }
  return t;
}

/** Zeitfenster mit Start/Ende sowie den Pausen danach (nur benannte Pausen werden angezeigt). */
function slotTime(tournament, slot) {
  const start = slotStartMinutes(tournament, slot);
  const duration = slotDuration(tournament, slot);
  const end = start + duration;
  let cursor = end;
  const breaks = breaksAfter(tournament, slot).map((b) => {
    const minutes = Number(b.minutes) || 0;
    const item = { afterSlot: slot, minutes, label: b.label || '', start: fmtMin(cursor), end: fmtMin(cursor + Math.max(0, minutes)), visible: !!b.label && minutes > 0 };
    cursor += minutes;
    return item;
  });
  return { start: fmtMin(start), end: fmtMin(end), label: `${fmtMin(start)} – ${fmtMin(end)}`, duration, breaks };
}

/** Pausen/Verschiebungen und individuelle Dauern setzen (Turnierleitung). */
function setSchedule(state, { breaks, slotDurations, startTime, slotMinutes }) {
  const t = state.tournament;
  const maxSlot = Math.max(...state.games.map((g) => g.slot));
  if (startTime !== undefined) {
    if (!/^\d{1,2}:\d{2}$/.test(startTime)) throw new Error('Startzeit im Format HH:MM angeben.');
    t.startTime = startTime;
  }
  if (slotMinutes !== undefined) {
    if (!(Number(slotMinutes) >= 5)) throw new Error('Die Spieldauer muss mindestens 5 Minuten betragen.');
    t.slotMinutes = Number(slotMinutes);
  }
  if (breaks !== undefined) {
    const list = [];
    for (const b of breaks || []) {
      const afterSlot = Number(b.afterSlot); const minutes = Number(b.minutes);
      if (!Number.isInteger(afterSlot) || afterSlot < 1 || afterSlot > maxSlot) throw new Error(`Ungültiges Zeitfenster für eine Pause: ${b.afterSlot}`);
      if (!Number.isInteger(minutes) || minutes === 0 || Math.abs(minutes) > 600) throw new Error('Pausenlänge in ganzen Minuten angeben (ungleich 0).');
      const label = String(b.label || '').trim();
      if (label && minutes < 0) throw new Error('Eine benannte Pause kann nicht negativ sein. Für Verkürzungen den Namen leer lassen.');
      list.push({ afterSlot, minutes, label });
    }
    list.sort((a, b) => a.afterSlot - b.afterSlot);
    t.breaks = list;
  }
  if (slotDurations !== undefined) {
    const out = {};
    for (const [k, v] of Object.entries(slotDurations || {})) {
      const slot = Number(k); const min = Number(v);
      if (!Number.isInteger(slot) || slot < 1 || slot > maxSlot) continue;
      if (!v || min === t.slotMinutes) continue;
      if (!(min >= 5)) throw new Error(`Zeitfenster ${slot}: Dauer muss mindestens 5 Minuten betragen.`);
      out[slot] = min;
    }
    t.slotDurations = out;
  }
  logEvent(state, 'schedule_changed', {});
}

// ---------------------------------------------------------------------------
// Erzeugung

function createTournament(config) {
  const format = getFormat(config.formatId);
  const teamsIn = (config.teams || []).map((t) => ({
    name: String(t.name || '').trim(), club: String(t.club || '').trim(),
    contact: String(t.contact || '').trim(), group: String(t.group || '').trim().toUpperCase(),
  }));
  if (teamsIn.length !== format.teamCount) {
    throw new Error(`Das Format benötigt genau ${format.teamCount} Teams (eingetragen: ${teamsIn.length}).`);
  }
  const names = new Set();
  for (const t of teamsIn) {
    if (!t.name) throw new Error('Jedes Team braucht einen Namen.');
    const key = t.name.toLowerCase();
    if (names.has(key)) throw new Error(`Teamname doppelt: ${t.name}`);
    names.add(key);
  }
  for (const g of format.groups) {
    const n = teamsIn.filter((t) => t.group === g.id).length;
    if (n !== g.size) throw new Error(`${g.name} braucht ${g.size} Teams (eingetragen: ${n}).`);
  }

  const teams = [];
  const byGroupPos = new Map();
  for (const g of format.groups) {
    teamsIn.filter((t) => t.group === g.id).forEach((t, idx) => {
      const team = { id: `t${teams.length + 1}`, ...t, pos: idx + 1 };
      teams.push(team);
      byGroupPos.set(`${g.id}:${idx + 1}`, team.id);
    });
  }

  const fieldCount = format.fieldCount;
  const fieldNames = Array.from({ length: fieldCount }, (_, i) => (config.fieldNames && config.fieldNames[i]) || `Feld ${i + 1}`);
  const tournament = {
    id: token(8),
    name: config.name || 'Volleyballturnier',
    date: config.date || '',
    startTime: config.startTime || '11:00',
    slotMinutes: Number(config.slotMinutes) || 30,
    formatId: format.id,
    fields: fieldNames.map((name, i) => ({ number: i + 1, name, token: token(8) })),
    createdAt: new Date().toISOString(),
  };

  const games = [];
  // Phase 1
  const counters = {};
  for (const slotDef of format.phase1.slots) {
    for (const gd of slotDef.games) {
      counters[gd.group] = (counters[gd.group] || 0) + 1;
      games.push({
        id: `p1-${gd.group}-${counters[gd.group]}`,
        token: token(),
        phase: 1, group: gd.group, round: null,
        label: `Gruppe ${gd.group}`, sublabel: `Spiel ${counters[gd.group]}`,
        mode: 'roundrobin',
        slot: slotDef.slot, field: gd.field,
        team1Ref: gd.team1, team2Ref: gd.team2,
        team1Id: byGroupPos.get(`${gd.team1.group}:${gd.team1.pos}`),
        team2Id: byGroupPos.get(`${gd.team2.group}:${gd.team2.pos}`),
        sets: null, refereeId: null,
      });
    }
  }
  const lastPhase1Slot = Math.max(...games.map((g) => g.slot));

  // Phase 2
  const phase2 = [];
  for (const round of format.phase2.rounds) {
    const seed = (i) => ({ type: 'placement', group: round.seeds[i].group, place: round.seeds[i].place });
    if (round.type === 'roundrobin') {
      const pairs = [[0, 1], [0, 2], [1, 2]];
      pairs.forEach(([a, b], i) => phase2.push({
        id: `p2-${round.id}-${i + 1}`, token: token(), phase: 2, group: null, round: round.id,
        label: round.name, sublabel: `Spiel ${i + 1}`, mode: 'roundrobin', order: i,
        team1Ref: seed(a), team2Ref: seed(b), deps: [], sets: null, refereeId: null,
      }));
    } else if (round.type === 'ko4') {
      const hf1 = `p2-${round.id}-1`; const hf2 = `p2-${round.id}-2`;
      const defs = [
        { id: hf1, team1Ref: seed(0), team2Ref: seed(3), deps: [] },
        { id: hf2, team1Ref: seed(1), team2Ref: seed(2), deps: [] },
        { id: `p2-${round.id}-3`, team1Ref: { type: 'winner', game: hf1 }, team2Ref: { type: 'winner', game: hf2 }, deps: [hf1, hf2] },
        { id: `p2-${round.id}-4`, team1Ref: { type: 'loser', game: hf1 }, team2Ref: { type: 'loser', game: hf2 }, deps: [hf1, hf2] },
      ];
      defs.forEach((d, i) => phase2.push({
        ...d, token: token(), phase: 2, group: null, round: round.id, label: round.name, sublabel: KO_LABELS[i],
        mode: 'ko', order: i, sets: null, refereeId: null,
      }));
    } else {
      throw new Error(`Unbekannter Rundentyp ${round.type}`);
    }
  }
  // Phase 3
  const phase3 = format.phase3.games.map((gd, i) => {
    const rounds = new Set([gd.team1.round, gd.team2.round]);
    return {
      id: `p3-${gd.id}`, token: token(), phase: 3, group: null, round: null, finalId: gd.id,
      label: gd.name, sublabel: '', mode: 'ko', order: i,
      team1Ref: gd.team1, team2Ref: gd.team2,
      deps: phase2.filter((g) => rounds.has(g.round)).map((g) => g.id),
      sets: null, refereeId: null,
    };
  });
  assignSlots([...phase2, ...phase3], lastPhase1Slot + 1, fieldCount, format.phase2.rounds.map((r) => r.id));
  for (const g of [...phase2, ...phase3]) { delete g.deps; delete g.order; }
  games.push(...phase2, ...phase3);

  const state = {
    version: 1,
    tournament, teams, games,
    phase: 1,
    placements: { phase1: {}, phase2: {} },
    log: [],
  };
  refresh(state);
  return state;
}

// ---------------------------------------------------------------------------
// Auflösung der Team-Referenzen

function roundDef(state, roundId) {
  return getFormat(state.tournament.formatId).phase2.rounds.find((r) => r.id === roundId);
}

function gameById(state, id) {
  return state.games.find((g) => g.id === id);
}

function koRoundPlace(state, roundId, place) {
  const finale = gameById(state, `p2-${roundId}-3`);
  const p3 = gameById(state, `p2-${roundId}-4`);
  const src = place <= 2 ? finale : p3;
  if (!src) return null;
  const r = evaluate(src);
  if (!r || !src.team1Id || !src.team2Id || r.winner === 0) return null;
  const winner = r.winner === 1 ? src.team1Id : src.team2Id;
  const loser = r.winner === 1 ? src.team2Id : src.team1Id;
  return (place === 1 || place === 3) ? winner : loser;
}

function resolveRef(state, ref) {
  if (!ref) return null;
  switch (ref.type) {
    case 'group': {
      const t = state.teams.find((x) => x.group === ref.group && x.pos === ref.pos);
      return t ? t.id : null;
    }
    case 'placement': {
      const list = state.placements.phase1[ref.group];
      return list ? list[ref.place - 1] || null : null;
    }
    case 'winner':
    case 'loser': {
      const g = gameById(state, ref.game);
      if (!g || !g.team1Id || !g.team2Id) return null;
      const r = evaluate(g);
      if (!r || r.winner === 0) return null;
      const w = r.winner === 1 ? g.team1Id : g.team2Id;
      const l = r.winner === 1 ? g.team2Id : g.team1Id;
      return ref.type === 'winner' ? w : l;
    }
    case 'roundPlace': {
      const rd = roundDef(state, ref.round);
      if (!rd) return null;
      if (rd.type === 'ko4') return koRoundPlace(state, ref.round, ref.place);
      const list = state.placements.phase2[ref.round];
      return list ? list[ref.place - 1] || null : null;
    }
    default:
      return null;
  }
}

function refLabel(state, ref) {
  if (!ref) return '?';
  const fmt = getFormat(state.tournament.formatId);
  switch (ref.type) {
    case 'group': return `${ref.group}${ref.pos}`;
    case 'placement': return `${ref.place}. Gruppe ${ref.group}`;
    case 'winner': case 'loser': {
      const g = gameById(state, ref.game);
      return `${ref.type === 'winner' ? 'Sieger' : 'Verlierer'} ${g ? g.sublabel : ref.game}`;
    }
    case 'roundPlace': {
      const rd = fmt.phase2.rounds.find((r) => r.id === ref.round);
      return `${ref.place}. ${rd ? rd.name : ref.round}`;
    }
    default: return '?';
  }
}

/** Löst Team-Referenzen auf und friert Schiedsrichter ein. Nach jeder Änderung aufrufen. */
function refresh(state) {
  // Phasen 2/3 hängen von Ergebnissen ab – mehrfach durchlaufen, bis stabil.
  for (let iter = 0; iter < 5; iter += 1) {
    let changed = false;
    for (const g of state.games) {
      if (g.phase === 1) continue;
      const t1 = resolveRef(state, g.team1Ref);
      const t2 = resolveRef(state, g.team2Ref);
      if (t1 !== (g.team1Id || null) || t2 !== (g.team2Id || null)) changed = true;
      g.team1Id = t1; g.team2Id = t2;
    }
    if (!changed) break;
  }
  freezeReferees(state);
  return state;
}

// ---------------------------------------------------------------------------
// Schiedsrichter

function teamRoundMap(state) {
  const m = new Map();
  for (const g of state.games) {
    if (g.phase !== 2 || !g.round) continue;
    if (g.team1Id) m.set(g.team1Id, g.round);
    if (g.team2Id) m.set(g.team2Id, g.round);
  }
  return m;
}

function freezeReferees(state) {
  const slots = [...new Set(state.games.map((g) => g.slot))].sort((a, b) => a - b);
  const refCount = new Map();
  const roundOfTeam = teamRoundMap(state);
  const sameUnit = (t, g) => (g.phase === 1 ? t.group === g.group : g.phase === 2 && roundOfTeam.get(t.id) === g.round);
  const newlyAssigned = [];
  let prevPlayers = new Set();
  for (const slot of slots) {
    const slotGames = state.games.filter((g) => g.slot === slot);
    const playing = new Set();
    for (const g of slotGames) { if (g.team1Id) playing.add(g.team1Id); if (g.team2Id) playing.add(g.team2Id); }
    // Ungültig gewordene automatische Zuteilungen verwerfen (z. B. nach Korrektur der Gruppenphase)
    const takenHere = new Set();
    for (const g of slotGames) {
      if (g.refereeId && g.refereeId !== 'orga' && !g.refereeManual) {
        const t = state.teams.find((x) => x.id === g.refereeId);
        if (!t || playing.has(g.refereeId) || takenHere.has(g.refereeId)) g.refereeId = null;
        else takenHere.add(g.refereeId);
      } else if (g.refereeId && g.refereeId !== 'orga') takenHere.add(g.refereeId);
    }
    const allKnown = slotGames.every((g) => g.team1Id && g.team2Id);
    if (allKnown && slotGames.some((g) => !g.refereeId)) {
      const assigned = assignRefereesForSlot(slotGames, state.teams, new Map(refCount), prevPlayers, sameUnit);
      for (const g of slotGames) {
        if (!g.refereeId && assigned.has(g.id)) { g.refereeId = assigned.get(g.id); newlyAssigned.push(g); }
      }
    }
    for (const g of slotGames) {
      if (g.refereeId && g.refereeId !== 'orga') refCount.set(g.refereeId, (refCount.get(g.refereeId) || 0) + 1);
    }
    prevPlayers = playing;
  }
  if (newlyAssigned.length > 1) balanceReferees(state, newlyAssigned, sameUnit);
}

/**
 * Gleicht die Schiri-Einsätze innerhalb der frisch zugeteilten Spiele aus.
 * Solange ein Team mindestens 2 Einsätze mehr hat als ein anderes, wird getauscht –
 * direkt oder über ein drittes Team (Kette).
 */
function balanceReferees(state, games, sameUnit) {
  const bySlot = new Map();
  for (const g of state.games) {
    if (!bySlot.has(g.slot)) bySlot.set(g.slot, []);
    bySlot.get(g.slot).push(g);
  }
  const eligible = (teamId, g) => bySlot.get(g.slot).every((x) => x.team1Id !== teamId && x.team2Id !== teamId && x.refereeId !== teamId);
  for (let iter = 0; iter < 500; iter += 1) {
    const count = new Map(state.teams.map((t) => [t.id, 0]));
    for (const g of state.games) if (g.refereeId && count.has(g.refereeId)) count.set(g.refereeId, count.get(g.refereeId) + 1);
    const max = Math.max(...count.values());
    const lows = state.teams.filter((t) => count.get(t.id) <= max - 2)
      .sort((a, b) => count.get(a.id) - count.get(b.id));
    if (!lows.length) break;
    const highGames = games.filter((g) => g.refereeId && g.refereeId !== 'orga' && count.get(g.refereeId) === max);
    let done = false;
    // 1. direkter Tausch
    for (const g of highGames) {
      const cands = lows.filter((t) => eligible(t.id, g))
        .sort((a, b) => count.get(a.id) - count.get(b.id) || (sameUnit(a, g) ? 0 : 1) - (sameUnit(b, g) ? 0 : 1));
      if (cands.length) { g.refereeId = cands[0].id; done = true; break; }
    }
    if (done) continue;
    // 2. Kette: low übernimmt Spiel h von x, x übernimmt Spiel g vom Vielpfeifer
    outer:
    for (const g of highGames) {
      for (const h of games) {
        if (h === g || !h.refereeId || h.refereeId === 'orga' || h.slot === g.slot) continue;
        const x = state.teams.find((t) => t.id === h.refereeId);
        if (!x || count.get(x.id) >= max || !eligible(x.id, g)) continue;
        const low = lows.find((t) => eligible(t.id, h));
        if (!low) continue;
        h.refereeId = low.id; g.refereeId = x.id; done = true;
        break outer;
      }
    }
    if (!done) break;
  }
}

function resetReferees(state, phase) {
  for (const g of state.games) {
    if (phase && g.phase !== phase) continue;
    if (!g.refereeManual) g.refereeId = null;
  }
  freezeReferees(state);
}

// ---------------------------------------------------------------------------
// Tabellen, Platzierungen

function teamName(state, id) {
  if (id === 'orga') return 'Orga / Helfer';
  const t = state.teams.find((x) => x.id === id);
  return t ? t.name : '';
}

function groupStandings(state, groupId) {
  const ids = state.teams.filter((t) => t.group === groupId).map((t) => t.id);
  const games = state.games.filter((g) => g.phase === 1 && g.group === groupId);
  return computeStandings(ids, games, (id) => teamName(state, id));
}

function roundStandings(state, roundId) {
  const games = state.games.filter((g) => g.phase === 2 && g.round === roundId);
  const ids = [...new Set(games.flatMap((g) => [g.team1Id, g.team2Id]).filter(Boolean))];
  return computeStandings(ids, games, (id) => teamName(state, id));
}

function phaseComplete(state, phase) {
  const games = state.games.filter((g) => g.phase === phase);
  return games.length > 0 && games.every((g) => evaluate(g));
}

/** Vorschlag der Platzierungen nach Tabellenstand (Phase 1: je Gruppe, Phase 2: je Dreier-Runde). */
function proposePlacements(state, phase) {
  const fmt = getFormat(state.tournament.formatId);
  const out = {};
  if (phase === 1) {
    for (const g of fmt.groups) {
      const table = groupStandings(state, g.id);
      out[g.id] = { order: table.map((r) => r.teamId), ties: table.filter((r) => r.tie).map((r) => r.teamId) };
    }
  } else {
    for (const r of fmt.phase2.rounds.filter((x) => x.type === 'roundrobin')) {
      const table = roundStandings(state, r.id);
      out[r.id] = { order: table.map((x) => x.teamId), ties: table.filter((x) => x.tie).map((x) => x.teamId) };
    }
  }
  return out;
}

function confirmPhase1(state, placements) {
  if (state.phase !== 1) throw new Error('Die 1. Gruppenphase ist bereits abgeschlossen.');
  if (!phaseComplete(state, 1)) throw new Error('Es fehlen noch Ergebnisse der 1. Gruppenphase.');
  const fmt = getFormat(state.tournament.formatId);
  const proposal = proposePlacements(state, 1);
  const final = {};
  for (const g of fmt.groups) {
    const order = (placements && placements[g.id]) || proposal[g.id].order;
    const expected = state.teams.filter((t) => t.group === g.id).map((t) => t.id).sort();
    if ([...order].sort().join() !== expected.join()) throw new Error(`Platzierung für Gruppe ${g.id} ist unvollständig oder enthält fremde Teams.`);
    final[g.id] = [...order];
  }
  state.placements.phase1 = final;
  state.phase = 2;
  resetReferees(state, 2); resetReferees(state, 3);
  refresh(state);
  logEvent(state, 'phase1_confirmed', {});
}

function reopenPhase1(state) {
  if (state.phase < 2) throw new Error('Die 1. Gruppenphase ist noch offen.');
  if (state.games.some((g) => g.phase >= 2 && g.sets)) throw new Error('Es liegen bereits Ergebnisse der 2. Phase vor. Diese zuerst löschen.');
  state.placements.phase1 = {}; state.placements.phase2 = {};
  state.phase = 1;
  refresh(state);
  logEvent(state, 'phase1_reopened', {});
}

function confirmPhase2(state, placements) {
  if (state.phase !== 2) throw new Error(state.phase < 2 ? 'Zuerst die 1. Gruppenphase abschließen.' : 'Die 2. Phase ist bereits abgeschlossen.');
  if (!phaseComplete(state, 2)) throw new Error('Es fehlen noch Ergebnisse der 2. Phase.');
  const fmt = getFormat(state.tournament.formatId);
  const proposal = proposePlacements(state, 2);
  const final = {};
  for (const r of fmt.phase2.rounds.filter((x) => x.type === 'roundrobin')) {
    const order = (placements && placements[r.id]) || proposal[r.id].order;
    const expected = [...proposal[r.id].order].sort();
    if ([...order].sort().join() !== expected.join()) throw new Error(`Platzierung für ${r.name} ist unvollständig.`);
    final[r.id] = [...order];
  }
  state.placements.phase2 = final;
  state.phase = 3;
  resetReferees(state, 3);
  refresh(state);
  logEvent(state, 'phase2_confirmed', {});
}

function reopenPhase2(state) {
  if (state.phase < 3) throw new Error('Die 2. Phase ist noch offen.');
  if (state.games.some((g) => g.phase === 3 && g.sets)) throw new Error('Es liegen bereits Ergebnisse der Finalspiele vor. Diese zuerst löschen.');
  state.placements.phase2 = {};
  state.phase = 2;
  refresh(state);
  logEvent(state, 'phase2_reopened', {});
}

/** Endplatzierung nach Format-Definition. Nicht entscheidbare Plätze bleiben leer. */
function finalRanking(state) {
  const fmt = getFormat(state.tournament.formatId);
  const stats = new Map();
  for (const r of fmt.phase2.rounds) for (const row of roundStandings(state, r.id)) stats.set(row.teamId, row);
  const resolveEntry = (e) => {
    if (e.type === 'winner' || e.type === 'loser') return resolveRef(state, { type: e.type, game: `p3-${e.game}` });
    return resolveRef(state, e);
  };
  const out = [];
  let place = 1;
  for (const tier of fmt.finalRanking) {
    const ids = tier.map((e) => ({ e, id: resolveEntry(e) }));
    ids.sort((a, b) => {
      if (!a.id || !b.id) return 0;
      const sa = stats.get(a.id); const sb = stats.get(b.id);
      if (sa && sb) return cmpBasic(sa, sb);
      return 0;
    });
    for (const { e, id } of ids) {
      out.push({ place, teamId: id, teamName: id ? teamName(state, id) : '', source: describeRankingEntry(state, e) });
      place += 1;
    }
  }
  return out;
}

function describeRankingEntry(state, e) {
  const fmt = getFormat(state.tournament.formatId);
  if (e.type === 'winner' || e.type === 'loser') {
    const g = fmt.phase3.games.find((x) => x.id === e.game);
    return `${e.type === 'winner' ? 'Sieger' : 'Verlierer'} ${g ? g.name : e.game}`;
  }
  const rd = fmt.phase2.rounds.find((r) => r.id === e.round);
  return `${e.place}. ${rd ? rd.name : e.round}`;
}

// ---------------------------------------------------------------------------
// Ergebnisse

function setResult(state, gameId, sets, meta = {}) {
  const g = gameById(state, gameId);
  if (!g) throw new Error('Spiel nicht gefunden.');
  if (!g.team1Id || !g.team2Id) throw new Error('Die Teams dieses Spiels stehen noch nicht fest.');
  if (g.phase === 1 && state.phase > 1 && !meta.admin) throw new Error('Die 1. Gruppenphase ist abgeschlossen. Änderungen nur durch die Turnierleitung.');
  if (g.phase === 2 && state.phase > 2 && !meta.admin) throw new Error('Die 2. Phase ist abgeschlossen. Änderungen nur durch die Turnierleitung.');
  g.sets = sets;
  g.enteredAt = new Date().toISOString();
  g.enteredBy = meta.by || 'referee';
  refresh(state);
  logEvent(state, 'result', { gameId, sets: formatSets(sets), by: g.enteredBy });
}

function clearResult(state, gameId) {
  const g = gameById(state, gameId);
  if (!g) throw new Error('Spiel nicht gefunden.');
  g.sets = null; g.enteredAt = null; g.enteredBy = null;
  refresh(state);
  logEvent(state, 'result_cleared', { gameId });
}

function setReferee(state, gameId, refereeId) {
  const g = gameById(state, gameId);
  if (!g) throw new Error('Spiel nicht gefunden.');
  if (refereeId === null || refereeId === '') { g.refereeId = null; g.refereeManual = false; }
  else {
    if (refereeId !== 'orga' && !state.teams.find((t) => t.id === refereeId)) throw new Error('Team nicht gefunden.');
    if (refereeId === g.team1Id || refereeId === g.team2Id) throw new Error('Ein spielendes Team kann nicht pfeifen.');
    g.refereeId = refereeId; g.refereeManual = true;
  }
  refresh(state);
}

function logEvent(state, type, data) {
  state.log = state.log || [];
  state.log.push({ at: new Date().toISOString(), type, ...data });
  if (state.log.length > 500) state.log.splice(0, state.log.length - 500);
}

// ---------------------------------------------------------------------------
// Ansichts-Modell

function gameView(state, g) {
  const r = evaluate(g);
  const time = slotTime(state.tournament, g.slot);
  const field = state.tournament.fields.find((f) => f.number === g.field);
  const team1 = g.team1Id ? teamName(state, g.team1Id) : null;
  const team2 = g.team2Id ? teamName(state, g.team2Id) : null;
  const rd = g.round ? roundDef(state, g.round) : null;
  const label = rd ? rd.name : g.label;
  return {
    id: g.id, token: g.token, phase: g.phase, group: g.group, round: g.round, mode: g.mode,
    label, sublabel: g.sublabel, title: g.sublabel ? `${label} – ${g.sublabel}` : label,
    slot: g.slot, time: time.label, start: time.start, end: time.end,
    field: g.field, fieldName: field ? field.name : `Feld ${g.field}`,
    team1Id: g.team1Id || null, team2Id: g.team2Id || null,
    team1: team1 || refLabel(state, g.team1Ref), team2: team2 || refLabel(state, g.team2Ref),
    team1Known: !!team1, team2Known: !!team2,
    refereeId: g.refereeId || null,
    referee: g.refereeId ? teamName(state, g.refereeId) : null,
    refereeManual: !!g.refereeManual,
    sets: g.sets || null, setsText: formatSets(g.sets),
    result: r ? { ...r, winnerId: r.winner === 1 ? g.team1Id : r.winner === 2 ? g.team2Id : null } : null,
    status: r ? 'done' : (g.team1Id && g.team2Id ? 'ready' : 'pending'),
    enteredAt: g.enteredAt || null, enteredBy: g.enteredBy || null,
  };
}

function tableView(state, rows) {
  return rows.map((r) => ({ ...r, teamName: teamName(state, r.teamId) }));
}

function buildView(state) {
  const fmt = getFormat(state.tournament.formatId);
  const games = state.games.map((g) => gameView(state, g)).sort((a, b) => a.slot - b.slot || a.field - b.field);
  const slots = [...new Set(games.map((g) => g.slot))].sort((a, b) => a - b).map((s) => {
    const st = slotTime(state.tournament, s);
    return { slot: s, time: st.label, start: st.start, end: st.end, duration: st.duration, breaks: st.breaks, games: games.filter((g) => g.slot === s) };
  });
  const groups = fmt.groups.map((g) => ({
    id: g.id, name: g.name,
    teams: state.teams.filter((t) => t.group === g.id).map((t) => ({ id: t.id, name: t.name, club: t.club, pos: t.pos })),
    table: tableView(state, groupStandings(state, g.id)),
    games: games.filter((x) => x.phase === 1 && x.group === g.id),
  }));
  // Wohin führt Platz p einer Runde? (Finalspiel oder Endplatz-Bereich)
  const nextOf = (roundId, place) => {
    const fin = fmt.phase3.games.find((g) => [g.team1, g.team2].some((ref) => ref.type === 'roundPlace' && ref.round === roundId && ref.place === place));
    if (fin) return { kind: 'final', label: fin.name };
    let pos = 1;
    for (const tier of fmt.finalRanking) {
      if (tier.some((e) => e.type === 'roundPlace' && e.round === roundId && e.place === place)) {
        return { kind: 'place', label: tier.length > 1 ? `Platz ${pos}–${pos + tier.length - 1}` : `Platz ${pos}` };
      }
      pos += tier.length;
    }
    return null;
  };
  const rounds = fmt.phase2.rounds.map((r) => ({
    id: r.id, name: r.name, type: r.type, tier: r.tier,
    seeds: r.seeds.map((s) => {
      const id = resolveRef(state, { type: 'placement', ...s });
      return { ...s, label: `${s.place}. Gruppe ${s.group}`, teamId: id, teamName: id ? teamName(state, id) : null };
    }),
    table: r.type === 'roundrobin' ? tableView(state, roundStandings(state, r.id)) : null,
    games: games.filter((x) => x.phase === 2 && x.round === r.id),
    placements: [1, 2, 3, 4].slice(0, r.type === 'roundrobin' ? 3 : 4).map((p) => {
      const id = resolveRef(state, { type: 'roundPlace', round: r.id, place: p });
      return { place: p, teamId: id, teamName: id ? teamName(state, id) : null, next: nextOf(r.id, p) };
    }),
  }));
  const refCounts = {};
  for (const g of games) if (g.refereeId && g.refereeId !== 'orga') refCounts[g.refereeId] = (refCounts[g.refereeId] || 0) + 1;
  const progress = [1, 2, 3].map((p) => {
    const gs = games.filter((g) => g.phase === p);
    return { phase: p, total: gs.length, done: gs.filter((g) => g.status === 'done').length };
  });
  return {
    tournament: { ...state.tournament, formatName: fmt.name, fields: state.tournament.fields.map(({ number, name }) => ({ number, name })) },
    phase: state.phase,
    phaseComplete: { 1: phaseComplete(state, 1), 2: phaseComplete(state, 2), 3: phaseComplete(state, 3) },
    progress,
    teams: state.teams.map((t) => ({ ...t, refereeCount: refCounts[t.id] || 0 })),
    groups, rounds,
    finals: games.filter((g) => g.phase === 3),
    games, slots,
    placements: state.placements,
    ranking: finalRanking(state),
    updatedAt: new Date().toISOString(),
  };
}

export {
  createTournament, refresh, buildView, gameView, setResult, clearResult, setReferee, resetReferees,
  confirmPhase1, reopenPhase1, confirmPhase2, reopenPhase2, proposePlacements, phaseComplete,
  groupStandings, roundStandings, finalRanking, teamName, slotTime, slotDuration, setSchedule, gameById, resolveRef, refLabel, token,
};

// ---------------------------------------------------------------------------
// Gemeinsame Regeln für Backend (Node/SQL) und Oberfläche

export const CORRECTION_MINUTES = 15;

/** Entfernt Zugriffs-Tokens (Spiele, Felder) für die öffentliche Ansicht. */
export function stripTokens(state) {
  if (!state) return state;
  const copy = JSON.parse(JSON.stringify(state));
  for (const g of copy.games) delete g.token;
  for (const f of copy.tournament.fields) delete f.token;
  return copy;
}

/** Darf ein Schiri-Team dieses Spiel (noch) eintragen bzw. korrigieren? */
export function refereeCanEdit(state, game, minutes = CORRECTION_MINUTES, now = Date.now()) {
  if (!game) return { ok: false, reason: 'Spiel nicht gefunden.' };
  if ((game.phase === 1 && state.phase > 1) || (game.phase === 2 && state.phase > 2)) {
    return { ok: false, reason: 'Diese Phase ist abgeschlossen. Änderungen nur noch durch die Turnierleitung.' };
  }
  if (!game.sets) return { ok: true };
  if (game.enteredBy === 'admin') return { ok: false, reason: 'Dieses Ergebnis wurde von der Turnierleitung eingetragen und kann nur dort geändert werden.' };
  const age = now - Date.parse(game.enteredAt || 0);
  if (age > minutes * 60 * 1000) return { ok: false, reason: `Die Korrekturfrist von ${minutes} Minuten ist abgelaufen. Bitte an die Turnierleitung wenden.` };
  return { ok: true };
}
