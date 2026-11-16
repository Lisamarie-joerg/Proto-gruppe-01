"""Build the Rhino reinforcement model and matching viewer geometry from plan P-01."""
import argparse
from collections import Counter, defaultdict
from math import atan2, ceil, cos, dist, pi, sin, sqrt
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
COVER = .04
FIT_MARGIN = .002
LAP = 1.06
MAX_LENGTH = 7.5
SECTION_WIDTH = .50

COLORS = {"Beton": (163, 164, 153, 255), "Metall": (81, 105, 127, 255),
          "Holz": (174, 112, 52, 255), "Stahlseil": (57, 73, 87, 255)}


def reinforcement(bars, foundations):
    groups = defaultdict(list)
    for bar in bars:
        if bar["gruppe"] != "Beton":
            continue
        a, b = bar["start"], bar["end"]
        axis = int(abs(b[1] - a[1]) > abs(b[0] - a[0]))
        groups[axis, a[1 - axis]].extend([a, b])

    supports = sorted(b["start"][:2] for b in bars if b["material_etappe03"] == "Metall")
    # Plan grid D/F coincides with RFEM X=10/13; rows 3/5/7 coincide
    # with Y=-10/-5/0. Heights follow the section axes of the RFEM solids.
    for (axis, coordinate), nodes in sorted(groups.items()):
        nodes.sort(key=lambda p: p[axis])
        start, end = nodes[0], nodes[-1]
        # Measured at the outer concrete faces in PDF sections A-A/B-B.
        # Dimensions refer to the outer support axes in the RFEM model.
        extensions = (.48, .54) if axis == 0 else (.25, .25)
        slope = [(b-a)/(end[axis]-start[axis]) for a,b in zip(start,end)]
        start = [a - extensions[0]*v for a,v in zip(start,slope)]
        end = [a + extensions[1]*v for a,v in zip(end,slope)]
        span = dist(start, end)
        section = "A–A" if axis == 0 else "B–B"
        strip = f"{'Y' if axis == 0 else 'X'} = {coordinate:g} m"
        direction = [(b - a) / span for a, b in zip(start, end)]
        bearing = atan2(direction[1], direction[0])
        side = (-sin(bearing), cos(bearing), 0)
        rise = direction[2]
        up = (-rise * cos(bearing), -rise * sin(bearing), sqrt(1 - rise**2))
        foundations.append({"strip": strip, "start": start, "end": end,
                            "direction": direction, "side": side, "up": up,
                            "width": SECTION_WIDTH, "height": SECTION_WIDTH,
                            "length": span, "extensions": extensions})
        stock_id = "2" if axis == 0 else "4"
        offset = COVER + FIT_MARGIN + .006
        length = span - 2 * offset
        # A-A: one drawn splice just east of axis E. B-B: two between
        # axes 4/5 and 5/6. These X/Y coordinates come from the section
        # drawing, registered to D/F and 3/5/7 in the RFEM model.
        splice_axes = (11.55,) if axis == 0 else (-6.54, -3.41)
        splices = [(station - start[axis]) / direction[axis] - offset
                   for station in splice_axes]

        def point(station, lateral, vertical):
            return [round(a + (station + offset)*d + lateral*s + vertical*u, 5)
                    for a, d, s, u in zip(start, direction, side, up)]

        def bar(position, points, origin=section):
            cut = sum(dist(a, b) for a, b in zip(points, points[1:]))
            radius = POSITIONS[position]["diameter"] / 2000
            limits = [SECTION_WIDTH / 2 - COVER - radius] * 2
            for vertex in points:
                relative = [x - a for x, a in zip(vertex, start)]
                station, lateral, height = [sum(x*v for x,v in zip(relative, vector))
                                            for vector in (direction, side, up)]
                assert COVER + radius - 1e-5 <= station <= span - COVER - radius + 1e-5
                assert all(abs(value) <= limit + 1e-5
                           for value, limit in zip((lateral, height), limits))
            assert cut <= MAX_LENGTH
            return {"position": position, "strip": strip, "source": origin,
                    "points": points, "length": round(cut, 4),
                    "group": f"{position}:{cut:.2f}"}

        # Clear cover is measured to the steel surface, not the centerline.
        half = SECTION_WIDTH / 2 - COVER - .005 - FIT_MARGIN
        corners = [(-half, -half + .15), (-half, -half), (half, -half), (half, half), (-half, half),
                   (-half, -half), (-half + .15, -half)]

        def stirrup(station, origin=section, cross_offset=None):
            if cross_offset is None:
                points = [point(station, lateral, z) for lateral, z in corners]
            else:
                points = [point(station + lateral, cross_offset, z) for lateral, z in corners]
            return bar("1", points, origin)

        def stirrup_run(start_station, end_station):
            spacings = ceil((end_station - start_station) / .20)
            return [stirrup(start_station + i*(end_station-start_station)/spacings)
                    for i in range(spacings + 1)]

        if axis == 0:
            yield from stirrup_run(0, length)
            for support_x, support_y in supports:
                if support_y != coordinate:
                    continue
                station = (support_x-start[0])/direction[0] - offset
                for shift in (-.15, -.05, .05, .15):
                    for item in (stirrup(station + shift, "Detail 1"),
                                 stirrup(station, "Detail 1", shift)):
                        item["support"] = [support_x, support_y]
                        yield item
        else:
            yield from stirrup_run(.23, length / 2 - .23)
            yield from stirrup_run(length / 2 + .23, length - .23)

        lanes = [(lateral, z) for z in (-.194, .194)
                 for lateral in (-.194, -.065, .065, .194)]
        lanes += [(-.194, 0), (.194, 0)]
        for lane, (lateral, z) in enumerate(lanes):
            # Stagger neighbouring lanes around the indicated splice station.
            stagger = (-.10, .10)[lane % 2]
            centers = [station + stagger for station in splices]
            starts = [0, *(center - LAP / 2 for center in centers)]
            ends = [*(center + LAP / 2 for center in centers), length]
            for i, (a, b) in enumerate(zip(starts, ends)):
                # Offset alternate pieces within the section to keep the
                # actual solids distinct in the overlapping length.
                shift_z = z * .91 if i % 2 else z
                shift_lateral = lateral * .91 if i % 2 and not z else lateral
                yield bar(stock_id, [point(a, shift_lateral, shift_z),
                                     point(b, shift_lateral, shift_z)])
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
                        "Fundamentstreifen": item["strip"], "Planbezug": item["source"],
                        "Modelllaenge_m": str(item["length"]), "Typgruppe": item["group"]}.items():
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
    foundations = []
    elements = list(reinforcement(bars, foundations))
    cages = defaultdict(list)
    for item in elements:
        if "support" in item:
            cages[tuple(item["support"])].extend(item["points"])
    assert len(cages) == 12
    for support, points in cages.items():
        assert all(abs((min(p[axis] for p in points)+max(p[axis] for p in points))/2
                       - support[axis]) < .0001 for axis in (0, 1))
    counts = Counter()
    for item in elements:
        p = item["position"]
        counts[p] += 1
        item["id"] = f"P{p}-{counts[p]:03}"
    assert set(counts) == set(POSITIONS)

    materials = {}
    for key, color in {**COLORS, "Betonstahl": (108, 39, 67, 255)}.items():
        material = rhino.Material()
        material.Name = key
        material.DiffuseColor = color
        materials[key] = model.Materials.Add(material)
    by_id = {str(b["beam_id"]): b for b in bars}
    old_foundations = []
    for obj in model.Objects:
        attrs = obj.Attributes
        beam = attrs.GetUserString("BG_RFEM_Exchange_BeamId_bg0246")
        if beam in by_id:
            if by_id[beam]["gruppe"] == "Beton" and isinstance(obj.Geometry, (rhino.Brep, rhino.Extrusion, rhino.Mesh)):
                old_foundations.append(attrs.Id)
            attrs.MaterialIndex = materials[by_id[beam]["material_etappe03"]]
            attrs.MaterialSource = rhino.ObjectMaterialSource.MaterialFromObject

    for object_id in old_foundations:
        model.Objects.Delete(object_id)
    foundation_layer = rhino.Layer()
    foundation_layer.Name = "Streifenfundamente nach Plan P-01"
    foundation_layer.Color = COLORS["Beton"]
    layer_index = model.Layers.Add(foundation_layer)
    for strip in foundations:
        half = strip["width"]/2
        box = rhino.Box(rhino.BoundingBox(rhino.Point3d(0,-half,-half),
                                         rhino.Point3d(strip["length"],half,half)))
        plane = rhino.Plane(rhino.Point3d(*strip["start"]),
                            rhino.Vector3d(*strip["direction"]), rhino.Vector3d(*strip["side"]))
        geometry = rhino.Brep.CreateFromBox(box)
        assert geometry.Transform(rhino.Transform.PlaneToPlane(rhino.Plane.WorldXY(), plane))
        assert geometry.IsSolid
        attrs = rhino.ObjectAttributes()
        attrs.Name = strip["strip"]
        attrs.LayerIndex = layer_index
        attrs.MaterialIndex = materials["Beton"]
        attrs.MaterialSource = rhino.ObjectMaterialSource.MaterialFromObject
        model.Objects.AddBrep(geometry,attrs)

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
        for name, rect in {
            "schnitt-a": (235, 1780, 1440, 2290),
            "schnitt-b": (1540, 1780, 2800, 2280),
            "detail-1": (2090, 1360, 2370, 1680),
        }.items():
            page.get_pixmap(matrix=pymupdf.Matrix(1.3, 1.3),
                            clip=pymupdf.Rect(rect)).save(args.static / f"{name}.png")
    records = {p: {k: v for k, v in spec.items() if k != "crop"} for p, spec in POSITIONS.items()}
    for position, record in records.items():
        record["modelCount"] = counts[position]
        record["modelMass"] = round(sum(
            item["length"] * 7850 * pi * (record["diameter"] / 2000)**2
            for item in elements if item["position"] == position), 2)
    payload = {"plan": "BG_5_BP_FU_XX_001_P-01", "mass": 1015.63,
               "modelMass": round(sum(record["modelMass"] for record in records.values()), 2),
               "cover": COVER, "lap": LAP, "maxLength": MAX_LENGTH,
               "grid": {"x": [["B",7],["C",8.07],["D",10],["E",11.5],["F",13],["G",14.93],["H",16]],
                        "y": [["3",-10],["4",-7.5],["5",-5],["6",-2.5],["7",0]]},
               "positions": records, "elements": elements, "foundations": foundations}
    (args.static / "bewehrung.json").write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print("Verified Rhino meshes:", dict(counts))


if __name__ == "__main__":
    main()


