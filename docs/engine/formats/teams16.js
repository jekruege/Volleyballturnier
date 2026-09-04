// Format: Quattro-Mixed mit 16 Teams (2 Gruppen à 8, 4 Spiele je Team),
// danach 4 K.o.-Runden à 4 Teams (2 Halbfinale, Finale, Spiel um Platz 3),
// abschließend Finale und Kleines Finale. Entspricht der Vorlage "2026Quattro_Mixed16".

// Paarungen je Gruppe (Positionsnummern 1–8), Reihenfolge wie in der Vorlage.
const GROUP_PAIRINGS = [
  [1, 2], [3, 4], [5, 6], [7, 8],
  [1, 3], [2, 4], [5, 7], [6, 8],
  [1, 4], [2, 3], [5, 8], [6, 7],
  [1, 5], [2, 6], [3, 7], [4, 8],
];

// Slot-Layout der Vorlage: [Feld, Gruppe, Spielnummer in der Gruppe]
const SLOT_LAYOUT = [
  [[1, 'A', 1], [2, 'B', 1], [3, 'A', 2]],
  [[1, 'B', 2], [2, 'A', 3], [3, 'B', 3]],
  [[1, 'A', 4], [2, 'B', 4], [3, 'A', 5]],
  [[1, 'B', 5], [2, 'A', 6], [3, 'B', 6]],
  [[1, 'A', 7], [2, 'B', 7], [3, 'A', 8]],
  [[1, 'B', 8], [2, 'A', 9], [3, 'B', 9]],
  [[1, 'A', 10], [2, 'B', 10], [3, 'A', 11]],
  [[1, 'B', 11], [2, 'A', 12], [3, 'B', 12]],
  [[1, 'A', 13], [2, 'B', 13], [3, 'A', 14]],
  [[1, 'B', 14], [2, 'A', 15], [3, 'B', 15]],
  [[1, 'A', 16], [2, 'B', 16]],
];

const phase1Slots = SLOT_LAYOUT.map((entries, slotIndex) => ({
  slot: slotIndex + 1,
  games: entries.map(([field, group, gameNo]) => {
    const pair = GROUP_PAIRINGS[gameNo - 1];
    return {
      field,
      group,
      team1: { type: 'group', group, pos: pair[0] },
      team2: { type: 'group', group, pos: pair[1] },
    };
  }),
}));

export default {
  id: 'teams16',
  name: 'Quattro Mixed – 16 Teams (2×8, dann K.o.-Runden)',
  teamCount: 16,
  fieldCount: 3,
  groups: [
    { id: 'A', name: 'Gruppe A', size: 8 },
    { id: 'B', name: 'Gruppe B', size: 8 },
  ],
  phase1: {
    description: '2 Gruppen à 8 Teams, 4 Spiele je Team (16 Spiele je Gruppe)',
    slots: phase1Slots,
  },
  phase2: {
    description: '4 K.o.-Runden à 4 Teams: 2 Halbfinale, Finale, Spiel um Platz 3',
    rounds: [
      { id: 'gold1', name: 'Gold-Runde 1', type: 'ko4', tier: 'gold',
        seeds: [{ group: 'A', place: 1 }, { group: 'B', place: 2 }, { group: 'A', place: 3 }, { group: 'B', place: 4 }] },
      { id: 'gold2', name: 'Gold-Runde 2', type: 'ko4', tier: 'gold',
        seeds: [{ group: 'A', place: 2 }, { group: 'B', place: 1 }, { group: 'A', place: 4 }, { group: 'B', place: 3 }] },
      { id: 'silber', name: 'Silber-Runde', type: 'ko4', tier: 'silber',
        seeds: [{ group: 'A', place: 5 }, { group: 'B', place: 5 }, { group: 'A', place: 6 }, { group: 'B', place: 6 }] },
      { id: 'bronze', name: 'Bronze-Runde', type: 'ko4', tier: 'bronze',
        seeds: [{ group: 'A', place: 7 }, { group: 'B', place: 7 }, { group: 'A', place: 8 }, { group: 'B', place: 8 }] },
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
  finalRanking: [
    [{ type: 'winner', game: 'finale' }],
    [{ type: 'loser', game: 'finale' }],
    [{ type: 'winner', game: 'kleines_finale' }],
    [{ type: 'loser', game: 'kleines_finale' }],
    [{ type: 'roundPlace', round: 'gold1', place: 3 }, { type: 'roundPlace', round: 'gold2', place: 3 }],
    [{ type: 'roundPlace', round: 'gold1', place: 4 }, { type: 'roundPlace', round: 'gold2', place: 4 }],
    [{ type: 'roundPlace', round: 'silber', place: 1 }],
    [{ type: 'roundPlace', round: 'silber', place: 2 }],
    [{ type: 'roundPlace', round: 'silber', place: 3 }],
    [{ type: 'roundPlace', round: 'silber', place: 4 }],
    [{ type: 'roundPlace', round: 'bronze', place: 1 }],
    [{ type: 'roundPlace', round: 'bronze', place: 2 }],
    [{ type: 'roundPlace', round: 'bronze', place: 3 }],
    [{ type: 'roundPlace', round: 'bronze', place: 4 }],
  ],
};
