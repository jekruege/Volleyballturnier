'use strict';
const teams15 = require('./teams15');
const teams16 = require('./teams16');

const FORMATS = { [teams15.id]: teams15, [teams16.id]: teams16 };

function getFormat(id) {
  const f = FORMATS[id];
  if (!f) throw new Error(`Unbekanntes Turnierformat: ${id}`);
  return f;
}

function listFormats() {
  return Object.values(FORMATS).map((f) => ({
    id: f.id, name: f.name, teamCount: f.teamCount, fieldCount: f.fieldCount,
    groups: f.groups, phase1: f.phase1.description, phase2: f.phase2.description,
  }));
}

module.exports = { FORMATS, getFormat, listFormats };
