# Projekt 6 und Stockerau - Tragwerk und Bewehrung

## Neu: Reuse catalogue

Nach dem Modell- und PDF-Import oben **Reuse catalogue** und **Create / recalculate catalogue** wählen. Der neue Ablauf bietet Geschossfilter, Schnittvorschläge, transparente Bauteilblöcke, Bewehrung, Bauteilliste mit Gewicht und Lkw-Zuordnung sowie eine Lade- und Demontageanimation. Transport- und Hubgrenzen sind einstellbar. Bedienung und Annahmen: `REUSE-KATALOG.md`. Englischer Zehn-Minuten-Demoablauf: `PRESENTATION-REUSE.md`.

## Website öffnen

Unter Windows mit installiertem Python im entpackten Ordner auf `Website-oeffnen.bat` doppelklicken. Alternativ `python website_starten.py` ausführen. Die Startdatei öffnet den Browser auf einem freien lokalen Port. Das Terminalfenster geöffnet lassen.

Die Website startet mit leerem Viewport. Die Dateien für die Präsentation liegen im entpackten Ordner unter `Praesentationsdateien`.

1. Aus `01-Pavillon` zuerst `Pavillon.glb` ins Modellfeld ziehen. Danach `Pavillon-Bewehrungsplan.pdf` ins Planfeld ziehen.
2. Aus `02-Projekt6` anschließend `Bauteil6.glb` ins Modellfeld ziehen. Danach die vier PDFs gemeinsam ins Planfeld ziehen. Beim Modellwechsel werden die zuvor importierten Pläne entfernt.
3. Einen Stab oder eine vorhandene Planposition auswählen. Gleiche Stäbe werden pink angezeigt; alle anderen Bewehrungsstäbe werden ausgeblendet. **Alle Stäbe anzeigen** hebt die Auswahl auf. Die Bauteil- und Geschossfilter gelten dabei weiterhin.
4. **Viewport leeren** setzt Modell und Planimporte für einen neuen Präsentationsdurchlauf zurück.

Die beiden mitgelieferten GLBs werden unabhängig vom Dateinamen erkannt. Die vier Projekt-6-PDFs werden anhand ihres Inhalts den zugehörigen Positionen und Originalplanbildern zugeordnet.

Die Projektansicht bietet Filter nach Bauteilgruppe und einzelnen Bauteilen. **Betondeckkraft** steuert die Sichtbarkeit des umgebenden Betons. **Geometrische Ergänzungen anzeigen** schaltet die orange Darstellung um. Beim Klick auf einen Stab werden gleiche Stäbe anhand von Länge, Biegeform und Durchmesser gruppiert und pink angezeigt. Bauteil, Einbauort und Stabrichtung bestimmen diese Gruppe nicht. Die anderen Bewehrungsstäbe werden ausgeblendet. Längen und Formabmessungen werden auf Millimeter verglichen. Die Positionsliste dient zusätzlich zur Auswahl einer Planposition.

Die Geschossnamen, Materialien und IFC-Kennungen wurden aus `Bauteil6.3dm` gelesen. Sie erscheinen bei der Bauteilauswahl. **Geschoss laut Rhino** filtert nach diesen Modellinformationen. 51 zugeordnete Mauerwerksbauteile erhalten keine schematische Betonbewehrung. 537 Bauteile enthalten geometrische Ergänzungen; 96 weitere Betongeometrien bleiben offen.

Die orange Geometrie ist ein schematischer Vorschlag aus den vorhandenen Bauteilmeshes, mit angenommenen Ø12, max. 20 cm Raster und nominell 4 cm Randabstand entlang der Koordinatenachsen. Abschnitte werden mit max. 7,50 m und angenommener Überdeckung von 1,06 m erzeugt. Diese Annahmen ersetzen keine fehlenden Ausführungspläne oder Biegeformen. Die Bauteil-CSV nennt offene Geometrien. Im Positionsvergleich zählen weiterhin nur die 101 aus Blatt 2448 rekonstruierten Stäbe zu den tatsächlichen Planpositionen.

Die vier Original-PDFs beschreiben E02. Ihre fünfte Seite ist eine Gebäudeansicht. Eine plangetreue vollständige Bewehrung der weiteren Geschosse und Treppen erfordert deren Positions- und Verlegepläne. Die schematischen Ergänzungen werden deshalb weder den Biegelistenpositionen zugerechnet noch im Rhino-Download der 101 rekonstruierten Stäbe als Planbewehrung ausgegeben.

Im Viewer zwischen Tragwerk, transparenter Überlagerung und reiner Bewehrung wechseln. Beim Klick auf einen Stab werden Stäbe derselben Planposition pink; die übrigen Bewehrungsstäbe werden ausgeblendet. Die Positionsliste markiert alle zugehörigen Modellstäbe. Das kleine Detailfenster zeigt einen unveränderten Ausschnitt aus dem Original-PDF. Für die Bewehrung sind Original- und Modellmasse ausgewiesen. Im Pavillonmodell beträgt die lichte Betondeckung mindestens 4 cm. Die Längsstöße überdecken sich 1,06 m. Sie liegen in A–A nahe E und in B–B zwischen 4/5 und 5/6. Benachbarte Lagen sind versetzt. Die Zuschnitte sind maximal 7,50 m lang. Die Tragwerksmassen sind Schätzwerte aus den Modellvolumina und den in der App angegebenen Dichten.

