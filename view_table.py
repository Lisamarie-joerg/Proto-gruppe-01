"""View members_data.json as a formatted table in the terminal.

Usage:
    python view_table.py                 # first 20 rows + group summary
    python view_table.py --rows 50       # first 50 rows
    python view_table.py --export csv    # also write members_data.csv
"""
from __future__ import annotations

import argparse
import csv
import json
from collections import defaultdict

DATA = "members_data.json"
COLUMNS = [
    "Member_Type", "Faces", "Length_X", "Length_Y", "Length_Z",
    "Longest_Dim", "Volume", "Center_X", "Center_Y", "Center_Z",
]


def print_table(rows: list[dict], columns: list[str]) -> None:
    widths = []
    for c in columns:
        w = max(len(c), *(len(f"{r.get(c, '')}") for r in rows))
        widths.append(w)
    header = " | ".join(c.ljust(widths[i]) for i, c in enumerate(columns))
    print(header)
    print("-|-".join("-" * w for w in widths))
    for r in rows:
        print(" | ".join(f"{r.get(c, '')}".ljust(widths[i]) for i, c in enumerate(columns)))


def print_summary(rows: list[dict]) -> None:
    grp: dict[str, list] = defaultdict(lambda: [0, 0.0])
    for r in rows:
        key = r["Layer"].split("::")[-1]
        grp[key][0] += 1
        grp[key][1] += r["Volume"]
    print()
    print(f'{"Querschnitt":<28}{"Anzahl":>8}{"Gesamtvolumen":>16}')
    print("-" * 52)
    for k, (n, v) in sorted(grp.items(), key=lambda x: -x[1][0]):
        print(f"{k:<28}{n:>8}{v:>16.3f}")
    print("-" * 52)
    print(f'{"SUMME":<28}{sum(n for n, _ in grp.values()):>8}'
          f'{sum(v for _, v in grp.values()):>16.3f}')


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--rows", type=int, default=20)
    ap.add_argument("--export", choices=["csv"], help="export as CSV (Excel)")
    args = ap.parse_args()

    with open(DATA, encoding="utf-8") as f:
        data = json.load(f)

    print(f"Zeilen: {len(data)} | Spalten: {len(data[0])}")
    print(f"Alle Spalten: {', '.join(data[0])}\n")
    print_table(data[: args.rows], COLUMNS)
    print(f"... (zeige {min(args.rows, len(data))} von {len(data)} Zeilen)")
    print_summary(data)

    if args.export == "csv":
        with open("members_data.csv", "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=data[0].keys())
            w.writeheader()
            w.writerows(data)
        print("\nmembers_data.csv geschrieben - in Excel oeffnen.")


if __name__ == "__main__":
    main()
