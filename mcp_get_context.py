"""Call the rhino-mcp 'get_context' tool over HTTP to prove end-to-end access."""
import json

import httpx

BASE = "http://localhost:10501/"
HEADERS = {"Accept": "application/json, text/event-stream", "Content-Type": "application/json"}

out = open("mcp_context.txt", "w", encoding="utf-8")


def log(msg=""):
    print(msg, flush=True)
    out.write(str(msg) + "\n")
    out.flush()


with httpx.Client(timeout=30.0) as client:
    client.post(BASE, json={
        "jsonrpc": "2.0", "id": 1, "method": "initialize",
        "params": {"protocolVersion": "2024-11-05", "capabilities": {},
                   "clientInfo": {"name": "cline", "version": "1.0"}}}, headers=HEADERS)
    client.post(BASE, json={"jsonrpc": "2.0", "method": "notifications/initialized"}, headers=HEADERS)

    r = client.post(BASE, json={
        "jsonrpc": "2.0", "id": 3, "method": "tools/call",
        "params": {"name": "get_context", "arguments": {}}}, headers=HEADERS)
    log(f"tools/call get_context: HTTP {r.status_code}")
    data = r.json()
    result = data.get("result", {})
    for content in result.get("content", []):
        if content.get("type") == "text":
            text = content["text"]
            try:
                log(json.dumps(json.loads(text), indent=2, ensure_ascii=False)[:3000])
            except Exception:
                log(text[:3000])

out.close()
print("done", flush=True)
