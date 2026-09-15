# Volleyballturnier

Turnierverwaltung für Quattro-Mixed-Beachvolleyball-Turniere – als Ersatz für die bisherige
Excel/LibreOffice-Datei. Die Anwendung erzeugt den kompletten Spielplan (inkl. Schiedsrichter-
Zuteilung), die Schiedsrichter-Teams tragen die Ergebnisse **per QR-Code am Feld** ein, und
Tabellen, Platzierungen sowie die Endplatzierung werden **automatisch und sortiert** berechnet.

Die App ist eine statische Web-Seite (läuft auf **GitHub Pages**) und speichert die Daten in einem
kostenlosen Backend: wahlweise ein **Cloudflare Worker** (empfohlen, schläft nie ein) oder eine
**Supabase**-Datenbank. Alternativ läuft sie komplett lokal mit Node.js im WLAN.

## Funktionen

- **Zwei Turnierformate** (aus den bisherigen Tabellen übernommen):
  - **15 Teams**: 3 Gruppen à 5 (Jeder gegen Jeden) → 5 Dreier-Runden (Gold 1/2, Silber (7–9), Silber (10–12), Bronze) → Finale & Kleines Finale. 47 Spiele, 16 Zeitfenster.
  - **16 Teams**: 2 Gruppen à 8 (4 Spiele je Team) → 4 K.o.-Runden à 4 Teams (2 Halbfinale, Finale, Spiel um Platz 3) → Finale & Kleines Finale. 50 Spiele, 17 Zeitfenster.
- **Spielplan** mit Zeitfenstern, 3 Feldern und Schiedsrichtern. Die Gruppenphase folgt exakt dem
  Slot-Layout der Vorlagen; die 2./3. Phase wird automatisch so geplant, dass kein Spiel eingeplant
  wird, bevor die beteiligten Teams feststehen.
- **Schiedsrichter-Zuteilung**: niemand pfeift, während er selbst spielt; Einsätze werden
  gleichmäßig verteilt (Gruppenphase: jedes Team genau 2×); in Dreier-Runden pfeift das pausierende
  Team der Runde. Jede Zuteilung kann manuell überschrieben werden.
- **Ergebniseingabe per QR-Code**: Ein QR-Code je Feld (zeigt alle Spiele des Feldes, nächstes
  offenes Spiel markiert) sowie ein QR-Code je Spiel auf den druckbaren Spielzetteln. Die Eingabe
  ist für Smartphones optimiert, prüft die Eingaben und zeigt danach sofort die aktualisierte
  Tabelle. Schiris können ein Ergebnis 15 Minuten lang selbst korrigieren, danach nur die Turnierleitung.
- **Sortierte Tabellen**: Siege → Satzdifferenz → Punktdifferenz → direkter Vergleich. Nicht
  auflösbare Gleichstände werden mit ⚖ markiert und können von der Turnierleitung beim Abschluss
  der Phase per Hand geordnet werden (z. B. Münzwurf).
- **Phasen-Ablauf**: Nach Abschluss der Gruppenphase werden die Platzierungen vorgeschlagen,
  bestätigt und die Teams der Gold-/Silber-/Bronze-Runden automatisch eingesetzt. K.o.-Runden
  füllen Finale und Spiel um Platz 3 automatisch aus den Halbfinal-Ergebnissen. Die Endplatzierung
  1–15/16 wird komplett automatisch berechnet.
- **Live-Übersicht** für Teams und Zuschauer (Spielplan mit Filter nach Feld/Team, Tabellen,
  Finale & Endplatzierung), aktualisiert sich alle 20 Sekunden.
- **Druckseiten**: QR-Codes der Felder, Spielzettel je Feld (mit QR je Spiel und Platz für
  handschriftliche Notizen), Gesamtspielplan, Tabellen.
- **Admin-Bereich** (PIN-geschützt): Turnier anlegen (Teams auch per Copy&Paste aus der Tabelle),
  Ergebnisse korrigieren/löschen, Schiris ändern, Phasen abschließen/wieder öffnen, Teamnamen
  ändern, PIN ändern, Export/Import als JSON-Sicherung, Zurücksetzen.

