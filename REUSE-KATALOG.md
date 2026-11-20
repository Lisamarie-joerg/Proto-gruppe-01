# Reuse catalogue – Bedienung und Konzept

Die Bewehrungsdarstellung wurde mit V3 überarbeitet: Blau = angenäherter Planbezug, Orange = schematische Matten/Körbe, Grau = ungeprüfter Import. Geometrische Stabgruppen lassen sich einzeln isolieren. Fehlende Bewehrung wird in den Produktinformationen als offen ausgewiesen; die Zerlegung und Lkw-Belegung bleiben erhalten. Details: `BEWEHRUNG-V3.md`.

## Öffnen

`Website-oeffnen.bat` im entpackten Projektordner doppelklicken. Python muss installiert sein. Das geöffnete Serverfenster geöffnet lassen. Nicht `index.html` direkt öffnen: Module, Modelldaten und Berechnungsworker benötigen den lokalen HTTP-Server.

Die App startet weiterhin mit leerem Viewport. Zuerst ein GLB aus `Praesentationsdateien` importieren und anschließend den zugehörigen PDF-Plan beziehungsweise bei Projekt 6 alle vier PDFs gemeinsam laden. Oben **Reuse catalogue** und anschließend **Create / recalculate catalogue** wählen.

## Ablauf aus Sicht der Entwerfenden

1. Unter **Transport & lifting assumptions** die verfügbare Ladefläche, Nutzlast, Hubkapazität und Anschlagmittelreserve festlegen. Nach Änderungen neu berechnen.
2. **Building & cuts** zeigt transparente Transporthüllen mit vorhandener Bewehrung und roten Schnittumrissen. Goldene Kanten markieren die größten Produkte je Ausgangsbauteil. Das sind geometrisch ermittelte Vorschläge, keine global optimierten Zuschnitte.
3. Unter **Visible storeys** einzelne IFC-Geschosse unabhängig ein- und ausschalten. **Exploded parts** verteilt Geschosse und Teilstücke zur besseren Übersicht.
4. Ein Teil im Viewport anklicken. Dasselbe Produkt erscheint pink in der Liste; Gewicht, Abmessungen, Quelle und Lkw-Zuordnung stehen im Detailfeld. Zusätzlich werden X ab Ladeflächenfront, Y ab linker Kante und die belegte Grundfläche angegeben. Für das ausgewählte Teil wird die tatsächlich geschnittene Modellgeometrie gezeigt. **Zoom to part** und **Show assigned truck** führen direkt dorthin. Ein Klick pausiert die Wiedergabe.
5. **Truck loading** zeigt die zugeordnete einlagige Belegung im 3D-Viewport und als anklickbare Draufsicht. Über die Lkw-Auswahl alle Ladungen durchgehen. Die angezeigte Lkw-Anzahl gilt für diese Packheuristik.
6. **Play sequence** zeigt alle Geschosse und hebt die Bauteile in der Reihenfolge ihrer tatsächlichen Oberkante von oben nach unten aus dem Gebäude ins Zwischenlager. Erst nach vollständigem Rückbau folgt die Verladung vom Zwischenlager auf die Ladefläche. Die Dauer ist von 30 bis 600 Sekunden einstellbar. Mit dem Regler zwischen den Phasen wechseln. **Reset** stellt das ganze Gebäude wieder her.
7. Die Bauteilliste ist nach Geschoss und Größe sortiert; weitere Sortierungen, Suche und **Export CSV** stehen bereit. Geschossfilter und Suche begrenzen auch den CSV-Export.

**Bewehrungsübersicht** beziehungsweise **Reinforcement overview — select identical bars** verlässt die Bauteilauswahl. Dort einzelne Stäbe anklicken: Gleiche Länge, Biegeform und gleicher Durchmesser ergeben eine pinke Gruppe, unabhängig von Richtung oder Bauteil. Andere Stäbe werden ausgeblendet; **Alle Stäbe anzeigen** setzt die Auswahl zurück. Auch sehr dünne Instanzstäbe sind mit einer Toleranz von wenigen Bildpunkten auswählbar. Original-PDFs, Materialansicht, Achsschnitte und Rhino-Downloads bleiben erhalten. Beim Modellwechsel werden Katalog und Ladezustand zurückgesetzt.

Am Ende der Sequenz beziehungsweise über **Not reused** erscheinen ausgeschlossene Produkte rot und in einer anklickbaren Liste mit Grund. Maßgebend sind die einstellbaren Mindestwerte für Teilegewicht und kleinste Abmessung. Diese Einordnung ist keine Aussage über die tatsächliche Resttragfähigkeit. Alle übrigen Teile bleiben Wiederverwendungskandidaten mit offenem Nachweis.

## Berechnungsregeln

