# Stockerau – Website für die Gruppe

## Öffnen

1. ZIP entpacken oder den freigegebenen GitHub-Stand klonen.
2. Unter Windows mit installiertem Python auf Website-oeffnen.bat doppelklicken. Alternativ im entpackten Ordner in PowerShell starten:

   ```powershell
   python -m http.server 8501 --bind 127.0.0.1 --directory webapp/static
   ```

3. Im Browser http://localhost:8501/ öffnen. Die URL gilt auf dem Rechner, auf dem der Befehl läuft. Ein Doppelklick auf index.html verhindert das Laden der Module und Daten.
4. Zum Beenden im Terminal Strg+C drücken. Falls Port 8501 belegt ist, im Befehl und in der URL beispielsweise 8510 verwenden.

Für die statische Website sind weder Rhino noch FastAPI nötig. Im bestehenden Repo funktioniert auch der FastAPI-Start über webapp_starten.bat bei eingerichteter .venv.

## In das Gruppen-Repo übernehmen

In VS Code zuerst den GitHub-Stand abrufen und Änderungen auf einem Arbeitsbranch prüfen. webapp/app.py und webapp/static aus dem ZIP mit dem aktuellen Repo abgleichen. Die neuen Einträge aus LOGBUCH.md übernehmen, wenn sich das Logbuch inzwischen geändert hat. Diff prüfen, committen und den Branch pushen. Die Gruppe holt sich den freigegebenen Stand per Pull.

Für eine gehostete Website ist webapp/static der vollständige Webroot. Der Plan ist unter bewehrungsplan.pdf Teil dieses Webroots. Die Sichtbarkeit der Website muss zu den Zugriffsrechten eurer Gruppe passen.

## Modell und Plan

Im 3D-Viewport ein Betonsegment auswählen, um den zugehörigen Streifen zu fokussieren. Die Ansichtsbuttons wechseln zwischen Tragwerk, schematischer Bewehrung und transparenter Überlagerung. Alle vier Positionen sind im 3D-Modell und in der Stabliste auswählbar. Bei Auswahl einer Position werden alle dazugehörigen Stäbe hervorgehoben. Die 501 dargestellten Stäbe und Bügel folgen den Stückzahlen, Zuschnittlängen und den Schnitten A–A/B–B. Einbaulagen, Übergreifungen im Detail und Biegeradien sind angenähert. Maßgeblich für Zuschnitt und Masse ist die Original-Stabliste. Die CO₂e-Bilanz verwendet die Planmasse von 1.015,63 kg. Für Einzelwerte wird diese proportional zum Betonvolumen verteilt.