## Einrichtung: GitHub Pages + kostenloses Backend (einmalig, ca. 15 Minuten)

Der Turnierstand muss im Internet liegen, damit Schiri-Handys und Turnierleitung denselben Stand
sehen. Zwei kostenlose Varianten stehen zur Wahl:

| | Variante A: Cloudflare Worker | Variante B: Supabase |
| --- | --- | --- |
| Kosten | kostenlos, keine Zahlungsdaten | kostenlos, keine Zahlungsdaten |
| Pausiert bei Nichtnutzung? | nein | ja, nach 7 Tagen ohne Datenbankzugriffe; im Dashboard wieder startbar, nach 90 Tagen Pause wird das Projekt gelöscht |
| Einrichtung | Node.js auf dem Rechner **oder** GitHub Actions | nur im Browser |
| Kontingent | 100.000 Anfragen pro Tag | 500 MB Datenbank, 2 aktive Projekte |

Empfehlung: **Variante A**, weil das Backend zwischen zwei Turnieren nicht einschläft und vor dem
Turnier nichts reaktiviert werden muss.

### 1A. Cloudflare Worker veröffentlichen

Der Worker enthält das Backend **und** liefert die App aus `docs/` selbst aus. Die Adresse
`https://volleyballturnier.<subdomain>.workers.dev` ist damit App und Backend zugleich; GitHub Pages
kann zusätzlich genutzt werden, muss aber nicht.

1. Kostenlos registrieren auf https://dash.cloudflare.com/sign-up (keine Zahlungsdaten nötig).
2. Im Dashboard links **Workers & Pages** öffnen. Beim ersten Mal fragt Cloudflare nach einer
   **workers.dev-Subdomain** (frei wählbar, z. B. `beachverein`).
3. **Create** → **Import a repository** → GitHub verbinden und dieses Repository auswählen.
   Einstellungen: Projektname `volleyballturnier`, Branch `main`, Root directory `/`,
   Build command leer, Deploy command `npx wrangler deploy`. Alles Weitere steht in
   [`wrangler.jsonc`](wrangler.jsonc). Save and Deploy.
4. Nach ein bis zwei Minuten ist der Worker fertig. Prüfen: `https://volleyballturnier.<subdomain>.workers.dev/health`
   zeigt „Volleyballturnier-Backend läuft“, und `…workers.dev/admin.html` öffnet die Turnierleitung.
   Ab jetzt wird bei jedem Push auf `main` automatisch neu veröffentlicht.

Die Einstellungen lassen sich später unter Workers & Pages → `volleyballturnier` → **Settings** →
**Build** ändern. Alternativen: von Hand mit `npx wrangler login` und `npx wrangler deploy` im
Stammverzeichnis des Repositories (Node.js ab Version 20), oder über den GitHub-Actions-Workflow
„Cloudflare Worker deployen“ (Repository-Secrets `CLOUDFLARE_API_TOKEN` mit der Vorlage
„Edit Cloudflare Workers“ und `CLOUDFLARE_ACCOUNT_ID`; Actions → Run workflow).

Der Worker speichert den Turnierstand in einem Durable Object (Cloudflare-Speicher auf SQLite-Basis)
und verarbeitet alle Anfragen nacheinander; gleichzeitige Ergebniseingaben an mehreren Feldern gehen
nicht verloren. Die PIN wird nur als Hash gespeichert. Die Adresse darf öffentlich sein: Wer sie
kennt, kann wie beim Supabase-Key nur lesen, Ergebnisse per Token eintragen und Änderungen nur mit
PIN vornehmen. Optional lässt sich der Zugriff für andere Seiten (z. B. GitHub Pages) auf bestimmte
Adressen beschränken (`ALLOWED_ORIGINS` in `wrangler.jsonc`).

**Kontingent:** 100.000 Backend-Anfragen pro Tag (Zähler beginnt um 00:00 UTC neu, also um 2 Uhr
MESZ); das Ausliefern der App-Dateien zählt nicht mit. Die Live-Übersicht fragt alle 20 Sekunden
nach, also 180 Anfragen pro Stunde je geöffneter Seite: 20 gleichzeitig geöffnete Live-Ansichten
über 10 Stunden ergeben etwa 36.000 Anfragen. Für Zuschauer daher lieber die große Anzeige
(`display.html`) am Beamer nutzen, als hunderte Handys aktualisieren zu lassen.

