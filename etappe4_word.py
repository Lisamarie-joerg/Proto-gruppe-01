"""Etappe 4: Word-Dokumentation – Embodied Carbon aus OEKOBAU.DAT (A1-A3)."""
import json
from docx import Document
from docx.shared import Pt, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT

D = json.load(open('Abgabe_23.10/_etappe4_ergebnisse.json', encoding='utf-8'))
bars = D['bars']
sections = D['sections']
groups = D['groups']
proc = D['processes']
total = D['total_co2e_kg']

doc = Document()
st = doc.styles['Normal']
st.font.name = 'Calibri'
st.font.size = Pt(11)

def h(text, level=1):
    return doc.add_heading(text, level=level)

def p(text, bold=False, italic=False, size=None):
    par = doc.add_paragraph()
    run = par.add_run(text)
    run.bold = bold
    run.italic = italic
    if size:
        run.font.size = Pt(size)
    return par

def bullet(text):
    return doc.add_paragraph(text, style='List Bullet')

def table(headers, rows, widths=None):
    t = doc.add_table(rows=1, cols=len(headers))
    t.style = 'Light Grid Accent 1'
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    hdr = t.rows[0].cells
    for j, htxt in enumerate(headers):
        hdr[j].text = str(htxt)
        for par in hdr[j].paragraphs:
            for run in par.runs:
                run.bold = True
    for row in rows:
        cells = t.add_row().cells
        for j, v in enumerate(row):
            cells[j].text = str(v)
    if widths:
        for j, w in enumerate(widths):
            for row in t.rows:
                row.cells[j].width = Cm(w)
    return t

# ================= Titel =================
titel = doc.add_paragraph()
titel.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = titel.add_run('Embodied Carbon – CO₂-Fußabdruck (A1–A3)\n'
                  'Pavillon Stockerau (RH7 / RFEM-Export)')
r.bold = True
r.font.size = Pt(18)
sub = doc.add_paragraph()
sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = sub.add_run('Berechnung der kg CO₂e je Stab – Datenquelle: '
                'ÖKOBAU.DAT (live über Open-API) – Etappe 4')
r.italic = True
r.font.size = Pt(12)
doc.add_paragraph()

# ================= 1 Aufgabenstellung =================
h('1.  Aufgabenstellung', 1)
p('Für jeden Stab des Pavillons Stockerau (736 Stäbe aus dem '
  'RFEM-Export) sollen die grauen CO₂-Emissionen (Embodied '
  'Carbon) des Lebenszyklus-Moduls A1–A3 (Rohstoffgewinnung bis '
  'Herstellung) in kg CO₂e berechnet werden. Die Ökobilanzdaten '
  'werden live aus der ÖKOBAU.DAT über die offene Schnittstelle '
  '(ohne Konto) bezogen:')
p('https://oekobaudat.de/OEKOBAU.DAT/resource/processes/<UUID>'
  '?format=json&view=extended', italic=True)
p('Ausgewerteter Indikator: GWP-total (Globales Erwärmungspotenzial '
  'total), Modul A1–A3. Zusätzlich gilt für die Bewehrung der '
  'Fundamente die Pauschale: 85 kg Betonstahl pro m³ Beton.')

# ================= 2 Datensaetze =================
h('2.  ÖKOBAU.DAT-Datensätze (live abgefragt)', 1)
p('Entscheidend ist die Bezugseinheit jedes Datensatzes: Der '
  'Baustahl-Datensatz ist auf 1000 kg (1 t) bezogen, der '
  'Beton-Datensatz auf 1 m³ und der Betonstahl-Datensatz auf '
  '1 kg. Die GWP-total-Werte wurden daher auf die jeweilige '
  'Bezugseinheit normiert:')
