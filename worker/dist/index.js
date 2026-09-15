var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.js
import { DurableObject } from "cloudflare:workers";

// ../docs/engine/formats/teams15.js
var GROUP_SLOT_PAIRINGS = [
  [1, 2],
  [3, 4],
  [5, 1],
  [2, 3],
  [4, 5],
  [1, 3],
  [2, 4],
  [5, 2],
  [3, 5],
  [4, 1]
];
var groups = ["A", "B", "C"];
var phase1Slots = GROUP_SLOT_PAIRINGS.map((pair, slotIndex) => ({
  slot: slotIndex + 1,
  games: groups.map((g, fieldIndex) => ({
    field: fieldIndex + 1,
    group: g,
    team1: { type: "group", group: g, pos: pair[0] },
    team2: { type: "group", group: g, pos: pair[1] }
  }))
}));
var teams15_default = {
  id: "teams15",
  name: "Quattro Mixed \u2013 15 Teams (3\xD75, dann Dreier-Runden)",
  teamCount: 15,
  fieldCount: 3,
  groups: groups.map((id) => ({ id, name: `Gruppe ${id}`, size: 5 })),
  phase1: {
    description: "Jeder gegen Jeden in 3 Gruppen \xE0 5 Teams (10 Spiele je Gruppe)",
    slots: phase1Slots
  },
  phase2: {
    description: "5 Dreier-Runden im Jeder-gegen-Jeden (3 Spiele je Runde)",
    rounds: [
      {
        id: "gold1",
        name: "Gold-Runde 1",
        type: "roundrobin",
        tier: "gold",
        seeds: [{ group: "A", place: 1 }, { group: "C", place: 1 }, { group: "A", place: 2 }]
      },
      {
        id: "gold2",
        name: "Gold-Runde 2",
        type: "roundrobin",
        tier: "gold",
        seeds: [{ group: "B", place: 1 }, { group: "B", place: 2 }, { group: "C", place: 2 }]
      },
      {
        id: "silber1",
        name: "Silber (7\u20139)",
        type: "roundrobin",
        tier: "silber",
        seeds: [{ group: "A", place: 3 }, { group: "C", place: 3 }, { group: "B", place: 3 }]
      },
      {
        id: "silber2",
        name: "Silber (10\u201312)",
        type: "roundrobin",
        tier: "silber",
        seeds: [{ group: "A", place: 4 }, { group: "B", place: 4 }, { group: "C", place: 4 }]
      },
      {
        id: "bronze",
        name: "Bronze-Runde",
        type: "roundrobin",
        tier: "bronze",
        seeds: [{ group: "A", place: 5 }, { group: "B", place: 5 }, { group: "C", place: 5 }]
      }
    ]
  },
  phase3: {
    games: [
      {
        id: "finale",
        name: "Finale",
        team1: { type: "roundPlace", round: "gold1", place: 1 },
        team2: { type: "roundPlace", round: "gold2", place: 1 }
      },
      {
        id: "kleines_finale",
        name: "Kleines Finale",
        team1: { type: "roundPlace", round: "gold1", place: 2 },
        team2: { type: "roundPlace", round: "gold2", place: 2 }
      }
    ]
  },
  // Endplatzierung: Liste von Stufen. Innerhalb einer Stufe mit mehreren Einträgen
  // wird nach der Bilanz in der 2. Phase sortiert (Siege, Satzdifferenz, Punktdifferenz).
  finalRanking: [
    [{ type: "winner", game: "finale" }],
    [{ type: "loser", game: "finale" }],
    [{ type: "winner", game: "kleines_finale" }],
    [{ type: "loser", game: "kleines_finale" }],
    [{ type: "roundPlace", round: "gold1", place: 3 }, { type: "roundPlace", round: "gold2", place: 3 }],
    [{ type: "roundPlace", round: "silber1", place: 1 }],
    [{ type: "roundPlace", round: "silber1", place: 2 }],
    [{ type: "roundPlace", round: "silber1", place: 3 }],
    [{ type: "roundPlace", round: "silber2", place: 1 }],
    [{ type: "roundPlace", round: "silber2", place: 2 }],
    [{ type: "roundPlace", round: "silber2", place: 3 }],
    [{ type: "roundPlace", round: "bronze", place: 1 }],
    [{ type: "roundPlace", round: "bronze", place: 2 }],
    [{ type: "roundPlace", round: "bronze", place: 3 }]
  ]
};

