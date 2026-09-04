import fs from 'fs';
import path from 'path';

/** JSON-Datei-Persistenz für den lokalen Modus: { state, version } mit atomarem Schreiben. */
export class Store {
  constructor(file) {
    this.file = path.resolve(file);
    this.state = null;
    this.version = 0;
  }

  load() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      if (raw && Array.isArray(raw.games)) { this.state = raw; this.version = 1; } // altes Dateiformat
      else { this.state = raw ? raw.state : null; this.version = raw ? raw.version || 0 : 0; }
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
      this.state = null; this.version = 0;
    }
    return this.state;
  }

  save(state) {
    this.state = state;
    this.version += 1;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ state, version: this.version, updatedAt: new Date().toISOString() }, null, 1));
    fs.renameSync(tmp, this.file);
  }
}
