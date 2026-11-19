# Arbeitsstand – 18.11.2026

> **Fortgesetzt am 19.11.2026:** Die nachstehende Notiz beschreibt den früheren Pausenstand. Aktuell sind alle 633 Betonquellen zugeordnet; der Standardkatalog enthält 2.311 Produkte und 361 Lkw-Ladungen. Die endgültige Bedienung steht in REUSE-KATALOG.md, Prüfungen und Änderungen im LOGBUCH.md. Die visuelle Browserprüfung bleibt offen. ZIP- und Push-Status werden beim Abschluss gesondert angegeben.

Auf Wunsch der Nutzerin unterbrochen, damit der Laptop geschlossen werden kann.

## Lokal gespeichert, noch nicht veröffentlicht

- Neue Module: webapp/static/reuse-core.js, reuse-worker.js, reuse-sources.js, reuse-workflow.js, reuse.css.
- index.html und viewport3d.js integrieren den neuen Reuse-Katalog.
- reuse-default-projekt6.json wurde aus der tatsächlichen GLB-Geometrie erzeugt: 628 zugeordnete Betonquellen, 2301 Produkte, 1708 Schnitte, 358 einlagige Lkw-Ladungen bei den Standardannahmen.
- Einstellungen: Ladefläche 13,6 × 2,45 m, Ladehöhe 2,6 m, Nutzlast 24 t, Hebelimit 5 t minus 200 kg Anschlagmittel, Dichte 2500 kg/m³, Abstand 8 cm, Schnittfuge 1 cm. Dies sind änderbare Planungsannahmen.
- UI enthält Geschossfilter, Bauteilkatalog, Bauteilauswahl mit Gewicht und Lkw, transparente Transporthüllen mit Bewehrung, Schnittlinien, Explosionsansicht, Lkw-Belegung, Ablaufregler und CSV.
- Konzeptstatus: kein statisch oder logistisch freigegebener Demontageplan. Schematische Bewehrung bleibt als solche gekennzeichnet. Neun Quellen verwenden eine obere Gewichtsschätzung statt geschlossenem Meshvolumen.

## Prüfungen und offene Schritte

- Geometriekern-Test bestanden: Volumen einschließlich Löchern und inneren Schnitten, Schnittverluste, Masse, Transportgrenzen, Packung ohne Überschneidung, Stab-Clipping.
- Bestehender Präsentations-/Stabgruppen-Regressionsablauf bestanden.
- Integrationstest für den neuen Katalog bestanden: tatsächliches Projekt-6-Modell, Gewichts- und Transportgrenzen, überschneidungsfreie Belegung, Volumenerhaltung, Cache-Fingerabdruck, Stabausschnitte, gekoppelte Auswahl, Geschossfilter, starre Lkw-Transformationen, Ablauf und Zurücksetzen. Skript: ../verify-reuse-integration.mjs.
- Weitere Hilfsskripte: ../generate-reuse.mjs, ../verify-reuse-core.mjs, ../verify-geometry-selection.mjs, ../package-building.py.
- Eine visuelle Browserprüfung war nicht möglich: In-App-Browser erreicht den lokalen Server nicht; natives Edge-Fenster minimiert und mit verfügbaren UI-Methoden nicht aktivierbar.
- Noch zu erledigen: Integration abschließend prüfen/korrigieren; visuellen Test nachholen; Dokumentation/Logbuch ergänzen; neue Module in Abgabe_20.11 spiegeln; ZIP mit allen neuen reuse-Dateien erstellen; auf main committen und Push überprüfen.
- Neue Änderungen sind noch NICHT committed/gepusht und NICHT im bisherigen ZIP enthalten.

Repository: C:\Users\beata\Documents\Codex\2026-11-16\new-chat-2\work\Proto-gruppe-01-GitHub

Remote: https://github.com/Lisamarie-joerg/Proto-gruppe-01.git – main, kein neuer Branch.
