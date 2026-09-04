
import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../docs/engine/tournament.js';
import { validateSets } from '../docs/engine/results.js';

const NAMES15 = ['Rübenzwerge', 'Häää', 'Die Klein Heidemänner', 'Little Gozillas', 'Kontiki', 'Beachrobben', 'Team Hotte', 'raSand_', 'Rübenriesen', 'Hallenstauballergiker', 'Blockwürstchen', 'Gurkengruppe', 'ImPoSand', 'The Joker', 'Beachparty'];
const NAMES16 = ['Rübenzwerge', 'Sandsturm', 'Beachparty', 'Häää', 'The Joker', 'Cousins', 'Kontiki', 'Beachrobben', 'Blockwürstchen', 'Gurkengruppe', 'Rübenriesen', 'raSand_', 'Team Hotte', 'Little Gozillas', 'Hallenstauballergiker', 'ImPoSand'];

function make15() {
  return T.createTournament({ formatId: 'teams15', name: 'T15', teams: NAMES15.map((n, i) => ({ name: n, group: 'ABC'[Math.floor(i / 5)] })) });
}
function make16() {
  return T.createTournament({ formatId: 'teams16', name: 'T16', teams: NAMES16.map((n, i) => ({ name: n, group: 'AB'[Math.floor(i / 8)] })) });
}

// deterministischer Pseudo-Zufall
function rng(seed) { let s = seed; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; }
function playOpen(state, phase, rand) {
  let played = 0;
  for (let guard = 0; guard < 10; guard += 1) {
    const open = state.games.filter((g) => g.phase === phase && !g.sets && g.team1Id && g.team2Id);
    if (!open.length) break;
    for (const g of open) {
      const set = () => { const a = 15 + Math.floor(rand() * 3); const b = Math.floor(rand() * 14); return rand() < 0.5 ? [a, b] : [b, a]; };
      let sets = [set(), set()];
      if (g.mode === 'ko' && sets.filter(([a, b]) => a > b).length === 1) sets.push(set());
      T.setResult(state, g.id, validateSets(sets, g.mode), { by: 'test' });
      played += 1;
    }
  }
  return played;
}
function checkReferees(state) {
  const slots = [...new Set(state.games.map((g) => g.slot))];
  for (const s of slots) {
    const games = state.games.filter((g) => g.slot === s);
    const playing = new Set(games.flatMap((g) => [g.team1Id, g.team2Id]));
    const refs = games.map((g) => g.refereeId).filter(Boolean);
    for (const r of refs) assert.ok(!playing.has(r), `Schiri ${r} spielt selbst in Slot ${s}`);
    assert.equal(new Set(refs).size, refs.length, `Schiri doppelt in Slot ${s}`);
  }
}

test('15 Teams: Struktur des Spielplans', () => {
  const s = make15();
  assert.equal(s.games.length, 30 + 15 + 2);
  assert.equal(Math.max(...s.games.map((g) => g.slot)), 16);
  // Jedes Team spielt in Phase 1 genau 4 Spiele
  for (const t of s.teams) assert.equal(s.games.filter((g) => g.phase === 1 && (g.team1Id === t.id || g.team2Id === t.id)).length, 4);
  // Kein Team spielt zweimal im selben Slot; pro Slot/Feld nur ein Spiel
  const seen = new Set();
  for (const g of s.games) {
    const key = `${g.slot}/${g.field}`; assert.ok(!seen.has(key), `Feld doppelt belegt: ${key}`); seen.add(key);
  }
  // Schiri-Zuteilung Phase 1: ausgeglichen (2 je Team) und gültig
  const counts = {};
  for (const g of s.games.filter((x) => x.phase === 1)) counts[g.refereeId] = (counts[g.refereeId] || 0) + 1;
  assert.deepEqual(Object.values(counts), Array(15).fill(2));
  checkReferees(s);
});

test('16 Teams: Struktur des Spielplans', () => {
  const s = make16();
  assert.equal(s.games.length, 32 + 16 + 2);
  assert.equal(Math.max(...s.games.map((g) => g.slot)), 17);
  for (const t of s.teams) assert.equal(s.games.filter((g) => g.phase === 1 && (g.team1Id === t.id || g.team2Id === t.id)).length, 4);
  // Phase-2-Spiele beginnen erst nach der letzten Gruppenrunde
  const lastP1 = Math.max(...s.games.filter((g) => g.phase === 1).map((g) => g.slot));
  assert.ok(s.games.filter((g) => g.phase >= 2).every((g) => g.slot > lastP1));
  // Finale/Platz 3 einer Runde liegen nach beiden Halbfinals
  for (const r of ['gold1', 'gold2', 'silber', 'bronze']) {
    const slotOf = (n) => s.games.find((g) => g.id === `p2-${r}-${n}`).slot;
    assert.ok(slotOf(3) > Math.max(slotOf(1), slotOf(2)));
    assert.ok(slotOf(4) > Math.max(slotOf(1), slotOf(2)));
  }
  const counts = {};
  for (const g of s.games.filter((x) => x.phase === 1)) counts[g.refereeId] = (counts[g.refereeId] || 0) + 1;
  assert.deepEqual(Object.values(counts), Array(16).fill(2));
  checkReferees(s);
});

