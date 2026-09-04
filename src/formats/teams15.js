'use strict';
// Format: Quattro-Mixed mit 15 Teams (3 Gruppen à 5, Jeder gegen Jeden),
// danach 5 Dreier-Runden (Gold 1/2, Silber 1/2, Bronze) im Jeder-gegen-Jeden,
// abschließend Finale und Kleines Finale. Entspricht der Vorlage "Turnier15Teams".

// Spielplan der 1. Gruppenphase: pro Slot ein Spiel je Gruppe (Feld 1 = Gruppe A,
// Feld 2 = Gruppe B, Feld 3 = Gruppe C). Angaben sind Positionsnummern (1–5) in der Gruppe.
const GROUP_SLOT_PAIRINGS = [
  [1, 2], [3, 4], [5, 1], [2, 3], [4, 5],
  [1, 3], [2, 4], [5, 2], [3, 5], [4, 1],
];

const groups = ['A', 'B', 'C'];

const phase1Slots = GROUP_SLOT_PAIRINGS.map((pair, slotIndex) => ({
  slot: slotIndex + 1,
  games: groups.map((g, fieldIndex) => ({
    field: fieldIndex + 1,
    group: g,
    team1: { type: 'group', group: g, pos: pair[0] },
    team2: { type: 'group', group: g, pos: pair[1] },
  })),
}));

module.exports = {
  id: 'teams15',
  name: 'Quattro Mixed – 15 Teams (3×5, dann Dreier-Runden)',
  teamCount: 15,
  fieldCount: 3,
  groups: groups.map((id) => ({ id, name: `Gruppe ${id}`, size: 5 })),
  phase1: {
    description: 'Jeder gegen Jeden in 3 Gruppen à 5 Teams (10 Spiele je Gruppe)',
    slots: phase1Slots,
  },
  phase2: {
    description: '5 Dreier-Runden im Jeder-gegen-Jeden (3 Spiele je Runde)',
    rounds: [
      { id: 'gold1', name: 'Gold-Runde 1', type: 'roundrobin', tier: 'gold',
        seeds: [{ group: 'A', place: 1 }, { group: 'C', place: 1 }, { group: 'A', place: 2 }] },
      { id: 'gold2', name: 'Gold-Runde 2', type: 'roundrobin', tier: 'gold',
        seeds: [{ group: 'B', place: 1 }, { group: 'B', place: 2 }, { group: 'C', place: 2 }] },
      { id: 'silber1', name: 'Silber-Runde 1', type: 'roundrobin', tier: 'silber',
        seeds: [{ group: 'A', place: 3 }, { group: 'C', place: 3 }, { group: 'B', place: 3 }] },
      { id: 'silber2', name: 'Silber-Runde 2', type: 'roundrobin', tier: 'silber',
        seeds: [{ group: 'A', place: 4 }, { group: 'B', place: 4 }, { group: 'C', place: 4 }] },
      { id: 'bronze', name: 'Bronze-Runde', type: 'roundrobin', tier: 'bronze',
        seeds: [{ group: 'A', place: 5 }, { group: 'B', place: 5 }, { group: 'C', place: 5 }] },
    ],
  },
  phase3: {
    games: [
      { id: 'finale', name: 'Finale',
        team1: { type: 'roundPlace', round: 'gold1', place: 1 },
        team2: { type: 'roundPlace', round: 'gold2', place: 1 } },
      { id: 'kleines_finale', name: 'Kleines Finale',
        team1: { type: 'roundPlace', round: 'gold1', place: 2 },
        team2: { type: 'roundPlace', round: 'gold2', place: 2 } },
    ],
  },
  // Endplatzierung: Liste von Stufen. Innerhalb einer Stufe mit mehreren Einträgen
  // wird nach der Bilanz in der 2. Phase sortiert (Siege, Satzdifferenz, Punktdifferenz).
  finalRanking: [
    [{ type: 'winner', game: 'finale' }],
    [{ type: 'loser', game: 'finale' }],
    [{ type: 'winner', game: 'kleines_finale' }],
    [{ type: 'loser', game: 'kleines_finale' }],
    [{ type: 'roundPlace', round: 'gold1', place: 3 }, { type: 'roundPlace', round: 'gold2', place: 3 }],
    [{ type: 'roundPlace', round: 'silber1', place: 1 }],
    [{ type: 'roundPlace', round: 'silber1', place: 2 }],
    [{ type: 'roundPlace', round: 'silber1', place: 3 }],
    [{ type: 'roundPlace', round: 'silber2', place: 1 }],
    [{ type: 'roundPlace', round: 'silber2', place: 2 }],
    [{ type: 'roundPlace', round: 'silber2', place: 3 }],
    [{ type: 'roundPlace', round: 'bronze', place: 1 }],
    [{ type: 'roundPlace', round: 'bronze', place: 2 }],
    [{ type: 'roundPlace', round: 'bronze', place: 3 }],
  ],
};