### 1B. Supabase-Projekt anlegen

1. Auf https://supabase.com kostenlos registrieren und **New project** anlegen (Name frei, Region
   z. B. Frankfurt, ein Datenbank-Passwort vergeben – das brauchst du später nicht mehr).
2. Links im Menü **SQL Editor** öffnen, den kompletten Inhalt der Datei
   [`supabase/schema.sql`](supabase/schema.sql) einfügen und mit **Run** ausführen.
   Das legt die Tabellen und die Funktionen an, über die die App mit der Datenbank spricht.
3. Zwei Werte kopieren:
   - **Project URL** unter **Project Settings → Data API** (z. B. `https://abcdefghijkl.supabase.co`;
     die Kennung steht auch in der Browser-Adresse hinter `/project/`).
   - **Publishable key** unter **Project Settings → API Keys** (beginnt mit `sb_publishable_`).
     Bei älteren Projekten heißt er **anon public** und beginnt mit `eyJ…`; beides funktioniert.
     Den **Secret key** niemals verwenden.

### 2. Zugangsdaten in der App eintragen

In der Datei [`docs/config.js`](docs/config.js) die Werte eintragen (direkt auf GitHub über das
Stift-Symbol bearbeiten und committen). Variante A (Cloudflare Worker) – nur nötig, wenn die App
auch über GitHub Pages laufen soll; unter der workers.dev-Adresse ignoriert der Worker diese Datei
und spricht immer mit sich selbst:

```js
window.VT_CONFIG = {
  apiUrl: 'https://volleyballturnier.<subdomain>.workers.dev',
  supabaseUrl: '',
  supabaseKey: '',
};
```

Variante B (Supabase):

```js
window.VT_CONFIG = {
  apiUrl: '',
  supabaseUrl: 'https://xxxxxxxxxxxx.supabase.co',
  supabaseKey: 'sb_publishable_…',
};
```

Ist `apiUrl` gesetzt, werden die Supabase-Werte ignoriert. Der Publishable/anon-Key darf öffentlich
sein: Er erlaubt nur, was die Funktionen aus `schema.sql` zulassen (lesen, Ergebnisse per Token
eintragen, Änderungen nur mit PIN).

**Umzug von Supabase zum Worker:** Im Admin-Bereich unter „Teams & Einstellungen“ den Turnierstand
als JSON exportieren, `apiUrl` eintragen, im neuen Backend die PIN festlegen und die Datei importieren.

### 3. GitHub Pages einschalten (optional bei Variante A)

1. Das Repository muss **öffentlich** sein (GitHub Pages ist bei kostenlosen Konten nur für
   öffentliche Repositories verfügbar): Settings → General → Danger Zone → *Change visibility*.
2. Settings → **Pages** → *Build and deployment*: Source **Deploy from a branch**, Branch **main**,
   Ordner **/docs**, Save.
3. Nach ein bis zwei Minuten ist die App unter `https://<benutzername>.github.io/Volleyballturnier/`
   erreichbar. Die Adresse steht oben auf der Pages-Seite.

### 4. PIN festlegen und Turnier anlegen

`https://<benutzername>.github.io/Volleyballturnier/admin.html` (bzw. bei Variante A auch
`https://volleyballturnier.<subdomain>.workers.dev/admin.html`) öffnen. Beim ersten Aufruf wird
die PIN der Turnierleitung festgelegt (sie wird nur als Hash in der Datenbank gespeichert).
Danach Turnier anlegen, Teams eintragen, Spielplan prüfen, QR-Codes und Spielzettel drucken.

