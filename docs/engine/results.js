// Auswertung eines einzelnen Spiels: Sätze, Punkte, Sieger.
// Modus 'roundrobin': 2 Sätze, Unentschieden (1:1) möglich.
// Modus 'ko': Sieger erforderlich. Bei 1:1 nach Sätzen entscheidet ein optionaler
// 3. Satz; ohne 3. Satz entscheidet die Punktdifferenz. Bei Gleichstand ist ein 3. Satz Pflicht.

const MAX_POINTS = 99;

class ResultError extends Error {}

function toInt(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  if (!Number.isInteger(n)) return NaN;
  return n;
}

/**
 * Normalisiert und validiert die Eingabe. Erwartet sets als Array von [t1, t2]
 * (Strings oder Zahlen). Wirft ResultError mit deutscher Fehlermeldung.
 */
function validateSets(rawSets, mode) {
  if (!Array.isArray(rawSets)) throw new ResultError('Ungültige Eingabe.');
  const sets = [];
  for (let i = 0; i < 3; i += 1) {
    const raw = rawSets[i];
    if (!raw) { sets.push(null); continue; }
    const a = toInt(raw[0]);
    const b = toInt(raw[1]);
    if (a === null && b === null) { sets.push(null); continue; }
    if (a === null || b === null) throw new ResultError(`Satz ${i + 1}: Bitte beide Punktzahlen eintragen.`);
    if (Number.isNaN(a) || Number.isNaN(b)) throw new ResultError(`Satz ${i + 1}: Nur ganze Zahlen erlaubt.`);
    if (a < 0 || b < 0 || a > MAX_POINTS || b > MAX_POINTS) throw new ResultError(`Satz ${i + 1}: Punktzahl muss zwischen 0 und ${MAX_POINTS} liegen.`);
    if (a === b) throw new ResultError(`Satz ${i + 1}: Ein Satz kann nicht unentschieden enden.`);
    sets.push([a, b]);
  }
  if (!sets[0] || !sets[1]) throw new ResultError('Bitte Satz 1 und Satz 2 eintragen.');
  if (sets[2] && !sets[1]) throw new ResultError('Satz 3 ohne Satz 2 ist nicht möglich.');

  const two = [sets[0], sets[1]];
  const won1 = two.filter(([a, b]) => a > b).length;
  const won2 = 2 - won1;

  if (mode === 'roundrobin') {
    // In der Gruppenphase werden genau 2 Sätze gespielt.
    if (sets[2]) throw new ResultError('In der Gruppenphase werden nur 2 Sätze gespielt.');
    return two;
  }

  // K.o.-Modus
  if (won1 !== won2) {
    if (sets[2]) throw new ResultError('Bei 2:0 Sätzen gibt es keinen 3. Satz.');
    return two;
  }
  if (sets[2]) return sets;
  const p1 = two[0][0] + two[1][0];
  const p2 = two[0][1] + two[1][1];
  if (p1 === p2) throw new ResultError('1:1 Sätze und gleiche Punktzahl: Bitte den entscheidenden 3. Satz eintragen.');
  return two;
}

/**
 * Wertet ein Spiel aus. Gibt null zurück, wenn kein Ergebnis vorliegt.
 * winner: 1 | 2 | 0 (Unentschieden)
 */
function evaluate(game) {
  const sets = game && game.sets;
  if (!sets || sets.length < 2) return null;
  let sets1 = 0; let sets2 = 0; let points1 = 0; let points2 = 0;
  for (const [a, b] of sets) {
    if (a > b) sets1 += 1; else sets2 += 1;
    points1 += a; points2 += b;
  }
  let winner;
  let decidedBy = 'sets';
  if (sets1 > sets2) winner = 1;
  else if (sets2 > sets1) winner = 2;
  else if (game.mode === 'ko') {
    decidedBy = 'points';
    if (points1 > points2) winner = 1;
    else if (points2 > points1) winner = 2;
    else winner = 0; // sollte durch Validierung ausgeschlossen sein
  } else {
    winner = 0;
  }
  return { sets1, sets2, points1, points2, winner, decidedBy };
}

function formatSets(sets) {
  if (!sets) return '';
  return sets.map(([a, b]) => `${a}:${b}`).join(', ');
}

export { validateSets, evaluate, formatSets, ResultError };
