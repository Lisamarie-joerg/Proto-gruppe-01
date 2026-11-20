# Stockerau – Website für die Gruppe

## Öffnen

1. ZIP entpacken oder den freigegebenen GitHub-Stand klonen.
2. Unter Windows mit installiertem Python auf Website-oeffnen.bat doppelklicken. Alternativ im entpackten Ordner `python website_starten.py` ausführen.
3. Die Startdatei öffnet die aktualisierte Seite auf einem freien lokalen Port. Falls kein Browserfenster aufgeht, die vollständige Adresse aus dem Terminal kopieren. Das Terminal muss offen bleiben.
4. Zum Beenden im Terminal Strg+C drücken.

Für die statische Website sind weder Rhino noch FastAPI nötig. Im bestehenden Repo funktioniert auch der FastAPI-Start über webapp_starten.bat bei eingerichteter .venv.

## In das Gruppen-Repo übernehmen

In VS Code zuerst den GitHub-Stand abrufen und Änderungen auf einem Arbeitsbranch prüfen. webapp/app.py und webapp/static aus dem ZIP mit dem aktuellen Repo abgleichen. Die neuen Einträge aus LOGBUCH.md übernehmen, wenn sich das Logbuch inzwischen geändert hat. Diff prüfen, committen und den Branch pushen. Die Gruppe holt sich den freigegebenen Stand per Pull.

Für eine gehostete Website ist webapp/static der vollständige Webroot. Der Plan ist unter bewehrungsplan.pdf Teil dieses Webroots. Die Sichtbarkeit der Website muss zu den Zugriffsrechten eurer Gruppe passen.

## Modell und Plan

Im 3D-Viewport ein Betonsegment auswählen, um den zugehörigen Streifen zu fokussieren. Die Ansichtsbuttons wechseln zwischen Tragwerk, schematischer Bewehrung und transparenter Überlagerung. Alle vier Positionen sind im 3D-Modell und in der Stabliste auswählbar. Bei Auswahl einer Position werden alle dazugehörigen Stäbe hervorgehoben. Die 501 dargestellten Stäbe und Bügel folgen den Stückzahlen, Zuschnittlängen und den Schnitten A–A/B–B. Einbaulagen, Übergreifungen im Detail und Biegeradien sind angenähert. Maßgeblich für Zuschnitt und Masse ist die Original-Stabliste. Die CO₂e-Bilanz verwendet die Planmasse von 1.015,63 kg. Für Einzelwerte wird diese proportional zum Betonvolumen verteilt.
