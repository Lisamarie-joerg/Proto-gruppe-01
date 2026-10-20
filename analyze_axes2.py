"""Analyze MemberAxes by section (fixed rhino3dm API) + element-type layers."""
import math
from collections import defaultdict

import rhino3dm

MODEL = r"Data\RH7 Stockerau Rhino Export from RFEM.3dm"
model = rhino3dm.File3dm.Read(MODEL)
objs = model.Objects

def cat_of(layer_name):
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
    cat = cat_of(layer.FullPath)
    if not cat:
        continue
    geo = o.Geometry
    p0 = geo.PointAtStart
    p1 = geo.PointAtEnd
    length = math.dist((p0.X, p0.Y, p0.Z), (p1.X, p1.Y, p1.Z))
    axes[cat].append({
        "sec": layer.FullPath.split("::")[-1],
        "len": length,
        "p0": (p0.X, p0.Y, p0.Z),
        "p1": (p1.X, p1.Y, p1.Z),
    })

print("=== MemberAxes nach Querschnitt ===")
grand = 0
for cat, items in axes.items():
    total = sum(i["len"] for i in items)
    grand += total
    zs = [(i["p0"][2] + i["p1"][2]) / 2 for i in items]
    print(f"\n{cat}: {len(items)} Stäbe, Gesamtlänge {total:.3f} m, Z-Mittel {sum(zs)/len(zs):.2f} m (Z von {min(zs):.2f} bis {max(zs):.2f})")
    secs = defaultdict(lambda: [0, 0.0])
    for i in items:
        secs[i["sec"]][0] += 1
        secs[i["sec"]][1] += i["len"]
    for sec, (c, l) in sorted(secs.items()):
        print(f"   {sec:<34} {c:>4}  {l:>8.3f} m")
print(f"\nGESAMT: {sum(len(v) for v in axes.values())} Stäbe, {grand:.3f} m")

# RD 12 detail: orientation & height profile
rd = axes["RD12"]
orient = defaultdict(int)
for i in rd:
    d = (abs(i["p1"][0]-i["p0"][0]), abs(i["p1"][1]-i["p0"][1]), abs(i["p1"][2]-i["p0"][2]))
    orient[["X", "Y", "Z"][d.index(max(d))]] += 1
print("\nRD 12 - Hauptausrichtung:", dict(orient))

lens = [i["len"] for i in rd]
print(f"RD 12 - Länge: min {min(lens):.2f}, max {max(lens):.2f}, mittel {sum(lens)/len(lens):.2f} m")

bins = defaultdict(int)
for i in rd:
    z = (i["p0"][2] + i["p1"][2]) / 2
    bins[math.floor(z)] += 1
print("RD 12 - Z-Verteilung (1m-Bins):")
for b in sorted(bins):
    print(f"   {b:>3}-{b+1:>3} m: {'#'*bins[b]} ({bins[b]})")

# sample endpoints of a few RD 12
print("\nRD 12 - Beispiele (Anfang -> Ende):")
for i in rd[:6]:
    print(f"   ({i['p0'][0]:.2f},{i['p0'][1]:.2f},{i['p0'][2]:.2f}) -> ({i['p1'][0]:.2f},{i['p1'][1]:.2f},{i['p1'][2]:.2f})  L={i['len']:.2f}")

# What's on the 02_AXES MODEL::Structure::Element::* layers?
print("\n=== 02_AXES MODEL Element-Layer ===")
for idx, layer in enumerate(model.Layers):
    if "02_AXES MODEL" in layer.FullPath:
        cnt = sum(1 for o in objs if o.Attributes.LayerIndex == idx)
        print(f"[{idx:>3}] ({cnt:>3}) {layer.FullPath}")
