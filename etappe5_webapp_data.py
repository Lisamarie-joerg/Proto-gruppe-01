"""Etappe 5: Web-App – Datenaggregat für die Embodied-Carbon-Web-App.

Datenquellen (alles im Repo vorhanden):
- etappen/etappe_02/staebe_etappe02.csv   (736 Stäbe: Nr, Profil, Achsen-Punkte)
- etappen/etappe_02/co2_etappe04.csv      (pro Stab: Fläche, Volumen, Masse, CO2e)
- oekobaudat_raw/*.json                   (OEKOBAU.DAT-Prozesse, GWP-total je Modul)
- Abgabe_23.10/EmbodiedCarbon_Staebe_Liste.xlsx (Sheets Materialgruppen, Querschnitte)

Methode (laut Etappe 4 / Aufgabenstellung):
- Materialgruppen: Baustahl (Flachstäbe + RD-12-Zugstäbe + Rundrohre),
  Beton (47 Fundamente) mit pauschaler Bewehrung 85 kg/m³
- Standard:  Baustahl Profile/Stabstahl + Beton C25/30
- Alternative: Baustahl Grobblech + Beton EcoPact
- Module: A1-A3 (Herstellung), C (C1-C4 End of Life), D (Recycling/Verwertung)

Ausgabe: webapp/static/data.json
"""
from __future__ import annotations

import csv
import json
import os
from collections import defaultdict
from datetime import datetime

ROOT = os.path.dirname(os.path.abspath(__file__))

# ---------- OEKOBAU.DAT-Prozesse aus oekobaudat_raw/ ----------
RAW_FILES = {
    "baustahl_standard": "Baustahl_Profile_Stabstahl",
    "baustahl_alternative": "Baustahl_Grobblech",
    "beton_standard": "Beton_C2530",
    "beton_alternative": "Beton_EcoPact",
    "betonstahl": "Betonstahl_Staeber",
}
UUIDS = {
    "baustahl_standard": "20c29cbd-f9a2-4518-a1ce-c681246c29c8",
    "baustahl_alternative": "04d1311a-ae38-4bfb-8e11-8992f1ddb14f",
    "beton_standard": "8347f9a7-f4ec-4a36-a266-a0281f5fd16d",
    "beton_alternative": "69dc12cf-ce4d-4251-8ea3-330ed72f2f79",
    "betonstahl": "a8ebf8f2-2fcc-4431-b730-93bf5efd8111",
}


def first_val(shortdesc):
    return shortdesc[0].get("value") if shortdesc else "?"


def load_process(key: str) -> dict:
    """OEKOBAU.DAT-JSON laden; GWP-total je Modul auf Bezugseinheit normieren."""
    path = os.path.join(ROOT, "oekobaudat_raw", RAW_FILES[key] + ".json")
    with open(path, encoding="utf-8") as f:
        d = json.load(f)
    pi = d["processInformation"]
    name = first_val(pi["dataSetInformation"]["name"]["baseName"])
    exlist = list(d["exchanges"].values())[0]
    ref = [e for e in exlist if e.get("referenceFlow")][0]
    fp = [f for f in ref["flowProperties"] if f.get("referenceFlowProperty")][0]
    unit = fp["referenceUnit"]
    amount = float(fp["meanValue"])
    density = None
    for mp in (ref.get("materialProperties") or []):
        if mp.get("name") == "gross density":
            density = float(mp["value"])
    raw: dict[str, float | None] = {}
    for res in d["LCIAResults"]["LCIAResult"]:
        mname = first_val(res["referenceToLCIAMethodDataSet"]["shortDescription"])
        if "GWP" in str(mname) and "total" in str(mname).lower():
            for a in res["other"]["anies"]:
                mod = a.get("module")
                val = a.get("value")
                if mod and val is not None:
                    raw[mod] = float(val)
    a13 = raw.get("A1-A3")
    if a13 is None:
        a13 = (raw.get("A1") or 0) + (raw.get("A2") or 0) + (raw.get("A3") or 0)
    c = sum(raw.get(m) or 0 for m in ("C1", "C2", "C3", "C4"))
    dd = raw.get("D") or 0.0
    return {
        "name": name, "uuid": UUIDS[key], "unit": unit,
        "amount_per_dataset": amount, "density": density,
        "gwp": {"A1-A3": a13 / amount, "C": c / amount, "D": dd / amount},
    }


