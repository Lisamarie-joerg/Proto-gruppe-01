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

**Ergebnis:**
- **Zuordnung aller 736 Stäbe über die Entscheidungsleiter (1. Regeln → 2. Sprachmodell → 3. Agent):**
  - **Regel 1 (Kurs-Vorgabe):** T678–T724 → **Beton** (47 Stäbe, „Rectangle 500/500" = massive Fundamentblöcke)
  - **Regel 2 (Kurs-Vorgabe):** T725–T736 → **Metall** (12 Stäbe, „RO 139.7x8.0" = Rundhohlprofil-Spalten)
  - **Regel 3 (Kurs-Vorgabe):** Rest → **Holz** (502 Stäbe, T001–T502; Pergola = Holzbau)
  - **Regel 3 – Ausnahme:** T503–T677 → **Stahlseil** (175 Stäbe, „RD 12"): diese Stäbe sind im Modell **nur als Linie (Achse ohne Solid)** hinterlegt und im RFEM als Typ **„Tension" (Zugstab)** geführt → „die Linien sind Stahlseile"
  - **Summe: 502 Holz + 175 Stahlseil + 47 Beton + 12 Metall = 736 ✓**
- **Test – Materialangaben im Modell (UserString `BG_Dlubal-Name (Material)`), geprüft an zwei Stäben:**
  - **T730** (BeamId 1477, RO 139.7x8.0): Modell sagt „Steel S 355". Prüfung: Profil = Rundhohlprofil (Sprache: Stahl) + Regel 2 sagt Metall + RFEM-Material sagt Stahl → **alle drei Stufen der Leiter stimmen überein → plausibel** ✓
  - **T040** (BeamId 94, Flat Bar 162.5/20): Modell sagt „Concrete C25/30". Prüfung: ein 162,5 × 20 mm Flachstab ist kein Betonbauteil (Sprache: Widerspruch); Regel 3 (Rest → Holz) ist die höchste Stufe und gilt → **nicht plausibel**. Betrifft T036–T053 (18 Stäbe); der Konflikt ist im UserString `Etappe03_Quelle` dieser Stäbe vermerkt, es bleibt Holz.
  - **Lücken:** 706/736 Stäbe haben kein RFEM-Material (Feld leer) – auch bei den 47 Betonblöcken (T678–T724), obwohl das die einzigen Betonbauteile sind. Die RFEM-Zuordnung sitzt also offenbar auf den falschen Stäben („Concrete C25/30" an Flachstäbe statt an Fundamentblöcke).
- **Umsetzung in Rhino:** 4 Render-Materialien angelegt – `Etappe03_Holz` (braun), `Etappe03_Beton` (hellgrau), `Etappe03_Metall` (stahlblau), `Etappe03_Stahlseil` (ziegelrot) – und den 15 Profil-Layern zugewiesen; alle 1.297 Member-Objekte (736 Achsen + 561 Solids) auf „Material von Layer" gestellt → **Farben im Rendered-Viewport sichtbar**. UserStrings `Etappe03_Material` + `Etappe03_Quelle` an jedem Stab (Achse und Solid) dokumentieren, **woher jede Zuordnung kommt**.

**Was wir gemacht haben:**
- Materialangaben aus dem Modell (RFEM-UserStrings) ausgelesen und gegen Profilnamen, RFEM-Typ und Kursregeln geprüft (Entscheidungsleiter Regeln → Sprachmodell → Agent).
- 736 Stäbe materialisiert: 502 Holz, 175 Stahlseil, 47 Beton, 12 Metall; jeder Stab mit Render-Material + Herkunfts-UserString versehen.
- Ergebnisse: `etappen/etappe_02/material_etappe02.csv` (736 Zeilen mit Quelle), `staebe_etappe02.csv` um 2 Spalten ergänzt, Excel `Abgabe_23.10/Etappe02_Traegerliste_T001-T736.xlsx` um Spalten S/T und Sheet „Material-Etappe03" erweitert.

**Wichtigste Prompts** (wörtlich kopieren):
- „ordne t678 bis t724 als material beton, t725 bis t736 als metall, der rest ist als material holz außer die linien sind stahlseile. berichte im logbuch was du gemacht hast _ füge die materilaien in rhino hinzu damit sie im rendert view port zu sehen sind."

**Was schiefging und woran wir es gemerkt haben:**
- Erste Material-Zuweisung pro Objekt blähte die Rhino-Materialtabelle auf (1.297 Einträge statt 4) → umgestellt auf Layer-basierte Zuordnung (15 Profil-Layer, „Material von Layer").
- Aufräumversuch per `DeleteAt` ließ gelöchte Material-Slots als null-Einträge stehen (NullReferenceException) → Rollback, danach saubere Layer-Zuweisung.
- Excel-Save einmal mit PermissionError (Datei durch OneDrive/Excel kurz gesperrt) → Retry erfolgreich.

**Was wir selbst geprüft haben:**
- Objektzählung: 1.297 Member-Objekte (736 Achsen + 561 Solids) mit „Material von Layer" ✓
- Zuordnungssumme: 502 + 175 + 47 + 12 = 736 ✓; T-Bereiche der Profile sind lückenlos und deckungsgleich mit den Regeln (T678–T724 = Rectangle 500/500, T725–T736 = RO 139.7x8.0, T503–T677 = RD 12 = Typ „Tension") ✓
- Rendered-Viewport: Farben sichtbar (Holz braun dominiert, Fundamente grau, Stahl blau, Seile rot) ✓

**Learning oder Besonderheit:**
- RFEM-Material-UserStrings sind nur spärlich gefüllt (30/736) und teilweise falsch zugeordnet – Materialangaben im Modell immer gegen Geometrie und Regeln prüfen.
- „Flat Bar …"-Profilnamen sind reine Querschnittsbezeichnungen, keine Materialaussage: ein Flachstab kann im Holzbau Holz sein.
- Die 175 „Stahlseile" erkennt man an zwei Merkmalen: Achse ohne Solid + RFEM-Typ „Tension".


## Etappe 4: Embodied Carbon aus der ÖKOBAUDAT

**Test:** Rechnet einen Stab von seiner Länge bis zu kg CO₂e (A1–A3) von Hand nach.

**Ergebnis (Test bestanden):**
- **Handrechnung:** Flachstab „Flat Bar 175/12" (175 × 12 mm), Achslänge L = 0,8453 m (aus dem Modell gemessen). A = 175 mm × 12 mm = 2100 mm² → V = A × L = 2100 mm² × 0,8453 m × 10⁻⁶ = 0,001775 m³ → m = V × ρ = 0,001775 m³ × 7850 kg/m³ = 13,935 kg → CO₂e (A1–A3) = m × GWP = 13,935 kg × 0,560287 kg CO₂e/kg = **7,807 kg CO₂e** ✓ (automatisierte Rechnung identisch).
- **Gesamtergebnis: 6.872,70 kg CO₂e (A1–A3) = 6,87 t CO₂e** für alle 736 Stäbe:
  - **Baustahl** (689 Stäbe: 502 Flachstäbe + 175 RD 12 + 12 RO): V = 0,944 m³, 7.411 kg Stahl → **4.152,33 kg CO₂e (60,4 %)**
  - **Beton** (47 Fundamente „Rectangle 500/500"): 11,756 m³, 28.214 kg Beton → 2.127,81 kg CO₂e; Bewehrung pauschal 85 kg/m³ = 999 kg Betonstahl → 592,55 kg CO₂e; zusammen **2.720,37 kg CO₂e (39,6 %)**

**ÖKOBAU.DAT-Datensätze (live über die Open-API abgefragt, Indikator GWP-total, Modul A1–A3):**

| Materialgruppe | Datensatz | UUID | Bezugseinheit | GWP normiert |
|---|---|---|---|---|
| Baustahl (Flachstäbe, Rohre, Zugstäbe) | Baustahl: Profile und Stabstahl (Standard) | 20c29cbd-f9a2-4518-a1ce-c681246c29c8 | 1000 kg/Datensatz | 0,560287 kg CO₂e/kg |
| Baustahl (Alternative) | Baustahl: Grobblech | 04d1311a-ae38-4bfb-8e11-8992f1ddb14f | 1000 kg/Datensatz | 2,528984 kg CO₂e/kg |
| Beton (Fundamente) | Beton der Druckfestigkeitsklasse C25/30 (Standard) | 8347f9a7-f4ec-4a36-a266-a0281f5fd16d | 1 m³/Datensatz | 181,0 kg CO₂e/m³ |
| Beton (Alternative) | Beton C25/30 X0 C1 16 L EcoPact (Hersteller) | 69dc12cf-ce4d-4251-8ea3-330ed72f2f79 | 1 m³/Datensatz | 98,939 kg CO₂e/m³ |
| Betonstahl (Bewehrung) | Betonstahl in Stäben (Standard) | a8ebf8f2-2fcc-4431-b730-93bf5efd8111 | 1 kg/Datensatz | 0,5930 kg CO₂e/kg |

**Was wir gemacht haben:**
- Die 5 Datensätze live über `https://oekobaudat.de/OEKOBAU.DAT/resource/processes/<UUID>?format=json&view=extended` abgefragt; Referenzfluss, Bezugseinheit, Referenzmenge, Dichte und GWP-total (A1–A3) extrahiert und auf die Bezugseinheit normiert.
- 736 Stabachsen (Layer „MemberAxes") aus dem RFEM-Export ausgelesen; Querschnittsflächen nominal aus den Profilbezeichnungen; Volumen V = A × L; Masse (Stahl 7850 kg/m³) bzw. Betonvolumen; Bewehrung pauschal 85 kg/m³.
- Pro Stab: CO₂e = CO₂e(Stahl) + CO₂e(Beton) + CO₂e(Bewehrung). Ergebnisse: `Abgabe_23.10/EmbodiedCarbon_Staebe_Liste.xlsx` (Sheets: Pro Stab / Querschnitte / Materialgruppen / OEKOBAU.DAT), `Abgabe_23.10/EmbodiedCarbon_Analyse.json` (Rohdaten), `Abgabe_23.10/EmbodiedCarbon_Oekobaudat_Analyse.docx` (Dokumentation), Skripte `etappe4_oekobaudat.py`, `etappe4_excel.py`, `etappe4_word.py`.

**Learning oder Besonderheit:**
- **Bezugseinheit ist die häufigste Fehlerquelle:** Der Baustahl-Datensatz meldet 560,287 kg CO₂e „je Datensatz“ – ist aber auf 1000 kg bezogen (Referenzfluss „structural steel sections and merchant bars“, Menge 1000 kg) → korrekt sind 0,560287 kg CO₂e/kg. Der Betonstahl-Datensatz ist auf 1 kg bezogen; sein GWP-total ergibt sich aus der Summe der Einzelmodule (A1: 0,0558 + A2: 0,0182 + A3: 0,5190 = 0,5930 kg CO₂e/kg).
- **Rundrohr RO 139.7x8.0 wird im RFEM-Export als Vollzylinder dargestellt** (Solids summieren 0,629 m³) – für die CO₂e-Bilanz ist der Hohlquerschnitt maßgeblich: A = π/4 × (D² − d²) = 3310,1 mm² → V = 0,136 m³.
- **Nominalvolumina (A × L)** liegen wegen der Anfassungen an den Stabanschlüssen ca. 5–15 % über den Solids im 3D-Modell → das Ergebnis ist eine leicht konservative Obergrenze.
- Die Fundamente (Rectangle 500/500) sind die einzigen Betonstäbe; die Flachstäbe, Rundrohre und RD-12-Zugstäbe werden laut Aufgabenstellung als Baustahl bilanziert.


## Etappe 5: Web-App

**Test:** Schaltet beim Stahl auf die Alternative um. Was erwartet ihr vorher, was passiert, und warum?


**Learning oder Besonderheit:**


## Zum Schluss

Wie habt ihr mit dem Agenten gearbeitet, und was würdet ihr der nächsten Gruppe mitgeben?

Der Agent hat das Modell selbstständig geöffnet, Geometrie ausgewertet (Layer/Pfade, Längen) und die Ergebnisse gegen das Modell geprüft (Objektsummen). Wir haben die Zahlen verifiziert und die Excel-Tabelle nur noch formatiert. Tipp für die nächste Gruppe: Modelldatei in `Data/` liegen lassen und den Agenten direkt darauf loslassen – die Zählung über die Stabachsen (Layer „MemberAxes") ist am schnellsten und verlässlichsten.
