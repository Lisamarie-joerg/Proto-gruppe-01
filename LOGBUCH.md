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

**Ergebnis (Test bestanden):**
- **Handnachrechnung:** taperter Flachstahl T316 (BeamId 669, Flat Bar 275/12 → 225/12), L = 0,8452 m. V_manuell = L × (b_S + b_E)/2 × t = 0,8452 m × 250,0 mm × 12 mm = 0,002536 m³. V_Rhino = 0,002528 m³ → **Abweichung −0,30 %** ✓ (Stichprobe T316/T334/T340, alle −0,30 %).
- **Querschnitt-Check (im Rhino-Modell):** 445/445 Haupt-Solids stimmen im lokalen Stab-Koordinatensystem (Curve.FrameAt + Brep.GetBoundingBox) exakt mit dem Nennprofil überein (Rectangle 500/500 → 500×500 mm; RO 139.7x8.0 → Ø139,7 mm; Flat Bar 275/12 → 275×12 mm) – bestätigt den Maßstab 1 Modelleinheit = 1 m aus Etappe 0/1. Länge: Achse = Solid-Länge (Abweichung 0 %).
- **Träger nummeriert:** alle 736 Stäbe T001–T736 (User-String „Etappe02_TraegerNr" + TextDot auf Layer „Etappe02_TraegerNr").
- **Rahmenausführungen:** Tragwerk = **ein zusammenhängendes System** (alle 736 Stäbe über ihre Endpunkte verbunden, Konnektivitäts-Analyse bei Toleranz 0,02 und 0,25 Einheiten). **12 Stützgruppen** an den RO 139.7x8.0-Stützen (x = 7/10/13/16 m, y = −10/−5/0 m), je 9–26 Stäbe (RD-12-Dachstäbe, getaperte Flachstahl-Hauptstäbe 200–275/20, Knotenstäbe, Fundamentblöcke); Höhe z: 0,3–4,3 m, Dachhöhe 4,32 m, Grundriss ca. 9 × 10 m. Details: etappen/etappe_02/rahmen_etappe02.md.
- **Auffälligkeiten für Etappe 3:** (1) Die 116 „Flat Bar 33.3/20"-Knotenstäbe sind geometrisch 20×20 mm quaderförmig (nicht 33,3×20 mm), ihre Solids ca. 1,7× länger als die Achse (Überdeckung an Knoten). (2) 175 „RD 12"-Dachstäbe existieren nur als Achse ohne Solid (Volumen/Masse aus Profilnamen rechnen). (3) 47 „Rectangle 500/500" sind Fundamentblöcke (z ≈ 0,3–0,8 m) – gehören nicht zur Stahl-Inventur.

**Was wir gemacht haben:**
- Rhino-Modell über MCP angesprochen; 736 MemberAxes-Kurven und 561 Member-Solids per BeamId-UserString 1:1 zugeordnet.
- Querschnitte im lokalen Stab-Koordinatensystem gemessen und gegen Nennprofile geprüft; taperten Stab von Hand nachgerechnet.
- Träger nummeriert; Rahmenausführungen per Endpunkt-Konnektivität und Stützgruppenzuordnung dokumentiert.
- Ergebnisse in etappen/etappe_02/: staebe_etappe02.csv (736 Zeilen), querschnitt_check.csv (561 Zeilen), querschnitt_pruefung.md, rahmen_etappe02.md.

**Wichtigste Prompts** (wörtlich kopieren):
- "arbeite in einer Test etappe 2 variante: Prüfe die Querschnitte und länge der stäbe in dem rhino programm das du unter data findest. nummeriere die träger. dokumentiere die rahmenausführungen im logbuch"

**Was schiefging und woran wir es gemerkt haben:**
- Achsenausgerichtete BoundingBox überschätzt Querschnitte bei schräg liegenden Stäben → lokales Stab-Koordinatensystem (FrameAt) verwendet.
- Erster Prüfungs-Entwurf mit falschem Umrechnungsfaktor (0,0012 statt 0,001) zeigte 561/561 systematische Abweichungen von −16,7 % → Faktor geprüft, Modell ist 1:1 in Metern.
- Handnachrechnung erst mit 10⁻⁹ statt 10⁻⁶ umgerechnet (Länge war schon in m) → „99600 % Abweichung" als Warnsignal erkannt und korrigiert.

**Was wir selbst geprüft haben** (von Hand, im Plan, im Modell):
- Handnachrechnung taperter Stab: −0,30 % Abweichung (Test bestanden).
- Stichproben: Rectangle 500/500 = 500×500 mm exakt; RO 139.7x8.0 = Ø139,7 mm exakt; Flat Bar 275/12 = 275×12 mm exakt.
- Plausibilität: Dachhöhe z ≈ 4,32 m, Grundriss ca. 9 × 10 m (x = 7–16 m, y = −10–0 m) – passt zum Modell und zu Etappe 1 (Gesamtlänge 686,377 m ✓).

**Learning oder Besonderheit:**
- Querschnitte stimmen exakt mit den Profilnamen überein – Etappe 3 kann direkt mit den Profilnamen (und dem Maßstab 1:1 m) rechnen.
- RFEM-Export liefert MemberAxes (736, immer vorhanden) und Member-Solids (561): RD-12-Stäbe haben nur Achsen.
- User-Strings sind der Schlüssel: BG_RFEM_Exchange_BeamId (1:1-Zuordnung Achse↔Solid), CrosSec_S/CrosSec_E (Taper-Information), Etappe02_TraegerNr (Nummerierung).


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