PROCESSES = {k: load_process(k) for k in RAW_FILES}

DATASETS = {
    "standard": {"label": "Standard",
                 "baustahl": PROCESSES["baustahl_standard"],
                 "beton": PROCESSES["beton_standard"],
                 "betonstahl": PROCESSES["betonstahl"],
                 "rebar_ratio_kg_m3": 85.0},
    "alternative": {"label": "Alternative",
                    "baustahl": PROCESSES["baustahl_alternative"],
                    "beton": PROCESSES["beton_alternative"],
                    "betonstahl": PROCESSES["betonstahl"],
                    "rebar_ratio_kg_m3": 85.0},
}

MODULES = [
    {"id": "A1-A3", "label": "A1–A3", "desc": "Herstellung (Rohstoff + Produktion)"},
    {"id": "C", "label": "C", "desc": "End of Life (C1–C4: Demontage, Transport, Entsorgung)"},
    {"id": "D", "label": "D", "desc": "Recycling / Verwertung (Gutschrift möglich)"},
]


def parse_de(s: str) -> float:
    """Deutsche Dezimaltrenner (1.234,56) zu float."""
    s = str(s)
    if "," in s:
        return float(s.replace(".", "").replace(",", "."))
    return float(s)


def load_bars() -> list[dict]:
    """736 Stäbe: Geometrie (Achsen-Punkte) + Querschnittsdaten."""
    bars = {}
    with open(os.path.join(ROOT, "etappen/etappe_02/staebe_etappe02.csv"),
              encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f, delimiter=";"):
            bars[row["Nr"]] = {
                "nr": row["Nr"],
                "beam_id": row["BeamId"],
                "profil": row["Profil"],
                "typ": row["Typ"],
                "L_m": parse_de(row["Laenge_mm"]) / 1000.0,
                "mitte": [parse_de(row["Mitte_X"]), parse_de(row["Mitte_Y"]),
                          parse_de(row["Mitte_Z"])],
                "start": [parse_de(row["Start_X"]), parse_de(row["Start_Y"]),
                          parse_de(row["Start_Z"])],
                "end": [parse_de(row["End_X"]), parse_de(row["End_Y"]),
                        parse_de(row["End_Z"])],
                "koerper": row["Koerper_vorhanden"] == "ja",
                "material_etappe03": row["Etappe03_Material"],
            }
    with open(os.path.join(ROOT, "etappen/etappe_02/co2_etappe04.csv"),
              encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f, delimiter=";"):
            b = bars.get(row["Nr"])
            if not b:
                continue
            b["A_mm2"] = parse_de(row["Querschnittsflaeche_mm2"])
            b["V_m3"] = parse_de(row["Volumen_m3"])
            b["m_kg"] = parse_de(row["Masse_kg"])
            b["bewehrung_kg"] = parse_de(row["Bewehrung_kg"])
            b["co2e_etappe04_A13"] = parse_de(row["CO2_A1-A3_kgCO2e"])
    return list(bars.values())


def materialgruppe(typ: str) -> str:
    return "Beton" if typ.startswith("Rechteck") else "Baustahl"