- Nur zugeordnete Betonbauteile werden zerlegt. Stahl, Holz und Mauerwerk sind nicht Teil des Betonkatalogs. Beim Pavillon werden die fünf korrigierten Betonfundamente verwendet; bei Projekt 6 die über Namen zugeordneten Betonmeshes mit IFC-Geschossdaten.
- Ausgangsbauteile bleiben getrennt. Jedes erhält einen horizontal ausgerichteten Begrenzungsrahmen. Weitere Schnitte begrenzen Gewicht und Transportmaße. Möglichst große linke Teilstücke werden bis zur gewählten Grenze gebildet; bei Treppen werden geeignete breite horizontale Podestbereiche bevorzugt. Eine statische Verbindungserkennung erfolgt nicht.
- Masse = geschlossenes Meshvolumen × einstellbare Dichte. Für offene oder nicht konsistent geschlossene Netze wird eine gekennzeichnete obere Schätzung aus dem Begrenzungsvolumen verwendet. Schnittfugen werden vom Teilvolumen abgezogen.
- Maßgebendes Teilegewicht ist das kleinere aus Lkw-Nutzlast und Hubkapazität abzüglich Anschlagmittelreserve. Hubradius und konkrete Kranlastkurve sind separat zu bestimmen.
- MaxRects belegt Lkw-Rechtecke einlagig mit zulässigen Achsrotationen, Randabstand und Zwischenraum. Mehrere Sortierungen werden verglichen, dünn belegte Ladungen nach Möglichkeit auf andere Lkw aufgeteilt und geeignete Teile umverteilt. Nutzlast und belegte Fläche sind separat sichtbar; geometrisch nicht passende Reststücke werden nicht über die Grenzwerte hinaus aufgefüllt. Weder Stapelung noch Auflager, zulässige Transportlage, Achslasten oder Ladungssicherung werden nachgewiesen.
- Reinforcement wird aus der bereits vorhandenen Stabüberlagerung in die Teilstücke geschnitten. Projekt-6-Ergänzungen bleiben ausdrücklich schematisch. Fehlende Planbewehrung wird nicht nachträglich als nachgewiesen ausgegeben.

Standardannahmen: 13,60 × 2,45 m nutzbare Ladefläche, 2,60 m Ladehöhe, 24.000 kg Nutzlast, 5.000 kg Hubkapazität, 200 kg Anschlagmittelreserve, 2.500 kg/m³ Betondichte, 0,08 m Packabstand und 0,01 m Schnittfuge. Nutzlast und Hubkapazität sind frei gewählte Planungsannahmen. Maße als Orientierung: [Schmitz S.CS](https://www.cargobull.com/en/products/curtainsider/curtainsider-semi-trailer/s-cs-universal); allgemeiner Rahmen: [EU-Richtlinie 96/53](https://eur-lex.europa.eu/legal-content/en/TXT/?uri=CELEX%3A31996L0053).

Zusätzliche Standardkriterien für die Rückgewinnung: mindestens 100 kg Teilegewicht und 0,08 m kleinste Abmessung. Beide Werte können angepasst werden, auch auf null. Mit diesen Einstellungen liefert Projekt 6 aus 633 Betonquellen 2.311 Teilstücke und 1.713 zusätzliche Schnitte. 2.257 Kandidaten werden auf 351 Lkw verteilt; 54 Teilstücke mit insgesamt etwa 4,27 t werden nach diesen Kriterien ausgeschlossen. Die letzte Ladung enthält 17 Teile mit etwa 19,36 t. Neun Quellen verwenden die obere Gewichtsschätzung. Das Ergebnis ist ein Konzept; Resttragfähigkeit, Verankerung geschnittener Stäbe, temporäre Sicherung und Ausführbarkeit der Demontage benötigen weitere Prüfung.

## Technische Prüfung

Vom Repository-Hauptordner mit Node.js ausführen:

```text
node webapp/tests/reuse-core.mjs
node webapp/tests/reuse-integration.mjs
node webapp/tests/presentation-regression.mjs
node webapp/tests/rebar-reuse-regression.mjs
```

Die Tests verwenden die echten GLB-/JSON-Dateien und Three.js mit simulierter Oberfläche. Sie prüfen Geometrie, Volumenerhaltung, Transport- und Gewichtsgrenzen, kollisionsfreie Lkw-Rechtecke, gekoppelte Auswahl, Geschossfilter, Ladepositionen, Ablauf sowie den bisherigen Präsentationsimport. Eine gerenderte visuelle Browserprüfung ist davon nicht abgedeckt.

`node webapp/tests/generate-reuse.mjs` erzeugt den Projekt-6-Standardkatalog erneut. Die App verwendet ihn nur bei passenden Einstellungen und passendem Fingerabdruck von Geometrie und Bauteilmetadaten; sonst berechnet ein Worker neu.
