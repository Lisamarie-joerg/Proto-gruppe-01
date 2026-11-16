# Stockerau – Tragwerk und Bewehrung

## Website öffnen

Unter Windows mit installiertem Python im entpackten Ordner auf `Website-oeffnen.bat` doppelklicken. Alternativ `python website_starten.py` ausführen. Die Startdatei öffnet den Browser auf einem freien lokalen Port. Das Terminalfenster geöffnet lassen.

Im Viewer zwischen Tragwerk, transparenter Überlagerung und reiner Bewehrung wechseln. Beim Klick auf einen Stab werden Stäbe derselben Planposition pink, die anderen grau. Die Positionsliste markiert alle zugehörigen Modellstäbe. Das kleine Detailfenster zeigt einen unveränderten Ausschnitt aus dem Original-PDF. Für die Bewehrung sind Original- und Modellmasse ausgewiesen. Im Modell beträgt die lichte Betondeckung mindestens 4 cm. Die Längsstöße überdecken sich 1,06 m. Sie liegen in A–A nahe E und in B–B zwischen 4/5 und 5/6. Benachbarte Lagen sind versetzt. Die Zuschnitte sind maximal 7,50 m lang. Die Tragwerksmassen sind Schätzwerte aus den Modellvolumina und den in der App angegebenen Dichten.

In der Draufsicht sind die Achsen B–H und 3–7 mit ihren Abständen auf der Grundfläche lesbar. C und G sind aus dem registrierten PDF-Plan abgeleitet.

Für einen Achsschnitt im Raster auf ein Achsenlabel klicken und anschließend eine Blickrichtung wählen. Mit Mausrad oder +/− im Schnitt zoomen. Die Schnittflächen des Betonstahls sind schwarz. Mit **Schnitt beenden** zur räumlichen Ansicht zurückkehren.

## Eigene Dateien

3D-Modelle als GLB und Bewehrungspläne als PDF in die markierten Felder ziehen oder per Dateidialog auswählen. Rhino-Dateien zuvor als GLB exportieren. Eigene Dateien werden lokal angezeigt. Eine Zuordnung von Stäben, Planpositionen und Gewichten ist für das integrierte Stockerau-Modell hinterlegt.

## Rhino und Plan

Die separate Datei `Stockerau-Bewehrung.3dm` enthält das Ausgangsmodell mit Materialzuweisung und 509 zusätzliche Stabobjekte auf vier Positionslayern. Sie liegt neben dem ZIP auf GitHub. In Rhino die schattierte oder gerenderte Darstellung wählen. Stab-ID, Planposition und Schnitt stehen in den Benutzerdaten der Objekte. Die Einbaulagen sind aus Plan und RFEM-Achsen rekonstruiert, die Biegeradien und Einbaulagen sind angenähert.

Zur Reproduktion mit installierten Paketen `rhino3dm` und `pymupdf` den Befehl `python bewehrung_erstellen.py PFAD_ZUM_MODELL PFAD_ZUM_PLAN` aus dem Repo ausführen. Website und Rhino-Modell verwenden dieselbe Bewehrungsgeometrie.

### Bewehrung in ein bestehendes Rhino-Modell übernehmen

Über **3D-Bewehrung für Rhino laden** die Importdatei herunterladen und in Rhino über **Datei > Importieren** ins bestehende Modell übernehmen. Die Datei enthält 509 3D-Stäbe auf vier Positionslayern sowie Referenzachsen und drei Kontrollpunkte. Die Geometrie steht in den ursprünglichen RFEM-Weltkoordinaten in Metern. Achskreuz D/5 liegt bei (10, −5, 0). Bei Verwendung als Block den Weltursprung als Einfügepunkt verwenden, mit Skalierung 1 und Drehung 0 bei gleicher Modelleinstellung in Metern.