| Seite | Zweck |
| --- | --- |
| `index.html` | Live-Übersicht (öffentlich) |
| `admin.html` | Turnierleitung (PIN) |
| `display.html` | Große Anzeige für iPad/Beamer, schaltet automatisch durch (siehe unten) |
| `print.html?type=qr` | QR-Codes der Felder zum Ausdrucken |
| `print.html?type=feld&n=1` | Spielzettel Feld 1 (ebenso `n=2`, `n=3`) |
| `print.html?type=plan` | Gesamtspielplan |
| `print.html?type=tabellen` | Alle Tabellen und die Endplatzierung |
| `f.html?t=…` / `g.html?t=…` | Schiri-Seiten (Ziel der QR-Codes) |

## Ablauf am Turniertag

1. **Vorbereitung**: Im Admin-Bereich Turnier anlegen (Format wählen, Teams eintragen – die
   Reihenfolge innerhalb einer Gruppe entspricht der Nummer im Spielplan). Spielplan, QR-Codes und
   Spielzettel drucken. QR-Codes der Felder laminieren und an den Feldern befestigen.
2. **Gruppenphase**: Schiri-Team scannt den QR-Code des Feldes (oder des Spiels), trägt die
   Satzergebnisse ein und bestätigt. Tabellen aktualisieren sich sofort.
3. **Phase abschließen**: Sobald alle Gruppenspiele eingetragen sind, zeigt der Admin-Bereich die
   Platzierungen; ggf. Gleichstände per Hand ordnen und „1. Gruppenphase abschließen“ klicken. Ab
   jetzt zeigen Spielplan und Spielzettel die echten Teams der 2. Phase samt Schiedsrichtern.
4. **2. Phase & Finale**: genauso; die Finalteilnehmer stehen nach Abschluss der 2. Phase fest.
5. **Siegerehrung**: Endplatzierung unter „Finale & Platzierung“ oder `print.html?type=tabellen`.

Die Schiri-Handys brauchen nur Internet (Mobilfunk reicht). Die Turnierleitung kann parallel am
Laptop oder Handy arbeiten; gleichzeitige Änderungen werden erkannt und automatisch zusammengeführt.

## Zeitplan: Pausen und Verschiebungen

Im Admin-Bereich unter **Zeitplan** lassen sich Startzeit und Standarddauer ändern, für einzelne
Zeitfenster eine abweichende Dauer setzen (z. B. 40 Minuten für das Finale) und nach jedem
Zeitfenster eine Pause einfügen. Eine Pause **mit Namen** (z. B. „Mittagspause“) erscheint in
Spielplan, Anzeige und Druck; eine Pause **ohne Namen** verschiebt nur die Zeiten, z. B. `15` bei
Verspätung oder `-10`, um Zeit aufzuholen. Alle folgenden Zeitfenster rücken automatisch nach.

## Große Anzeige (iPad / Beamer)

`display.html` zeigt Spielplan (aktuelles und die nächsten Zeitfenster) und alle Tabellen in
großer Schrift und schaltet automatisch alle 12 Sekunden weiter. Bedienung: rechts tippen = weiter,
links = zurück, Mitte = Pause; Tastatur: Pfeiltasten, `p` (Pause), `f` (Vollbild).
Parameter: `display.html?s=20` (Sekunden je Seite), `?plan=5` (Zeitfenster im Spielplan).

Auf dem iPad in Safari öffnen, dann **Teilen → Zum Home-Bildschirm**. Von dort gestartet läuft die
Anzeige ohne Browserleisten im Vollbild. Damit das Display nicht abschaltet: Einstellungen →
Anzeige & Helligkeit → Automatische Sperre → Nie.

## Alternative: lokal im WLAN (ohne Internet)