// ../docs/engine/formats/teams16.js
var GROUP_PAIRINGS = [
  [1, 2],
  [3, 4],
  [5, 6],
  [7, 8],
  [1, 3],
  [2, 4],
  [5, 7],
  [6, 8],
  [1, 4],
  [2, 3],
  [5, 8],
  [6, 7],
  [1, 5],
  [2, 6],
  [3, 7],
  [4, 8]
];
var SLOT_LAYOUT = [
  [[1, "A", 1], [2, "B", 1], [3, "A", 2]],
  [[1, "B", 2], [2, "A", 3], [3, "B", 3]],
  [[1, "A", 4], [2, "B", 4], [3, "A", 5]],
  [[1, "B", 5], [2, "A", 6], [3, "B", 6]],
  [[1, "A", 7], [2, "B", 7], [3, "A", 8]],
  [[1, "B", 8], [2, "A", 9], [3, "B", 9]],
  [[1, "A", 10], [2, "B", 10], [3, "A", 11]],
  [[1, "B", 11], [2, "A", 12], [3, "B", 12]],
  [[1, "A", 13], [2, "B", 13], [3, "A", 14]],
  [[1, "B", 14], [2, "A", 15], [3, "B", 15]],
  [[1, "A", 16], [2, "B", 16]]
];
var phase1Slots2 = SLOT_LAYOUT.map((entries, slotIndex) => ({
  slot: slotIndex + 1,
  games: entries.map(([field, group, gameNo]) => {
    const pair = GROUP_PAIRINGS[gameNo - 1];
    return {
      field,
      group,
      team1: { type: "group", group, pos: pair[0] },
      team2: { type: "group", group, pos: pair[1] }
    };
  })
}));
var teams16_default = {
  id: "teams16",
  name: "Quattro Mixed \u2013 16 Teams (2\xD78, dann K.o.-Runden)",
  teamCount: 16,
  fieldCount: 3,
  groups: [
    { id: "A", name: "Gruppe A", size: 8 },
    { id: "B", name: "Gruppe B", size: 8 }
  ],
  phase1: {
    description: "2 Gruppen \xE0 8 Teams, 4 Spiele je Team (16 Spiele je Gruppe)",
    slots: phase1Slots2
  },
  phase2: {
    description: "4 K.o.-Runden \xE0 4 Teams: 2 Halbfinale, Finale, Spiel um Platz 3",
    rounds: [
      {
        id: "gold1",
        name: "Gold-Runde 1",
        type: "ko4",
        tier: "gold",
        seeds: [{ group: "A", place: 1 }, { group: "B", place: 2 }, { group: "A", place: 3 }, { group: "B", place: 4 }]
      },
      {
        id: "gold2",
        name: "Gold-Runde 2",
        type: "ko4",
        tier: "gold",
        seeds: [{ group: "A", place: 2 }, { group: "B", place: 1 }, { group: "A", place: 4 }, { group: "B", place: 3 }]
      },
      {
        id: "silber",
        name: "Silber-Runde",
        type: "ko4",
        tier: "silber",
        seeds: [{ group: "A", place: 5 }, { group: "B", place: 5 }, { group: "A", place: 6 }, { group: "B", place: 6 }]
      },
      {
        id: "bronze",
        name: "Bronze-Runde",
        type: "ko4",
        tier: "bronze",
        seeds: [{ group: "A", place: 7 }, { group: "B", place: 7 }, { group: "A", place: 8 }, { group: "B", place: 8 }]
      }
    ]
  },
  phase3: {
    games: [
      {
        id: "finale",
        name: "Finale",
        team1: { type: "roundPlace", round: "gold1", place: 1 },
        team2: { type: "roundPlace", round: "gold2", place: 1 }
      },
      {
        id: "kleines_finale",
        name: "Kleines Finale",
        team1: { type: "roundPlace", round: "gold1", place: 2 },
        team2: { type: "roundPlace", round: "gold2", place: 2 }
      }
    ]
  },
  finalRanking: [
    [{ type: "winner", game: "finale" }],
    [{ type: "loser", game: "finale" }],
    [{ type: "winner", game: "kleines_finale" }],
    [{ type: "loser", game: "kleines_finale" }],
    [{ type: "roundPlace", round: "gold1", place: 3 }, { type: "roundPlace", round: "gold2", place: 3 }],
    [{ type: "roundPlace", round: "gold1", place: 4 }, { type: "roundPlace", round: "gold2", place: 4 }],
    [{ type: "roundPlace", round: "silber", place: 1 }],
    [{ type: "roundPlace", round: "silber", place: 2 }],
    [{ type: "roundPlace", round: "silber", place: 3 }],
    [{ type: "roundPlace", round: "silber", place: 4 }],
    [{ type: "roundPlace", round: "bronze", place: 1 }],
    [{ type: "roundPlace", round: "bronze", place: 2 }],
    [{ type: "roundPlace", round: "bronze", place: 3 }],
    [{ type: "roundPlace", round: "bronze", place: 4 }]
  ]
};

