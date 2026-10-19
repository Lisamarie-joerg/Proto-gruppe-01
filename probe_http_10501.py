"""Probe http://localhost:10501/ - is it an MCP HTTP endpoint?"""
import json

import httpx

BASE = "http://localhost:10501"
out = open("http_probe.txt", "w", encoding="utf-8")


def log(msg=""):
    print(msg, flush=True)
    out.write(str(msg) + "\n")
    out.flush()


def show(label, resp):
    body = resp.text[:600].replace("\r", "")
    log(f"  {label}: HTTP {resp.status_code}")
    ct = resp.headers.get("content-type", "?")
    log(f"    content-type: {ct}")
    if body.strip():
        log("    body: " + body[:400])


with httpx.Client(timeout=8.0) as client:
    # 1) GET common paths
    log("=== GET probes ===")
    for path in ["/", "/mcp", "/sse", "/messages", "/status", "/health", "/api"]:
        try:
            r = client.get(BASE + path)
            show(f"GET {path}", r)
        except Exception as exc:
            log(f"  GET {path}: FAILED {type(exc).__name__}: {exc}")

    # 2) MCP initialize via Streamable HTTP transport
    log("\n=== POST /mcp (MCP initialize) ===")
    init_msg = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "protocolVersion": "2025-03-26",
            "capabilities": {},
            "clientInfo": {"name": "http-probe", "version": "1.0"},
        },
    }
    for path in ["/mcp", "/", "/messages"]:
        try:
            r = client.post(
                BASE + path,
                json=init_msg,
                headers={
                    "Accept": "application/json, text/event-stream",
                    "Content-Type": "application/json",
                },
            )
            show(f"POST {path}", r)
        except Exception as exc:
            log(f"  POST {path}: FAILED {type(exc).__name__}: {exc}")

out.close()
print("done", flush=True)
