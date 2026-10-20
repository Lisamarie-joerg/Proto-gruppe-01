# Logbuch

Pro Etappe ein Eintrag. Kurz reicht. Das Logbuch ist Teil der Abgabe und Grundlage eurer Demo.
One entry per stage. Short is fine. The log is part of the submission and the basis for your demo.

## Etappe 0

- **Was wir gemacht haben:** Rhino-Modell „RH7 Stockerau" (RFEM-Export, 1.297 Objekte, 336 Layer, Einheit: Meter) geöffnet und automatisiert ausgelesen. Stäbe sind als Achsen (Layer „MemberAxes", 736) und Solids (Layer „Members", 561) hinterlegt. Pro Querschnitt gezählt, Gesamtlängen gemessen, Excel-Tabelle erzeugt und in `Abgabe_23.10/` abgelegt.
- **Wichtigste Prompts** (wörtlich kopieren): „lese das Rhino Modell … Bestimme hierbei die Anzahl der Stäbe und liste sie mir in einer Tabelle auf. In Form einer Excel Tabelle." · „bitte speichere mir das Endergebnis in den angelegten Ordner ‚Abgabe_23.10'"
- **Was schiefging und woran wir es gemerkt haben:** Der offene Rhino meldet sich nicht beim Tool-Router (Slot blieb leer) → Modell direkt aus `Data/` geöffnet. `LayerName`-Attribut existiert in RhinoCommon nicht → Auswertung über `LayerIndex` bzw. Layer-Pfad.
- **Was wir selbst geprüft haben:** 736 Achsen + 561 Solids = 1.297 Objekte ✓ · Summe der Querschnitte = 736 Stäbe ✓ · Modelleinheit = Meter ✓

---

# Sprint 1: Carbon-Inventur Pavillon Stockerau

## Etappe 1: Modell lesen

**Test:** Wie viele Stäbe hat der Pavillon? Prüft die Zahl am Modell nach.

**Ergebnis: 736 Stäbe** in 16 Querschnitten, Gesamtlänge **686,377 m**. Davon 561 Stäbe mit Achse + Solid, 175 Rundstäbe RD 12 nur als Achse (kein Solid im Export).

| Nr. | Typ | Querschnitt | Anzahl | Länge (m) |
|----|-------|------------------|----:|---------:|
| 1 | Flachstab | Flat Bar 33.3/20 | 116 | 2,320 |
| 2 | Flachstab | Flat Bar 162.5/12 | 35 | 13,639 |
| 3 | Flachstab | Flat Bar 162.5/20 | 18 | 6,842 |
| 4 | Flachstab | Flat Bar 175/12 | 35 | 29,587 |
| 5 | Flachstab | Flat Bar 175/20 | 23 | 19,285 |
| 6 | Flachstab | Flat Bar 200/12 | 35 | 13,649 |
| 7 | Flachstab | Flat Bar 200/20 | 18 | 7,019 |
| 8 | Flachstab | Flat Bar 225/12 | 35 | 29,587 |
| 9 | Flachstab | Flat Bar 225/20 | 23 | 19,443 |
| 10 | Flachstab | Flat Bar 237.5/12 | 35 | 13,639 |
| 11 | Flachstab | Flat Bar 237.5/20 | 18 | 7,014 |
| 12 | Flachstab | Flat Bar 275/12 | 70 | 42,638 |
| 13 | Flachstab | Flat Bar 275/20 | 41 | 26,454 |
| 14 | Rundstab | RD 12 | 175 | 367,168 |
| 15 | Rechteck-Stab | Rectangle 500/500 | 47 | 47,023 |
| 16 | Rundrohr | RO 139.7x8.0 (EN 10210-2) | 12 | 41,070 |
| | **Summe** | **16 Querschnitte** | **736** | **686,377** |

**Learning oder Besonderheit:** Der RFEM-Export legt pro Stab eine Achse (Layer „MemberAxes") und – bei zugewiesenem Querschnitt – einen Solid (Layer „Members") an. Die Zählung über die Achsen ist 1:1 verlässlich. Auffällig: Die 175 Rundstäbe RD 12 (367 m, über die Hälfte der Gesamtlänge) werden ohne Solid exportiert; die 116 Flachstäbe 33.3/20 sind mit ca. 2 cm Länge extrem kurz (vermutlich Verbindungselemente/starre Glieder). Ergebnisse: `Abgabe_23.10/Staebe_UEbersicht.xlsx` (Übersichtstabelle), `Stäben_Liste.xlsx` / `Stäben_Liste.csv` (Einzelstämme mit IDs) hier im Repo.


## Etappe 2: Querschnitte verstehen

**Test:** Rechnet einen Stab, dessen Querschnitt sich über die Länge ändert, von Hand nach und vergleicht mit eurem Programm.


**Learning oder Besonderheit:**


## Etappe 3: Material zuordnen

**Test:** Sind die Materialangaben, die schon im Modell stehen, plausibel? Zeigt an einem Stab, wie ihr das geprüft habt.


**Learning oder Besonderheit:**


## Etappe 4: Embodied Carbon aus der ÖKOBAUDAT

**Test:** Rechnet einen Stab von seiner Länge bis zu kg CO₂e (A1–A3) von Hand nach.


**Learning oder Besonderheit:**


## Etappe 5: Web-App

**Test:** Schaltet beim Stahl auf die Alternative um. Was erwartet ihr vorher, was passiert, und warum?


**Learning oder Besonderheit:**


## Zum Schluss

Wie habt ihr mit dem Agenten gearbeitet, und was würdet ihr der nächsten Gruppe mitgeben?

Der Agent hat das Modell selbstständig geöffnet, Geometrie ausgewertet (Layer/Pfade, Längen) und die Ergebnisse gegen das Modell geprüft (Objektsummen). Wir haben die Zahlen verifiziert und die Excel-Tabelle nur noch formatiert. Tipp für die nächste Gruppe: Modelldatei in `Data/` liegen lassen und den Agenten direkt darauf loslassen – die Zählung über die Stabachsen (Layer „MemberAxes") ist am schnellsten und verlässlichsten.