Voraussetzung: [Node.js](https://nodejs.org) ab Version 20. `docs/config.js` bleibt leer.

```bash
npm install
ADMIN_PIN=geheim npm start
```

Übersicht auf `http://localhost:3000/`, Turnierleitung unter `http://localhost:3000/admin.html`.
Der lokale Server ignoriert die Worker-/Supabase-Werte in `docs/config.js` (mit `SUPABASE_CONFIG=1`
nutzt er sie stattdessen).
Damit die Schiri-Handys die QR-Links erreichen, müssen sie im selben WLAN sein; die Druckseiten
über die IP-Adresse des Rechners aufrufen (z. B. `http://192.168.0.23:3000/print.html?type=qr`),
dann enthalten die QR-Codes diese Adresse. Die Daten liegen in `data/turnier.json`.

Mit Docker: `docker compose up -d` (PIN in `docker-compose.yml` anpassen).

| Variable | Standard | Bedeutung |
| --- | --- | --- |
| `PORT` | `3000` | Port des Webservers |
| `ADMIN_PIN` | `1234` | PIN für den Admin-Bereich – **unbedingt ändern** |
| `DATA_FILE` | `./data/turnier.json` | Speicherort der Turnierdaten |

## Regeln (wie in der Vorlage)

- 2 Sätze je Spiel, Punkte werden gezählt (z. B. 15:12, 13:15).
- Gruppen-/Dreier-Runden: ein 1:1 nach Sätzen ist ein Unentschieden.
- K.o.-Spiele und Finalspiele brauchen einen Sieger: bei 1:1 entscheidet ein 3. Satz; wird keiner
  eingetragen, zählt die Punktdifferenz beider Sätze; bei gleicher Punktzahl ist der 3. Satz Pflicht.
- Tabellen: Siege → Satzdifferenz → Punktdifferenz → direkter Vergleich → mehr gewonnene Punkte.
- Weiterkommen 15 Teams: Gold 1 = 1.A, 1.C, 2.A · Gold 2 = 1.B, 2.B, 2.C · Silber (7–9) = 3.A, 3.C, 3.B ·
  Silber (10–12) = 4.A, 4.B, 4.C · Bronze = 5.A, 5.B, 5.C. Finale 1. Gold 1 vs 1. Gold 2, Kleines Finale
  die Zweiten.
- Weiterkommen 16 Teams: Gold 1 = 1.A, 2.B, 3.A, 4.B · Gold 2 = 2.A, 1.B, 4.A, 3.B · Silber = 5./6.
  beider Gruppen · Bronze = 7./8. beider Gruppen. Halbfinale: 1 vs 4 und 2 vs 3 der Runde.
- Endplatzierung: 1–4 aus Finale/Kleinem Finale, dann die Dritten (und Vierten) der Gold-Runden,
  dann Silber, dann Bronze. Gleichrangige Plätze werden nach der Bilanz in der 2. Phase geordnet.

## Technik

- `docs/` – die komplette Web-App (statisch, kein Build-Schritt): Seiten, Stylesheet, Turnier-Engine
  (`docs/engine/`, ES-Module, läuft im Browser und in Node), Backend-Adapter (`docs/js/api.js`).
- `src/rpc.js` – die Backend-Funktionen (PIN-Prüfung, Ergebnis-Eintrag per Token, optimistische
  Sperre über eine Versionsnummer) in JavaScript; genutzt vom lokalen Server und vom Cloudflare Worker.
- `worker/` + `wrangler.jsonc` – Cloudflare Worker: bietet die Funktionen unter `POST /rpc/<name>`
  an und liefert `docs/` als statische Dateien aus (`/config.js` wird dabei durch eine leere
  Konfiguration ersetzt). Turnierstand und PIN-Hash liegen in einem Durable Object
  (`worker/src/core.js`, `worker/src/http.js`). Deploy über die Cloudflare-Git-Integration, mit
  `npx wrangler deploy` oder über `.github/workflows/deploy-worker.yml`. Nach Änderungen an Engine
  oder App muss der Worker neu deployt werden (bei der Git-Integration passiert das automatisch).
- `supabase/schema.sql` – dieselben Funktionen als SQL für Supabase. Die App spricht nur über diese
  Funktionen mit der Datenbank; direkter Tabellenzugriff ist gesperrt.
- `server.js` – lokaler Modus: liefert `docs/` aus und bietet dieselben Funktionen unter
  `/rpc/<name>` an, Speicherung als JSON-Datei.
- Neue Turnierformate: Datei in `docs/engine/formats/` anlegen (siehe `teams15.js`, `teams16.js`)
  und in `index.js` registrieren.

```bash
npm test        # Tests: Ergebnisregeln, Tabellen, Spielplan, kompletter Turnierdurchlauf, RPC-Server, Worker
npm run dev     # lokaler Server mit automatischem Neustart bei Änderungen
```