// ../docs/engine/formats/index.js
var FORMATS = { [teams15_default.id]: teams15_default, [teams16_default.id]: teams16_default };
function getFormat(id) {
  const f = FORMATS[id];
  if (!f) throw new Error(`Unbekanntes Turnierformat: ${id}`);
  return f;
}
__name(getFormat, "getFormat");

// ../docs/engine/results.js
var MAX_POINTS = 99;
var ResultError = class extends Error {
  static {
    __name(this, "ResultError");
  }
};
function toInt(v) {
  if (v === "" || v === null || v === void 0) return null;
  const n = Number(v);
  if (!Number.isInteger(n)) return NaN;
  return n;
}
__name(toInt, "toInt");
function validateSets(rawSets, mode) {
  if (!Array.isArray(rawSets)) throw new ResultError("Ung\xFCltige Eingabe.");
  const sets = [];
  for (let i = 0; i < 3; i += 1) {
    const raw = rawSets[i];
    if (!raw) {
      sets.push(null);
      continue;
    }
    const a = toInt(raw[0]);
    const b = toInt(raw[1]);
    if (a === null && b === null) {
      sets.push(null);
      continue;
    }
    if (a === null || b === null) throw new ResultError(`Satz ${i + 1}: Bitte beide Punktzahlen eintragen.`);
    if (Number.isNaN(a) || Number.isNaN(b)) throw new ResultError(`Satz ${i + 1}: Nur ganze Zahlen erlaubt.`);
    if (a < 0 || b < 0 || a > MAX_POINTS || b > MAX_POINTS) throw new ResultError(`Satz ${i + 1}: Punktzahl muss zwischen 0 und ${MAX_POINTS} liegen.`);
    if (a === b) throw new ResultError(`Satz ${i + 1}: Ein Satz kann nicht unentschieden enden.`);
    sets.push([a, b]);
  }
  if (!sets[0] || !sets[1]) throw new ResultError("Bitte Satz 1 und Satz 2 eintragen.");
  if (sets[2] && !sets[1]) throw new ResultError("Satz 3 ohne Satz 2 ist nicht m\xF6glich.");
  const two = [sets[0], sets[1]];
  const won1 = two.filter(([a, b]) => a > b).length;
  const won2 = 2 - won1;
  if (mode === "roundrobin") {
    if (sets[2]) throw new ResultError("In der Gruppenphase werden nur 2 S\xE4tze gespielt.");
    return two;
  }
  if (won1 !== won2) {
    if (sets[2]) throw new ResultError("Bei 2:0 S\xE4tzen gibt es keinen 3. Satz.");
    return two;
  }
  if (sets[2]) return sets;
  const p1 = two[0][0] + two[1][0];
  const p2 = two[0][1] + two[1][1];
  if (p1 === p2) throw new ResultError("1:1 S\xE4tze und gleiche Punktzahl: Bitte den entscheidenden 3. Satz eintragen.");
  return two;
}
__name(validateSets, "validateSets");
function evaluate(game) {
  const sets = game && game.sets;
  if (!sets || sets.length < 2) return null;
  let sets1 = 0;
  let sets2 = 0;
  let points1 = 0;
  let points2 = 0;
  for (const [a, b] of sets) {
    if (a > b) sets1 += 1;
    else sets2 += 1;
    points1 += a;
    points2 += b;
  }
  let winner;
  let decidedBy = "sets";
  if (sets1 > sets2) winner = 1;
  else if (sets2 > sets1) winner = 2;
  else if (game.mode === "ko") {
    decidedBy = "points";
    if (points1 > points2) winner = 1;
    else if (points2 > points1) winner = 2;
    else winner = 0;
  } else {
    winner = 0;
  }
  return { sets1, sets2, points1, points2, winner, decidedBy };
}
__name(evaluate, "evaluate");
function formatSets(sets) {
  if (!sets) return "";
  return sets.map(([a, b]) => `${a}:${b}`).join(", ");
}
__name(formatSets, "formatSets");

