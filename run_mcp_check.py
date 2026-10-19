"""Full Rhino MCP connection check, results written to mcp_check_result.txt"""
import json
import socket
import subprocess
import sys
import traceback

_out = open("mcp_check_result.txt", "w", encoding="utf-8")


def log(msg=""):
    print(msg, flush=True)
    _out.write(str(msg) + "\n")
    _out.flush()


def main():
    # 1) Is Rhino running?
    tasklist = subprocess.run(["tasklist"], capture_output=True, text=True).stdout
    rhino_procs = [l for l in tasklist.splitlines() if "rhino" in l.lower()]
    log("=== Rhino processes ===")
    if rhino_procs:
        for p in rhino_procs:
            log("  " + p.strip())
    else:
        log("  NO Rhino process found!")

    # 2) Is port 1999 open (IPv4 and IPv6)?
    log("=== Port 1999 (RhinoMCP default) ===")
    port_open = False
    for family, host in [(socket.AF_INET, "127.0.0.1"), (socket.AF_INET6, "::1")]:
        s = socket.socket(family)
        s.settimeout(3)
        err = s.connect_ex((host, 1999))
        s.close()
        log(f"  {host}:1999 -> {'OPEN' if err == 0 else f'CLOSED (error {err})'}")
        port_open = port_open or err == 0

    # 3) Which TCP ports are listening?
    log("=== LISTENING TCP ports (netstat) ===")
    ns = subprocess.run(["netstat", "-ano", "-p", "tcp"], capture_output=True, text=True).stdout
    listening = [l.strip() for l in ns.splitlines() if "LISTENING" in l]
    for l in listening[:40]:
        log("  " + l)
    log(f"  ({len(listening)} listening entries total)")

    # 4) If port is open, ask Rhino for scene info
    log("=== MCP handshake test ===")
    if not port_open:
        log("  Skipped - port 1999 is closed, nothing to talk to.")
        return
    s = socket.socket(socket.AF_INET)
    s.settimeout(5)
    s.connect(("127.0.0.1", 1999))
    s.sendall(json.dumps({"type": "get_scene_info", "params": {}}).encode("utf-8"))
    data = b""
    resp = None
    try:
        while True:
            chunk = s.recv(8192)
            if not chunk:
                break
            data += chunk
            try:
                resp = json.loads(data.decode("utf-8"))
                break
            except json.JSONDecodeError:
                continue
        log("  Rhino answered: " + json.dumps(resp, ensure_ascii=False)[:1500])
    except socket.timeout:
        log("  Socket open but no answer within 5 s (timeout).")
    s.close()


if __name__ == "__main__":
    try:
        main()
    except Exception:
        log("SCRIPT ERROR:")
        log(traceback.format_exc())
    finally:
        _out.close()
    print("\nSaved to mcp_check_result.txt", flush=True)
