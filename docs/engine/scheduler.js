// Zeitplanung der 2./3. Phase und Schiedsrichter-Zuteilung.

function refKey(ref) {
  return JSON.stringify(ref);
}

/**
 * Verteilt die Spiele der Phasen 2 und 3 auf Zeit-Slots und Felder.
 * Regeln:
 *  - Ein Spiel wird erst eingeplant, wenn alle Spiele, von denen es abhängt (deps),
 *    in einem früheren Slot liegen.
 *  - Zwei Spiele mit gemeinsamem Team (gleiche Team-Referenz) laufen nie parallel.
 *  - Runden werden gleichmäßig abwechselnd bedient (Runde mit den wenigsten
 *    bereits geplanten Spielen zuerst, dann Rundenreihenfolge).
 *  - Spiele der Phase 3 (Finale) kommen erst, wenn alle Spiele der Phase 2 geplant sind.
 *
 * games: [{ id, phase, round, order, deps: [id], team1Ref, team2Ref }]
 * Mutiert games: setzt slot und field.
 */
function assignSlots(games, startSlot, fieldCount, roundOrder) {
  const roundIdx = new Map(roundOrder.map((r, i) => [r, i]));
  const scheduledInRound = new Map(roundOrder.map((r) => [r, 0]));
  const lastFieldOfRound = new Map();
  const slotOf = new Map();
  const pending = new Set(games.map((g) => g.id));
  const byId = new Map(games.map((g) => [g.id, g]));
  let slot = startSlot;
  let guard = 0;
  while (pending.size > 0) {
    guard += 1;
    if (guard > 200) throw new Error('Spielplan konnte nicht erstellt werden (Endlosschleife).');
    const usedRefs = new Set();
    const chosen = [];
    const take = (g) => {
      chosen.push(g);
      pending.delete(g.id);
      usedRefs.add(refKey(g.team1Ref)); usedRefs.add(refKey(g.team2Ref));
      if (g.round) scheduledInRound.set(g.round, (scheduledInRound.get(g.round) || 0) + 1);
    };
    const eligible = (g) => g.deps.every((d) => slotOf.has(d) && slotOf.get(d) < slot)
      && !usedRefs.has(refKey(g.team1Ref)) && !usedRefs.has(refKey(g.team2Ref));
    const sortKey = (a, b) => (scheduledInRound.get(a.round) || 0) - (scheduledInRound.get(b.round) || 0)
      || (roundIdx.get(a.round) ?? 99) - (roundIdx.get(b.round) ?? 99)
      || a.order - b.order;

    // Phase 2
    while (chosen.length < fieldCount) {
      const cands = [...pending].map((id) => byId.get(id)).filter((g) => g.phase === 2 && eligible(g)).sort(sortKey);
      if (!cands.length) break;
      take(cands[0]);
    }
    // Phase 3 erst, wenn Phase 2 vollständig geplant ist
    const phase2Open = [...pending].some((id) => byId.get(id).phase === 2);
    if (!phase2Open) {
      while (chosen.length < fieldCount) {
        const cands = [...pending].map((id) => byId.get(id)).filter((g) => g.phase === 3 && eligible(g)).sort((a, b) => a.order - b.order);
        if (!cands.length) break;
        take(cands[0]);
      }
    }
    // Felder vergeben: Runden bleiben möglichst auf "ihrem" Feld
    const freeFields = new Set(Array.from({ length: fieldCount }, (_, i) => i + 1));
    const rest = [];
    for (const g of chosen) {
      const pref = lastFieldOfRound.get(g.round);
      if (g.round && pref && freeFields.has(pref)) { g.field = pref; freeFields.delete(pref); } else rest.push(g);
    }
    for (const g of rest) { g.field = Math.min(...freeFields); freeFields.delete(g.field); }
    for (const g of chosen) {
      g.slot = slot; slotOf.set(g.id, slot);
      if (g.round) lastFieldOfRound.set(g.round, g.field);
    }
    slot += 1;
  }
  return games;
}

/**
 * Schiedsrichter-Zuteilung für einen Slot.
 * Kandidaten: Teams, die in diesem Slot nicht spielen und nicht schon ein anderes
 * Spiel im selben Slot pfeifen. Bewertung: möglichst wenige bisherige Einsätze,
 * bevorzugt ein pausierendes Team derselben Runde, bevorzugt Teams, die im
 * vorherigen Slot nicht gespielt haben.
 *
 * @param slotGames Spiele des Slots (mit team1Id/team2Id/round/phase/refereeId)
 * @param teams alle Teams [{id}]
 * @param refCount Map teamId -> bisherige Schiri-Einsätze
 * @param prevSlotPlayers Set teamIds, die im vorherigen Slot gespielt haben
 * @param sameUnit (team, game) => boolean: Team gehört zur selben Gruppe/Runde wie das Spiel
 * @returns Map gameId -> teamId | 'orga'
 */
function assignRefereesForSlot(slotGames, teams, refCount, prevSlotPlayers, sameUnit) {
  const playing = new Set();
  for (const g of slotGames) { playing.add(g.team1Id); playing.add(g.team2Id); }
  const taken = new Set(slotGames.filter((g) => g.refereeId && g.refereeId !== 'orga').map((g) => g.refereeId));
  const result = new Map();
  const toAssign = slotGames.filter((g) => !g.refereeId).sort((a, b) => a.field - b.field);
  for (const g of toAssign) {
    const cands = teams.filter((t) => !playing.has(t.id) && !taken.has(t.id));
    if (cands.length === 0) { result.set(g.id, 'orga'); continue; }
    const score = (t) => {
      const sameRound = sameUnit(t, g) ? 0 : 1;
      const rested = prevSlotPlayers.has(t.id) ? 1 : 0;
      return (refCount.get(t.id) || 0) * 100 + sameRound * 10 + rested;
    };
    cands.sort((a, b) => score(a) - score(b) || a.name.localeCompare(b.name, 'de'));
    const pick = cands[0];
    result.set(g.id, pick.id);
    taken.add(pick.id);
    refCount.set(pick.id, (refCount.get(pick.id) || 0) + 1);
  }
  return result;
}

export { assignSlots, assignRefereesForSlot };