// ../docs/engine/scheduler.js
function assignRefereesForSlot(slotGames, teams, refCount, prevSlotPlayers, sameUnit) {
  const playing = /* @__PURE__ */ new Set();
  for (const g of slotGames) {
    playing.add(g.team1Id);
    playing.add(g.team2Id);
  }
  const taken = new Set(slotGames.filter((g) => g.refereeId && g.refereeId !== "orga").map((g) => g.refereeId));
  const result = /* @__PURE__ */ new Map();
  const toAssign = slotGames.filter((g) => !g.refereeId).sort((a, b) => a.field - b.field);
  for (const g of toAssign) {
    const cands = teams.filter((t) => !playing.has(t.id) && !taken.has(t.id));
    if (cands.length === 0) {
      result.set(g.id, "orga");
      continue;
    }
    const score = /* @__PURE__ */ __name((t) => {
      const sameRound = sameUnit(t, g) ? 0 : 1;
      const rested = prevSlotPlayers.has(t.id) ? 1 : 0;
      return (refCount.get(t.id) || 0) * 100 + sameRound * 10 + rested;
    }, "score");
    cands.sort((a, b) => score(a) - score(b) || a.name.localeCompare(b.name, "de"));
    const pick = cands[0];
    result.set(g.id, pick.id);
    taken.add(pick.id);
    refCount.set(pick.id, (refCount.get(pick.id) || 0) + 1);
  }
  return result;
}
__name(assignRefereesForSlot, "assignRefereesForSlot");

