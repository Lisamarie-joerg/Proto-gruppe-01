# Querschnitts- und Längenprüfung (Etappe 2, Test)

Modell: Stockerau Rhino Export from RFEM (3).3dm
**Massstab (korrigiert): 1 Modelleinheit = 1 m (1:1).** Etappe 1 hatte fälschlich 833,33 mm angenommen (Faktor 0,0012 statt 0,001).
Methode: Körper-BoundingBox im lokalen Stab-Koordinatensystem (Curve.FrameAt + Brep.GetBoundingBox).

## Ergebnis: 445 von 561 geprüften Körpern innerhalb 2% Toleranz; 116 mit Abweichung; 175 Achsen ohne Körper (RD 12 nur als Achse).
## Gesamtlänge aller Stäbe: 686,4 m (Etappe 1: 572 m mit falschem Massstab).

## Auffälligkeiten
- Nr T493 (BeamId 796, Flat Bar 33.3/20): Ist 20,0x20,0 mm vs Soll 33,3x20 mm (Dev -0,00%/-39,94%), LaengDev 66,50%
- Nr T473 (BeamId 795, Flat Bar 33.3/20): Ist 20,0x20,0 mm vs Soll 33,3x20 mm (Dev -0,00%/-39,94%), LaengDev 66,50%
- Nr T457 (BeamId 794, Flat Bar 33.3/20): Ist 20,0x20,0 mm vs Soll 33,3x20 mm (Dev -0,00%/-39,94%), LaengDev 66,50%
- Nr T434 (BeamId 793, Flat Bar 33.3/20): Ist 20,0x20,0 mm vs Soll 33,3x20 mm (Dev -0,00%/-39,94%), LaengDev 66,50%
- Nr T418 (BeamId 792, Flat Bar 33.3/20): Ist 20,0x20,0 mm vs Soll 33,3x20 mm (Dev -0,00%/-39,94%), LaengDev 66,50%
- Nr T395 (BeamId 791, Flat Bar 33.3/20): Ist 20,0x20,0 mm vs Soll 33,3x20 mm (Dev -0,00%/-39,94%), LaengDev 66,50%
- Nr T499 (BeamId 790, Flat Bar 33.3/20): Ist 20,0x20,0 mm vs Soll 33,3x20 mm (Dev -0,00%/-39,94%), LaengDev 66,50%
- Nr T497 (BeamId 789, Flat Bar 33.3/20): Ist 20,0x20,0 mm vs Soll 33,3x20 mm (Dev -0,00%/-39,94%), LaengDev 66,50%
- Nr T495 (BeamId 788, Flat Bar 33.3/20): Ist 20,0x20,0 mm vs Soll 33,3x20 mm (Dev -0,00%/-39,94%), LaengDev 66,50%
- Nr T471 (BeamId 785, Flat Bar 33.3/20): Ist 20,0x20,0 mm vs Soll 33,3x20 mm (Dev -0,00%/-39,94%), LaengDev 66,50%
- Nr T469 (BeamId 784, Flat Bar 33.3/20): Ist 20,0x20,0 mm vs Soll 33,3x20 mm (Dev -0,00%/-39,94%), LaengDev 66,50%
- Nr T467 (BeamId 783, Flat Bar 33.3/20): Ist 20,0x20,0 mm vs Soll 33,3x20 mm (Dev -0,00%/-39,94%), LaengDev 66,50%
- Nr T463 (BeamId 782, Flat Bar 33.3/20): Ist 20,0x20,0 mm vs Soll 33,3x20 mm (Dev -0,00%/-39,94%), LaengDev 66,50%
- Nr T461 (BeamId 781, Flat Bar 33.3/20): Ist 20,0x20,0 mm vs Soll 33,3x20 mm (Dev -0,00%/-39,94%), LaengDev 66,50%
- Nr T459 (BeamId 780, Flat Bar 33.3/20): Ist 20,0x20,0 mm vs Soll 33,3x20 mm (Dev -0,00%/-39,94%), LaengDev 66,50%
- Alle 116 Knotenstäbe (Flat Bar 33.3/20): geometrisch 20x20 mm quaderförmig (nicht 33,3x20 mm); Körper ca. 1,7x länger als die Achse (Überdeckung an Knoten).

