"""Ask the live Rhino (via MCP over HTTP at localhost:10501) what's in the open document."""
import json

import httpx

BASE = "http://localhost:10501/"
HEADERS = {"Accept": "application/json, text/event-stream", "Content-Type": "application/json"}

out = open("mcp_open_doc.txt", "w", encoding="utf-8")


def log(msg=""):
    print(msg, flush=True)
    out.write(str(msg) + "\n")
    out.flush()


RHINO_PY = r"""
from collections import Counter
doc = __rhino_doc__
print("DOC NAME :", doc.Name or "(untitled)")
print("DOC PATH :", doc.Path or "(not saved)")
print("UNITS    :", doc.ModelUnitSystem)
objs = list(doc.Objects)
print("OBJECTS  :", len(objs))
for t, n in Counter(str(o.ObjectType) for o in objs).most_common():
    print(f"   {t}: {n}")
layers = list(doc.Layers)
print("LAYERS   :", len(layers))
for l in layers[:40]:
    print("   " + l.FullPath)
if len(layers) > 40:
    print(f"   ... (+{len(layers)-40} more)")
"""


def extract_text(result):
    texts = []
    for c in result.get("content", []):
        if c.get("type") == "text":
            texts.append(c["text"])
    return "\n".join(texts)


with httpx.Client(timeout=90.0) as client:
    client.post(BASE, json={
        "jsonrpc": "2.0", "id": 1, "method": "initialize",
        "params": {"protocolVersion": "2024-11-05", "capabilities": {},
                   "clientInfo": {"name": "cline", "version": "1.0"}}}, headers=HEADERS)
    client.post(BASE, json={"jsonrpc": "2.0", "method": "notifications/initialized"}, headers=HEADERS)

    # 0) input schemas of the tools we want to use
    r = client.post(BASE, json={"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}},
                    headers=HEADERS)
    tools = {t["name"]: t for t in r.json().get("result", {}).get("tools", [])}
    for name in ("get_context", "list_objects", "run_python"):
        schema = tools.get(name, {}).get("inputSchema", {})
        props = list(schema.get("properties", {}).keys())
        log(f"schema {name}: props={props}")

    # 1) get_context
    log("\n=== get_context ===")
    r = client.post(BASE, json={"jsonrpc": "2.0", "id": 3, "method": "tools/call",
                                "params": {"name": "get_context", "arguments": {}}},
                    headers=HEADERS)
    log(f"HTTP {r.status_code}")
    try:
        log(extract_text(r.json().get("result", {}))[:2500])
    except Exception as exc:
        log(f"parse error: {exc} | raw: {r.text[:1000]}")

    # 2) run_python doc summary
    log("\n=== run_python doc summary ===")
    r = client.post(BASE, json={"jsonrpc": "2.0", "id": 4, "method": "tools/call",
                                "params": {"name": "run_python",
                                           "arguments": {"script": RHINO_PY}}},
                    headers=HEADERS)
    log(f"HTTP {r.status_code}")
    try:
        log(extract_text(r.json().get("result", {}))[:4000])
    except Exception as exc:
        log(f"parse error: {exc} | raw: {r.text[:1500]}")

out.close()
print("done", flush=True)
