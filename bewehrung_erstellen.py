"""Build the Rhino reinforcement model and matching viewer geometry from plan P-01."""
import argparse
from collections import Counter, defaultdict
from math import atan2, cos, dist, pi, sin, sqrt
import json
from pathlib import Path

import pymupdf
import rhino3dm as rhino

POSITIONS = {
    "1": {"diameter": 10, "count": 341, "length": 1.98, "mass": 416.59, "detail": "Bügel · 42 × 42 cm · Haken 15 cm", "crop": (2040, 817, 2515, 875)},
    "2": {"diameter": 12, "count": 60, "length": 5.55, "mass": 295.70, "detail": "Längsstab · Schnitt A–A", "crop": (2040, 874, 2515, 926)},
    "3": {"diameter": 12, "count": 40, "length": 2.39, "mass": 84.89, "detail": "Endbügel · 100 / 39 / 100 cm", "crop": (2040, 924, 2515, 981)},
    "4": {"diameter": 12, "count": 60, "length": 4.10, "mass": 218.45, "detail": "Längsstab · Schnitt B–B", "crop": (2040, 978, 2515, 1038)},
}
COLORS = {"Beton": (163, 164, 153, 255), "Metall": (81, 105, 127, 255),
          "Holz": (174, 112, 52, 255), "Stahlseil": (57, 73, 87, 255)}


def reinforcement(bars):
    groups = defaultdict(list)
    for bar in bars:
        if bar["gruppe"] != "Beton":
            continue
        a, b = bar["start"], bar["end"]
        axis = int(abs(b[1] - a[1]) > abs(b[0] - a[0]))
        groups[axis, a[1 - axis]].extend([a, b])

    # Plan grid D/F coincides with RFEM X=10/13; rows 3/5/7 coincide
    # with Y=-10/-5/0. Heights follow the section axes of the RFEM solids.
    for (axis, coordinate), nodes in sorted(groups.items()):
        nodes.sort(key=lambda p: p[axis])
        start, end = nodes[0], nodes[-1]
        span = dist(start, end)
        section = "A–A" if axis == 0 else "B–B"
        strip = f"{'Y' if axis == 0 else 'X'} = {coordinate:g} m"
        direction = [(b - a) / span for a, b in zip(start, end)]
        bearing = atan2(direction[1], direction[0])
        side = (-sin(bearing), cos(bearing), 0)
        rise = direction[2]
        up = (-rise * cos(bearing), -rise * sin(bearing), sqrt(1 - rise**2))
        stock_id, pieces = ("2", 2) if axis == 0 else ("4", 3)
        stock = POSITIONS[stock_id]["length"]
        length = stock * pieces - (pieces - 1)  # 1.00 m overlaps per section
        offset = (span - length) / 2

        def point(station, lateral, vertical):
            return [round(a + (station + offset)*d + lateral*s + vertical*u, 5)
                    for a, d, s, u in zip(start, direction, side, up)]

        def bar(position, points, origin=section):
            return {"position": position, "strip": strip, "source": origin,
                    "points": points}

        # 42 cm outside width, 10 mm diameter, 4 cm concrete cover.
        half = .205
        corners = [(-half, -half + .15), (-half, -half), (half, -half), (half, half), (-half, half),
                   (-half, -half), (-half + .15, -half)]

        def stirrup(station, origin=section, cross_offset=None):
            if cross_offset is None:
                points = [point(station, lateral, z) for lateral, z in corners]
            else:
                points = [point(station + lateral, cross_offset, z) for lateral, z in corners]
            return bar("1", points, origin)

        if axis == 0:
            for i in range(51):
                yield stirrup((length - 10) / 2 + .20*i)
            crossings = [(x - start[0])/direction[0] - offset for x in (10, 13)]
            for station in (.23, *crossings, length - .23):
                for shift in (-.15, -.05, .05, .15):
                    yield stirrup(station + shift, "Detail 1")
                    yield stirrup(station, "Detail 1", shift)
        else:
            for center in (length / 4, 3 * length / 4):
                for i in range(-11, 12):
                    yield stirrup(center + i * .20)

        lanes = [(lateral, z) for z in (-.194, .194)
                 for lateral in (-.194, -.065, .065, .194)]
        lanes += [(-.194, 0), (.194, 0)]
        for i in range(pieces):
            station = i * (stock - 1)
            for lateral, z in lanes:
                yield bar(stock_id, [point(station, lateral, z),
                                     point(station + stock, lateral, z)])
        for end_station, inward in ((0, 1), (length, length - 1)):
            for lateral in (-.194, -.065, .065, .194):
                yield bar("3", [point(inward, lateral, -.195),
                                point(end_station, lateral, -.195),
                                point(end_station, lateral, .195),
                                point(inward, lateral, .195)])


