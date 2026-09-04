'use strict';
const fs = require('fs');
const path = require('path');

/** Einfache JSON-Datei-Persistenz mit atomarem Schreiben. */
class Store {
  constructor(file) {
    this.file = path.resolve(file);
    this.state = null;
  }

  load() {
    try {
      const raw = fs.readFileSync(this.file, 'utf8');
      this.state = JSON.parse(raw);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
      this.state = null;
    }
    return this.state;
  }

  save(state) {
    this.state = state;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(state, null, 1));
    fs.renameSync(tmp, this.file);
  }

  clear() {
    this.state = null;
    try { fs.unlinkSync(this.file); } catch (err) { if (err.code !== 'ENOENT') throw err; }
  }
}

module.exports = { Store };