In der Draufsicht sind die Achsen B–H und 3–7 mit ihren Abständen auf der Grundfläche lesbar. C und G sind aus dem registrierten PDF-Plan abgeleitet.

Für einen Achsschnitt im Raster auf ein Achsenlabel klicken und anschließend eine Blickrichtung wählen. Mit Mausrad oder +/− im Schnitt zoomen. Die Schnittflächen des Betonstahls sind schwarz. Mit **Schnitt beenden** zur räumlichen Ansicht zurückkehren.

## Eigene Dateien

Die Quelldateien für Projekt 6 liegen unter `Abgabe_20.11/Dateien Projekt6`. Unter **Importierte Bewehrung** das Planblatt wählen. **Soll** ist die Stückzahl aus der Biegeliste, **In 3D** zählt die vorhandenen Modellstäbe dieser Planposition. Beim Klick auf eine Position öffnet sich ihr Originalblatt. Vorhandene Stäbe der Gruppe werden pink.

Das Teilmodell enthält 101 angenäherte Stäbe aus Blatt 2448 in den Positionen 1, 2 und 9. Die zugehörige **3D-Teilbewehrung für Rhino** lässt sich in die Originaldatei `Bauteil6.3dm` importieren. Beide verwenden dieselben Weltkoordinaten in Millimetern. In den Positionslayern sind die rekonstruierten Stäbe nach Planblatt und Position abgelegt.

1. 3D-Modell als GLB öffnen. Rhino-Dateien zuvor als GLB mit eingebetteten Texturen exportieren. Ist das Modell zu dunkel, **Neutral anzeigen** aktivieren; liegt das Modell auf der Seite, **Z ist oben** umschalten.
2. Das dazugehörige Original-PDF laden. Bei einer Stabauswahl erscheint es im Detailfenster. Ohne Zuordnung wird der gesamte Plan geöffnet.
3. Die Website erkennt separate GLB-Stäbe mit der Metadaten-Eigenschaft `rebarPosition` (z. B. `2`) oder Objektnamen wie `P2-001`. Alternativ eine passende JSON-Datei laden. Die JSON-Geometrie ersetzt dann die erkannten GLB-Stäbe im Viewer. Sie ermöglicht auch die Massenberechnung und schwarze Stabschnittflächen. Ein optionales X/Y-Raster liefert die eigenen Schnittachsen und Achsmaße.

Beispiel für die JSON-Datei, mit Stabachsen in Z-up-Weltkoordinaten in Metern, Durchmesser in Millimetern und PDF-Seite ab 1. Die Koordinaten müssen zum GLB passen:

```json
{
  "positions": {"2": {"diameter": 12, "page": 1, "detail": "Längsstab"}},
  "elements": [{"id": "P2-001", "position": "2", "points": [[0, 0, 0.15], [3, 0, 0.15]]}],
  "grid": {"x": [["A", 0], ["B", 3]], "y": [["1", 0], ["2", 2]]}
}
```

Dateien bleiben im Browser. Aus einem PDF allein erzeugt die Website keine räumliche Bewehrung. Der Rhino-Download im Stockerau-Modus enthält weiterhin die fest zugehörigen Stockerau-Stäbe.

## Rhino und Plan

Die separate Datei `Stockerau-Bewehrung.3dm` enthält das Ausgangsmodell mit Materialzuweisung und 509 zusätzliche Stabobjekte auf vier Positionslayern. Sie liegt neben dem ZIP auf GitHub. In Rhino die schattierte oder gerenderte Darstellung wählen. Stab-ID, Planposition und Schnitt stehen in den Benutzerdaten der Objekte. Die Einbaulagen sind aus Plan und RFEM-Achsen rekonstruiert, die Biegeradien und Einbaulagen sind angenähert.

Zur Reproduktion mit installierten Paketen `rhino3dm` und `pymupdf` den Befehl `python bewehrung_erstellen.py PFAD_ZUM_MODELL PFAD_ZUM_PLAN` aus dem Repo ausführen. Website und Rhino-Modell verwenden dieselbe Bewehrungsgeometrie.

### Bewehrung in ein bestehendes Rhino-Modell übernehmen

Über **3D-Bewehrung für Rhino laden** die Importdatei herunterladen und in Rhino über **Datei > Importieren** ins bestehende Modell übernehmen. Die Datei enthält 509 3D-Stäbe auf vier Positionslayern sowie Referenzachsen und drei Kontrollpunkte. Die Geometrie steht in den ursprünglichen RFEM-Weltkoordinaten in Metern. Achskreuz D/5 liegt bei (10, −5, 0). Bei Verwendung als Block den Weltursprung als Einfügepunkt verwenden, mit Skalierung 1 und Drehung 0 bei gleicher Modelleinstellung in Metern.
