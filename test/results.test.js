
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSets, evaluate, ResultError } from '../docs/engine/results.js';

test('Gruppenspiel: zwei Sätze, Unentschieden möglich', () => {
  const sets = validateSets([['15', '10'], ['12', '15']], 'roundrobin');
  assert.deepEqual(sets, [[15, 10], [12, 15]]);
  const r = evaluate({ sets, mode: 'roundrobin' });
  assert.equal(r.winner, 0);
  assert.equal(r.points1, 27);
  assert.equal(r.points2, 25);
});

test('Gruppenspiel: dritter Satz nicht erlaubt', () => {
  assert.throws(() => validateSets([[15, 10], [12, 15], [15, 9]], 'roundrobin'), ResultError);
});

test('Satz darf nicht unentschieden sein, beide Sätze Pflicht', () => {
  assert.throws(() => validateSets([[15, 15], [12, 15]], 'roundrobin'), /unentschieden/);
  assert.throws(() => validateSets([[15, 10], ['', '']], 'roundrobin'), /Satz 1 und Satz 2/);
  assert.throws(() => validateSets([[15, 10], ['12', '']], 'roundrobin'), /beide Punktzahlen/);
  assert.throws(() => validateSets([[15, 10], ['a', '3']], 'roundrobin'), /ganze Zahlen/);
});

test('K.o.: 1:1 nach Sätzen -> Punkte entscheiden, bei Gleichstand 3. Satz Pflicht', () => {
  const sets = validateSets([[15, 10], [12, 15]], 'ko');
  const r = evaluate({ sets, mode: 'ko' });
  assert.equal(r.winner, 1);
  assert.equal(r.decidedBy, 'points');
  assert.throws(() => validateSets([[15, 10], [10, 15]], 'ko'), /3\. Satz/);
  const withThird = validateSets([[15, 10], [10, 15], [13, 15]], 'ko');
  assert.equal(evaluate({ sets: withThird, mode: 'ko' }).winner, 2);
  assert.throws(() => validateSets([[15, 10], [15, 11], [13, 15]], 'ko'), /keinen 3\. Satz/);
});