// ../docs/engine/tournament.js
function roundDef(state, roundId) {
  return getFormat(state.tournament.formatId).phase2.rounds.find((r) => r.id === roundId);
}
__name(roundDef, "roundDef");
function gameById(state, id) {
  return state.games.find((g) => g.id === id);
}
__name(gameById, "gameById");
function koRoundPlace(state, roundId, place) {
  const finale = gameById(state, `p2-${roundId}-3`);
  const p3 = gameById(state, `p2-${roundId}-4`);
  const src = place <= 2 ? finale : p3;
  if (!src) return null;
  const r = evaluate(src);
  if (!r || !src.team1Id || !src.team2Id || r.winner === 0) return null;
  const winner = r.winner === 1 ? src.team1Id : src.team2Id;
  const loser = r.winner === 1 ? src.team2Id : src.team1Id;
  return place === 1 || place === 3 ? winner : loser;
}
__name(koRoundPlace, "koRoundPlace");
function resolveRef(state, ref) {
  if (!ref) return null;
  switch (ref.type) {
    case "group": {
      const t = state.teams.find((x) => x.group === ref.group && x.pos === ref.pos);
      return t ? t.id : null;
    }
    case "placement": {
      const list = state.placements.phase1[ref.group];
      return list ? list[ref.place - 1] || null : null;
    }
    case "winner":
    case "loser": {
      const g = gameById(state, ref.game);
      if (!g || !g.team1Id || !g.team2Id) return null;
      const r = evaluate(g);
      if (!r || r.winner === 0) return null;
      const w = r.winner === 1 ? g.team1Id : g.team2Id;
      const l = r.winner === 1 ? g.team2Id : g.team1Id;
      return ref.type === "winner" ? w : l;
    }
    case "roundPlace": {
      const rd = roundDef(state, ref.round);
      if (!rd) return null;
      if (rd.type === "ko4") return koRoundPlace(state, ref.round, ref.place);
      const list = state.placements.phase2[ref.round];
      return list ? list[ref.place - 1] || null : null;
    }
    default:
      return null;
  }
}
__name(resolveRef, "resolveRef");
function refresh(state) {
  for (let iter = 0; iter < 5; iter += 1) {
    let changed = false;
    for (const g of state.games) {
      if (g.phase === 1) continue;
      const t1 = resolveRef(state, g.team1Ref);
      const t2 = resolveRef(state, g.team2Ref);
      if (t1 !== (g.team1Id || null) || t2 !== (g.team2Id || null)) changed = true;
      g.team1Id = t1;
      g.team2Id = t2;
    }
    if (!changed) break;
  }
  freezeReferees(state);
  return state;
}
__name(refresh, "refresh");
function teamRoundMap(state) {
  const m = /* @__PURE__ */ new Map();
  for (const g of state.games) {
    if (g.phase !== 2 || !g.round) continue;
    if (g.team1Id) m.set(g.team1Id, g.round);
    if (g.team2Id) m.set(g.team2Id, g.round);
  }
  return m;
}
__name(teamRoundMap, "teamRoundMap");
function freezeReferees(state) {
  const slots = [...new Set(state.games.map((g) => g.slot))].sort((a, b) => a - b);
  const refCount = /* @__PURE__ */ new Map();
  const roundOfTeam = teamRoundMap(state);
  const sameUnit = /* @__PURE__ */ __name((t, g) => g.phase === 1 ? t.group === g.group : g.phase === 2 && roundOfTeam.get(t.id) === g.round, "sameUnit");
  const newlyAssigned = [];
  let prevPlayers = /* @__PURE__ */ new Set();
  for (const slot of slots) {
    const slotGames = state.games.filter((g) => g.slot === slot);
    const playing = /* @__PURE__ */ new Set();
    for (const g of slotGames) {
      if (g.team1Id) playing.add(g.team1Id);
      if (g.team2Id) playing.add(g.team2Id);
    }
    const takenHere = /* @__PURE__ */ new Set();
    for (const g of slotGames) {
      if (g.refereeId && g.refereeId !== "orga" && !g.refereeManual) {
        const t = state.teams.find((x) => x.id === g.refereeId);
        if (!t || playing.has(g.refereeId) || takenHere.has(g.refereeId)) g.refereeId = null;
        else takenHere.add(g.refereeId);
      } else if (g.refereeId && g.refereeId !== "orga") takenHere.add(g.refereeId);
    }
    const allKnown = slotGames.every((g) => g.team1Id && g.team2Id);
    if (allKnown && slotGames.some((g) => !g.refereeId)) {
      const assigned = assignRefereesForSlot(slotGames, state.teams, new Map(refCount), prevPlayers, sameUnit);
      for (const g of slotGames) {
        if (!g.refereeId && assigned.has(g.id)) {
          g.refereeId = assigned.get(g.id);
          newlyAssigned.push(g);
        }
      }
    }
    for (const g of slotGames) {
      if (g.refereeId && g.refereeId !== "orga") refCount.set(g.refereeId, (refCount.get(g.refereeId) || 0) + 1);
    }
    prevPlayers = playing;
  }
  if (newlyAssigned.length > 1) balanceReferees(state, newlyAssigned, sameUnit);
}
__name(freezeReferees, "freezeReferees");
function balanceReferees(state, games, sameUnit) {
  const bySlot = /* @__PURE__ */ new Map();
  for (const g of state.games) {
    if (!bySlot.has(g.slot)) bySlot.set(g.slot, []);
    bySlot.get(g.slot).push(g);
  }
  const eligible = /* @__PURE__ */ __name((teamId, g) => bySlot.get(g.slot).every((x) => x.team1Id !== teamId && x.team2Id !== teamId && x.refereeId !== teamId), "eligible");
  for (let iter = 0; iter < 500; iter += 1) {
    const count = new Map(state.teams.map((t) => [t.id, 0]));
    for (const g of state.games) if (g.refereeId && count.has(g.refereeId)) count.set(g.refereeId, count.get(g.refereeId) + 1);
    const max = Math.max(...count.values());
    const lows = state.teams.filter((t) => count.get(t.id) <= max - 2).sort((a, b) => count.get(a.id) - count.get(b.id));
    if (!lows.length) break;
    const highGames = games.filter((g) => g.refereeId && g.refereeId !== "orga" && count.get(g.refereeId) === max);
    let done = false;
    for (const g of highGames) {
      const cands = lows.filter((t) => eligible(t.id, g)).sort((a, b) => count.get(a.id) - count.get(b.id) || (sameUnit(a, g) ? 0 : 1) - (sameUnit(b, g) ? 0 : 1));
      if (cands.length) {
        g.refereeId = cands[0].id;
        done = true;
        break;
      }
    }
    if (done) continue;
    outer:
      for (const g of highGames) {
        for (const h of games) {
          if (h === g || !h.refereeId || h.refereeId === "orga" || h.slot === g.slot) continue;
          const x = state.teams.find((t) => t.id === h.refereeId);
          if (!x || count.get(x.id) >= max || !eligible(x.id, g)) continue;
          const low = lows.find((t) => eligible(t.id, h));
          if (!low) continue;
          h.refereeId = low.id;
          g.refereeId = x.id;
          done = true;
          break outer;
        }
      }
    if (!done) break;
  }
}
__name(balanceReferees, "balanceReferees");
function setResult(state, gameId, sets, meta = {}) {
  const g = gameById(state, gameId);
  if (!g) throw new Error("Spiel nicht gefunden.");
  if (!g.team1Id || !g.team2Id) throw new Error("Die Teams dieses Spiels stehen noch nicht fest.");
  if (g.phase === 1 && state.phase > 1 && !meta.admin) throw new Error("Die 1. Gruppenphase ist abgeschlossen. \xC4nderungen nur durch die Turnierleitung.");
  if (g.phase === 2 && state.phase > 2 && !meta.admin) throw new Error("Die 2. Phase ist abgeschlossen. \xC4nderungen nur durch die Turnierleitung.");
  g.sets = sets;
  g.enteredAt = (/* @__PURE__ */ new Date()).toISOString();
  g.enteredBy = meta.by || "referee";
  refresh(state);
  logEvent(state, "result", { gameId, sets: formatSets(sets), by: g.enteredBy });
}
__name(setResult, "setResult");
function logEvent(state, type, data) {
  state.log = state.log || [];
  state.log.push({ at: (/* @__PURE__ */ new Date()).toISOString(), type, ...data });
  if (state.log.length > 500) state.log.splice(0, state.log.length - 500);
}
__name(logEvent, "logEvent");
var CORRECTION_MINUTES = 15;
function stripTokens(state) {
  if (!state) return state;
  const copy = JSON.parse(JSON.stringify(state));
  for (const g of copy.games) delete g.token;
  for (const f of copy.tournament.fields) delete f.token;
  return copy;
}
__name(stripTokens, "stripTokens");
function refereeCanEdit(state, game, minutes = CORRECTION_MINUTES, now = Date.now()) {
  if (!game) return { ok: false, reason: "Spiel nicht gefunden." };
  if (game.phase === 1 && state.phase > 1 || game.phase === 2 && state.phase > 2) {
    return { ok: false, reason: "Diese Phase ist abgeschlossen. \xC4nderungen nur noch durch die Turnierleitung." };
  }
  if (!game.sets) return { ok: true };
  if (game.enteredBy === "admin") return { ok: false, reason: "Dieses Ergebnis wurde von der Turnierleitung eingetragen und kann nur dort ge\xE4ndert werden." };
  const age = now - Date.parse(game.enteredAt || 0);
  if (age > minutes * 60 * 1e3) return { ok: false, reason: `Die Korrekturfrist von ${minutes} Minuten ist abgelaufen. Bitte an die Turnierleitung wenden.` };
  return { ok: true };
}
__name(refereeCanEdit, "refereeCanEdit");

