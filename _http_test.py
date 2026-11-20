"""HTTP-Test: Server starten, Endpunkte prüfen, Server stoppen."""
import json
import subprocess
import sys
import time
import urllib.request

BASE = "http://127.0.0.1:8501"

proc = subprocess.Popen(
    [sys.executable, "webapp/app.py"],
    stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
)
try:
    for _ in range(50):                    # Auf Server-Ready warten
        try:
            urllib.request.urlopen(BASE + "/", timeout=2)
            break
        except Exception:
            time.sleep(0.2)

    paths = [
        "/", "/api/data", "/static/viewport3d.js", "/static/index.html",
        "/static/model.glb", "/static/plotly.min.js",
        "/static/three/three.module.js",
        "/static/three/addons/loaders/GLTFLoader.js",
        "/static/three/addons/controls/OrbitControls.js",
        "/static/three/addons/libs/fflate.module.js",
        "/static/three/addons/utils/BufferGeometryUtils.js",
    ]
    ok = True
    for p in paths:
        try:
            with urllib.request.urlopen(BASE + p, timeout=10) as r:
                n = len(r.read())
                print(f"{r.status}  {p:52s} {n:>10,} bytes")
                if r.status != 200:
                    ok = False
        except Exception as e:
            ok = False
            print(f"ERR  {p}: {e}")

    # Struktur: viewport3d.js muss setView/resize auf Top-Level haben
    js = urllib.request.urlopen(BASE + "/static/viewport3d.js",
                                timeout=10).read().decode()
    for fn in ["function setView", "function resize",
               "function refreshHighlight", "function showPartInfo"]:
        if fn not in js:
            ok = False
            print(f"FEHLT: {fn}")
    print("viewport3d.js Struktur:", "OK" if ok else "FEHLER")
    print("ERGEBNIS:", "ALLE ENDPOINTS OK" if ok else "FEHLER")
finally:
    proc.terminate()
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        proc.kill()
