
import test from 'node:test';
import assert from 'node:assert/strict';
import { computeStandings } from '../docs/engine/standings.js';

const g = (a, b, sets) => ({ team1Id: a, team2Id: b, sets, mode: 'roundrobin' });

test('Sortierung nach Siegen, Satzdifferenz, Punktdifferenz', () => {
  const games = [
    g('A', 'B', [[15, 10], [15, 12]]), // A gewinnt 2:0
    g('A', 'C', [[15, 13], [10, 15]]), // 1:1
    g('B', 'C', [[15, 5], [15, 6]]),   // B gewinnt 2:0
  ];
  const t = computeStandings(['A', 'B', 'C'], games);
  // A und B je 1 Sieg; A hat die bessere Satzdifferenz (+2 gegenüber 0)
  assert.deepEqual(t.map((r) => r.teamId), ['A', 'B', 'C']);
  const a = t[0];
  assert.equal(a.wins, 1); assert.equal(a.draws, 1); assert.equal(a.losses, 0); assert.equal(a.setDiff, 2);
  const b = t[1];
  assert.equal(b.wins, 1); assert.equal(b.losses, 1); assert.equal(b.draws, 0);
  assert.equal(b.setDiff, 0); assert.equal(b.pointDiff, 52 - 41);
  assert.equal(t[2].losses, 1); assert.equal(t[2].draws, 1);
});

test('Gleiche Siege: Satzdifferenz entscheidet', () => {
  const games = [
    g('A', 'B', [[15, 10], [15, 12]]),
    g('C', 'D', [[15, 10], [10, 15]]),
    g('A', 'C', [[15, 13], [15, 14]]),
    g('B', 'D', [[15, 1], [15, 2]]),
  ];
  const t = computeStandings(['A', 'B', 'C', 'D'], games);
  assert.equal(t[0].teamId, 'A'); // 2 Siege
  assert.equal(t[1].teamId, 'B'); // 1 Sieg, +0 Sätze? B: 0:2 und 2:0 = 0, D: 1:1 und 0:2 = -2, C: 1:1 und 0:2 = -2
  assert.equal(t[0].place, 1);
  assert.equal(t[3].place, 4);
});

test('Direkter Vergleich bei komplettem Gleichstand', () => {
  // A und B jeweils 1 Sieg, gleiche Satz- und Punktdifferenz; A hat gegen B gewonnen.
  const games = [
    g('A', 'B', [[15, 10], [15, 10]]),
    g('B', 'C', [[15, 10], [15, 10]]),
    g('C', 'A', [[15, 10], [15, 10]]),
  ];
  const t = computeStandings(['A', 'B', 'C'], games, (id) => id);
  // Alle drei komplett gleich (Zirkel) -> Gleichstand markiert
  assert.ok(t.every((r) => r.tie));
  // Mit einem zusätzlichen Team D, das gegen alle verliert, bleibt der Zirkel
  const games2 = games.concat([g('D', 'A', [[1, 15], [1, 15]]), g('D', 'B', [[1, 15], [1, 15]]), g('D', 'C', [[1, 15], [1, 15]])]);
  const t2 = computeStandings(['A', 'B', 'C', 'D'], games2);
  assert.equal(t2[3].teamId, 'D');
  assert.equal(t2[3].tie, undefined);
});

test('Direkter Vergleich löst Zweier-Gleichstand', () => {
  const games = [
    g('A', 'B', [[15, 10], [15, 10]]), // A schlägt B
    g('A', 'C', [[5, 15], [5, 15]]),   // C schlägt A
    g('B', 'C', [[15, 5], [15, 5]]),   // B schlägt C
    g('A', 'D', [[15, 0], [15, 0]]),
    g('B', 'D', [[15, 0], [15, 0]]),
    g('C', 'D', [[0, 15], [0, 15]]),   // D schlägt C
  ];
  // A: 2 Siege, Sätze 4:2, B: 2 Siege, Sätze 4:2, gleiche Punkte? A: 30+10+30=70 für, 20+30+0=50 gegen -> +20; B: 20+30+30=80 für, 30+10+0=40 -> +40
  const t = computeStandings(['A', 'B', 'C', 'D'], games);
  assert.equal(t[0].teamId, 'B'); // bessere Punktdifferenz
  assert.equal(t[1].teamId, 'A');
});
