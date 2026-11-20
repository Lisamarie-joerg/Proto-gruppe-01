# -*- coding: utf-8 -*-
"""Run in Rhino to write the Projekt 6 reinforcement import file."""
import json
import os
from collections import Counter
import Rhino
from System import Guid
from System.Drawing import Color

assets = os.path.join(os.path.dirname(__file__), "static")
source = os.path.join(assets, "bauteil6-bewehrung.json")
target = os.path.join(assets, "Bauteil6-Bewehrung-Import.3dm")
with open(source) as handle:
    data = json.load(handle)
model = Rhino.FileIO.File3dm()
model.Settings.ModelUnitSystem = Rhino.UnitSystem.Millimeters

def layer(name, parent=None):
    item = Rhino.DocObjects.Layer()
    item.Id = Guid.NewGuid()
    item.Name = name
    item.Color = Color.FromArgb(148, 33, 90)
    if parent is not None:
        item.ParentLayerId = parent.Id
    model.Layers.Add(item)
    return next(saved for saved in model.Layers if saved.Id == item.Id)

root = layer("E02 Bewehrung - Teilmodell")
sheets = {}
positions = {}
for position, attrs in sorted(data["positions"].items()):
    sheet, number = position.split(" / ")
    if sheet not in sheets:
        sheets[sheet] = layer(sheet, root)
    positions[position] = layer("Position " + number, sheets[sheet])

for bar in data["elements"]:
    start, end = [Rhino.Geometry.Point3d(*(coord * 1000 for coord in point))
                  for point in bar["points"]]
    vector = end - start
    geom = Rhino.Geometry.Cylinder(
        Rhino.Geometry.Circle(Rhino.Geometry.Plane(start, vector),
                              data["positions"][bar["position"]]["diameter"] / 2.0),
        vector.Length).ToBrep(True, True)
    assert geom.IsSolid and geom.IsValid
    attributes = Rhino.DocObjects.ObjectAttributes()
    attributes.LayerIndex = positions[bar["position"]].Index
    attributes.Name = bar["id"]
    attributes.SetUserString("Planposition", bar["position"])
    attributes.SetUserString("Einbaulage", "Angenaeherte Rekonstruktion")
    model.Objects.AddBrep(geom, attributes)
assert model.Write(target, 7)
check = Rhino.FileIO.File3dm.Read(target)
assert check.Settings.ModelUnitSystem == Rhino.UnitSystem.Millimeters
counts = Counter(obj.Attributes.GetUserString("Planposition") for obj in check.Objects)
assert counts == Counter(bar["position"] for bar in data["elements"])
assert all(obj.Geometry.IsSolid and obj.Geometry.IsValid for obj in check.Objects)
print("Verified Rhino export: " + str(dict(counts)))

