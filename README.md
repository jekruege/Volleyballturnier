# Volleyballturnier

Turnierverwaltung für Quattro-Mixed-Beachvolleyball-Turniere – als Ersatz für die bisherige
Excel/LibreOffice-Datei. Die Anwendung erzeugt den kompletten Spielplan (inkl. Schiedsrichter-
Zuteilung), die Schiedsrichter-Teams tragen die Ergebnisse **per QR-Code am Feld** ein, und
Tabellen, Platzierungen sowie die Endplatzierung werden **automatisch und sortiert** berechnet.

Die App ist eine statische Web-Seite (läuft auf **GitHub Pages**) und speichert die Daten in einer
kostenlosen **Supabase**-Datenbank. Alternativ läuft sie komplett lokal mit Node.js im WLAN.

## Funktionen

- **Zwei Turnierformate** (aus den bisherigen Tabellen übernommen):
  - **15 Teams**: 3 Gruppen à 5 (Jeder gegen Jeden) → 5 Dreier-Runden (Gold 1/2, Silber 1/2, Bronze) → Finale & Kleines Finale. 47 Spiele, 16 Zeitfenster.
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

## Einrichtung: GitHub Pages + Supabase (einmalig, ca. 15 Minuten)

### 1. Supabase-Projekt anlegen

1. Auf https://supabase.com kostenlos registrieren und **New project** anlegen (Name frei, Region
   z. B. Frankfurt, ein Datenbank-Passwort vergeben – das brauchst du später nicht mehr).
2. Links im Menü **SQL Editor** öffnen, den kompletten Inhalt der Datei
   [`supabase/schema.sql`](supabase/schema.sql) einfügen und mit **Run** ausführen.
   Das legt die Tabellen und die Funktionen an, über die die App mit der Datenbank spricht.
3. Unter **Project Settings → API** die beiden Werte kopieren: **Project URL** und den
   **anon public**-Key.

### 2. Zugangsdaten in der App eintragen

In der Datei [`docs/config.js`](docs/config.js) die beiden Werte eintragen (direkt auf GitHub über
das Stift-Symbol bearbeiten und committen):

```js
window.VT_CONFIG = {
  supabaseUrl: 'https://xxxxxxxxxxxx.supabase.co',
  supabaseKey: 'eyJhbGciOi…',
};
```

Der anon-Key darf öffentlich sein: Er erlaubt nur, was die Funktionen aus `schema.sql` zulassen
(lesen, Ergebnisse per Token eintragen, Änderungen nur mit PIN).

### 3. GitHub Pages einschalten

1. Das Repository muss **öffentlich** sein (GitHub Pages ist bei kostenlosen Konten nur für
   öffentliche Repositories verfügbar): Settings → General → Danger Zone → *Change visibility*.
2. Settings → **Pages** → *Build and deployment*: Source **Deploy from a branch**, Branch **main**,
   Ordner **/docs**, Save.
3. Nach ein bis zwei Minuten ist die App unter `https://<benutzername>.github.io/Volleyballturnier/`
   erreichbar. Die Adresse steht oben auf der Pages-Seite.

### 4. PIN festlegen und Turnier anlegen

`https://<benutzername>.github.io/Volleyballturnier/admin.html` öffnen. Beim ersten Aufruf wird
die PIN der Turnierleitung festgelegt (sie wird nur als Hash in der Datenbank gespeichert).
Danach Turnier anlegen, Teams eintragen, Spielplan prüfen, QR-Codes und Spielzettel drucken.

| Seite | Zweck |
| --- | --- |
| `index.html` | Live-Übersicht (öffentlich) |
| `admin.html` | Turnierleitung (PIN) |
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

## Alternative: lokal im WLAN (ohne Internet)

Voraussetzung: [Node.js](https://nodejs.org) ab Version 20. `docs/config.js` bleibt leer.

```bash
npm install
ADMIN_PIN=geheim npm start
```

Übersicht auf `http://localhost:3000/`, Turnierleitung unter `http://localhost:3000/admin.html`.
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
- Weiterkommen 15 Teams: Gold 1 = 1.A, 1.C, 2.A · Gold 2 = 1.B, 2.B, 2.C · Silber 1 = 3.A, 3.C, 3.B ·
  Silber 2 = 4.A, 4.B, 4.C · Bronze = 5.A, 5.B, 5.C. Finale 1. Gold 1 vs 1. Gold 2, Kleines Finale
  die Zweiten.
- Weiterkommen 16 Teams: Gold 1 = 1.A, 2.B, 3.A, 4.B · Gold 2 = 2.A, 1.B, 4.A, 3.B · Silber = 5./6.
  beider Gruppen · Bronze = 7./8. beider Gruppen. Halbfinale: 1 vs 4 und 2 vs 3 der Runde.
- Endplatzierung: 1–4 aus Finale/Kleinem Finale, dann die Dritten (und Vierten) der Gold-Runden,
  dann Silber, dann Bronze. Gleichrangige Plätze werden nach der Bilanz in der 2. Phase geordnet.

## Technik

- `docs/` – die komplette Web-App (statisch, kein Build-Schritt): Seiten, Stylesheet, Turnier-Engine
  (`docs/engine/`, ES-Module, läuft im Browser und in Node), Backend-Adapter (`docs/js/api.js`).
- `supabase/schema.sql` – Tabellen und SQL-Funktionen (PIN-Prüfung, Ergebnis-Eintrag per Token,
  optimistische Sperre über eine Versionsnummer). Die App spricht nur über diese Funktionen mit der
  Datenbank; direkter Tabellenzugriff ist gesperrt.
- `server.js` – lokaler Modus: liefert `docs/` aus und bietet dieselben Funktionen unter
  `/rpc/<name>` an, Speicherung als JSON-Datei.
- Neue Turnierformate: Datei in `docs/engine/formats/` anlegen (siehe `teams15.js`, `teams16.js`)
  und in `index.js` registrieren.

```bash
npm test        # Tests: Ergebnisregeln, Tabellen, Spielplan, kompletter Turnierdurchlauf, RPC-Server
npm run dev     # lokaler Server mit automatischem Neustart bei Änderungen
```
