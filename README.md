# Volleyballturnier

Turnierverwaltung für Quattro-Mixed-Beachvolleyball-Turniere – als Ersatz für die bisherige
Excel/LibreOffice-Datei. Die Anwendung erzeugt den kompletten Spielplan (inkl. Schiedsrichter-
Zuteilung), die Schiedsrichter-Teams tragen die Ergebnisse **per QR-Code am Feld** ein, und
Tabellen, Platzierungen sowie die Endplatzierung werden **automatisch und sortiert** berechnet.

## Funktionen

- **Zwei Turnierformate** (aus den bisherigen Tabellen übernommen):
  - **15 Teams**: 3 Gruppen à 5 (Jeder gegen Jeden) → 5 Dreier-Runden (Gold 1/2, Silber 1/2, Bronze) → Finale & Kleines Finale. 47 Spiele, 16 Zeitfenster.
  - **16 Teams**: 2 Gruppen à 8 (4 Spiele je Team) → 4 K.o.-Runden à 4 Teams (2 Halbfinale, Finale, Spiel um Platz 3) → Finale & Kleines Finale. 50 Spiele, 17 Zeitfenster.
- **Spielplan** mit Zeitfenstern, 3 Feldern und Schiedsrichtern. Die Gruppenphase folgt exakt dem
  Slot-Layout der Vorlagen; die 2./3. Phase wird automatisch so geplant, dass kein Spiel eingeplant
  wird, bevor die beteiligten Teams feststehen (in der 16er-Vorlage begann die Gold-Runde parallel zu
  den letzten Gruppenspielen – das geht in der Praxis nicht).
- **Schiedsrichter-Zuteilung**: niemand pfeift, während er selbst spielt; Einsätze werden
  gleichmäßig verteilt (Gruppenphase: jedes Team genau 2×); in Dreier-Runden pfeift das pausierende
  Team der Runde. Jede Zuteilung kann manuell überschrieben werden.
- **Ergebniseingabe per QR-Code**: Ein QR-Code je Feld (zeigt alle Spiele des Feldes, nächstes
  offenes Spiel markiert) sowie ein QR-Code je Spiel auf den druckbaren Spielzetteln. Die Eingabe
  ist für Smartphones optimiert, prüft die Eingaben (kein Satz-Unentschieden, 2 Sätze in der
  Gruppenphase, Sieger-Pflicht in K.o.-Spielen) und zeigt danach sofort die aktualisierte Tabelle.
  Schiris können ein Ergebnis 15 Minuten lang selbst korrigieren, danach nur die Turnierleitung.
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
  ändern, Export/Import als JSON-Sicherung, Zurücksetzen.

## Schnellstart

Voraussetzung: [Node.js](https://nodejs.org) ab Version 18.

```bash
npm install
ADMIN_PIN=geheim npm start
```

Dann im Browser:

| Adresse | Zweck |
| --- | --- |
| `http://localhost:3000/` | Live-Übersicht (öffentlich) |
| `http://localhost:3000/admin` | Turnierleitung (PIN) |
| `http://localhost:3000/print/qr` | QR-Codes der Felder zum Ausdrucken |
| `http://localhost:3000/print/feld/1` | Spielzettel Feld 1 (ebenso `/2`, `/3`) |
| `http://localhost:3000/print/plan` | Gesamtspielplan |
| `http://localhost:3000/print/tabellen` | Alle Tabellen und die Endplatzierung |

### Mit Docker

```bash
docker compose up -d
```

Die Turnierdaten liegen in `./data/turnier.json` und bleiben über Neustarts erhalten.

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
5. **Siegerehrung**: Endplatzierung unter „Finale & Platzierung“ oder `/print/tabellen`.

## Netzwerk & QR-Codes

Die QR-Codes enthalten die Adresse, unter der die Druckseite aufgerufen wurde (z. B.
`http://192.168.0.10:3000`). Damit die Schiri-Handys die Seite erreichen, muss der Server im
selben WLAN erreichbar sein – oder öffentlich im Internet (dann `PUBLIC_URL` setzen). Eine Adresse
lässt sich mit `PUBLIC_URL=https://turnier.example.org npm start` fest vorgeben.

## Konfiguration (Umgebungsvariablen)

| Variable | Standard | Bedeutung |
| --- | --- | --- |
| `PORT` | `3000` | Port des Webservers |
| `ADMIN_PIN` | `1234` | PIN für den Admin-Bereich – **unbedingt ändern** |
| `PUBLIC_URL` | (leer) | Basis-URL für die QR-Codes; leer = Adresse der aufrufenden Seite |
| `DATA_FILE` | `./data/turnier.json` | Speicherort der Turnierdaten |
| `CORRECTION_MINUTES` | `15` | Wie lange Schiris ein eingetragenes Ergebnis selbst korrigieren dürfen |

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
  dann Silber, dann Bronze. Gleichrangige Plätze (z. B. beide Dritten der Gold-Runden) werden nach
  der Bilanz in der 2. Phase geordnet.

## Neue Formate

Ein Format ist eine Datei in `src/formats/` (siehe `teams15.js`, `teams16.js`): Gruppen, Slot-Layout
der Gruppenphase, Runden der 2. Phase (`roundrobin` mit 3 Teams oder `ko4` mit 4 Teams) mit Setzliste,
Finalspiele und die Reihenfolge der Endplatzierung. Neue Formate in `src/formats/index.js` registrieren.

## Entwicklung

```bash
npm test        # Unit-Tests (Ergebnisregeln, Tabellen, Spielplan, kompletter Turnierdurchlauf)
npm run dev     # Server mit automatischem Neustart bei Änderungen
```

Technik: Node.js, Express, kein Build-Schritt (Vanilla JS im Browser), Speicherung als JSON-Datei,
QR-Codes werden serverseitig als SVG erzeugt (`qrcode`).