rows = []
DS = [
    ('Baustahl', 'Baustahl_Profile_Stabstahl', 'Standard',
     'Flachstäbe, RO-Rundrohre, RD-12-Zugstäbe'),
    ('Baustahl', 'Baustahl_Grobblech', 'Alternative', '–'),
    ('Beton', 'Beton_C2530', 'Standard',
     'Fundamente (Rectangle 500/500)'),
    ('Beton', 'Beton_EcoPact', 'Alternative', '–'),
    ('Betonstahl', 'Betonstahl_Staeber', 'Standard',
     'Bewehrung der Fundamente (pauschal 85 kg/m³)'),
]
for grp, key, variante, verwendung in DS:
    pr = proc[key]
    label = grp if variante == 'Standard' else f'{grp} (Alternative)'
    rows.append([
        label, pr['name'][:58], pr['uuid'],
        f"{pr['amount_per_dataset']:g} {pr['unit']}",
        f"{pr['gwp']['A1-A3']:.3f}",
        f"{pr['gwp_per_unit']:.6f} kg CO₂e/{pr['unit']}",
        verwendung])
table(['Materialgruppe', 'Datensatz', 'UUID', 'Bezugseinheit',
       'GWP-total A1–A3 (kg CO₂e)', 'Normiert', 'Verwendung'],
      rows, widths=[2.2, 4.0, 3.6, 1.7, 1.8, 2.7, 3.4])
p('')
p('Hinweis zur Bezugseinheit: „Baustahl: Profile und Stabstahl“ '
  'meldet 560,287 kg CO₂e je Datensatz – der Datensatz bezieht '
  'sich jedoch auf 1000 kg Stahl (Referenzfluss „structural steel '
  'sections and merchant bars“, Menge 1000 kg). Der korrekt '
  'normierte Faktor ist daher 0,560287 kg CO₂e/kg. Analog: '
  'Beton C25/30 = 181,0 kg CO₂e/m³; Betonstahl in Stäben = '
  '0,5930 kg CO₂e/kg (Summe der Module A1: 0,0558 + A2: 0,0182 '
  '+ A3: 0,5190).', italic=True)

# ================= 3 Vorgehensweise =================
h('3.  Vorgehensweise (wesentliche Schritte)', 1)
p('Die Berechnung erfolgt in fünf Schritten, automatisiert im '
  'Skript etappe4_oekobaudat.py:')
bullet('Schritt 1 – ÖKOBAU.DAT live abfragen: Die fünf Datensätze '
       'werden über die Open-API (format=json&view=extended) '
       'geladen. Aus jedem Datensatz werden Referenzfluss, '
       'Bezugseinheit (unit), Referenzmenge (Menge pro Datensatz), '
       'Dichte und der Indikator GWP-total (Modul A1–A3) '
       'extrahiert und auf die Bezugseinheit normiert.')
bullet('Schritt 2 – Stabgeometrie aus dem Modell: Die 736 '
       'Member-Achsen (LineCurve-Objekte auf den MemberAxes-'
       'Layern des RFEM-Exports) werden ausgelesen; die Stab-'
       'länge ergibt sich aus der Distanz der Achsendpunkte. '
       'Die Zuordnung zum Querschnitt erfolgt über den '
       'Layer-Namen.')
bullet('Schritt 3 – Querschnittsfläche A (nominal aus der '
       'Profilbezeichnung, Etappe 1): Flachstab = Breite × '
       'Dicke; RD 12 = π/4 × d² = 113,1 mm²; Rectangle '
       '500/500 = 500 × 500 mm; RO 139.7x8.0 = π/4 × (D² − '
       'd²) = 3310,1 mm² (Hohlquerschnitt).')
bullet('Schritt 4 – Volumen und Masse: V = A × L (nominal). '
       'Masse Stahl = V × 7850 kg/m³; Betonvolumen direkt in '
       'm³ (Fundamente); Bewehrung = 85 kg/m³ × Betonvolumen '
       '(Pauschale).')
bullet('Schritt 5 – CO₂e (A1–A3): Stahl: m × 0,560287 kg '
       'CO₂e/kg; Beton: V × 181,0 kg CO₂e/m³; Bewehrung: '
       'm_Bew × 0,5930 kg CO₂e/kg. Pro Stab: CO₂e = CO₂e('
       'Stahl) + CO₂e(Beton) + CO₂e(Bewehrung).')
