"""Analyze the 3dm model directly with rhino3dm: layers, axes, solids."""
import rhino3dm
from collections import defaultdict

MODEL = r"Data\RH7 Stockerau Rhino Export from RFEM.3dm"
print("rhino3dm version:", rhino3dm.__version__)
model = rhino3dm.File3dm.Read(MODEL)
objs = model.Objects
print("Objects:", len(objs))
print("Layers:", len(model.Layers))
print("Materials:", len(model.Materials))

# --- layer structure ---
print("\n=== Layers containing MemberAxes / Members / Element ===")
for i, layer in enumerate(model.Layers):
    fp = layer.FullPath
    if any(k in fp for k in ("MemberAxes", "Members", "Element", "Structure")):
        cnt = sum(1 for o in objs if o.Attributes.LayerIndex == i)
        if cnt > 0:
            print(f"[{i:>3}] ({cnt:>4}) {fp}")
