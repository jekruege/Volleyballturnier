-- Volleyballturnier – Datenbankschema für Supabase
-- Einmalig im Supabase-Dashboard unter "SQL Editor" komplett einfügen und ausführen.
-- Kann gefahrlos erneut ausgeführt werden (Funktionen werden ersetzt, Daten bleiben erhalten).

create extension if not exists pgcrypto with schema extensions;

-- Turnierdaten: genau eine Zeile (id = 'current') mit dem kompletten Turnierstand als JSON.
create table if not exists public.vt_tournament (
  id text primary key,
  state jsonb,
  version integer not null default 0,
  updated_at timestamptz not null default now()
);

-- Einstellungen (PIN der Turnierleitung, als Hash).
create table if not exists public.vt_settings (
  id text primary key,
  admin_pin_hash text
);

insert into public.vt_tournament (id, state) values ('current', null) on conflict (id) do nothing;
insert into public.vt_settings (id) values ('current') on conflict (id) do nothing;

-- Kein direkter Tabellenzugriff über die API – nur über die Funktionen unten.
alter table public.vt_tournament enable row level security;
alter table public.vt_settings enable row level security;
revoke all on public.vt_tournament from anon, authenticated;
revoke all on public.vt_settings from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Hilfsfunktionen

create or replace function public.vt_strip(state jsonb) returns jsonb
language sql immutable as $$
  select case when state is null then null else
    jsonb_set(
      jsonb_set(state, '{games}',
        coalesce((select jsonb_agg(g - 'token') from jsonb_array_elements(state->'games') g), '[]'::jsonb)),
      '{tournament,fields}',
      coalesce((select jsonb_agg(f - 'token') from jsonb_array_elements(state->'tournament'->'fields') f), '[]'::jsonb))
  end
$$;

-- Spiel anhand eines Tokens finden: entweder das Spiel-Token selbst oder "<Feld-Token>.<Spiel-ID>"
-- (die Feldseite verlinkt ihre Spiele über das Feld-Token). Liefert den Index im games-Array oder -1.
create or replace function public.vt_find_game(s jsonb, token text) returns integer
language plpgsql immutable as $$
declare i integer; n integer; g jsonb; ftoken text; gid text; fnum integer;
begin
  if s is null or token is null then return -1; end if;
  n := jsonb_array_length(s->'games');
  if position('.' in token) > 0 then
    ftoken := split_part(token, '.', 1); gid := substr(token, position('.' in token) + 1);
    select (x->>'number')::int into fnum from jsonb_array_elements(s->'tournament'->'fields') x where x->>'token' = ftoken limit 1;
    if fnum is null then return -1; end if;
    for i in 0..n-1 loop
      g := s->'games'->i;
      if g->>'id' = gid and (g->>'field')::int = fnum then return i; end if;
    end loop;
    return -1;
  end if;
  for i in 0..n-1 loop
    if s->'games'->i->>'token' = token then return i; end if;
  end loop;
  return -1;
end $$;

create or replace function public.vt_check_pin(pin text) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare h text;
begin
  select admin_pin_hash into h from public.vt_settings where id = 'current';
  if h is null or pin is null then return false; end if;
  return h = crypt(pin, h);
end $$;