p('')
p('Ergebnisdateien in Abgabe_23.10: EmbodiedCarbon_Staebe_'
  'Liste.xlsx (pro Stab, Querschnitte, Materialgruppen, '
  'OEKOBAU.DAT) und dieses Word-Dokument. Die Berechnungs-'
  'skripte (etappe4_oekobaudat.py, etappe4_excel.py) sind '
  'im Repository abgelegt.')

# ================= 4 Handrechnung =================
h('4.  Handrechnung – ein Stab von der Länge bis kg CO₂e', 1)
p('Beispiel: ein Flachstab aus dem Profil „Flat Bar 175/12“ '
  '(175 mm × 12 mm). Die Achslänge dieses Stabs wurde aus dem '
  'Modell gemessen: L = 0,8453 m.')
GEWICHT_STAHL = proc['Baustahl_Profile_Stabstahl']['density']
GWP_BAUSTAHL = proc['Baustahl_Profile_Stabstahl']['gwp_per_unit']
probe = next(r for r in bars if r['section'] == 'Flat Bar 175/12')
A = probe['A_mm2']; L = probe['L_m']
V = A * L / 1e6
m = V * GEWICHT_STAHL
co2e = m * GWP_BAUSTAHL
table(['Schritt', 'Formel', 'Wert'],
      [['1. Querschnittsfläche A', '175 mm × 12 mm', f'{A} mm²'],
       ['2. Volumen V', 'A × L = 2100 mm² × 0,8453 m × 10⁻⁶',
        f'{V:.6f} m³'],
       ['3. Masse m', 'V × ρ_Stahl = 0,001775 m³ × 7850 kg/m³',
        f'{m:.3f} kg'],
       ['4. CO₂e (A1–A3)', 'm × GWP = 13,935 kg × 0,560287 '
        'kg CO₂e/kg', f'{co2e:.3f} kg CO₂e']],
      widths=[4.0, 7.5, 3.5])
p('')
p(f'Ergebnis der Handrechnung: Ein Flachstab 175/12 mit '
  f'L = {L:.4f} m verursacht {co2e:.3f} kg CO₂e (A1–A3). '
  'Zur Kontrolle: Die Summe aller 35 Stäbe dieses Profils '
  f'(Gesamtlänge 29,587 m) ergibt '
  f'{sections["Flat Bar 175/12"]["co2e"]:.2f} kg CO₂e – '
  'konsistent mit der per-Stab-Berechnung.')

# ================= 5 Ergebnisse =================
h('5.  Ergebnisse', 1)
h('5.1  Ergebnis je Querschnitt', 2)
rows = []
for i, (sec, s) in enumerate(sorted(sections.items()), 1):
    typ = next(r['typ'] for r in bars if r['section'] == sec)
    rows.append([i, typ, sec, s['n'], f"{s['L']:.3f}",
                 f"{s['V']:.5f}", f"{s['m_stahl']:.1f}",
                 f"{s['m_beton']:.1f}", f"{s['m_bew']:.1f}",
                 f"{s['co2e']:.2f}"])
table(['Nr.', 'Typ', 'Querschnitt', 'Anzahl', 'Länge (m)',
       'Volumen (m³)', 'Stahl (kg)', 'Beton (kg)',
       'Bewehrung (kg)', 'CO₂e A1–A3 (kg)'],
      rows, widths=[0.9, 2.0, 3.0, 1.2, 1.4, 1.6, 1.5, 1.5,
                    1.6, 1.8])
p('')
h('5.2  Ergebnis je Materialgruppe', 2)
rows = []
for gname, g in sorted(groups.items()):
    ds = ('Baustahl: Profile und Stabstahl' if gname == 'Baustahl'
          else 'Beton C25/30 + Betonstahl in Stäben')
    rows.append([gname, ds, g['n'], f"{g['V']:.4f}",
                 f"{g['m_stahl']:.1f}", f"{g['m_beton']:.1f}",
                 f"{g['m_bew']:.1f}", f"{g['co2e']:.2f}",
                 f"{100 * g['co2e'] / total:.1f} %"])
