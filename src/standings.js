'use strict';
const { evaluate } = require('./results');

// Tabellenberechnung. Sortierung: 1. Siege, 2. Satzdifferenz, 3. Punktdifferenz,
// 4. direkter Vergleich (nur unter den punktgleichen Teams), 5. gewonnene Punkte, 6. Name.

function emptyRow(teamId) {
  return {
    teamId, played: 0, wins: 0, draws: 0, losses: 0,
    setsFor: 0, setsAgainst: 0, setDiff: 0, pointsFor: 0, pointsAgainst: 0, pointDiff: 0,
  };
}

function accumulate(rows, games) {
  for (const g of games) {
    const r = evaluate(g);
    if (!r || !g.team1Id || !g.team2Id) continue;
    const a = rows.get(g.team1Id);
    const b = rows.get(g.team2Id);
    if (!a || !b) continue;
    a.played += 1; b.played += 1;
    a.setsFor += r.sets1; a.setsAgainst += r.sets2; b.setsFor += r.sets2; b.setsAgainst += r.sets1;
    a.pointsFor += r.points1; a.pointsAgainst += r.points2; b.pointsFor += r.points2; b.pointsAgainst += r.points1;
    if (r.winner === 1) { a.wins += 1; b.losses += 1; } else if (r.winner === 2) { b.wins += 1; a.losses += 1; } else { a.draws += 1; b.draws += 1; }
  }
  for (const row of rows.values()) {
    row.setDiff = row.setsFor - row.setsAgainst;
    row.pointDiff = row.pointsFor - row.pointsAgainst;
  }
}

function cmpBasic(a, b) {
  return (b.wins - a.wins) || (b.setDiff - a.setDiff) || (b.pointDiff - a.pointDiff);
}

/**
 * @param {string[]} teamIds Teams der Gruppe/Runde
 * @param {object[]} games Spiele (mit team1Id/team2Id/sets/mode)
 * @param {(id:string)=>string} nameOf Name für die letzte Sortierstufe
 */
function computeStandings(teamIds, games, nameOf = (id) => id) {
  const rows = new Map(teamIds.map((id) => [id, emptyRow(id)]));
  const relevant = games.filter((g) => rows.has(g.team1Id) && rows.has(g.team2Id));
  accumulate(rows, relevant);
  const list = [...rows.values()];

  // Gruppen gleichwertiger Teams bilden und per direktem Vergleich auflösen
  list.sort(cmpBasic);
  const result = [];
  let i = 0;
  while (i < list.length) {
    let j = i + 1;
    while (j < list.length && cmpBasic(list[i], list[j]) === 0) j += 1;
    const tied = list.slice(i, j);
    if (tied.length > 1) {
      const tiedIds = new Set(tied.map((r) => r.teamId));
      const h2hRows = new Map(tied.map((r) => [r.teamId, emptyRow(r.teamId)]));
      accumulate(h2hRows, relevant.filter((g) => tiedIds.has(g.team1Id) && tiedIds.has(g.team2Id)));
      tied.sort((a, b) => {
        const ha = h2hRows.get(a.teamId); const hb = h2hRows.get(b.teamId);
        return cmpBasic(ha, hb) || (b.pointsFor - a.pointsFor) || nameOf(a.teamId).localeCompare(nameOf(b.teamId), 'de');
      });
      // Markieren, wenn auch der direkte Vergleich keine Entscheidung bringt
      for (let k = 0; k < tied.length - 1; k += 1) {
        const ha = h2hRows.get(tied[k].teamId); const hb = h2hRows.get(tied[k + 1].teamId);
        if (cmpBasic(ha, hb) === 0 && tied[k].pointsFor === tied[k + 1].pointsFor) {
          tied[k].tie = true; tied[k + 1].tie = true;
        }
      }
    }
    result.push(...tied);
    i = j;
  }
  result.forEach((row, idx) => { row.place = idx + 1; });
  return result;
}

module.exports = { computeStandings, cmpBasic };