test('Falsche Teamanzahl / doppelte Namen werden abgewiesen', () => {
  assert.throws(() => T.createTournament({ formatId: 'teams15', teams: NAMES15.slice(0, 14).map((n) => ({ name: n, group: 'A' })) }), /genau 15 Teams/);
  assert.throws(() => T.createTournament({ formatId: 'teams15', teams: NAMES15.map((n) => ({ name: 'X', group: 'A' })) }), /doppelt/);
  assert.throws(() => T.createTournament({ formatId: 'teams15', teams: NAMES15.map((n) => ({ name: n, group: 'A' })) }), /Gruppe A braucht 5/);
});

test('15 Teams: kompletter Durchlauf bis zur Endplatzierung', () => {
  const s = make15();
  const rand = rng(42);
  assert.equal(playOpen(s, 1, rand), 30);
  assert.throws(() => T.confirmPhase2(s), /Zuerst die 1/);
  // Vor Abschluss sind die Teams der 2. Phase unbekannt
  assert.equal(s.games.find((g) => g.phase === 2).team1Id, null);
  T.confirmPhase1(s);
  assert.equal(s.phase, 2);
  // Seeds: Gold 1 = 1.A, 1.C, 2.A
  const gold1 = s.games.filter((g) => g.phase === 2 && g.round === 'gold1');
  const teamsGold1 = new Set(gold1.flatMap((g) => [g.team1Id, g.team2Id]));
  assert.equal(teamsGold1.size, 3);
  assert.ok(teamsGold1.has(s.placements.phase1.A[0]) && teamsGold1.has(s.placements.phase1.C[0]) && teamsGold1.has(s.placements.phase1.A[1]));
  // Schiri in Dreier-Runde = das pausierende Team der Runde
  for (const g of gold1) assert.ok(teamsGold1.has(g.refereeId), 'Schiri der Dreier-Runde sollte aus der Runde kommen');
  assert.throws(() => T.setResult(s, 'p1-A-1', [[15, 1], [15, 1]]), /abgeschlossen/);
  assert.equal(playOpen(s, 2, rand), 15);
  T.confirmPhase2(s);
  assert.equal(s.phase, 3);
  const finale = s.games.find((g) => g.id === 'p3-finale');
  assert.equal(finale.team1Id, s.placements.phase2.gold1[0]);
  assert.equal(finale.team2Id, s.placements.phase2.gold2[0]);
  assert.equal(playOpen(s, 3, rand), 2);
  const ranking = T.finalRanking(s);
  assert.equal(ranking.length, 15);
  assert.ok(ranking.every((r) => r.teamId));
  assert.equal(new Set(ranking.map((r) => r.teamId)).size, 15);
  checkReferees(s);
  // Alle Spiele haben einen Schiri (kein "orga" nötig)
  assert.ok(s.games.every((g) => g.refereeId && g.refereeId !== 'orga'));
});

test('16 Teams: K.o.-Runden lösen sich automatisch auf', () => {
  const s = make16();
  const rand = rng(7);
  playOpen(s, 1, rand);
  T.confirmPhase1(s);
  const hf1 = s.games.find((g) => g.id === 'p2-gold1-1');
  assert.equal(hf1.team1Id, s.placements.phase1.A[0]);
  assert.equal(hf1.team2Id, s.placements.phase1.B[3]);
  const fin = s.games.find((g) => g.id === 'p2-gold1-3');
  assert.equal(fin.team1Id, null);
  playOpen(s, 2, rand);
  assert.ok(fin.team1Id && fin.team2Id);
  T.confirmPhase2(s);
  playOpen(s, 3, rand);
  const ranking = T.finalRanking(s);
  assert.equal(ranking.length, 16);
  assert.equal(new Set(ranking.map((r) => r.teamId).filter(Boolean)).size, 16);
  checkReferees(s);
  const view = T.buildView(s);
  assert.equal(view.phaseComplete[3], true);
  assert.equal(view.ranking[0].source, 'Sieger Finale');
});

test('Wiedereröffnung ohne Ergebnisse der 2. Phase möglich, mit Ergebnissen nicht', () => {
  const s = make15();
  const rand = rng(5);
  playOpen(s, 1, rand);
  T.confirmPhase1(s);
  T.reopenPhase1(s);
  assert.equal(s.phase, 1);
  assert.equal(s.games.find((g) => g.phase === 2).team1Id, null);
  T.confirmPhase1(s);
  const g2 = s.games.find((g) => g.phase === 2);
  T.setResult(s, g2.id, [[15, 3], [15, 4]]);
  assert.throws(() => T.reopenPhase1(s), /Ergebnisse der 2\. Phase/);
  T.clearResult(s, g2.id);
  T.reopenPhase1(s);
  assert.equal(s.phase, 1);
});

test('Manueller Schiri bleibt erhalten, spielendes Team abgelehnt', () => {
  const s = make15();
  const g = s.games.find((x) => x.phase === 1);
  assert.throws(() => T.setReferee(s, g.id, g.team1Id), /spielendes Team/);
  const other = s.teams.find((t) => t.id !== g.team1Id && t.id !== g.team2Id && !s.games.some((x) => x.slot === g.slot && (x.team1Id === t.id || x.team2Id === t.id)));
  T.setReferee(s, g.id, other.id);
  T.resetReferees(s);
  assert.equal(g.refereeId, other.id);
  assert.equal(g.refereeManual, true);
  T.setReferee(s, g.id, 'orga');
  assert.equal(g.refereeId, 'orga');
});
