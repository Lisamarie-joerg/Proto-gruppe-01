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

**Ergebnis (Test bestanden):**
- **Erwartung:** Der Alternative-Datensatz „Baustahl Grobblech" hat laut ÖKOBAU.DAT ein GWP-total (A1–A3) von 2,529 kg CO₂e/kg statt 0,560 kg CO₂e/kg beim Standard („Profile und Stabstahl") – also fast 4,5×. Da die 689 Baustahl-Stäbe (7.411 kg Stahl) 60,4 % der A1–A3-Emissionen ausmachen, erwarteten wir einen starken Anstieg der Gesamtsumme; Beton sollte mit EcoPact (98,9 statt 181,0 kg CO₂e/m³) sinken.
- **Tatsächlich:** Gesamt A1–A3 steigt von **6.872,6 kg auf 20.497,6 kg CO₂e (+198,3 %)**. Baustahl: 4.152,2 → 18.742,0 kg (+351 %), Beton+Bewehrung: 2.720,4 → 1.755,7 kg (−35 %).
- **Warum:** Der Grobblech-Datensatz ist ein energiesintensives Produkt (hoher Schmelzaufwand pro kg) – der Ausschlag kommt vom Datensatz, nicht von der Menge.
- **Module C und D:** Standard: C = +262,9 kg (Demontage/Entsorgung), D = +1.470,9 kg. Alternative: C = +300,5 kg, D = **−10.924,4 kg** (Grobblech hat eine hohe Recycling-Gutschrift von −1,467 kg CO₂e/kg). Über den Lebenszyklus (A1–A3+C+D) liegt die Alternative mit 9.873,7 kg nur knapp über Standard (8.606,4 kg) – die Modulwahl ist also entscheidend.

