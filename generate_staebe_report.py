"""Generate a Stäbe list from the open Rhino document via MCP HTTP."""
from __future__ import annotations

import base64
import json
import os
from collections import defaultdict
from datetime import datetime

import httpx

BASE = "http://localhost:10501/"
HEADERS = {
    "Accept": "application/json, text/event-stream",
    "Content-Type": "application/json",
}
OUTPUT_DIR = os.path.join("reports")
DETAILS_CSV = os.path.join(OUTPUT_DIR, "staebe_details.csv")
SUMMARY_MD = os.path.join(OUTPUT_DIR, "staebe_liste.md")
SNAPSHOT_PATH = os.path.join(OUTPUT_DIR, "staebe_view.jpg")


def ensure_dir(path: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)


def join_text(result: dict) -> str:
    texts = []
    for item in result.get("content", []):
        if item.get("type") == "text" and item.get("text"):
            texts.append(item["text"])
    return "\n".join(texts)


BAR_SCRIPT = r"""
import json
from Rhino.Geometry import Curve

doc = __rhino_doc__
bars = []
for obj in doc.Objects:
    geo = obj.Geometry
    if geo is None:
        continue
    if not isinstance(geo, Curve):
        continue
    layer = doc.Layers[obj.Attributes.LayerIndex]
    layer_name = layer.FullPath
    if "Structure::Element" not in layer_name:
        continue
    ok, length = geo.TryGetLength()
    if not ok:
        length = geo.GetLength()
    bars.append({
        "id": str(obj.Id),
        "layer": layer_name,
        "length": float(length),
        "objectType": str(obj.ObjectType)
    })


class RhinoMCPClient:
    def __init__(self, base: str = BASE) -> None:
        self.base = base
        self.client = httpx.Client(timeout=120.0)
        self._initialize()

    def _initialize(self) -> None:
        self.client.post(self.base, json={
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "staebe-report", "version": "1.0"}
            }
        }, headers=HEADERS)
        self.client.post(self.base, json={
            "jsonrpc": "2.0",
            "method": "notifications/initialized"
        }, headers=HEADERS)

    def call_tool(self, name: str, arguments: dict | None = None) -> dict:
        payload = {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/call",
            "params": {"name": name, "arguments": arguments or {}}
        }


def gather_bars(client: RhinoMCPClient) -> dict:
    result = client.call_tool("run_python", {"script": BAR_SCRIPT})
    text = join_text(result)
    return json.loads(text)


def zoom_and_snapshot(client: RhinoMCPClient) -> None:
    try:
        client.call_tool("zoom_to_layer", {"layer": "2__B+G::02_AXES MODEL::Structure::Element"})
    except Exception:
        pass
    shot = client.call_tool("get_viewport_image", {
        "width": 1200,
        "height": 675,
        "displayMode": "Shaded"
    })

        client.call_tool("zoom_to_layer", {"layer": "2__B+G::02_AXES MODEL::Structure::Element"})
    except Exception:
        pass
    shot = client.call_tool("get_viewport_image", {
        "width": 960,
        "height": 540,
        "displayMode": "Shaded"
    })
    image_b64 = shot.get("imageData") or shot.get("image")
    if not image_b64:
    image_b64 = shot.get("imageData") or shot.get("image")
    if not image_b64:
        return

def build_tables(data: dict):
    bars = data["bars"]
    bars_sorted = sorted(bars, key=lambda b: (b["layer"], -b["length"]))
    ensure_dir(DETAILS_CSV)
    with open(DETAILS_CSV, "w", encoding="utf-8") as f:
        f.write("id,layer,length_m\n")
        for b in bars_sorted:
            f.write(f"{b['id']},{b['layer']},{b['length']:.4f}\n")

    layer_stats = defaultdict(lambda: [0, 0.0])
    for b in bars_sorted:
        layer_stats[b["layer"]][0] += 1
        layer_stats[b["layer"]][1] += b["length"]

    layer_rows = []
    for layer, (count, total_len) in sorted(layer_stats.items(), key=lambda kv: kv[0]):
        avg = total_len / count if count else 0
        layer_rows.append((layer, count, total_len, avg))

    top_bars = sorted(bars, key=lambda b: b["length"], reverse=True)[:25]
    return layer_rows, top_bars, bars_sorted


def write_markdown(data: dict, layer_rows, top_bars) -> None:

    ensure_dir(SNAPSHOT_PATH)
    with open(SNAPSHOT_PATH, "wb") as f:
        f.write(base64.b64decode(image_b64))
 
 
 def build_tables(data: dict):

        return


def build_tables(data: dict):
    bars = data["bars"]
    bars_sorted = sorted(bars, key=lambda b: (b["layer"], -b["length"]))
    ensure_dir(DETAILS_CSV)
    with open(DETAILS_CSV, "w", encoding="utf-8") as f:
        f.write("id,layer,length_m\n")


    layer_rows = []

        f.write("## Längste 25 Stäbe\n\n")
        f.write("| # | Layer | Länge [m] | Objekt-ID |\n|---|---|---:|---|\n")
        for idx, bar in enumerate(top_bars, start=1):
            f.write(f"| {idx} | {bar['layer']} | {bar['length']:.2f} | {bar['id']} |\n")
        f.write("\nHinweis: vollständige Liste siehe `staebe_details.csv`.\n")



def main() -> None:

    for layer, (count, total_len) in sorted(layer_stats.items(), key=lambda kv: kv[0]):
        avg = total_len / count if count else 0
        layer_rows.append((layer, count, total_len, avg))

    top_bars = sorted(bars, key=lambda b: b["length"], reverse=True)[:25]
    return layer_rows, top_bars, bars_sorted
    try:
        data = gather_bars(client)
        layer_rows, top_bars, bars_sorted = build_tables(data)
        zoom_and_snapshot(client)
        write_markdown(data, layer_rows, top_bars)
        print("Report erstellt:", SUMMARY_MD)
        print(f"Gesamtzahl Stäbe: {len(bars_sorted)}")
        print(f"Gesamtlänge [m]: {sum(b['length'] for b in bars_sorted):.2f}")
    finally:
        client.close()




        for b in bars_sorted:
            f.write(f"{b['id']},{b['layer']},{b['length']:.4f}\n")

    layer_stats = defaultdict(lambda: [0, 0.0])
    for b in bars_sorted:
        layer_stats[b["layer"]][0] += 1
        layer_stats[b["layer"]][1] += b["length"]

    layer_rows = []
    for layer, (count, total_len) in sorted(layer_stats.items(), key=lambda kv: kv[0]):
        avg = total_len / count if count else 0
def build_tables(data: dict):
    bars = data["bars"]
    bars_sorted = sorted(bars, key=lambda b: (b["layer"], -b["length"]))
    ensure_dir(DETAILS_CSV)
    with open(DETAILS_CSV, "w", encoding="utf-8") as f:
        f.write("id,layer,length_m\n")
        for b in bars_sorted:
            f.write(f"{b['id']},{b['layer']},{b['length']:.4f}\n")

    layer_stats = defaultdict(lambda: [0, 0.0])
    for b in bars_sorted:
        layer_stats[b["layer"]][0] += 1
        layer_stats[b["layer"]][1] += b["length"]

    layer_rows = []
    for layer, (count, total_len) in sorted(layer_stats.items(), key=lambda kv: kv[0]):
        avg = total_len / count if count else 0
        layer_rows.append((layer, count, total_len, avg))

    top_bars = sorted(bars, key=lambda b: b["length"], reverse=True)[:25]
    return layer_rows, top_bars, bars_sorted


def write_markdown(data: dict, layer_rows, top_bars) -> None:
    ensure_dir(SUMMARY_MD)
    total_count = len(data["bars"])
    total_length = sum(b["length"] for b in data["bars"])
    doc_name = data.get("docName") or "(unbenannt)"
    doc_path = data.get("docPath") or "(unsaved)"
    units = data.get("units", "")
    now = datetime.now().strftime("%d.%m.%Y %H:%M")

    with open(SUMMARY_MD, "w", encoding="utf-8") as f:
        f.write("# Stäbe-Liste\n\n")
        f.write(f"**Erstellt:** {now}  ")
        f.write(f"**Dokument:** `{doc_name}`  ")
        f.write(f"**Pfad:** `{doc_path}`  ")
        f.write(f"**Einheiten:** {units}\n\n")
        f.write("## Gesamtübersicht\n\n")
        f.write("| Kennzahl | Wert |\n|---|---:|\n")
        f.write(f"| Anzahl Stäbe | {total_count} |\n")
        f.write(f"| Gesamtlänge [{units}] | {total_length:.2f} |\n")
        f.write(f"| Durchschnittslänge [{units}] | {total_length/total_count:.2f} |\n")
        f.write("\n")
        if os.path.exists(SNAPSHOT_PATH):
            rel = os.path.relpath(SNAPSHOT_PATH, os.path.dirname(SUMMARY_MD))
            f.write(f"![Stäbe-Ansicht]({rel})\n\n")

        f.write("## Stäbe nach Layer\n\n")
        f.write("| Layer | Anzahl | Summe [m] | Mittel [m] |\n|---|---:|---:|---:|\n")
        for layer, count, total_len, avg in layer_rows:
            f.write(f"| {layer} | {count} | {total_len:.2f} | {avg:.2f} |\n")
        f.write("\n")

        f.write("## Längste 25 Stäbe\n\n")
        f.write("| # | Layer | Länge [m] | Objekt-ID |\n|---|---|---:|---|\n")
        for idx, bar in enumerate(top_bars, start=1):
            f.write(f"| {idx} | {bar['layer']} | {bar['length']:.2f} | {bar['id']} |\n")
        f.write("\nHinweis: vollständige Liste siehe `staebe_details.csv`.\n")

        layer_rows.append((layer, count, total_len, avg))

    top_bars = sorted(bars, key=lambda b: b["length"], reverse=True)[:25]
    return layer_rows, top_bars


        f.write("## Laengste 25 Staebe\n\n")
        f.write("## Längste 25 Stäbe\n\n")
        f.write("| # | Layer | Länge [m] | Objekt-ID |\n|---|---|---:|---|\n")

        f.write("## L e4ngste 25 St e4be\n\n")
        f.write("| # | Layer | L e4nge [m] | Objekt-ID |\n|---|---|---:|---|\n")
        for idx, bar in enumerate(top_bars, start=1):
            f.write(f"| {idx} | {bar['layer']} | {bar['length']:.2f} | {bar['id']} |\n")
        f.write("\nHinweis: vollst e4ndige Liste siehe `staebe_details.csv`.\n")
 


def write_markdown(data: dict, layer_rows, top_bars) -> None:
    ensure_dir(SUMMARY_MD)
    total_count = len(data["bars"])
    total_length = sum(b["length"] for b in data["bars"])
    doc_name = data.get("docName") or "(unbenannt)"
    doc_path = data.get("docPath") or "(unsaved)"
    units = data.get("units", "")
    try:
        data = gather_bars(client)
        layer_rows, top_bars, bars_sorted = build_tables(data)
        zoom_and_snapshot(client)
        print(f"Gesamtlänge [m]: {sum(b['length'] for b in bars_sorted):.2f}")

        write_markdown(data, layer_rows, top_bars)
        print(f"Gesamtzahl St e4be: {len(bars_sorted)}")
        f.write("| Kennzahl | Wert |\n|---|---:|\n")
        f.write(f"| Anzahl Stäbe | {total_count} |\n")
        f.write(f"| Gesamtlänge [{units}] | {total_length:.2f} |\n")
        f.write(f"| Durchschnittslänge [{units}] | {total_length/total_count:.2f} |\n")
        f.write("\n")
        if os.path.exists(SNAPSHOT_PATH):
            rel = os.path.relpath(SNAPSHOT_PATH, os.path.dirname(SUMMARY_MD))
            f.write(f"![Stäbe-Ansicht]({rel})\n\n")

        f.write("## Stäbe nach Layer\n\n")
        f.write("| Layer | Anzahl | Summe [m] | Mittel [m] |\n|---|---:|---:|---:|\n")
        for layer, count, total_len, avg in layer_rows:
            f.write(f"| {layer} | {count} | {total_len:.2f} | {avg:.2f} |\n")
        f.write("\n")

        f.write("## Längste 25 Stäbe\n\n")
        f.write("| # | Layer | Länge [m] | Objekt-ID |\n|---|---|---:|---|\n")
        for idx, bar in enumerate(top_bars, start=1):
            f.write(f"| {idx} | {bar['layer']} | {bar['length']:.2f} | {bar['id']} |\n")
        f.write("\nHinweis: vollständige Liste siehe `staebe_details.csv`.\n")

    ensure_dir(SNAPSHOT_PATH)
    with open(SNAPSHOT_PATH, "wb") as f:
        f.write(base64.b64decode(image_b64))


    now = datetime.now().strftime("%d.%m.%Y %H:%M")

    with open(SUMMARY_MD, "w", encoding="utf-8") as f:
        f.write("# Stäbe-Liste\n\n")
        f.write(f"**Erstellt:** {now}  ")
        f.write(f"**Dokument:** `{doc_name}`  ")
        f.write(f"**Pfad:** `{doc_path}`  ")
        f.write(f"**Einheiten:** {units}\n\n")
        f.write("## Gesamtübersicht\n\n")
        f.write("| Kennzahl | Wert |\n|---|---:|\n")
        f.write(f"| Anzahl Stäbe | {total_count} |\n")
        f.write(f"| Gesamtlänge [{units}] | {total_length:.2f} |\n")
        f.write(f"| Durchschnittslänge [{units}] | {total_length/total_count:.2f} |\n")
        f.write("\n")
        if os.path.exists(SNAPSHOT_PATH):
            rel = os.path.relpath(SNAPSHOT_PATH, os.path.dirname(SUMMARY_MD))
            f.write(f"![Stäbe-Ansicht]({rel})\n\n")

        f.write("## Stäbe nach Layer\n\n")
        f.write("| Layer | Anzahl | Summe [m] | Mittel [m] |\n|---|---:|---:|---:|\n")
        for layer, count, total_len, avg in layer_rows:
            f.write(f"| {layer} | {count} | {total_len:.2f} | {avg:.2f} |\n")
        f.write("\n")

        f.write("## Längste 25 Stäbe\n\n")


def main() -> None:
    client = RhinoMCPClient()
    try:
        data = gather_bars(client)
        layer_rows, top_bars = build_tables(data)
        zoom_and_snapshot(client)
        write_markdown(data, layer_rows, top_bars)
        print("Report erstellt:", SUMMARY_MD)
    finally:
        client.close()


if __name__ == "__main__":
    main()

        f.write("| # | Layer | Länge [m] | Objekt-ID |\n|---|---|---:|---|\n")
        for idx, bar in enumerate(top_bars, start=1):
            f.write(f"| {idx} | {bar['layer']} | {bar['length']:.2f} | {bar['id']} |\n")
        f.write("\nHinweis: vollständige Liste siehe `staebe_details.csv`.\n")


    ensure_dir(SNAPSHOT_PATH)
    with open(SNAPSHOT_PATH, "wb") as f:
        f.write(base64.b64decode(image_b64))

        resp = self.client.post(self.base, json=payload, headers=HEADERS)
        resp.raise_for_status()
        data = resp.json()
        return data["result"]

    def close(self) -> None:
        self.client.close()

print(json.dumps({
    "docName": doc.Name,
    "docPath": doc.Path,
    "units": str(doc.ModelUnitSystem),
    "bars": bars
}))
"""