def co2e_bar(bar: dict, dataset: str, module: str) -> dict:
    """CO2e eines Stabs fuer Datensatz + Modul (in kg CO2e)."""
    ds = DATASETS[dataset]
    g = materialgruppe(bar["typ"])
    if g == "Baustahl":
        m = bar["V_m3"] * (ds["baustahl"]["density"] or 7850.0)
        return {"gruppe": g, "m_kg": m,
                "co2e": m * ds["baustahl"]["gwp"][module]}
    V = bar["V_m3"]
    m_beton = V * (ds["beton"]["density"] or 2400.0)
    m_rebar = V * ds["rebar_ratio_kg_m3"]
    co2e = (V * ds["beton"]["gwp"][module]
            + m_rebar * ds["betonstahl"]["gwp"][module])
    return {"gruppe": g, "m_kg": m_beton, "co2e": co2e,
            "beton_kg": m_beton, "bewehrung_kg": m_rebar}


def read_excel_table(path: str, sheet: str) -> dict:
    """Excel-Sheet als Zeilenliste (zur Einbindung in die Web-App)."""
    import openpyxl
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb[sheet]
    rows = []
    for row in ws.iter_rows(values_only=True):
        vals = [("" if v is None else v) for v in row]
        if any(str(v).strip() for v in vals):
            rows.append(vals)
    wb.close()
    return {"sheet": sheet, "rows": rows}