**Was wir gemacht haben:**
- Lokale Web-App (FastAPI + Plotly.js, läuft offline, Start: `python webapp/app.py` → http://localhost:8501). **3D-Viewport in der Seitenmitte** (Pavillon mit Maus drehbar), 736 Stäbe als Punkte **nach CO₂e gefärbt** (grün→rot), Punktgröße = Querschnittsfläche, Hover zeigt Nr/Profil/Länge/Volumen/CO₂e.
- Steuerung per Buttons: **Datensatz Standard/Alternative**, **Modul A1–A3 / C / D**, **Materialien aus-/einschaltbar** (Baustahl / Beton / Bewehrung), Ansichten (Perspektive/Draufsicht/Seite), Stabachsen einblenden.
- Datenaggregat `etappe5_webapp_data.py`: liest **alle Excel-Dateien** aus `Abgabe_23.10/` (EmbodiedCarbon_Staebe_Liste.xlsx mit Materialgruppen/Querschnitte/OEKOBAU.DAT, Staebe_UEbersicht.xlsx, Staebe_Querschnitt_Volumen.xlsx, Etappe02_Traegerliste_T001-T736_ETAPPE04.xlsx mit Trägerliste/Rahmenausführungen/Profil-Übersicht) plus die CSVs der Etappen 2/4 und die ÖKOBAU.DAT-Rohdaten (`oekobaudat_raw/`, GWP-total je Modul A1–A3/C1–C4/D) → `webapp/static/data.json` (756 KB). Die Excel-Tabellen sind in der App im rechten Panel eingebunden.
- Plausibilitätscheck: Standard A1–A3 = 6.872,6 kg vs. Etappe 4: 6.872,7 kg → **Abweichung 0,00 %**.

**Wichtigste Prompts** (wörtlich kopieren):
- „Baut eine lokale Web-App, die den Embodied Carbon des Pavillons zeigt. Der Pavillon in 3D, die Stäbe nach CO₂ eingefärbt. Datensatz je Materialgruppe (Standard / Alternative) und Module A1–A3 / C / D umschaltbar. mache ein viewport in der mitte der seite in dem man das gebäude in 3D drehen kann. die Verschiedenen materialien sind per button ausschaltbar. erstelle eine webapp die man bedinen kann. erstelle dazu ein logbucheintrag und speichere es unter dem abgabe ordner ab. greife auf alle gespeicherten exceldatein zu und binde sie ein"

**Was schiefging und woran wir es gemerkt haben:**
- Die Excel-Tabellen landeten zuerst als `null` in der data.json – bei der Reparatur des Daten-Skripts war die `return`-Zeile von `read_excel_table` verloren gegangen; aufgefallen an der Zeilen-/Spalten-Prüfung der JSON-Ausgabe.
- PowerShell-Escapes haben Inline-Python zerschossen → alle Skripte als Dateien geschrieben.

**Was wir selbst geprüft haben:**
- Endpunkte per HTTP-Test: `/` (200), `/api/data` (200, 736 Stäbe, 2 Datensätze, 3 Module, 8 Excel-Tabellen), `/static/plotly.min.js` (200).
- Summen gegen Etappe 4 (0,00 % Abweichung); Gruppensummen Baustahl 4.152,2 / Beton 2.720,4 kg stimmen mit dem Excel-Sheet „Materialgruppen" (4.152,33 / 2.720,37) überein.
- Materialgruppen: Baustahl 689 Stäbe (7.410,9 kg), Beton 47 Stäbe (11,756 m³, 28.214 kg, Bewehrung 999 kg).

**Learning oder Besonderheit:**
- Die ÖKOBAU.DAT-Datensätze liefern im erweiterten View (`view=extended`) auch die Module C1–C4 und D – Lebenszyklus-Szenarien (A1–A3+C+D) sind damit ohne Zusatzdaten rechenbar.
- Bei Modul D kann der „schlechtere" Datensatz (Grobblech) dank hoher Recycling-Gutschrift (−1,467 kg/kg) die bessere Bilanz ergeben – Graue-Energie-Vergleiche müssen immer alle Module betrachten.
- Die Flachstäbe werden laut Aufgabenstellung (Etappe 4) als Baustahl bilanziert, in Etappe 3 aber als Holz gerendert – die CO₂-App folgt der Etappe-4-Methodik (die Etappe-3-Materialzuordnung steht zusätzlich in den Daten).



**Nachtrag – Bugfix (Web-App):** Die App zeigte das 3D-Modell nur, wenn sie über
`python webapp/app.py` (FastAPI, Port 8501) gestartet wurde. Wurde der
`static`-Ordner direkt über einen Statik-Server geöffnet (z. B.
`python -m http.server 8000`), schlugen die absoluten Pfade
`/static/plotly.min.js` und `/api/data` mit 404 fehl → Plotly und Daten luden
nicht, der Viewport blieb leer (Fehlerkonsole: „Daten konnten nicht geladen
werden"). Fix: `index.html` nutzt jetzt relative Pfade mit Fallback
(Plotly: `plotly.min.js` → `/static/plotly.min.js`; Daten: `/api/data` →
`data.json`), und `app.py` mountet den static-Ordner zusätzlich unter `/`
(`html=True`). Damit läuft die App sowohl über FastAPI als auch über jeden
beliebigen Statik-Server. Verifiziert per Headless-Render (736 Stäbe, Szene
822×733 px) auf beiden Wegen.

**Nachtrag – Darstellung der Stäbe im 3D-Viewport:** Zuerst wurden die 736
Stäbe nur als einfache Punkte (scatter3d markers) gezeichnet. Jetzt wird jeder
Stab als echtes 3D-Volumen (quaderförmiger mesh3d-Körper zwischen `start` und
`end`, Kantenlänge aus der Querschnittsfläche `A_mm2`) gerendert, weiterhin
nach CO₂e eingefärbt (grün → rot) und mit Hover-Infos (Nr./Profil/Länge/Fläche/
Volumen/CO₂e). Verifiziert per Headless-Render: Bildinhalt von ~12.800 auf
~57.000 farbige Pixel gestiegen (~4,5×), identisch auf FastAPI (`app.py`, :8501)
und reinem Statik-Server (`python -m http.server`, :8000).

## Zum Schluss

Wie habt ihr mit dem Agenten gearbeitet, und was würdet ihr der nächsten Gruppe mitgeben?

Der Agent hat das Modell selbstständig geöffnet, Geometrie ausgewertet (Layer/Pfade, Längen) und die Ergebnisse gegen das Modell geprüft (Objektsummen). Wir haben die Zahlen verifiziert und die Excel-Tabelle nur noch formatiert. Tipp für die nächste Gruppe: Modelldatei in `Data/` liegen lassen und den Agenten direkt darauf loslassen – die Zählung über die Stabachsen (Layer „MemberAxes") ist am schnellsten und verlässlichsten.

## 16.11.2026 – Bewehrungsplan und Website

- Bestandsaufnahme: Website und Abgabe_20.11 gesichtet. Die gleichnamigen Rhino-Dateien haben unterschiedliche Prüfsummen.
- Quellen geprüft: Streifenfundamentplan zeigt vier Stabpositionen mit 1.015,63 kg Gesamtmasse laut Stabliste. Im RFEM-Modell sind keine separat benannten Bewehrungslayer vorhanden.
- Webapp bearbeitet: GLB-Linien in Filter und Auswahl aufgenommen, Kamera auf Rhino-Z ausgerichtet, Modellabmessungen ergänzt. Fundamentfokus, schematische 3D-Bewehrung, transparente Überlagerung, PDF und Zuschnittliste ergänzt.
- Gruppenzugriff vorbereitet: Webdateien verwenden relative Pfade und können mit einem einfachen lokalen HTTP-Server bereitgestellt werden. Startanleitung hinzugefügt.
- Offen: Sichtprüfung im Browser, Zuordnung aller planmäßigen Stäbe, planbasierte CO₂e-Mengen und GitHub-Abgleich. OneDrive-Projektordner meldet beim Schreibversuch Zugriff verweigert.
- Prüfungen: Alle 47 Betonachsen der Webdaten stimmen auf Millimeter gerundet mit Abgabe_20.11 überein. Planmassen, Planausschnitt, lokale Asset-Pfade und JavaScript-Syntax geprüft. Die Testumgebung hat die lokale Socket-Verbindung verweigert.

## 16.11.2026 – Planpositionen im Modell und CO₂e

- Schnitte A–A und B–B sowie Detail 1 ausgewertet. Alle vier Positionen als anwählbare 3D-Stäbe in fünf Fundamentstreifen ergänzt. Lage, Übergreifungen im Detail und Biegeradien bleiben angenähert.
- Die Stabliste und die Bilanz beziehen ihre Mengen aus denselben Planpositionen. Die Gesamtbilanz verwendet 1.015,63 kg, Einzelwerte verteilen die Planmasse proportional zum Betonvolumen. Archivierte Excel-Ergebnisse sind als vorheriger Bilanzstand gekennzeichnet.
- Automatisch geprüft: 501 erzeugte Stäbe, vier korrekte Positionsstückzahlen, endliche 3D-Koordinaten und Bewehrungs-CO₂e für beide Datensätze in A1–A3, C und D.
- GitHub-Ziel geprüft: Die konfigurierte Origin ist öffentlich und der Browser meldet keinen angemeldeten Account. Git kann den GitHub-Host aus der Sitzung nicht auflösen. Der Upload ist offen.

## 16.11.2026 – Startdatei und GitHub-Desktop-Stand

- Windows-Startdatei für den lokalen Website-Aufruf hinzugefügt und ZIP neu geprüft.
- Separaten Git-Arbeitsbranch vom lokal bekannten Stand der Gruppen-Origin vorbereitet. Die veröffentlichte Version steht noch aus.

## 16.11.2026 – Materialdarstellung und Start

- Modellmaterial nach Bauteil-ID zugewiesen: 47 Betonfundamente, 12 Stahlstützen, 502 Holzbauteile und 175 Stahlseile. Materialdarstellung und CO₂e-Bilanzannahmen separat gekennzeichnet.
- Ein eindeutiger Seitentitel und ein Start auf freiem Port unterscheiden die aktualisierte Website von einer älteren lokalen Instanz.
- Website-Dateien und ZIP für den genehmigten GitHub-Push vorbereitet.

## 16.11.2026 – Planmodell, Material und Interaktion

- Aus Stabliste P-01, Schnitten A–A/B–B und Detail 1 wurden 501 3D-Stabobjekte auf vier Positionslayern erzeugt. Rhino-Datei wieder geöffnet und Stückzahlen geprüft. Einbaulagen und Biegeradien sind angenähert.
- Website auf Tragwerk, Bewehrung und Gewicht umgebaut. Materialzuordnung gegen GLB und RFEM-Daten geprüft: 47 Betonfundamente, 12 Stahlstützen, 502 Dachkörper aus Holz.
- In Edge Materialansicht und freigestellte Bewehrung geprüft. Klick auf einen Längsstab öffnete Detailposition 2 und markierte die Positionsgruppe pink. Drag-and-drop für eigene GLB-/PDF-Dateien ergänzt.
- ZIP mit der aktuellen Website aktualisiert. Rhino-Modell separat bereitgestellt.

## 16.11.2026 – Betondeckung, Stöße und Originaldetails

- Beton in der kombinierten Ansicht deutlicher dargestellt. Stabwahl markiert gleiche Planposition und modellierte Zuschnittlänge pink, andere Stäbe grau. Originalausschnitte A–A, B–B und Detail 1 direkt aus dem PDF ergänzt.
- Längsstäbe mit 30 cm Überdeckung modelliert und seitlich versetzt. Gegen die Betonflächen des GLB bis zu 25 mm entlang der Stäbe geprüft: kleinster geprüfter Abstand zur Stahloberfläche 41,66 mm, längster Stab 5,1044 m.
- 470 Stäbe, modellierte Stahlmasse 902,86 kg. Originalwerte bleiben in der Stabliste sichtbar. Rhino-Modell und ZIP aktualisiert.

## 16.11.2026 – Stoßlagen und bemaßte Achsen

- P-01 erneut geprüft. A–A zeigt einen Stoß nahe Achse E, B–B zwei Stöße zwischen 4/5 und 5/6. Bemaßung jeweils mindestens 1,00 m. Im Modell 1,06 m verwendet und benachbarte Stöße um insgesamt 20 cm gegeneinander versetzt.
- Alle 70 Längsstöße mit 1,06 m Überdeckung nachgerechnet. Längster Stab 5,1353 m. 490 Stäbe in 15 Typgruppen, Modellmasse 955,43 kg. Die Stabauswahl gruppiert nach Planposition und Zuschnittlänge auf Zentimeter gerundet.
- Achsen B–H und 3–7 mit Maßketten in der XY-Ebene unter dem Fundament eingezeichnet und in Edge geprüft. Rhino-Modell und ZIP aktualisiert.


## 16.11.2026 – Gruppenordner für die Abgabe

- Lokal aktualisierten Ordner Abgabe_20.11 mit Originalplan, Rhino-Quelldatei und startbarer Website übernommen. Startdatei und Website-Assets geprüft. Das ZIP im Hauptordner entspricht dem aktuellen Stand auf main.

## 16.11.2026 – Fundamentenden, Stützenkörbe und Achsschnitte

- Außenkanten aus P-01 am registrierten Achsraster abgelesen. Fundamentüberstände ab äußeren Stützenachsen in A–A ca. 48/54 cm, in B–B je 25 cm. Fünf Fundamentkörper für Rhino und Viewer aus gemeinsamen Geometriedaten erzeugt.
- 12 Detailkörbe aus je acht Bügeln an den Stützenmittelpunkten zentriert und ihre Lage aus den Modellkoordinaten geprüft. Kleinste modellierte lichte Deckung 41.99 mm. Auswahl nach Planposition, Position 2 umfasst alle 60 Stäbe.
- Klick auf Rasterachse und anschließende Richtungswahl erzeugen einen orthogonalen Clipping-Schnitt. Website im Hauptordner und in Abgabe_20.11 aktualisiert.

## 16.11.2026 – Schnittzoom und Rhino-Bewehrungsexport

- Orthogonalen Schnittzoom per Mausrad und Schaltflächen ergänzt. Die schwarzen Schnittpolygone des Betonstahls für beide Richtungen an den Achsen D und 5 geprüft.
- Button für den 3DM-Export der 509 Stäbe ergänzt. Vier Positionslayer und Referenzachsen samt Kontrollpunkten im bestehenden RFEM-Koordinatensystem gespeichert. Bounding Boxes der Stäbe stimmen zwischen Importdatei und Vollmodell exakt überein, Referenz D/5 ist auf (10, −5, 0).

## 16.11.2026 - Import eigener Modelle und Bewehrungspläne

- Dunkle GLB-Materialien aufgehellt und eine neutrale Darstellung sowie Z-up-Umschaltung ergänzt.
- Importierte Stäbe nach Positionsnamen oder JSON gruppiert. Original-PDF im Detailfenster, optionale Planseiten, Achsen, Schnittflächen und berechnete Bewehrungsmasse für JSON-Geometrie ergänzt.
- Stockerau im Browser geöffnet. Datenprüfung mit 509 Stäben, 60 Stäben der Position 2, Schnittflächen und einem synthetischen dunklen Importmodell bestanden.

## 16.11.2026 - Bauteil 6 und Originalpläne E02

- Den konkreten GLB-Export mit 883 Meshes geprüft. Beton und Stahlprofile erhalten lesbare Ersatzfarben für das schwarze Ausgangsmaterial.
- Vier Original-PDFs gleichzeitig auswählbar gemacht. Die Positionen 1 und 2 aus Plan 2448 als 20 angenäherte gerade Stäbe der unteren Deckenlage am GLB hinterlegt. Plan 2448 öffnet sich bei der Stabauswahl nach lokalem Laden des PDFs.
- Import mit echtem GLB, vier Originaldateien, Gruppenauswahl, PDF-Verknüpfung und Rückkehr zu Stockerau im Anwendungstest geprüft. Der Test verwendet Three.js mit einer simulierten Browseroberfläche und prüft die Szene ohne WebGL-Ausgabe.

## 16.11.2026 - Planabgleich für die vollständige Bewehrung E02

- Vier Biegelisten visuell gelesen und die Sollstückzahlen je Plan, Revision und Position in `webapp/static/projekt6-plan-soll.csv` erfasst. Die Summe beträgt 3.154 Tabellenstücke für E02. Die Abgrenzung der Ergänzungspositionen und der vollständigen oberen Lage vor dem Modellieren anhand der referenzierten Planblätter prüfen.
- `Bauteil6.3dm` in Rhino geprüft. Das Dokument enthält 883 Meshes und verwendet Millimeter. Das Deckenmesh `Floor:STB, d=25:1936245` trägt die IFC-GlobalId `3RxWNgkJb4BgTC6fgJ6T1J`. Es liegt zwischen +12,02 und +12,27 m und ist laut IFC-Metadaten 250 mm dick. Eine ähnlich geformte Decke liegt bei +7,38 bis +7,63 m.
- Für die Rekonstruktion zuerst Geschoss, Raster A–D/1–7 und Öffnungen registrieren. Dann je Planposition Bauteil, Lage, Durchmesser, Biegeform, Stückzahl und Verlegebereich erfassen. Das Rhino-Modell erhält Stabobjekte je Plan und Position. Die Website übernimmt daraus Stabachsen und Planverweise. Sollmengen, geometrisch zugeordnete Stäbe und Modellmasse werden separat geprüft.

## 16.11.2026 - E02-Positionsliste und Grundnetz in der App

- 136 Tabellenpositionen der vier Blätter mit Soll- und Modellstückzahl in der App verfügbar gemacht. Positionen öffnen das jeweilige lokal geladene Original-PDF. Vorhandene Stäbe lassen sich gemeinsam auswählen.
- Für Position 2448/9 81 von 92 geraden 14-m-Stäben als Näherung am E02-Deckenmesh geprüft und übernommen. Elf Lagen erfordern weitere Prüfung an Öffnungen und Rändern. Positionen 1 und 2 liegen über der kreuzenden Lage. Die Rekonstruktion umfasst insgesamt 101 Stäbe.
- Separate Rhino-Importdatei mit 101 geschlossenen Volumenkörpern im Originalkoordinatensystem erzeugt und in Rhino wieder eingelesen. Viewer-Import, Gruppenauswahl, Planverweise und Rückkehr zu Stockerau mit den echten Dateien im Anwendungstest geprüft.

## 18.11.2026 - Gebäudeansicht und Prüfung aller fünf PDF-Seiten

- Vier PDFs mit fünf Seiten erneut geprüft. Die zweite Seite von Blatt 2648 zeigt eine Gebäudeansicht mit Treppen. Sie enthält keine zusätzliche Biegeliste. Die plangetreue Bewehrung des vollständigen Gebäudes einschließlich Treppen ist durch diese E02-Unterlagen nicht vollständig festgelegt.
- Projekt 6 mit Modell, Original-PDFs und unveränderten Planbildern in die Website integriert. Projekt 6 startet direkt. Filter für Bauteilgruppen, einzelne Bauteile und Betondeckkraft ergänzt.
- Aus dem tatsächlichen GLB-Mesh schematische äußere Stabgitter abgeleitet. Nach Abgleich mit den Rhino-Materialien verbleiben 56.345 orange Abschnitte in 537 von 684 erfassten Bauteilen, darunter 1.402 in 35 Treppenbauteilen. 51 Mauerwerksbauteile wurden ausgeschlossen. 96 Betongeometrien bleiben offen und sind in der Bauteil-CSV aufgeführt. Die angenommenen geraden Stäbe haben Ø12, Raster maximal 20 cm, nominellen Achs-Randabstand von 4 cm, Abschnittslänge maximal 7,50 m und angenommene Längsüberdeckung von 1,06 m. Die Abstände an schrägen Oberflächen und die Ausführbarkeit benötigen gesonderte Prüfung.
- Die 101 rekonstruierten E02-Stäbe und die Biegelisten-Sollmengen werden durch die schematischen Ergänzungen nicht als vollständig modelliert ausgewiesen. Auswahl gleicher Ergänzungsstäbe nach Durchmesser und auf Millimeter gerundeter Länge. Geometrie wird als Instanzen dargestellt.
- Anwendungseinstieg mit echten Dateien, PDF-Planbilder, Gruppen-, Treppen- und Einzelfilter sowie Rückkehr zum Pavillon getestet. Eine gerenderte Browserprüfung scheiterte zunächst am Verbindungsaufbau. Der direkte Zugriff auf den ursprünglichen OneDrive-Ordner ist durch Dateirechte begrenzt. Der Git-Push über HTTPS scheiterte an der DNS-Auflösung von github.com.
- Anschließend die Live-Verbindung zu Rhino wiederhergestellt und IFC-Metadaten aller 883 Objekte ausgelesen. Alle 684 erfassten GLB-Bauteile über ihre Bounding Boxes mit Rhino verknüpft. Geschossfilter, Material und IFC-GlobalId in der App ergänzt. Das Rhino-Dokument enthält ausschließlich Meshes und keine Bewehrungsobjekte.

## 18.11.2026 - Präsentationsablauf mit leerem Viewport

- Startansicht geleert. GLB-Import erkennt Pavillon und Projekt 6 anhand des Dateiinhalts. Erst nach PDF-Import wird die Bewehrungsüberlagerung aktiviert. Vorherige PDFs und Auswahlzustände werden beim Wechsel des Modells entfernt.
- Präsentationsdateien für beide Projekte in zwei Unterordnern zusammengestellt. Die vier Projekt-6-PDFs werden auch bei geändertem Dateinamen den bekannten Planblättern zugeordnet.
- Stabauswahl isoliert gleiche Stäbe: übrige Modellstäbe, Ergänzungsinstanzen und Schnittflächen werden ausgeblendet. Schaltflächen zum Aufheben der Auswahl und zum Leeren des Viewports ergänzt.
- Den vollständigen Ablauf mit echten GLB-/PDF-Dateien in einem Anwendungstest geprüft: leerer Start, Pavillon und Plan, Auswahl von Position 2 mit 60 sichtbaren Stäben, gefilterte Schnittflächen, Projektwechsel, vier umbenannte Projekt-6-Pläne, isolierte Instanzauswahl und Neustart des Ablaufs.

## 18.11.2026 - Auswahl auf die einzelne Stabgruppe begrenzt

- Die schematischen Ergänzungen wurden zu breit gebäudeweit anhand von Durchmesser und Länge zusammengefasst. Die Gruppen sind jetzt zusätzlich nach Bauteil und Stabrichtung getrennt. Echte Planpositionen behalten ihre Positionszuordnung.
- Den Klicktest ohne vorherige Bauteil- oder Geschossfilter erweitert: Nach der Auswahl ist genau eine Gruppe mit genau einem Bauteil und einer Stabrichtung sichtbar. Die anderen Stäbe sind ausgeblendet. Pavillon-Position 2 mit 60 sichtbaren Stäben und das Aufheben der Auswahl erneut geprüft.

## 18.11.2026 - Stabgruppen nach Länge, Biegeform und Durchmesser

- Nach Präzisierung der Anforderung die Gruppierung von Bauteil und Stabrichtung gelöst. Beim Klick im Viewport sind ausschließlich Länge, Biegeform und Durchmesser maßgebend. Die Formprüfung nutzt die Abstände zwischen den Biegepunkten und berücksichtigt räumliche Biegungen. Verschobene, gedrehte und in umgekehrter Reihenfolge gespeicherte Stäbe werden gemeinsam erkannt.
- Die ausgewählte geometrische Gruppe bleibt pink sichtbar; die übrigen Stäbe und deren Schnittflächen werden ausgeblendet. Die Positionsliste bleibt als zusätzliche Auswahl der jeweiligen Planposition verfügbar.
- Gleiche und unterschiedliche U-/L-Formen, rechteckige Bügel, Durchmesser, Länge, räumliche Biegungen, Drehungen und verschiedene Startpunkte geschlossener Bügel geprüft. Direkte Viewport-Klicks im Pavillon und Projekt 6 zeigen jeweils genau die ermittelte geometrische Gruppe. Präsentationsablauf mit leerem Start erneut getestet.

## 19.11.2026 – Reuse-Katalog, Schnittvorschläge und Lkw-Belegung

- Neuen englischen Reuse-Ablauf ergänzt: transparente Transporthüllen mit geschnittener Bewehrung, rote Schnittumrisse, größte Stücke je Ausgangsbauteil, Explosionsansicht und unabhängige IFC-Geschossfilter. Die bestehende Bewehrungsansicht einschließlich Gruppenauswahl, PDF-Verknüpfung, Achsschnitten und Rhino-Download bleibt erhalten.
- Bauteilkatalog mit Abmessungen, Volumen, Masse, Herkunft, Bewehrungsstatus und Lkw-Zuordnung ergänzt. Auswahl im Viewport, in der Bauteiltabelle und in der Lkw-Draufsicht ist gekoppelt. Einzelteilzoom, CSV-Export und konzeptionelle Demontage-/Ladefolge hinzugefügt.
- Volumen geschlossener, konsistent orientierter Meshes verwendet; offene Netze erhalten eine gekennzeichnete obere Gewichtsschätzung. Schnittfugen, Nettohubgrenze, Ladefläche, Ladehöhe, Nutzlast und Packabstände berücksichtigt. Einlagige MaxRects-Heuristik mit zulässigen Achsrotationen verwendet. Das ist keine statische Freigabe oder globale Transportoptimierung.
- Fünf zunächst fehlende Betonquellen mit mehrfach vergebenen Rhino-Namen gefunden. Zuordnung um Welt-Bounding-Boxes ergänzt. Alle 633 erwarteten Betonquellen werden eindeutig übernommen. Mit den Standardannahmen entstehen 2.311 Produkte, 1.713 neue Schnitte und 361 Lkw-Ladungen; neun Quellen verwenden eine obere Gewichtsschätzung.
- Kamerareihenfolge beim erstmaligen Öffnen korrigiert; Auswahlgrenzen nach dem Verschieben von Gebäudeteilen auf die Ladefläche zurückgesetzt. Wiedergabe wird beim Verlassen des Katalogs angehalten. Standardkatalog durch Fingerabdruck von Geometrie und Bauteilmetadaten gegen falsche Wiederverwendung geschützt.
- Automatische Prüfungen mit realen Projektdateien bestanden: Volumen inklusive Löchern und Schnitten, Schnittverlustbilanz, Gewichts-/Transportgrenzen, eindeutige Bauteile, überschneidungsfreie Lkw-Belegung, starre Ladetransformationen, geschnittene Stäbe, Auswahl, Geschossfilter, Ladefolge, Zurücksetzen, Pavillon-Neuberechnung und bisheriger Präsentationsablauf. Die Tests nutzen Three.js mit simulierter Oberfläche; eine visuelle WebGL-Browserprüfung bleibt offen, da die Browsersteuerung die aktuelle Adresse nicht sicher ermitteln konnte.
- Bedienung in REUSE-KATALOG.md und englischen Zehn-Minuten-Demoablauf in PRESENTATION-REUSE.md gespeichert. Website-Startanleitung aktualisiert. Weitergabe über aktualisiertes ZIP; GitHub-Veröffentlichung muss anhand des tatsächlichen Push-Ergebnisses geprüft werden.

## 19.11.2026 – Stabauswahl, sichtbarer Rückbau und konsolidierte Ladungen

- Bewehrungsübersicht als klare Rückkehr aus dem Katalog ergänzt. Individuelle Instanzstäbe erhalten eine Klicktoleranz von wenigen Bildpunkten. Gruppen werden weiterhin ausschließlich nach Länge, Biegeform und Durchmesser gebildet; Bauteil- und Geschossfilter werden für eine vollständige geometrische Gruppe zurückgesetzt. Fremde Stäbe sind ausgeblendet.
- Die Sequenz folgt jetzt der tatsächlichen oberen Z-Kante der Teile. Bauteile werden sichtbar angehoben, zum Zwischenlager bewegt und erst danach aus der Gebäudeansicht entfernt. Nach dem vollständigen Rückbau beginnt die Bewegung vom Zwischenlager auf die jeweilige Ladefläche. Dauer 30–600 Sekunden; Auswahl pausiert die Wiedergabe.
- Teilinformationen um X ab Ladeflächenfront, Y ab linker Ladeflächenkante und belegte Grundfläche ergänzt. Auswahl bleibt mit Katalog und Lkw-Draufsicht verknüpft.
- Mehrere Packreihenfolgen verglichen, schwach belegte Lkw nach Möglichkeit aufgelöst und passende Teile umverteilt. Mit den aktuellen Standardkriterien: 351 statt zuvor 361 Ladungen; letzte Ladung 17 Teile / 19,36 t statt zuvor zwei Teile / 6,18 t. Nutzlast und Flächenauslastung werden separat ausgewiesen. Grenzen und kollisionsfreie Belegung werden weiterhin eingehalten.
- Einstellbare Mindestwerte für Rückgewinnung ergänzt: standardmäßig 100 kg Teilegewicht und 8 cm kleinste Abmessung. 54 von 2.311 Teilstücken mit etwa 4,27 t fallen dadurch aus der Verladung; 2.257 bleiben Kandidaten. Am Sequenzende und über Not reused stehen die ausgeschlossenen Teile rot im Viewport und mit Grund in einer anklickbaren Liste. Dies ist eine Einordnung nach gewählten Kriterien und kein statischer Unbrauchbarkeitsnachweis.
- Kern-, Projekt-6-, Pavillon- und vollständige Anwendungstests erweitert: echte Workflow-Einbindung statt alleiniger Attrappe; Rückkehr zur Stabauswahl; einzelner dünner Instanzstab; geometrische Gruppenisolation; sichtbare Hubbewegung; strikt getrennte Rückbau-/Ladephase; Endbericht; Ladepositionen; Masse, Abstände und kollisionsfreie Packung. Prüfungen verwenden echte Geometrien mit simulierter Oberfläche; visuelle WebGL-Prüfung weiterhin separat erforderlich.

## 19.11.2026 – Bewehrung V3: Herkunft und bauteilbezogene Gitter/Körbe

- Das bisherige rasterartige Volumennetz durch bauteilbezogene Ergänzungen ersetzt: zweiachsige Matten in Decken und Wänden, geneigte Treppen- und Podestgitter sowie Längsstäbe mit abgerundeten geschlossenen Bügeln für passende Stützen- und Trägergeometrien.
- Die 101 ursprünglichen Planachsen getrennt erhalten und als 283 angenommene Montageabschnitte mit maximal 7,50 m dargestellt. Die 1,06-m-Stöße und seitlichen Stoßversätze sind ausdrücklich Annahmen. Nur diese Rekonstruktion hat einen Planpositionsbezug; es ist keine vollständige Rekonstruktion der vier E02-Pläne.
- Herkunft durch blaue Planrekonstruktion, orange Ergänzungen und grauen ungeprüften Import getrennt. Eigenständige Herkunftsfilter und eine geometrische Gruppenliste ergänzt. Ein Klick auf eine Planposition wählt nun eine einzelne Formgruppe. Ausgewählte Stäbe werden nach tatsächlicher Mittellinienlänge, Biegeform und Durchmesser isoliert; auch alle Segmente eines gebogenen Bügels bleiben demselben Stab zugeordnet.
- Fehlerhaften PDF-Rückfall beseitigt: Schematische Stäbe öffnen nicht mehr das zuletzt geladene, unzugeordnete PDF. Planpositionen ohne 3D-Geometrie sind ausdrücklich als nicht modelliert beschriftet.
- 52789 angenommene Stäbe, darunter 2067 geschlossene Bügel, in 514 von 633 Betonquellen erzeugt. 119 Quellen bleiben offen, statt unplausibel gefüllt zu werden. Offene Netze, außerhalb liegende Vorschläge, zu wenig geometrische Deckung und unvollständige Körbe/Gitter werden ausgeschlossen. Bauteil-CSV und Herkunftshinweise aktualisiert.
- Geometrie gegen die tatsächlichen Meshes geprüft: Segment-zu-Dreieck-Abstände für die ergänzten Stäbe und mindestens 4 cm lichte geometrische Deckung; unabhängige Stichproben an 203.841 Punkten kontrolliert. Keine statische Bemessung oder Prüfung der real vorhandenen Bewehrung behauptet. Schließhaken, Verankerung und fehlende Ausführungspläne bleiben offen.
- Anwendungstest mit echter Workflow-Einbindung bestanden: Herkunftsfilter, geometrische Gruppenauswahl, vollständige gebogene Instanzstäbe, Plan-PDF-Zuordnung und Rückkehr aus dem Reuse-Katalog. Grundtests für Rotationen, Längen, Durchmesser und Biegeformen sowie die bisherigen Reuse-/Lkw-Tests bestanden. Reuse-Geometrie und Belegung bleiben bei 351 Ladungen unverändert.
- Anleitung BEWEHRUNG-V3.md und sichtbare Versionskennung ergänzt. Tests verwenden die echte Geometrie mit simulierter Oberfläche; eine visuelle WebGL-Endprüfung ist weiterhin nicht abgedeckt.
