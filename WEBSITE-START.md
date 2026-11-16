# Stockerau – Tragwerk und Bewehrung

## Website öffnen

Unter Windows mit installiertem Python im entpackten Ordner auf `Website-oeffnen.bat` doppelklicken. Alternativ `python website_starten.py` ausführen. Die Startdatei öffnet den Browser auf einem freien lokalen Port. Das Terminalfenster geöffnet lassen.

Im Viewer zwischen Tragwerk, transparenter Überlagerung und reiner Bewehrung wechseln. Beim Klick auf einen Stab oder eine Positionsnummer werden alle gleich bezeichneten Stäbe pink. Das kleine Detailfenster zeigt die jeweilige Zeile aus der Original-Stabliste. Die Gewichtsangaben stammen für die Bewehrung aus Plan P-01. Die Tragwerksmassen sind Schätzwerte aus den Modellvolumina und den in der App angegebenen Dichten.

## Eigene Dateien

3D-Modelle als GLB und Bewehrungspläne als PDF in die markierten Felder ziehen oder per Dateidialog auswählen. Rhino-Dateien zuvor als GLB exportieren. Eigene Dateien werden lokal angezeigt. Eine Zuordnung von Stäben, Planpositionen und Gewichten ist für das integrierte Stockerau-Modell hinterlegt.

## Rhino und Plan

Die separate Datei `Stockerau-Bewehrung.3dm` enthält das Ausgangsmodell mit Materialzuweisung und 501 zusätzliche Stabobjekte auf vier Positionslayern. Sie liegt neben dem ZIP auf GitHub. In Rhino die schattierte oder gerenderte Darstellung wählen. Stab-ID, Planposition und Schnitt stehen in den Benutzerdaten der Objekte. Die Einbaulagen sind aus Plan und RFEM-Achsen rekonstruiert, die Biegeradien und Einbaulagen sind angenähert.

Zur Reproduktion mit installierten Paketen `rhino3dm` und `pymupdf` den Befehl `python bewehrung_erstellen.py PFAD_ZUM_MODELL PFAD_ZUM_PLAN` aus dem Repo ausführen. Website und Rhino-Modell verwenden dieselbe Bewehrungsgeometrie.