// ../src/rpc.js
var RpcError = class extends Error {
  static {
    __name(this, "RpcError");
  }
};
function createRpc({ store, pins }) {
  const requirePin = /* @__PURE__ */ __name(async (pin) => {
    if (typeof pin !== "string" || !pin || !await pins.check(pin)) throw new RpcError("Falsche PIN.");
  }, "requirePin");
  const requireState = /* @__PURE__ */ __name(() => {
    if (!store.state) throw new RpcError("Es ist kein Turnier angelegt.");
    return store.state;
  }, "requireState");
  const findGame = /* @__PURE__ */ __name((state, token) => {
    if (typeof token !== "string" || !token) return null;
    const dot = token.indexOf(".");
    if (dot > 0) {
      const field = state.tournament.fields.find((f) => f.token === token.slice(0, dot));
      if (!field) return null;
      const id = token.slice(dot + 1);
      return state.games.find((g) => g.id === id && g.field === field.number) || null;
    }
    return state.games.find((g) => g.token === token) || null;
  }, "findGame");
  const stamp = /* @__PURE__ */ __name(() => ({ version: store.version, updatedAt: store.updatedAt || (/* @__PURE__ */ new Date()).toISOString() }), "stamp");
  return {
    vt_pin_status: /* @__PURE__ */ __name(() => pins.status(), "vt_pin_status"),
    vt_set_admin_pin: /* @__PURE__ */ __name(({ pin }) => pins.set(pin), "vt_set_admin_pin"),
    vt_change_admin_pin: /* @__PURE__ */ __name(({ old_pin, new_pin }) => pins.change(old_pin, new_pin), "vt_change_admin_pin"),
    vt_login: /* @__PURE__ */ __name(async ({ pin }) => {
      await requirePin(pin);
      return { ok: true };
    }, "vt_login"),
    vt_get_state: /* @__PURE__ */ __name(() => ({ state: stripTokens(store.state), ...stamp() }), "vt_get_state"),
    vt_get_admin_state: /* @__PURE__ */ __name(async ({ pin }) => {
      await requirePin(pin);
      return { state: store.state, ...stamp() };
    }, "vt_get_admin_state"),
    vt_save_admin_state: /* @__PURE__ */ __name(async ({ pin, new_state, expected_version }) => {
      await requirePin(pin);
      if (Number(expected_version) !== store.version) throw new RpcError("VERSION_CONFLICT");
      if (new_state !== null) {
        if (!new_state || !Array.isArray(new_state.games) || !Array.isArray(new_state.teams) || !new_state.tournament) throw new RpcError("Ung\xFCltiger Turnierstand.");
        try {
          refresh(new_state);
        } catch (err) {
          throw new RpcError(`Ung\xFCltiger Turnierstand: ${err.message}`);
        }
      }
      await store.save(new_state);
      return { version: store.version };
    }, "vt_save_admin_state"),
    vt_get_game: /* @__PURE__ */ __name(({ token }) => {
      const state = requireState();
      const g = findGame(state, token);
      if (!g) throw new RpcError("Dieses Spiel gibt es nicht (mehr).");
      const field = state.tournament.fields.find((f) => f.number === g.field);
      return { state: stripTokens(state), gameId: g.id, fieldToken: field ? field.token : null };
    }, "vt_get_game"),
    vt_get_field: /* @__PURE__ */ __name(({ token }) => {
      const state = requireState();
      const field = state.tournament.fields.find((f) => f.token === token);
      if (!field) throw new RpcError("Dieses Feld gibt es nicht (mehr).");
      return { state: stripTokens(state), fieldNumber: field.number };
    }, "vt_get_field"),
    vt_submit_result: /* @__PURE__ */ __name(async ({ token, sets }) => {
      const state = requireState();
      const g = findGame(state, token);
      if (!g) throw new RpcError("Dieses Spiel gibt es nicht (mehr).");
      if (!g.team1Id || !g.team2Id) throw new RpcError("Die Teams dieses Spiels stehen noch nicht fest.");
      const edit = refereeCanEdit(state, g);
      if (!edit.ok) throw new RpcError(edit.reason);
      let valid;
      try {
        valid = validateSets(sets, g.mode);
      } catch (err) {
        if (err instanceof ResultError) throw new RpcError(err.message);
        throw err;
      }
      setResult(state, g.id, valid, { by: "referee" });
      await store.save(state);
      return { ok: true, version: store.version };
    }, "vt_submit_result")
  };
}
__name(createRpc, "createRpc");
async function runRpc(fns, name, params) {
  const fn = fns[name];
  if (!fn) return { status: 404, body: { message: `Unbekannte Funktion ${name}` } };
  try {
    return { status: 200, body: await fn(params && typeof params === "object" ? params : {}) };
  } catch (err) {
    if (err instanceof RpcError) return { status: 400, body: { message: err.message } };
    throw err;
  }
}
__name(runRpc, "runRpc");

