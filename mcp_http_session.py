"""Full MCP session over HTTP with Rhino 8 on http://localhost:10501/
initialize -> notifications/initialized -> tools/list
"""
import json

import httpx

BASE = "http://localhost:10501/"
out = open("mcp_session.txt", "w", encoding="utf-8")


def log(msg=""):
    print(msg, flush=True)
    out.write(str(msg) + "\n")
    out.flush()


HEADERS = {
    "Accept": "application/json, text/event-stream",
    "Content-Type": "application/json",
}

with httpx.Client(timeout=15.0) as client:
    session_id = None

    def post(payload):
        global session_id
        h = dict(HEADERS)
        if session_id:
            h["mcp-session-id"] = session_id
        r = client.post(BASE, json=payload, headers=h)
        sid = r.headers.get("mcp-session-id")
        if sid:
            session_id = sid
        return r

    # 1) initialize
    r = post({
        "jsonrpc": "2.0", "id": 1, "method": "initialize",
        "params": {"protocolVersion": "2024-11-05", "capabilities": {},
                   "clientInfo": {"name": "cline-probe", "version": "1.0"}},
    })
    log(f"initialize: HTTP {r.status_code}")
    log(f"  mcp-session-id: {session_id}")
    log("  " + r.text[:500].replace("\r", ""))

    # 2) notifications/initialized
    r = post({"jsonrpc": "2.0", "method": "notifications/initialized"})
    log(f"notifications/initialized: HTTP {r.status_code}")

    # 3) tools/list
    r = post({"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}})
    log(f"tools/list: HTTP {r.status_code}")
    try:
        data = r.json()
        tools = data.get("result", {}).get("tools", [])
        log(f"  {len(tools)} tools available:")
        for t in tools:
            desc = (t.get("description") or "")[:90].replace("\n", " ")
            log(f"    - {t.get('name')}: {desc}")
    except Exception as exc:
        log(f"  parse error: {exc}")
        log("  raw: " + r.text[:2000].replace("\r", ""))

out.close()
print("done", flush=True)
