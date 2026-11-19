# Bewehrung V3 – Herkunft, Geometrie und Auswahl

Die Oberfläche trägt sichtbar die Kennung **Bewehrung V3 · 19.11.2026**. Fehlt diese Kennung, läuft eine ältere Kopie. Aus dem aktualisierten Repository `Website-oeffnen.bat` starten und die Browserseite mit Strg+F5 neu laden. Bei ZIP-Nutzung das neue V3-ZIP vollständig in einen neuen Ordner entpacken.

## Was aus den Plänen stammt

Es liegen 101 angenähert räumlich zugeordnete Planachsen aus E02/Blatt 2448, Positionen 1, 2 und 9 vor. Das ist **keine vollständige Rekonstruktion der vier Planblätter**. Die Planpositionen und ursprünglichen Entwurfslängen haben einen PDF-Bezug; die räumliche Zuordnung wurde rekonstruiert.

Die Website zeigt diese Achsen **blau**. Für die Montageansicht sind sie in 283 Abschnitte mit maximal 7,50 m unterteilt. Die angenommene Überlappung von 1,06 m und die seitlichen Versätze der Stöße sind keine aus diesen Plänen vollständig belegten Ausführungsdetails. Die ursprünglichen 101 Achsen bleiben im Datensatz unter `originalPlanAxes` erhalten. Die bisherige Rhino-Rohdatei enthält diese ursprüngliche Rekonstruktion; ihr Download ist entsprechend beschriftet.

## Was zusätzlich angenommen wurde

**Orange** Geometrie hat keine PDF-Positionszuordnung. Sie wird aus dem jeweiligen Betonmesh erzeugt:

| Bauteil | Schematische Geometrie |
| --- | --- |
| Decken und Fundamente | Zwei getrennte Mattenlagen mit zwei kreuzenden Richtungen |
| Wände | Zwei Oberflächenlagen mit horizontalen und vertikalen Stäben |
| Stützen und Träger | Längsstäbe sowie quer dazu angeordnete geschlossene, abgerundete Bügel |
| Treppen | An geneigten Flächen orientierte Gitter und gesonderte passende Podestgitter |

Annahmen: Ø12 für Gitter und Längsstäbe, Ø10 für Bügel, Raster höchstens 20 cm, 4 cm lichte geometrische Betondeckung, maximal 7,50 m je Abschnitt und angenommene Längsüberdeckung von 1,06 m. Kreuzende Lagen und Stoßabschnitte erhalten einen räumlichen Abstand. Bei Bügeln bleiben Schließhaken und Verankerung ungeklärt; die geschlossene Darstellung ist keine freigegebene Biegeform.

Aktueller Datensatz: 52,789 angenommene Stäbe einschließlich 2,067 Bügeln in 514 von 633 Betonquellen. 119 Betonquellen bleiben ausdrücklich offen. Diese Stückzahlen sind keine Biegelistenmengen aus dem PDF.

Die Ergänzung ersetzt keine Bemessung. Offene beziehungsweise inkonsistente Betonmeshes werden nicht blind gefüllt. Vorschläge außerhalb des Körpers, mit zu wenig geometrischer Deckung oder ohne plausible zweite Gitterrichtung beziehungsweise ohne vollständigen Korb werden entfernt. Offene Bauteile und Prüfhinweise erscheinen bei der Bauteilauswahl und in `projekt6-bauteile.csv`.

Als fachliche Orientierung für die Unterscheidung zwischen Längs-, Quer- und Flächenbewehrung dient die [Detailing-Erläuterung des Concrete Centre](https://www.concretecentre.com/Concrete-Design/Design-Codes/Eurocode-2/Detailing.aspx). Die hier eingesetzten Maße sind Modellannahmen und kein Nachweis nach dieser Veröffentlichung.

## So wird ausgewählt

1. **Bewehrungsübersicht** öffnen.
2. Unter **Herkunft sichtbar** zwischen allen Herkünften, nur Planbezug, nur schematischer Ergänzung und ungeprüftem Import wählen. Blau, Orange und Grau bleiben in der Legende erklärt.
3. Einen einzelnen Stab anklicken oder unter **Einzelne geometrische Stabgruppe** eine Form wählen. Die Gruppe vergleicht Durchmesser, tatsächliche Mittellinienlänge und Biegeform; Einbauort und Richtung bilden keine eigene Gruppe.
4. Nur diese Gruppe wird pink gezeigt; andere Stäbe werden ausgeblendet. Das Auswahlfeld nennt die Anzahl gegenüber der Gesamtzahl und trennt Planbezug und Annahmen. Alle Segmente eines gebogenen Bügels gehören zu demselben Stab.
5. Auch ein Klick auf eine Planposition wählt jetzt eine einzelne geometrische Gruppe dieser Position. Weitere Formen derselben Position können über die Gruppenliste gewählt werden. **Alle Stäbe anzeigen** hebt die Isolation auf.

Nur zugeordnete Planpositionen öffnen ein entsprechendes PDF beziehungsweise Originalplanbild. Schematische Stäbe öffnen **kein beliebiges zuletzt geladenes PDF**. Die Reuse-Funktion bleibt erhalten; dort werden fehlende Bewehrungsnachweise weiterhin als offen angegeben.

## Reproduktion und Prüfungen

Für die Website selbst sind Node.js und Rhino nicht erforderlich. Für die erneute Erzeugung und automatischen Prüfungen vom Repository-Hauptordner mit Node.js 24:

```text
node webapp/rebuild-building-rebar.mjs
node webapp/tests/generate-reuse.mjs
node webapp/tests/rebar-evidence-geometry.mjs
node webapp/tests/rebar-reuse-regression.mjs
node webapp/tests/reuse-integration.mjs
```

Die Geometrieprüfung kontrolliert Herkunft, Stablänge, Mittellinienlage im tatsächlichen Mesh, geometrische Deckung, vertikale Wandstäbe, geneigte Treppengitter und die Lage der Bügel quer zu den Längsstäben. Der Anwendungstest prüft die vollständige Workflow-Einbindung, Herkunftsfilter, Gruppenauswahl und gebogene Instanzstäbe. Die Reuse-Prüfung kontrolliert weiterhin die Lkw-Belegung und Sequenz. Diese automatischen Tests verwenden eine simulierte Oberfläche; eine visuelle WebGL-Prüfung ist separat erforderlich.
