"""Etappe 4: Embodied Carbon – per-bar CO2e (A1-A3) aus OEKOBAU.DAT (live-API).

Datenquellen:
- Achsenlaengen: MemberAxes-Layer im RFEM-Export (LineCurve pro Stab)
- Querschnittsflaechen: Etappe 1 (Staebe_Querschnitt_Volumen.xlsx)
- OeKOBAU.DAT-GWP-total (A1-A3): live aus https://oekobaudat.de/OEKOBAU.DAT/resource/processes/<UUID>?format=json&view=extended
"""
import rhino3dm, math, json, httpx
from collections import defaultdict

# ---------- 1) OEKOBAU.DAT live holen ----------
DATASETS = {
    'Baustahl_Profile_Stabstahl': '20c29cbd-f9a2-4518-a1ce-c681246c29c8',
    'Baustahl_Grobblech':         '04d1311a-ae38-4bfb-8e11-8992f1ddb14f',
    'Beton_C2530':                '8347f9a7-f4ec-4a36-a266-a0281f5fd16d',
    'Beton_EcoPact':              '69dc12cf-ce4d-4251-8ea3-330ed72f2f79',
    'Betonstahl_Staeber':         'a8ebf8f2-2fcc-4431-b730-93bf5efd8111',
}
BASE = 'https://oekobaudat.de/OEKOBAU.DAT/resource/processes/'

def first_val(shortdesc):
    return shortdesc[0].get('value') if shortdesc else '?'

def fetch_process(uuid):
    r = httpx.get(BASE + uuid + '?format=json&view=extended', timeout=60.0, follow_redirects=True)
    r.raise_for_status()
    d = r.json()
    pi = d['processInformation']
    name = first_val(pi['dataSetInformation']['name']['baseName'])
    # Referenzfluss: Einheit + Menge pro Datensatz
    exlist = list(d['exchanges'].values())[0]
    ref = [e for e in exlist if e.get('referenceFlow')][0]
    flow = first_val(ref['referenceToFlowDataSet']['shortDescription'])
    fp = [f for f in ref['flowProperties'] if f.get('referenceFlowProperty')][0]
    unit = fp['referenceUnit']
    meanval = fp['meanValue']           # Menge des Referenzflusses pro Datensatz
    density = None
    for mp in (ref.get('materialProperties') or []):
        if mp.get('name') == 'gross density':
            density = float(mp['value'])
    # GWP-total: Module A1, A2, A3 (einzeln) und A1-A3
    gwp = {'A1': 0.0, 'A2': 0.0, 'A3': 0.0, 'A1-A3': None}
    for res in d['LCIAResults']['LCIAResult']:
        mname = first_val(res['referenceToLCIAMethodDataSet']['shortDescription'])
        if 'GWP-total' in str(mname) or 'Global Warming Potential total' in str(mname):
            for a in res['other']['anies']:
                mod = a.get('module')
                if mod in gwp:
                    gwp[mod] = float(a['value'])
                elif mod == 'A1-A3' and gwp['A1-A3'] is None:
                    gwp['A1-A3'] = float(a['value'])
    if gwp['A1-A3'] is None:  # nur Einzelfmodule vorhanden -> aufsummieren
        gwp['A1-A3'] = gwp['A1'] + gwp['A2'] + gwp['A3']
    return {'name': name, 'uuid': uuid, 'ref_flow': flow, 'unit': unit,
            'amount_per_dataset': meanval, 'density': density, 'gwp': gwp}

print('=== OEKOBAU.DAT Datensätze (live) ===')
proc = {}
for key, uuid in DATASETS.items():
    p = fetch_process(uuid)
    proc[key] = p
    # GWP pro Bezugseinheit = GWP des Datensatzes / Referenzmenge
    gwp_per_unit = p['gwp']['A1-A3'] / p['amount_per_dataset']
    p['gwp_per_unit'] = gwp_per_unit
    print(f"{p['name'][:60]:60s}")
    print(f"    Referenzfluss: {p['ref_flow'][:60]}")
    print(f"    Einheit: {p['unit']} | Menge/Datensatz: {p['amount_per_dataset']} {p['unit']}"
          f" | Dichte: {p['density']}")
    print(f"    GWP-total A1-A3: {p['gwp']['A1-A3']:.3f} kg CO2e pro Datensatz"
          f"  ->  {gwp_per_unit:.6f} kg CO2e/{p['unit']}")