## Handnachrechnung taperter Stäbe (Etappe-2-Test)
Formel: V = L × (b_Start + b_Ende)/2 × Dicke (linear getaperter Prismastab), 1 Modelleinheit = 1 m.
Nr T316 (BeamId 669, Flat Bar 275/12): L=0,8452 m, Querschnitt 275x12 -> 225x12 mm. V_manuell = L x (bS+bE)/2 x t = 0,8452 m x 250,0 mm x 12 mm = 0,002536 m^3. V_Rhino = 0,002528 m^3. Abweichung: -0,30%.
Nr T340 (BeamId 668, Flat Bar 275/12): L=0,8452 m, Querschnitt 275x12 -> 225x12 mm. V_manuell = L x (bS+bE)/2 x t = 0,8452 m x 250,0 mm x 12 mm = 0,002536 m^3. V_Rhino = 0,002528 m^3. Abweichung: -0,30%.
Nr T334 (BeamId 660, Flat Bar 275/12): L=0,8452 m, Querschnitt 275x12 -> 225x12 mm. V_manuell = L x (bS+bE)/2 x t = 0,8452 m x 250,0 mm x 12 mm = 0,002536 m^3. V_Rhino = 0,002528 m^3. Abweichung: -0,30%.
## Rahmenausfuehrungen
Das Tragwerk bildet **ein zusammenhängendes System**: alle 736 Stäbe sind über ihre Endpunkte verbunden (Konnektivitäts-Analyse, Toleranz 0,02 und 0,25 Einheiten → jeweils 1 Komponente).

### Stützgruppen (12 Stützen RO 139.7x8.0; Zuordnung: Stab-Endpunkt innerhalb 1 m der Stützenachse)
**Rahmen 01** (Stütze bei x=7,00 m, y=-5,00 m): 14 Stäbe – RD 12: 6, Flat Bar 275/20: 3, Flat Bar 225/20: 2, Rectangle 500/500: 1, Flat Bar 200/20: 1, Flat Bar 237.5/20: 1; Ausdehnung 1,5 x 5,0 m, Höhe z: 0,43–4,32 m
**Rahmen 02** (Stütze bei x=16,00 m, y=-5,00 m): 14 Stäbe – RD 12: 6, Flat Bar 275/20: 3, Flat Bar 225/20: 2, Rectangle 500/500: 1, Flat Bar 237.5/20: 1, Flat Bar 200/20: 1; Ausdehnung 1,5 x 5,0 m, Höhe z: 0,69–4,32 m
**Rahmen 03** (Stütze bei x=13,00 m, y=-10,00 m): 25 Stäbe – RD 12: 12, Flat Bar 275/20: 4, Rectangle 500/500: 3, Flat Bar 237.5/20: 2, Flat Bar 200/20: 2, Flat Bar 225/20: 2; Ausdehnung 3,0 x 5,0 m, Höhe z: 0,45–4,32 m
**Rahmen 04** (Stütze bei x=10,00 m, y=-10,00 m): 25 Stäbe – RD 12: 12, Flat Bar 275/20: 4, Rectangle 500/500: 3, Flat Bar 237.5/20: 2, Flat Bar 200/20: 2, Flat Bar 225/20: 2; Ausdehnung 3,0 x 5,0 m, Höhe z: 0,34–4,32 m
**Rahmen 05** (Stütze bei x=13,00 m, y=0,00 m): 25 Stäbe – RD 12: 12, Flat Bar 275/20: 4, Rectangle 500/500: 3, Flat Bar 237.5/20: 2, Flat Bar 200/20: 2, Flat Bar 225/20: 2; Ausdehnung 3,0 x 5,0 m, Höhe z: 0,74–4,32 m
**Rahmen 06** (Stütze bei x=10,00 m, y=0,00 m): 25 Stäbe – RD 12: 12, Flat Bar 275/20: 4, Rectangle 500/500: 3, Flat Bar 237.5/20: 2, Flat Bar 200/20: 2, Flat Bar 225/20: 2; Ausdehnung 3,0 x 5,0 m, Höhe z: 0,65–4,32 m
**Rahmen 07** (Stütze bei x=16,00 m, y=-10,00 m): 14 Stäbe – RD 12: 6, Flat Bar 275/20: 3, Flat Bar 225/20: 2, Rectangle 500/500: 1, Flat Bar 237.5/20: 1, Flat Bar 200/20: 1; Ausdehnung 1,5 x 5,0 m, Höhe z: 0,56–4,32 m
**Rahmen 08** (Stütze bei x=7,00 m, y=-10,00 m): 14 Stäbe – RD 12: 6, Flat Bar 275/20: 3, Flat Bar 225/20: 2, Rectangle 500/500: 1, Flat Bar 200/20: 1, Flat Bar 237.5/20: 1; Ausdehnung 1,5 x 5,0 m, Höhe z: 0,26–4,32 m
**Rahmen 09** (Stütze bei x=7,00 m, y=0,00 m): 14 Stäbe – RD 12: 6, Flat Bar 275/20: 3, Flat Bar 225/20: 2, Rectangle 500/500: 1, Flat Bar 200/20: 1, Flat Bar 237.5/20: 1; Ausdehnung 1,5 x 5,0 m, Höhe z: 0,60–4,32 m
**Rahmen 10** (Stütze bei x=16,00 m, y=0,00 m): 9 Stäbe – RD 12: 3, Flat Bar 275/20: 2, Rectangle 500/500: 1, Flat Bar 237.5/20: 1, Flat Bar 200/20: 1, Flat Bar 225/20: 1; Ausdehnung 1,5 x 2,5 m, Höhe z: 0,82–4,32 m
**Rahmen 11** (Stütze bei x=13,00 m, y=-5,00 m): 26 Stäbe – RD 12: 12, Rectangle 500/500: 4, Flat Bar 275/20: 4, Flat Bar 237.5/20: 2, Flat Bar 200/20: 2, Flat Bar 225/20: 2; Ausdehnung 3,0 x 5,0 m, Höhe z: 0,59–4,32 m
**Rahmen 12** (Stütze bei x=10,00 m, y=-5,00 m): 26 Stäbe – RD 12: 12, Rectangle 500/500: 4, Flat Bar 275/20: 4, Flat Bar 237.5/20: 2, Flat Bar 200/20: 2, Flat Bar 225/20: 2; Ausdehnung 3,0 x 5,0 m, Höhe z: 0,50–4,32 m

