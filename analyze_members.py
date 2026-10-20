"""Analyze members_data.json: group by section layer, report spatial layout."""
import json
from collections import defaultdict

with open("members_data.json", encoding="utf-8") as f:
    members = json.load(f)

groups = defaultdict(list)
for m in members:
    layer = m["Layer"]
    section = layer.split("::")[-1]
    groups[section].append(m)

print(f"Total solids: {len(members)}\n")
print(f"{'Section':<28}{'Count':>6}  {'X range':>18}  {'Y range':>18}  {'Z range':>18}  {'Z center avg':>12}")
for section, items in sorted(groups.items(), key=lambda kv: -len(kv[1])):
    xs = [m["Center_X"] for m in items]
    ys = [m["Center_Y"] for m in items]
    zs = [m["Center_Z"] for m in items]
    print(f"{section:<28}{len(items):>6}  {min(xs):>8.2f}-{max(xs):<8.2f}  {min(ys):>8.2f}-{max(ys):<8.2f}  {min(zs):>8.2f}-{max(zs):<8.2f}  {sum(zs)/len(zs):>12.2f}")

# Check orientation of RD 12 bars (axis direction via bbox dims)
print("\n--- RD 12 orientation (longest axis) ---")
rd = groups.get("RD 12", [])
orient = defaultdict(int)
for m in rd:
    dims = {"X": m["Length_X"], "Y": m["Length_Y"], "Z": m["Length_Z"]}
    longest = max(dims, key=dims.get)
    orient[longest] += 1
print(dict(orient))

# Sample a few RD 12 members
print("\nSample RD 12 members (first 5):")
for m in rd[:5]:
    print(f"  id={m['ID'][:8]} center=({m['Center_X']:.2f},{m['Center_Y']:.2f},{m['Center_Z']:.2f}) dims=({m['Length_X']:.2f},{m['Length_Y']:.2f},{m['Length_Z']:.2f})")

# Sample Rectangle 500/500 members
print("\nSample Rectangle 500/500 members (first 5):")
for m in groups.get("Rectangle 500/500", [])[:5]:
    print(f"  id={m['ID'][:8]} center=({m['Center_X']:.2f},{m['Center_Y']:.2f},{m['Center_Z']:.2f}) dims=({m['Length_X']:.2f},{m['Length_Y']:.2f},{m['Length_Z']:.2f})")

# Sample RO 139.7 members
print("\nSample RO 139.7x8.0 members (first 5):")
for m in groups.get("RO 139.7x8.0 (EN 10210-2)", [])[:5]:
    print(f"  id={m['ID'][:8]} center=({m['Center_X']:.2f},{m['Center_Y']:.2f},{m['Center_Z']:.2f}) dims=({m['Length_X']:.2f},{m['Length_Y']:.2f},{m['Length_Z']:.2f})")

# Sample Flat Bar members of each size
for sec, items in sorted(groups.items()):
    if sec.startswith("Flat Bar"):
        print(f"\nSample {sec} (first 3):")
        for m in items[:3]:
            print(f"  id={m['ID'][:8]} center=({m['Center_X']:.2f},{m['Center_Y']:.2f},{m['Center_Z']:.2f}) dims=({m['Length_X']:.2f},{m['Length_Y']:.2f},{m['Length_Z']:.2f})")