rows.append(['GESAMT', '–', sum(g['n'] for g in groups.values()),
             f"{sum(g['V'] for g in groups.values()):.4f}",
             f"{sum(g['m_stahl'] for g in groups.values()):.1f}",
             f"{sum(g['m_beton'] for g in groups.values()):.1f}",
             f"{sum(g['m_bew'] for g in groups.values()):.1f}",
             f"{total:.2f}", '100,0 %'])
table(['Materialgruppe', 'Datensatz', 'Anzahl', 'Volumen (m³)',
       'Stahl (kg)', 'Beton (kg)', 'Bewehrung (kg)',
       'CO₂e A1–A3 (kg)', 'Anteil'],
      rows, widths=[2.0, 4.2, 1.2, 1.7, 1.5, 1.5, 1.7, 1.8, 1.3])
p('')
erg = doc.add_paragraph()
erg.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = erg.add_run(f'Gesamtes Embodied Carbon (A1–A3): '
                f'{total:,.2f} kg CO₂e = {total/1000:,.3f} '
                f't CO₂e')
r.bold = True
r.font.size = Pt(14)

# ================= 6 Anmerkungen =================
h('6.  Anmerkungen und Annahmen', 1)
bullet('Nominalvolumina: Die Volumina werden rechnerisch aus '
       'Querschnittsfläche × Achslänge (A·L) gebildet. Die '
       'Solids im 3D-Modell sind an den Anschlüssen angefast/'
       'gekürzt und liegen bei ca. 85–99 % von A·L – das '
       'Ergebnis ist damit eine leicht konservative '
       'Obergrenze.')
bullet('Rundrohr RO 139.7x8.0: Der RFEM-Export stellt das '
       'Hohlrohr als Vollzylinder dar (Modellvolumen '
       '0,629 m³). Für die CO₂e-Berechnung ist der '
       'Hohlquerschnitt maßgeblich (A = π/4 × (D² − d²) '
       '= 3310,1 mm² → V = 0,136 m³), da ein Hohlrohr '
       'kein Vollmaterial besitzt.')
bullet('RD 12: Die 175 Zugstäbe liegen im Modell nur als '
       'Achsen (keine Solids); das Volumen wird rechnerisch '
       'aus der Achslänge gebildet (A = 113,1 mm²).')
bullet('Bewehrung: Die Bewehrung der Fundamente wird pauschal '
       'mit 85 kg Betonstahl pro m³ Beton angesetzt '
       '(laut Aufgabenstellung) und mit dem ÖKOBAU.DAT-'
       'Datensatz „Betonstahl in Stäben“ (0,5930 kg '
       'CO₂e/kg) bilanziert.')
bullet('Materialgruppen: Flachstäbe, Rundrohre und RD-12-'
       'Zugstäbe werden als Baustahl mit dem Datensatz '
       '„Baustahl: Profile und Stabstahl“ bilanziert; die '
       'Rechteck-Stäbe 500/500 sind die Fundamente und '
       'werden als Beton C25/30 plus pauschale Bewehrung '
       'bilanziert.')
bullet('Alternative Datensätze (nicht verrechnet, nur '
       'dokumentiert): „Baustahl: Grobblech“ (2,529 kg '
       'CO₂e/kg) und „Beton C25/30 EcoPact“ (98,94 kg '
       'CO₂e/m³) sind in der Excel-Datei ausgewiesen.')
bullet('Gültigkeit: Die Werte decken den Lebenszyklus-Modul '
       'A1–A3 ab (Rohstoffgewinnung, Herstellung, '
       'Transport zum Hersteller – je nach Datensatz-'
       'definition der Module A1/A2/A3 in ÖKOBAU.DAT). '
       'Module B (Nutzung), C (Lebensende) und D '
       '(Potentiale) sind nicht enthalten.')

doc.save('Abgabe_23.10/EmbodiedCarbon_Oekobaudat_Analyse.docx')
print('Gespeichert: Abgabe_23.10/EmbodiedCarbon_Oekobaudat_Analyse.docx')