def add_rebar_mesh(model, item, layer, material):
    mesh = rhino.Mesh()
    sides = 10
    radius = POSITIONS[item["position"]]["diameter"] / 2000
    points = [rhino.Point3d(*p) for p in item["points"]]
    for a, b in zip(points, points[1:]):
        plane = rhino.Plane(a, rhino.Vector3d(b.X-a.X, b.Y-a.Y, b.Z-a.Z))
        offset = len(mesh.Vertices)
        for center in (a, b):
            for i in range(sides):
                angle = 2*pi*i/sides
                x, y = radius*cos(angle), radius*sin(angle)
                u, v = plane.XAxis, plane.YAxis
                mesh.Vertices.Add(center.X+x*u.X+y*v.X,
                                  center.Y+x*u.Y+y*v.Y,
                                  center.Z+x*u.Z+y*v.Z)
        for i in range(sides):
            j = (i+1) % sides
            mesh.Faces.AddFace(offset+i, offset+j, offset+sides+j, offset+sides+i)
        for i in range(1, sides-1):
            mesh.Faces.AddFace(offset, offset+i+1, offset+i)
            mesh.Faces.AddFace(offset+sides, offset+sides+i, offset+sides+i+1)
    mesh.Normals.ComputeNormals()
    mesh.Compact()
    assert mesh.IsValid
    attrs = rhino.ObjectAttributes()
    attrs.LayerIndex = layer
    attrs.MaterialIndex = material
    attrs.MaterialSource = rhino.ObjectMaterialSource.MaterialFromObject
    attrs.Name = item["id"]
    for name, value in {"Plan": "BG_5_BP_FU_XX_001_P-01", "Position": item["position"],
                        "Fundamentstreifen": item["strip"], "Planbezug": item["source"]}.items():
        attrs.SetUserString(name, value)
    model.Objects.AddMesh(mesh, attrs)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("model", type=Path)
    parser.add_argument("plan", type=Path)
    parser.add_argument("--static", type=Path, default=Path("webapp/static"))
    parser.add_argument("--rhino-out", type=Path, default=Path("Stockerau-Bewehrung.3dm"))
    args = parser.parse_args()
    model = rhino.File3dm.Read(str(args.model))
    assert model is not None and model.Settings.ModelUnitSystem == rhino.UnitSystem.Meters
    bars = json.loads((args.static / "data.json").read_bytes())["bars"]
    elements = list(reinforcement(bars))
    counts = Counter()
    for item in elements:
        p = item["position"]
        counts[p] += 1
        item["id"] = f"P{p}-{counts[p]:03}"
    assert counts == {p: spec["count"] for p, spec in POSITIONS.items()}

    materials = {}
    for key, color in {**COLORS, "Betonstahl": (108, 39, 67, 255)}.items():
        material = rhino.Material()
        material.Name = key
        material.DiffuseColor = color
        materials[key] = model.Materials.Add(material)
    by_id = {str(b["beam_id"]): b for b in bars}
    for obj in model.Objects:
        attrs = obj.Attributes
        beam = attrs.GetUserString("BG_RFEM_Exchange_BeamId_bg0246")
        if beam in by_id:
            attrs.MaterialIndex = materials[by_id[beam]["material_etappe03"]]
            attrs.MaterialSource = rhino.ObjectMaterialSource.MaterialFromObject

    layers = {}
    for p in POSITIONS:
        layer = rhino.Layer()
        layer.Name = f"Bewehrung P-01 - Position {p}"
        layer.Color = (108, 39, 67, 255)
        layers[p] = model.Layers.Add(layer)
    for item in elements:
        add_rebar_mesh(model, item, layers[item["position"]], materials["Betonstahl"])
    assert model.Write(str(args.rhino_out), 7)
    reopened = rhino.File3dm.Read(str(args.rhino_out))
    assert Counter(o.Attributes.GetUserString("Position") for o in reopened.Objects
                   if o.Attributes.GetUserString("Plan") == "BG_5_BP_FU_XX_001_P-01") == counts

    with pymupdf.open(args.plan) as pdf:
        page = pdf[0]
        for p, spec in POSITIONS.items():
            page.get_pixmap(matrix=pymupdf.Matrix(2.2, 2.2),
                            clip=pymupdf.Rect(spec["crop"])).save(args.static / f"position-{p}.png")
    records = {p: {k: v for k, v in spec.items() if k != "crop"} for p, spec in POSITIONS.items()}
    payload = {"plan": "BG_5_BP_FU_XX_001_P-01", "mass": 1015.63,
               "positions": records, "elements": elements}
    (args.static / "bewehrung.json").write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print("Verified Rhino meshes:", dict(counts))


if __name__ == "__main__":
    main()


