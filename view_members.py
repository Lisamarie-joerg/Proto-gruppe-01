"""Member table from the LIVE Rhino document (via mitglieder_live.csv).

The CSV is produced by the C# script in Rhino (RhinoCommon: exact
Brep.GetVolume() and Curve.GetLength()). This script displays the table
with pandas and exports it to Excel (3 sheets).

Usage:  python view_members.py [--rows N]
"""
from __future__ import annotations

import argparse

import pandas as pd

CSV = "mitglieder_live.csv"
OUT_XLSX = "mitglieder_tabelle.xlsx"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--rows", type=int, default=15)
    args = ap.parse_args()

    df = pd.read_csv(CSV)
    print(f"=== Stabliste aus dem offenen Rhino-Dokument: {len(df)} Mitglieder ===")
    print(f"(Breps: {(df.Kurvenlaenge == 0).sum()}, "
          f"Kurven/Stahlseile: {(df.Kurvenlaenge > 0).sum()})\n")
    print(df.head(args.rows).to_string(index=False))

    print("\n=== Zusammenfassung pro Material ===")
    summ = df.groupby("Material").agg(
        Anzahl=("ID", "count"),
        Gesamtvolumen_m3=("Volumen", "sum"),
        Gesamtkurvenlaenge_m=("Kurvenlaenge", "sum"),
    ).round(3)
    print(summ.to_string())

    print("\n=== Zusammenfassung pro Querschnitt ===")
    qs = df.groupby("Querschnitt").agg(
        Anzahl=("ID", "count"),
        Gesamtvolumen_m3=("Volumen", "sum"),
        Gesamtkurvenlaenge_m=("Kurvenlaenge", "sum"),
    ).round(3).sort_values("Anzahl", ascending=False)
    print(qs.to_string())

    print(f"\nGesamtvolumen (Solide): {df.Volumen.sum():.3f} m^3")
    print(f"Gesamtkurvenlaenge (Stahlseile): {df.Kurvenlaenge.sum():.2f} m")

    with pd.ExcelWriter(OUT_XLSX, engine="openpyxl") as xw:
        df.to_excel(xw, sheet_name="Mitglieder", index=False)
        summ.to_excel(xw, sheet_name="Summe_Material")
        qs.to_excel(xw, sheet_name="Summe_Querschnitt")
    print(f"\nExportiert: {OUT_XLSX} (3 Blätter)")


if __name__ == "__main__":
    main()

