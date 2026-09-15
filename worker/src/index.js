// Cloudflare Worker: stellt die RPC-Funktionen der App (siehe src/rpc.js) unter POST /rpc/<name>
// bereit. Der komplette Turnierstand liegt in einem einzigen Durable Object ("current"), das
// Anfragen nacheinander verarbeitet – so gehen gleichzeitige Ergebniseingaben nicht verloren.
import { DurableObject } from 'cloudflare:workers';
import { TournamentCore } from './core.js';
import { handleRequest } from './http.js';

export class Tournament extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.core = new TournamentCore(ctx.storage);
  }

  /** RPC-Methode für den Worker: liefert { status, body }. */
  rpc(name, params) {
    return this.core.handle(name, params);
  }
}

export default {
  fetch(request, env) {
    const stub = env.TOURNAMENT.get(env.TOURNAMENT.idFromName('current'));
    return handleRequest(request, env, (name, params) => stub.rpc(name, params));
  },
};
