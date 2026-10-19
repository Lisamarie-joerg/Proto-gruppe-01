"""Is the rhino MCP server running? Check processes + internal Rhino AI port."""
import socket
import subprocess

out = open("running_check.txt", "w", encoding="utf-8")


def log(msg=""):
    print(msg, flush=True)
    out.write(str(msg) + "\n")
    out.flush()


# 1) rhino-mcp-router processes (with parent process name)
log("=== rhino-mcp-router processes ===")
ps = subprocess.run(
    ["powershell", "-NoProfile", "-Command",
     "Get-CimInstance Win32_Process -Filter \"Name like '%rhino-mcp%'\" | "
     "ForEach-Object { $p = (Get-Process -Id $_.ParentProcessId -ErrorAction SilentlyContinue).ProcessName; "
     "\"$($_.ProcessId) parent=$p cmd=$($_.CommandLine)\" }"],
    capture_output=True, text=True, timeout=60)
result = (ps.stdout + ps.stderr).strip()
log(result if result else "  (no rhino-mcp-router process found)")

# 2) Is port 10501 (internal Rhino AI slot port) listening?
log("\n=== Ports 10500-10510 ===")
for port in range(10500, 10511):
    s = socket.socket()
    s.settimeout(1)
    state = "OPEN" if s.connect_ex(("127.0.0.1", port)) == 0 else "closed"
    s.close()
    if state == "OPEN":
        log(f"  {port}: {state}")

# 3) Who listens on those ports? (netstat lines, locale-independent grep on '1050')
log("\n=== netstat lines for 1050x ===")
ns = subprocess.run(["netstat", "-ano", "-p", "tcp"], capture_output=True, text=True).stdout
hits = [l.strip() for l in ns.splitlines() if ":1050" in l]
log("\n".join("  " + h for h in hits) if hits else "  (none)")

out.close()
print("done", flush=True)