// src/core.js
var KEY_TOURNAMENT = "tournament";
var KEY_SETTINGS = "settings";
var PBKDF2_ITERATIONS = 1e5;
var b64 = /* @__PURE__ */ __name((bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))), "b64");
var unb64 = /* @__PURE__ */ __name((s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0)), "unb64");
async function derive(pin, salt, iterations) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  return crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
}
__name(derive, "derive");
async function hashPin(pin, iterations = PBKDF2_ITERATIONS) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await derive(pin, salt, iterations);
  return `pbkdf2$${iterations}$${b64(salt)}$${b64(bits)}`;
}
__name(hashPin, "hashPin");
async function verifyPin(pin, stored) {
  if (typeof pin !== "string" || typeof stored !== "string") return false;
  const [algo, iterations, salt, hash] = stored.split("$");
  if (algo !== "pbkdf2" || !salt || !hash) return false;
  const bits = new Uint8Array(await derive(pin, unb64(salt), Number(iterations)));
  const expected = unb64(hash);
  if (bits.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < bits.length; i += 1) diff |= bits[i] ^ expected[i];
  return diff === 0;
}
__name(verifyPin, "verifyPin");
function checkNewPin(pin) {
  if (typeof pin !== "string" || pin.length < 4) throw new RpcError("Die PIN muss mindestens 4 Zeichen haben.");
  if (pin.length > 64) throw new RpcError("Die PIN darf h\xF6chstens 64 Zeichen haben.");
}
__name(checkNewPin, "checkNewPin");
var TournamentCore = class {
  static {
    __name(this, "TournamentCore");
  }
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
    const t = await this.storage.get(KEY_TOURNAMENT) || {};
    const s = await this.storage.get(KEY_SETTINGS) || {};
    this.state = t.state || null;
    this.version = Number(t.version) || 0;
    this.updatedAt = t.updatedAt || null;
    this.pinHash = s.adminPinHash || null;
    if (this.state) refresh(this.state);
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
      get state() {
        return core.state;
      },
      get version() {
        return core.version;
      },
      get updatedAt() {
        return core.updatedAt;
      },
      async save(state) {
        const version = core.version + 1;
        const updatedAt = (/* @__PURE__ */ new Date()).toISOString();
        await core.put(KEY_TOURNAMENT, { state, version, updatedAt });
        core.state = state;
        core.version = version;
        core.updatedAt = updatedAt;
      }
    };
  }
  pinAdapter() {
    const core = this;
    const store = /* @__PURE__ */ __name(async (hash) => {
      await core.put(KEY_SETTINGS, { adminPinHash: hash });
      core.pinHash = hash;
    }, "store");
    return {
      status: /* @__PURE__ */ __name(() => ({ configured: !!core.pinHash }), "status"),
      async set(pin) {
        if (core.pinHash) throw new RpcError("Es ist bereits eine PIN gesetzt.");
        checkNewPin(pin);
        const hash = await hashPin(pin);
        if (core.pinHash) throw new RpcError("Es ist bereits eine PIN gesetzt.");
        await store(hash);
        return { ok: true };
      },
      async change(oldPin, newPin) {
        if (!await this.check(oldPin)) throw new RpcError("Falsche PIN.");
        checkNewPin(newPin);
        await store(await hashPin(newPin));
        return { ok: true };
      },
      check: /* @__PURE__ */ __name((pin) => core.pinHash ? verifyPin(pin, core.pinHash) : false, "check")
    };
  }
  /** Führt eine RPC-Funktion aus: { status, body }. Unerwartete Fehler werden geworfen. */
  async handle(name, params) {
    if (!this.ready) this.ready = this.load().catch((err) => {
      this.ready = null;
      throw err;
    });
    await this.ready;
    return runRpc(this.fns, name, params);
  }
};

