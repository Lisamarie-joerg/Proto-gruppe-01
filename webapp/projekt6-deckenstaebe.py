"""Reconstruct the straight lower-layer group 2448/9 for the E02 viewer."""
import hashlib
import json
from pathlib import Path
import struct
import sys

MODEL_HASH = "d7576f41e671a6d75ddc6fa0595425d7d92df09b2be869d9bb0d3104e7cd25fc"
SLAB = "Floor:STB, d=25:1936245"
COVER = 0.025
DIAMETER = 0.014


def floor_triangles(file_bytes):
    assert hashlib.sha256(file_bytes).hexdigest() == MODEL_HASH, "Unexpected GLB export"
    json_size = struct.unpack_from("<I", file_bytes, 12)[0]
    gltf = json.loads(file_bytes[20:20 + json_size])
    binary_start = 28 + json_size
    node = next(node for node in gltf["nodes"] if node.get("name") == SLAB)
    assert not (node.keys() & {"matrix", "translation", "rotation", "scale"})
    primitive = gltf["meshes"][node["mesh"]]["primitives"][0]

    def read(index, format_string):
        accessor = gltf["accessors"][index]
        view = gltf["bufferViews"][accessor["bufferView"]]
        offset = binary_start + view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
        stride = view.get("byteStride", struct.calcsize(format_string))
        return [struct.unpack_from(format_string, file_bytes, offset + i * stride)
                for i in range(accessor["count"])]

    points = [(x, -z, y) for x, y, z in read(primitive["attributes"]["POSITION"], "<fff")]
    index_formats = {5121: "<B", 5123: "<H", 5125: "<I"}
    indices = [value for value, in read(
        primitive["indices"], index_formats[gltf["accessors"][primitive["indices"]]["componentType"]]
    )]
    elevation = min(point[2] for point in points)
    triangles = []
    for start in range(0, len(indices), 3):
        triangle = [points[idx] for idx in indices[start:start + 3]]
        if all(abs(z - elevation) < 1e-5 for _, _, z in triangle):
            triangles.append([(x, y) for x, y, _ in triangle])
    assert triangles and abs(elevation - 12.02) < 1e-5
    return triangles, elevation


def spans_at_x(triangles, x):
    intervals = []
    for triangle in triangles:
        cuts = []
        for (x1, y1), (x2, y2) in zip(triangle, triangle[1:] + triangle[:1]):
            if x1 != x2 and min(x1, x2) <= x <= max(x1, x2):
                cuts.append(y1 + (y2 - y1) * (x - x1) / (x2 - x1))
        if cuts:
            intervals.append((min(cuts), max(cuts)))
    merged = []
    for start, end in sorted(intervals):
        if merged and start <= merged[-1][1] + 1e-5:
            merged[-1] = (merged[-1][0], max(end, merged[-1][1]))
        else:
            merged.append((start, end))
    return merged


def append_deck_bars(dataset, triangles, lower_face):
    position = "2448 / 9"
    dataset["elements"] = [bar for bar in dataset["elements"] if bar["position"] != position]
    dataset["scope"] = ("E02 · angenäherte untere Deckenbewehrung aus Blatt 2448. "
                        "Die Positionsliste zeigt die Sollmengen aller vier Blätter und die vorhandene 3D-Geometrie.")
    dataset["positions"][position] = {
        "diameter": 14, "page": 1, "sheet": "2448",
        "detail": "Untere Deckenlage E02 · Ø14 / 20 cm · 14,00 m. Geradlinig angenähert; "
                  "Fächerung und Sonderlagen an Öffnungen sind noch offen."
    }
    inset = COVER + DIAMETER / 2
    lower = -101.735
    upper = lower + 14
    # Lower layer 1 is transverse to the previously modeled 12 mm layer 2.
    center_z = round(lower_face + inset, 4)
    for row in range(92):
        x = round(26.73 + row * 0.2, 4)
        # The whole unbroken length, including an allowance at the slab boundary,
        # must fit. Rows crossing an opening remain unresolved rather than shortened.
        if not all(any(lo <= lower - inset and hi >= upper + inset
                       for lo, hi in spans_at_x(triangles, test_x))
                   for test_x in (x - inset, x, x + inset)):
            continue
        dataset["elements"].append({
            "id": f"2448-P9-{row + 1}", "position": position,
            "points": [[x, lower, center_z], [x, upper, center_z]],
        })
    # Raise the transverse crossing groups above layer 1, preserving their plan lengths.
    for bar in dataset["elements"]:
        if bar["position"] in {"2448 / 1", "2448 / 2"}:
            for point in bar["points"]:
                point[2] = round(center_z + (DIAMETER + 0.012) / 2, 4)
    return sum(bar["position"] == position for bar in dataset["elements"])


if __name__ == "__main__":
    glb, output = map(Path, sys.argv[1:])
    plan = json.loads(output.read_text(encoding="utf-8"))
    geometry, elevation = floor_triangles(glb.read_bytes())
    inserted = append_deck_bars(plan, geometry, elevation)
    assert 0 < inserted <= 92
    output.write_text(json.dumps(plan, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"2448 / 9: {inserted} of 92 included after slab opening check")

