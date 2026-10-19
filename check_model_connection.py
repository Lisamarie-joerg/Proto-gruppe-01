"""Check both ways to reach the Rhino model:
1) Live MCP bridge (socket 127.0.0.1:1999 inside Rhino 8)
2) Direct file read of the .3dm with rhino3dm (no running Rhino needed)
"""
import os
import socket

out = open("model_connection_check.txt", "w", encoding="utf-8")


def log(msg=""):
    print(msg, flush=True)
    out.write(str(msg) + "\n")
    out.flush()


# --- 1) Live MCP bridge ---
log("=== 1) Live MCP bridge (Rhino 8 plugin, port 1999) ===")
s = socket.socket()
s.settimeout(3)
err = s.connect_ex(("127.0.0.1", 1999))
s.close()
if err == 0:
    log("  OPEN - MCP bridge is reachable.")
else:
    log(f"  CLOSED (error {err}) - Rhino MCP server is NOT listening.")

# --- 2) .3dm file via rhino3dm ---
log("=== 2) Model file via rhino3dm ===")
path = os.path.join("Data", "RH7 Stockerau Rhino Export from RFEM.3dm")
log(f"  File: {os.path.abspath(path)}")
if not os.path.exists(path):
    log("  FILE NOT FOUND!")
else:
    size_mb = os.path.getsize(path) / 1e6
    log(f"  Size: {size_mb:.2f} MB")
    try:
        import rhino3dm
        log(f"  rhino3dm version: {rhino3dm.__version__}")
        model = rhino3dm.File3dm.Read(path)
        objs = list(model.Objects)
        log(f"  READ OK - {len(objs)} objects in the model")
        # breakdown by geometry type
        from collections import Counter
        types = Counter(type(o.Geometry).__name__ for o in objs)
        for t, n in types.most_common():
            log(f"    {t}: {n}")
        # layers present
        layers = [l.Name for l in model.Layers]
        log(f"  Layers ({len(layers)}): " + ", ".join(layers[:25]))
    except Exception as exc:
        log(f"  READ FAILED: {type(exc).__name__}: {exc}")

out.close()
print("done", flush=True)