// src/http.js
var MAX_BODY = 5 * 1024 * 1024;
var FN_NAME = /^vt_[a-z_]{1,40}$/;
var json = /* @__PURE__ */ __name((status, body, headers = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers }
}), "json");
function corsHeaders(request, env = {}) {
  const origin = request.headers.get("Origin");
  const allowed = String(env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim().replace(/\/+$/, "")).filter(Boolean);
  const base = {
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400"
  };
  if (allowed.length === 0) return { ...base, "Access-Control-Allow-Origin": "*" };
  if (!origin) return base;
  if (!allowed.includes(origin)) return null;
  return { ...base, "Access-Control-Allow-Origin": origin, Vary: "Origin" };
}
__name(corsHeaders, "corsHeaders");
async function handleRequest(request, env, run) {
  const cors = corsHeaders(request, env);
  if (!cors) return json(403, { message: "Diese Herkunft ist nicht erlaubt (ALLOWED_ORIGINS)." });
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  const url = new URL(request.url);
  if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
    return new Response("Volleyballturnier-Backend l\xE4uft. Diese Adresse geh\xF6rt als apiUrl in docs/config.js.\n", {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8", ...cors }
    });
  }
  const m = url.pathname.match(/^\/rpc\/([^/]+)\/?$/);
  if (!m) return json(404, { message: "Seite nicht gefunden." }, cors);
  if (request.method !== "POST") return json(405, { message: "Nur POST erlaubt." }, { ...cors, Allow: "POST, OPTIONS" });
  const name = m[1];
  if (!FN_NAME.test(name)) return json(404, { message: `Unbekannte Funktion ${name}` }, cors);
  const length = Number(request.headers.get("Content-Length") || 0);
  if (length > MAX_BODY) return json(413, { message: "Anfrage zu gro\xDF." }, cors);
  let params = {};
  const text = await request.text();
  if (text.length > MAX_BODY) return json(413, { message: "Anfrage zu gro\xDF." }, cors);
  if (text.trim()) {
    try {
      params = JSON.parse(text);
    } catch {
      return json(400, { message: "Ung\xFCltiges JSON." }, cors);
    }
  }
  if (!params || typeof params !== "object" || Array.isArray(params)) return json(400, { message: "Ung\xFCltige Parameter." }, cors);
  try {
    const { status, body } = await run(name, params);
    return json(status, body, cors);
  } catch (err) {
    console.error(`RPC ${name} fehlgeschlagen:`, err);
    return json(500, { message: "Interner Fehler im Backend. Bitte sp\xE4ter erneut versuchen." }, cors);
  }
}
__name(handleRequest, "handleRequest");

// src/index.js
var Tournament = class extends DurableObject {
  static {
    __name(this, "Tournament");
  }
  constructor(ctx, env) {
    super(ctx, env);
    this.core = new TournamentCore(ctx.storage);
  }
  /** RPC-Methode für den Worker: liefert { status, body }. */
  rpc(name, params) {
    return this.core.handle(name, params);
  }
};
var index_default = {
  fetch(request, env) {
    const stub = env.TOURNAMENT.get(env.TOURNAMENT.idFromName("current"));
    return handleRequest(request, env, (name, params) => stub.rpc(name, params));
  }
};
export {
  Tournament,
  index_default as default
};
//# sourceMappingURL=index.js.map