create or replace function public.vt_require_pin(pin text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.vt_check_pin(pin) then
    raise exception 'Falsche PIN.' using errcode = 'P0001';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- PIN-Verwaltung

create or replace function public.vt_pin_status() returns jsonb
language sql security definer set search_path = public, extensions as $$
  select jsonb_build_object('configured', admin_pin_hash is not null) from public.vt_settings where id = 'current'
$$;

-- Erste Einrichtung: PIN setzen, solange noch keine gesetzt ist.
create or replace function public.vt_set_admin_pin(pin text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare h text;
begin
  select admin_pin_hash into h from public.vt_settings where id = 'current' for update;
  if h is not null then raise exception 'Es ist bereits eine PIN gesetzt.'; end if;
  if pin is null or length(pin) < 4 then raise exception 'Die PIN muss mindestens 4 Zeichen haben.'; end if;
  update public.vt_settings set admin_pin_hash = crypt(pin, gen_salt('bf')) where id = 'current';
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.vt_change_admin_pin(old_pin text, new_pin text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.vt_require_pin(old_pin);
  if new_pin is null or length(new_pin) < 4 then raise exception 'Die PIN muss mindestens 4 Zeichen haben.'; end if;
  update public.vt_settings set admin_pin_hash = crypt(new_pin, gen_salt('bf')) where id = 'current';
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.vt_login(pin text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.vt_require_pin(pin);
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------------------
-- Lesen

-- Öffentlicher Stand (ohne Zugriffs-Tokens).
create or replace function public.vt_get_state() returns jsonb
language sql security definer set search_path = public, extensions as $$
  select jsonb_build_object('state', public.vt_strip(state), 'version', version, 'updatedAt', updated_at)
  from public.vt_tournament where id = 'current'
$$;

-- Vollständiger Stand für die Turnierleitung.
create or replace function public.vt_get_admin_state(pin text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare r record;
begin
  perform public.vt_require_pin(pin);
  select state, version, updated_at into r from public.vt_tournament where id = 'current';
  return jsonb_build_object('state', r.state, 'version', r.version, 'updatedAt', r.updated_at);
end $$;

-- Spiel per Token (Schiri-QR-Code): öffentlicher Stand + Spiel-ID + Feld-Token für den Rücklink.
create or replace function public.vt_get_game(token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare s jsonb; g jsonb; f jsonb; idx integer;
begin
  select state into s from public.vt_tournament where id = 'current';
  if s is null then raise exception 'Es ist kein Turnier angelegt.'; end if;
  idx := public.vt_find_game(s, token);
  if idx < 0 then raise exception 'Dieses Spiel gibt es nicht (mehr).'; end if;
  g := s->'games'->idx;
  select x into f from jsonb_array_elements(s->'tournament'->'fields') x where (x->>'number')::int = (g->>'field')::int limit 1;
  return jsonb_build_object('state', public.vt_strip(s), 'gameId', g->>'id', 'fieldToken', f->>'token');
end $$;

-- Feld per Token (Feld-QR-Code).
create or replace function public.vt_get_field(token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare s jsonb; f jsonb;
begin
  select state into s from public.vt_tournament where id = 'current';
  if s is null then raise exception 'Es ist kein Turnier angelegt.'; end if;
  select x into f from jsonb_array_elements(s->'tournament'->'fields') x where x->>'token' = token limit 1;
  if f is null then raise exception 'Dieses Feld gibt es nicht (mehr).'; end if;
  return jsonb_build_object('state', public.vt_strip(s), 'fieldNumber', (f->>'number')::int);
end $$;

-- ---------------------------------------------------------------------------
-- Schreiben

-- Turnierleitung speichert den kompletten Stand (optimistische Sperre über version).
create or replace function public.vt_save_admin_state(pin text, new_state jsonb, expected_version integer) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v integer;
begin
  perform public.vt_require_pin(pin);
  select version into v from public.vt_tournament where id = 'current' for update;
  if v <> expected_version then
    raise exception 'VERSION_CONFLICT' using errcode = 'P0002';
  end if;
  update public.vt_tournament set state = new_state, version = v + 1, updated_at = now() where id = 'current';
  return jsonb_build_object('version', v + 1);
end $$;

-- Schiri-Team trägt ein Ergebnis ein. Es wird nur das Feld "sets" des Spiels geändert.
create or replace function public.vt_submit_result(token text, sets jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  s jsonb; g jsonb; idx integer := -1; i integer; n integer; st jsonb; a integer; b integer;
  won1 integer := 0; won2 integer := 0; p1 integer := 0; p2 integer := 0; mode text; v integer;
begin
  select state, version into s, v from public.vt_tournament where id = 'current' for update;
  if s is null then raise exception 'Es ist kein Turnier angelegt.'; end if;
  idx := public.vt_find_game(s, token);
  if idx < 0 then raise exception 'Dieses Spiel gibt es nicht (mehr).'; end if;
  g := s->'games'->idx;

  -- Phase abgeschlossen?
  if ((g->>'phase')::int = 1 and (s->>'phase')::int > 1) or ((g->>'phase')::int = 2 and (s->>'phase')::int > 2) then
    raise exception 'Diese Phase ist abgeschlossen. Änderungen nur noch durch die Turnierleitung.';
  end if;
  -- Korrekturfrist
  if g->'sets' is not null and jsonb_typeof(g->'sets') <> 'null' then
    if g->>'enteredBy' = 'admin' then
      raise exception 'Dieses Ergebnis wurde von der Turnierleitung eingetragen und kann nur dort geändert werden.';
    end if;
    if now() - coalesce((g->>'enteredAt')::timestamptz, now()) > interval '15 minutes' then
      raise exception 'Die Korrekturfrist von 15 Minuten ist abgelaufen. Bitte an die Turnierleitung wenden.';
    end if;
  end if;

  -- Sätze prüfen
  mode := g->>'mode';
  if sets is null or jsonb_typeof(sets) <> 'array' or jsonb_array_length(sets) < 2 or jsonb_array_length(sets) > 3 then
    raise exception 'Bitte Satz 1 und Satz 2 eintragen.';
  end if;
  for i in 0..jsonb_array_length(sets)-1 loop
    st := sets->i;
    if jsonb_typeof(st) <> 'array' or jsonb_array_length(st) <> 2
       or jsonb_typeof(st->0) <> 'number' or jsonb_typeof(st->1) <> 'number' then
      raise exception 'Satz %: Ungültige Eingabe.', i + 1;
    end if;
    a := (st->>0)::numeric; b := (st->>1)::numeric;
    if a::numeric <> (st->>0)::numeric or b::numeric <> (st->>1)::numeric then raise exception 'Satz %: Nur ganze Zahlen erlaubt.', i + 1; end if;
    if a < 0 or b < 0 or a > 99 or b > 99 then raise exception 'Satz %: Punktzahl muss zwischen 0 und 99 liegen.', i + 1; end if;
    if a = b then raise exception 'Satz %: Ein Satz kann nicht unentschieden enden.', i + 1; end if;
    if i < 2 then
      if a > b then won1 := won1 + 1; else won2 := won2 + 1; end if;
      p1 := p1 + a; p2 := p2 + b;
    end if;
  end loop;
  if mode = 'roundrobin' and jsonb_array_length(sets) = 3 then
    raise exception 'In der Gruppenphase werden nur 2 Sätze gespielt.';
  end if;
  if mode = 'ko' then
    if won1 <> won2 and jsonb_array_length(sets) = 3 then raise exception 'Bei 2:0 Sätzen gibt es keinen 3. Satz.'; end if;
    if won1 = won2 and jsonb_array_length(sets) = 2 and p1 = p2 then
      raise exception '1:1 Sätze und gleiche Punktzahl: Bitte den entscheidenden 3. Satz eintragen.';
    end if;
  end if;

  g := g || jsonb_build_object('sets', sets, 'enteredAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'enteredBy', 'referee');
  s := jsonb_set(s, array['games', idx::text], g);
  update public.vt_tournament set state = s, version = v + 1, updated_at = now() where id = 'current';
  return jsonb_build_object('ok', true, 'version', v + 1);
end $$;

-- Rechte: Nur die API-Funktionen dürfen von der Web-App (anon) aufgerufen werden.
revoke execute on function
  public.vt_pin_status(), public.vt_set_admin_pin(text), public.vt_change_admin_pin(text, text), public.vt_login(text),
  public.vt_get_state(), public.vt_get_admin_state(text), public.vt_get_game(text), public.vt_get_field(text),
  public.vt_save_admin_state(text, jsonb, integer), public.vt_submit_result(text, jsonb),
  public.vt_check_pin(text), public.vt_require_pin(text), public.vt_strip(jsonb), public.vt_find_game(jsonb, text)
from public;
grant execute on function
  public.vt_pin_status(), public.vt_set_admin_pin(text), public.vt_change_admin_pin(text, text), public.vt_login(text),
  public.vt_get_state(), public.vt_get_admin_state(text), public.vt_get_game(text), public.vt_get_field(text),
  public.vt_save_admin_state(text, jsonb, integer), public.vt_submit_result(text, jsonb)
to anon, authenticated;