### Profil-Übersicht (alle 736 Achsen)
- RD 12: 175 Stäbe, Gesamtlänge 367,2 m
- Flat Bar 33.3/20: 116 Stäbe, Gesamtlänge 2,3 m
- Flat Bar 275/12: 70 Stäbe, Gesamtlänge 42,6 m
- Rectangle 500/500: 47 Stäbe, Gesamtlänge 47,0 m
- Flat Bar 275/20: 41 Stäbe, Gesamtlänge 26,5 m
- Flat Bar 237.5/12: 35 Stäbe, Gesamtlänge 13,6 m
- Flat Bar 200/12: 35 Stäbe, Gesamtlänge 13,6 m
- Flat Bar 162.5/12: 35 Stäbe, Gesamtlänge 13,6 m
- Flat Bar 175/12: 35 Stäbe, Gesamtlänge 29,6 m
- Flat Bar 225/12: 35 Stäbe, Gesamtlänge 29,6 m
- Flat Bar 225/20: 23 Stäbe, Gesamtlänge 19,4 m
- Flat Bar 175/20: 23 Stäbe, Gesamtlänge 19,3 m
- Flat Bar 162.5/20: 18 Stäbe, Gesamtlänge 6,8 m
- Flat Bar 200/20: 18 Stäbe, Gesamtlänge 7,0 m
- Flat Bar 237.5/20: 18 Stäbe, Gesamtlänge 7,0 m
- RO 139.7x8.0 | EN 10210-2:2006: 12 Stäbe, Gesamtlänge 41,1 m

Dateien: staebe_etappe02.csv (736 Achsen, Nummer T001–T736), querschnitt_check.csv (561 Körper-Prüfungen).