def main() -> None:
    bars = load_bars()
    print(f"Stäbe geladen: {len(bars)}")

    # CO2e pro Stab fuer alle Kombinationen + Plausibilitaetscheck
    check_total = 0.0
    for b in bars:
        b["gruppe"] = materialgruppe(b["typ"])
        b["co2e"] = {}
        for ds_name in ("standard", "alternative"):
            b["co2e"][ds_name] = {}
            for mod in ("A1-A3", "C", "D"):
                r = co2e_bar(b, ds_name, mod)
                b["co2e"][ds_name][mod] = round(r["co2e"], 3)
                if ds_name == "standard" and mod == "A1-A3":
                    check_total += r["co2e"]
    print(f"CHECK Standard A1-A3 Gesamt: {check_total:,.1f} kg CO2e "
          f"(Etappe 4: 6.872,7 kg) -> "
          f"Abweichung {abs(check_total - 6872.7) / 6872.7 * 100:.2f} %")

    std_total = sum(b["co2e"]["standard"]["A1-A3"] for b in bars)
    alt_total = sum(b["co2e"]["alternative"]["A1-A3"] for b in bars)
    print(f"Standard A1-A3: {std_total:,.1f} kg | "
          f"Alternative A1-A3: {alt_total:,.1f} kg CO2e")

    # Gruppensummen
    groups: dict[str, dict] = defaultdict(
        lambda: {"n": 0, "L": 0.0, "V": 0.0, "m": 0.0,
                 "co2e_std": 0.0, "co2e_alt": 0.0})
    for b in bars:
        g = groups[b["gruppe"]]
        g["n"] += 1
        g["L"] += b["L_m"]
        g["V"] += b["V_m3"]
        g["m"] += b["m_kg"]
        g["co2e_std"] += b["co2e"]["standard"]["A1-A3"]
        g["co2e_alt"] += b["co2e"]["alternative"]["A1-A3"]

    tabellen = {
        # EmbodiedCarbon_Staebe_Liste.xlsx
        "materialgruppen": read_excel_table(
            os.path.join(ROOT, "Abgabe_23.10/EmbodiedCarbon_Staebe_Liste.xlsx"),
            "Materialgruppen"),
        "querschnitte": read_excel_table(
            os.path.join(ROOT, "Abgabe_23.10/EmbodiedCarbon_Staebe_Liste.xlsx"),
            "Querschnitte"),
        "oekobaudat": read_excel_table(
            os.path.join(ROOT, "Abgabe_23.10/EmbodiedCarbon_Staebe_Liste.xlsx"),
            "OEKOBAU.DAT"),
        # Staebe_UEbersicht.xlsx
        "uebersicht": read_excel_table(
            os.path.join(ROOT, "Abgabe_23.10/Staebe_UEbersicht.xlsx"),
            "Stäbe-Übersicht"),
        # Staebe_Querschnitt_Volumen.xlsx
        "querschnitt_volumen": read_excel_table(
            os.path.join(ROOT, "Abgabe_23.10/Staebe_Querschnitt_Volumen.xlsx"),
            "Querschnitt & Volumen"),
        # Etappe02_Traegerliste_T001-T736_ETAPPE04.xlsx
        # (Version mit Etappe-4-Spalten; ersetzt Etappe02_Traegerliste_T001-T736.xlsx)
        "traegerliste": read_excel_table(
            os.path.join(ROOT,
                         "Abgabe_23.10/Etappe02_Traegerliste_T001-T736_ETAPPE04.xlsx"),
            "Staebe T001-T736"),
        "rahmen": read_excel_table(
            os.path.join(ROOT,
                         "Abgabe_23.10/Etappe02_Traegerliste_T001-T736_ETAPPE04.xlsx"),
            "Rahmenausfuehrungen"),
        "profil_uebersicht": read_excel_table(
            os.path.join(ROOT,
                         "Abgabe_23.10/Etappe02_Traegerliste_T001-T736_ETAPPE04.xlsx"),
            "Profil-Uebersicht"),
        "traegerliste_hint": (
            "Alle Excel-Dateien aus Abgabe_23.10/ sind eingebunden: "
            "EmbodiedCarbon_Staebe_Liste.xlsx (Materialgruppen, Querschnitte, "
            "OEKOBAU.DAT), Staebe_UEbersicht.xlsx, Staebe_Querschnitt_Volumen.xlsx, "
            "Etappe02_Traegerliste_T001-T736_ETAPPE04.xlsx (Trägerliste, "
            "Rahmenausführungen, Profil-Übersicht)."),
    }

    out = {
        "meta": {
            "titel": "Pavillon Stockerau – Embodied Carbon",
            "modell": "RH7 Stockerau (RFEM-Export), 736 Stäbe, 686,377 m",
            "einheit": "m",
            "erstellt": datetime.now().isoformat(timespec="seconds"),
            "quellen": [
                "etappen/etappe_02/staebe_etappe02.csv (Geometrie, Achsen-Punkte)",
                "etappen/etappe_02/co2_etappe04.csv (Flächen, Volumina, Massen)",
                "Abgabe_23.10/EmbodiedCarbon_Staebe_Liste.xlsx (Materialgruppen, Querschnitte)",
                "oekobaudat_raw/*.json (OEKOBAU.DAT GWP-total je Modul)",
            ],
            "methode": ("Materialgruppen laut Etappe 4: Baustahl (Flachstäbe, "
                        "RD-12-Zugstäbe, Rundrohre) + Beton (Fundamente) mit "
                        "pauschaler Bewehrung 85 kg/m³. GWP aus OEKOBAU.DAT, "
                        "normiert auf die Bezugseinheit (kg bzw. m³)."),
        },
        "module": MODULES,
        "datasets": {k: {kk: vv for kk, vv in v.items()} for k, v in DATASETS.items()},
        "gruppen_summen": {k: {kk: round(vv, 3) for kk, vv in v.items()}
                           for k, v in groups.items()},
        "bars": bars,
        "tabellen": tabellen,
    }

    # Groesse reduzieren: Rundungen
    for b in out["bars"]:
        b["L_m"] = round(b["L_m"], 4)
        b["A_mm2"] = round(b["A_mm2"], 1)
        b["V_m3"] = round(b["V_m3"], 6)
        b["m_kg"] = round(b["m_kg"], 2)
        b["mitte"] = [round(v, 3) for v in b["mitte"]]
        b["start"] = [round(v, 3) for v in b["start"]]
        b["end"] = [round(v, 3) for v in b["end"]]

    out_path = os.path.join(ROOT, "webapp", "static", "data.json")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False)
    print(f"Geschrieben: {out_path} ({os.path.getsize(out_path) / 1e3:.0f} KB)")


if __name__ == "__main__":
    main()