json.dump({k: {kk: vv for kk, vv in v.items()} for k, v in proc.items()},
          open('Abgabe_23.10/_oekobaudat_prozesse.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('\nGespeichert: Abgabe_23.10/_oekobaudat_prozesse.json')

# ---------- 2) Geometrie: Achslaengen aller 736 Stäbe aus dem RFEM-Export ----------
print('\n=== Geometrie: Member-Achsen aus RH7 Stockerau (RFEM-Export) ===')
model = rhino3dm.File3dm.Read('Data/RH7 Stockerau Rhino Export from RFEM.3dm')

# Querschnittsflaechen A in mm2 (Etappe 1, nominal aus Profilbezeichnung)
A_MM2 = {
    'Flat Bar 33.3/20': 666, 'Flat Bar 162.5/12': 1950, 'Flat Bar 162.5/20': 3250,
    'Flat Bar 175/12': 2100, 'Flat Bar 175/20': 3500, 'Flat Bar 200/12': 2400,
    'Flat Bar 200/20': 4000, 'Flat Bar 225/12': 2700, 'Flat Bar 225/20': 4500,
    'Flat Bar 237.5/12': 2850, 'Flat Bar 237.5/20': 4750, 'Flat Bar 275/12': 3300,
    'Flat Bar 275/20': 5500, 'RD 12': 113.1, 'Rectangle 500/500': 250000,
    'RO 139.7x8.0 | EN 10210-2:2006': 3310.1,
}
TYP = {'Flat Bar': 'Flachstab', 'RD 12': 'Rundstab', 'Rectangle': 'Rechteck-Stab (Fundament)',
       'RO 139.7x8.0 | EN 10210-2:2006': 'Rundrohr'}

def typ_von(section):
    for k, v in TYP.items():
        if section.startswith(k):
            return v
    return 'Unbekannt'

# Materialgruppe -> OEKOBAU.DAT-Datensatz (Standard)
MAT_GRUPPE = {
    'Flachstab': 'Baustahl', 'Rundstab': 'Baustahl', 'Rundrohr': 'Baustahl',
    'Rechteck-Stab (Fundament)': 'Beton',
}

bars = []
for o in model.Objects:
    lp = model.Layers[o.Attributes.LayerIndex].FullPath
    if '::MemberAxes::' in lp:
        section = lp.split('::MemberAxes::')[1]
        g = o.Geometry                      # LineCurve
        p1, p2 = g.Line.From, g.Line.To
        L = math.dist((p1.X, p1.Y, p1.Z), (p2.X, p2.Y, p2.Z))
        bars.append({'id': str(o.Attributes.Id), 'section': section,
                     'typ': typ_von(section), 'L': L})

agg = defaultdict(lambda: [0, 0.0])
for b in bars:
    agg[b['section']][0] += 1
    agg[b['section']][1] += b['L']
print(f'{len(bars)} Stäbe, Gesamtlänge {sum(v[1] for v in agg.values()):.3f} m')
for sec, (n, L) in sorted(agg.items()):
    print(f'  {sec:40s} n={n:3d}  L={L:9.3f} m')

# ---------- 3) CO2e-Berechnung je Stab (A1-A3) ----------
print('\n=== CO2e-Berechnung je Stab (Modul A1-A3) ===')

GEWICHT_STAHL = proc['Baustahl_Profile_Stabstahl']['density']      # 7850 kg/m3
GEWICHT_BETON = proc['Beton_C2530']['density']                     # 2400 kg/m3
GWP_BAUSTAHL = proc['Baustahl_Profile_Stabstahl']['gwp_per_unit']  # kg CO2e/kg
GWP_BETON = proc['Beton_C2530']['gwp_per_unit']                    # kg CO2e/m3
GWP_BETONSTAHL = proc['Betonstahl_Staeber']['gwp_per_unit']        # kg CO2e/kg
BEWEHRUNG_PAUSCHAL = 85.0                                          # kg Betonstahl / m3 Beton

print(f'Baustahl: {GEWICHT_STAHL} kg/m3 x {GWP_BAUSTAHL:.6f} kg CO2e/kg')
print(f'Beton C25/30: {GWP_BETON:.1f} kg CO2e/m3')
print(f'Bewehrung: {BEWEHRUNG_PAUSCHAL} kg/m3 Beton x {GWP_BETONSTAHL:.4f} kg CO2e/kg')

results = []
for b in bars:
    A = A_MM2[b['section']]                 # mm2
    V = A * b['L'] / 1e6                    # m3
    row = {'id': b['id'], 'typ': b['typ'], 'section': b['section'],
           'L_m': round(b['L'], 4), 'A_mm2': A, 'V_m3': V}
    if MAT_GRUPPE[b['typ']] == 'Baustahl':
        m = V * GEWICHT_STAHL               # kg
        row.update(m_stahl_kg=m, m_beton_kg=0.0, V_beton_m3=0.0,
                   m_bewehrung_kg=0.0,
                   co2e_stahl=m * GWP_BAUSTAHL, co2e_beton=0.0,
                   co2e_bewehrung=0.0)
    else:                                   # Beton (Fundament)
        m_beton = V * GEWICHT_BETON         # kg
        m_bew = V * BEWEHRUNG_PAUSCHAL      # kg Betonstahl
        row.update(m_stahl_kg=0.0, m_beton_kg=m_beton, V_beton_m3=V,
                   m_bewehrung_kg=m_bew,
                   co2e_stahl=0.0, co2e_beton=V * GWP_BETON,
                   co2e_bewehrung=m_bew * GWP_BETONSTAHL)
    row['co2e_total_kg'] = (row['co2e_stahl'] + row['co2e_beton']
                            + row['co2e_bewehrung'])
    results.append(row)

# ---------- 4) Auswertung: Sektionen und Materialgruppen ----------
print('\n=== Ergebnis je Querschnitt ===')
sec_sum = defaultdict(lambda: dict(n=0, L=0.0, V=0.0, m_stahl=0.0,
                                   m_beton=0.0, m_bew=0.0, co2e=0.0))
for r in results:
    s = sec_sum[r['section']]
    s['n'] += 1
    s['L'] += r['L_m']
    s['V'] += r['V_m3']
    s['m_stahl'] += r['m_stahl_kg']
    s['m_beton'] += r['m_beton_kg']
    s['m_bew'] += r['m_bewehrung_kg']
    s['co2e'] += r['co2e_total_kg']

for sec, s in sorted(sec_sum.items()):
    print(f'{sec:40s} n={s["n"]:3d}  V={s["V"]:8.4f} m3  '
          f'Stahl={s["m_stahl"]:8.1f} kg  Beton={s["m_beton"]:9.1f} kg  '
          f'Bew={s["m_bew"]:7.1f} kg  CO2e={s["co2e"]:9.2f} kg')

print('\n=== Ergebnis je Materialgruppe ===')
grp_sum = defaultdict(lambda: dict(n=0, V=0.0, m_stahl=0.0, m_beton=0.0,
                                   m_bew=0.0, co2e=0.0))
for r in results:
    g = grp_sum[MAT_GRUPPE[r['typ']]]
    g['n'] += 1
    g['V'] += r['V_m3']
    g['m_stahl'] += r['m_stahl_kg']
    g['m_beton'] += r['m_beton_kg']
    g['m_bew'] += r['m_bewehrung_kg']
    g['co2e'] += r['co2e_total_kg']
total_co2e = 0.0
for gname, g in grp_sum.items():
    total_co2e += g['co2e']
    print(f'{gname:10s} n={g["n"]:3d}  V={g["V"]:8.4f} m3  Stahl={g["m_stahl"]:9.1f} kg  '
          f'Beton={g["m_beton"]:9.1f} kg  Bewehrung={g["m_bew"]:8.1f} kg  '
          f'CO2e A1-A3={g["co2e"]:10.2f} kg')
print(f'GESAMT: {total_co2e:.2f} kg CO2e (A1-A3) = {total_co2e/1000:.3f} t CO2e')

# ---------- 5) Handrechnung: ein Stab von der Laenge bis kg CO2e ----------
print('\n=== Handrechnung (Beispiel: 1 Flachstab aus Flat Bar 175/12) ===')
probe = next(r for r in results if r['section'] == 'Flat Bar 175/12')
A = probe['A_mm2']; L = probe['L_m']
V = A * L / 1e6
m = V * GEWICHT_STAHL
co2e = m * GWP_BAUSTAHL
print(f'Stab: Flat Bar 175/12 (B x t = 175 mm x 12 mm), Laenge L = {L:.4f} m')
print(f'  A = 175 mm x 12 mm = {A} mm2')
print(f'  V = A x L = {A} mm2 x {L:.4f} m = {A} x {L:.4f} x 1e-6 m3 = {V:.6f} m3')
print(f'  m = V x rho = {V:.6f} m3 x {GEWICHT_STAHL} kg/m3 = {m:.3f} kg')
print(f'  CO2e (A1-A3) = m x GWP = {m:.3f} kg x {GWP_BAUSTAHL:.6f} kg CO2e/kg'
      f' = {co2e:.3f} kg CO2e')

json.dump({'bars': results,
           'sections': {k: v for k, v in sec_sum.items()},
           'groups': {k: v for k, v in grp_sum.items()},
           'total_co2e_kg': total_co2e,
           'processes': proc},
          open('Abgabe_23.10/_etappe4_ergebnisse.json', 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1, default=str)
print('\nGespeichert: Abgabe_23.10/_etappe4_ergebnisse.json')


