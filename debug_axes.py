"""Debug: iterate MemberAxes objects."""
import rhino3dm
import traceback

MODEL = r"Data\RH7 Stockerau Rhino Export from RFEM.3dm"
model = rhino3dm.File3dm.Read(MODEL)
objs = model.Objects

count = 0
for o in objs:
    try:
        layer = model.Layers[o.Attributes.LayerIndex]
        fp = layer.FullPath
    except Exception as e:
        print("layer lookup failed:", e)
        continue
    if "MemberAxes" not in fp:
        continue
    count += 1
    if count <= 8:
        geo = o.Geometry
        print(f"\n#{count} layer={fp}")
        print(f"   geo type: {type(geo)}")
        try:
            bb = geo.GetBoundingBox(True)
            print(f"   bbox: ({bb.Min.X:.2f},{bb.Min.Y:.2f},{bb.Min.Z:.2f}) .. ({bb.Max.X:.2f},{bb.Max.Y:.2f},{bb.Max.Z:.2f})")
        except Exception as e:
            print("   bbox FAILED:", e)
            traceback.print_exc()
        try:
            l = geo.GetLength()
            print(f"   length: {l:.3f}")
        except Exception as e:
            print("   length FAILED:", e)

print(f"\nTotal MemberAxes objects: {count}")
