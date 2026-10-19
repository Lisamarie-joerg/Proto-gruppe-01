"""Describe the currently open Rhino document via Rhino MCP HTTP endpoint."""
import json
import httpx

BASE = "http://localhost:10501/"
HEADERS = {
    "Accept": "application/json, text/event-stream",
    "Content-Type": "application/json",
}

OUT_PATH = "rhino_doc_summary.txt"


def log(out, msg=""):
    print(msg, flush=True)
    out.write(str(msg) + "\n")
    out.flush()


RHINO_SCRIPT = r"""
from collections import Counter

doc = __rhino_doc__
name = doc.Name or "(untitled)"
path = doc.Path or "(unsaved)"
unit_name = str(doc.ModelUnitSystem)
objects = list(doc.Objects)
layers = list(doc.Layers)
print(f"DOC NAME   : {name}")
print(f"DOC PATH   : {path}")
print(f"UNITS      : {unit_name}")
print(f"OBJECTS    : {len(objects)}")
counts = Counter(str(o.ObjectType) for o in objects)
for obj_type, count in counts.most_common():
    print(f"   {obj_type}: {count}")
print(f"LAYERS     : {len(layers)}")
for layer in layers[:40]:
    print(f"   {layer.FullPath}")
if len(layers) > 40:
    print(f"   ... (+{len(layers) - 40} more)")
"""


def call(client, payload):
    resp = client.post(BASE, json=payload, headers=HEADERS)
    resp.raise_for_status()
    return resp


def main():
    with open(OUT_PATH, "w", encoding="utf-8") as out, httpx.Client(timeout=60.0) as client:
        log(out, "== initialize ==")
        call(client, {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "cline", "version": "1.0"}
            }
        })
        call(client, {"jsonrpc": "2.0", "method": "notifications/initialized"})

        log(out, "\n== get_context ==")
        ctx = call(client, {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/call",
            "params": {"name": "get_context", "arguments": {}}
        }).json()["result"]
        log(out, json.dumps(ctx, indent=2))

        log(out, "\n== run_python doc summary ==")
        py = call(client, {
            "jsonrpc": "2.0",
            "id": 3,
            "method": "tools/call",
            "params": {"name": "run_python", "arguments": {"script": RHINO_SCRIPT}}
        }).json()["result"]
        for content in py.get("content", []):
            if content.get("type") == "text":
                log(out, content["text"])


if __name__ == "__main__":
    main()
