"""Analyze MemberAxes by section: lengths, spatial extents, orientation."""
import rhino3dm
from collections import defaultdict

MODEL = r"Data\RH7 Stockerau Rhino Export from RFEM.3dm"
model = rhino3dm.File3dm.Read(MODEL)
objs = model.Objects

def category_of(layer_name):
    sec = layer_name.split("::")[-1]
    if sec.startswith("Flat Bar"):
        return "Flachstab"
    if sec.startswith("RO 139"):
        return "Rundrohr"
    if sec.startswith("RD 12"):
        return "RD12"
    if sec.startswith("Rectangle"):
        return "Rechteck"
    return None

axes = defaultdict(list)
for o in objs:
    layer = model.Layers[o.Attributes.LayerIndex]
    if "MemberAxes::" not in layer.FullPath:
        continue
    cat = category_of(layer.FullPath)
    if not cat:
        continue
    geo = o.Geometry
    try:
        bb = geo.GetBoundingBox(True)
    except Exception:
        continue
    axes[cat].append({
        "layer": layer.FullPath.split("::")[-1],
        "len": geo.GetLength(),
        "bbmin": (bb.Min.X, bb.Min.Y, bb.Min.Z),
        "bbmax": (bb.Max.X, bb.Max.Y, bb.Max.Z),
        "center": ((bb.Min.X+bb.Max.X)/2, (bb.Min.Y+bb.Max.Y)/2, (bb.Min.Z+bb.Max.Z)/2),
    })

for cat, items in axes.items():
    zs = [i["center"][2] for i in items]
    total_len = sum(i["len"] for i in items)
    print(f"\n=== {cat}: {len(items)} Achsen, Gesamtlänge {total_len:.2f} m ===")
    print(f"  Z-Bereich: {min(zs):.2f} .. {max(zs):.2f} m  (Mittel {sum(zs)/len(zs):.2f})")
    # section breakdown
    secs = defaultdict(lambda: [0, 0.0])
    for i in items:
        secs[i["layer"]][0] += 1
        secs[i["layer"]][1] += i["len"]
    for sec, (c, l) in sorted(secs.items()):
        print(f"    {sec:<32} {c:>4} Stäbe  {l:>8.2f} m")

# RD 12 orientation & height profile
rd = axes.get("RD12", [])
orient = defaultdict(int)
for i in rd:
    d = (i["bbmax"][0]-i["bbmin"][0], i["bbmax"][1]-i["bbmin"][1], i["bbmax"][2]-i["bbmin"][2])
    k = ["X","Y","Z"][d.index(max(d))]
    orient[k] += 1
print("\nRD 12 Orientierung (längste Achse):", dict(orient))

# height histogram of RD12 centers
import math
bins = defaultdict(int)
for i in rd:
    z = i["center"][2]
    b = math.floor(z / 0.5) * 0.5
    bins[b] += 1
print("RD 12 Z-Verteilung (0.5m-Bins):")
for b in sorted(bins):
    print(f"  {b:>5.1f} - {b+0.5:>5.1f} m: {'#' * bins[b]} ({bins[b]})")

# Solids volumes by category
print("\n=== Solids (Members) Volumina ===")
vol = defaultdict(lambda: [0, 0.0])
for o in objs:
    layer = model.Layers[o.Attributes.LayerIndex]
    if "::Members::" not in layer.FullPath:
        continue
    cat = category_of(layer.FullPath)
    geo = o.Geometry
    try:
        v = geo.GetVolume()
    except Exception:
        v = 0.0
    vol[cat][0] += 1
    vol[cat][1] += v
for cat, (c, v) in vol.items():
    print(f"  {cat:<12} {c:>4} Solids, Gesamtvolumen {v:>8.3f} m³")
