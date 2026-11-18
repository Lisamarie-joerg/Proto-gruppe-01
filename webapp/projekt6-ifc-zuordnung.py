"""Attach Rhino IFC identifiers and storeys to GLB reinforcement hosts."""
import html
import json
from pathlib import Path
import re

assets=Path(__file__).parent/"static"
metadata=json.loads((assets/"projekt6-ifc.json").read_text(encoding="utf-8"))

def decode(value):
    if isinstance(value,str): return html.unescape(value)
    if isinstance(value,list): return [decode(item) for item in value]
    if isinstance(value,dict): return {html.unescape(key):decode(item) for key,item in value.items()}
    return value
metadata=decode(metadata)
# Save only the source filename in the distributable metadata.
metadata["source"]="Bauteil6.3dm"
(assets/"projekt6-ifc.json").write_text(json.dumps(metadata,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
plan_path=assets/"bauteil6-bewehrung.json"
plan=json.loads(plan_path.read_text(encoding="utf-8"))
objects=metadata["objects"]
matched=0
for host in plan["hosts"]:
    def distance(item):
        return max(abs(a-b) for pa,pb in zip(host["bounds"],item["bounds"]) for a,b in zip(pa,pb))
    candidates=[obj for obj in objects if distance(obj)<.001]
    if len(candidates)==1:
        obj=candidates[0]
    else:
        same=[obj for obj in candidates if obj["name"]==host["name"]]
        obj=same[0] if len(same)==1 else None
    if obj:
        host["ifc"]=obj["ifc"]
        host["rhinoId"]=obj["id"]
        host["storey"]=obj["ifc"].get("IfcStorey","")
        host["rhinoName"]=obj["name"]
        matched+=1
    else:
        host["storey"]=""
    material=host.get("ifc",{}).get("Material","").lower()
    masonry="mauerwerk" in material or ":mw," in material or ":hw_" in material
    host["reinforcementExpected"]=not masonry
    if masonry:
        host["category"]="Mauerwerk"
        host["count"]=0
        host["status"]="Mauerwerk laut Rhino-Material; keine Ergänzungsstäbe erzeugt"
excluded={host["id"] for host in plan["hosts"] if not host["reinforcementExpected"]}
plan["elements"]=[item for item in plan["elements"] if not item.get("schematic") or item["host"] not in excluded]
active={item["position"] for item in plan["elements"]}
plan["positions"]={key:value for key,value in plan["positions"].items() if key in active}
plan_path.write_text(json.dumps(plan,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
print("Rhino/GLB matched",matched,"of",len(plan["hosts"]))
from collections import Counter
print(Counter(h.get("ifc",{}).get("Material","") for h in plan["hosts"]))
print("Unmatched",[(h["id"],h["name"]) for h in plan["hosts"] if "ifc" not in h])
import csv
with (assets/"projekt6-bauteile.csv").open("w",encoding="utf-8-sig",newline="") as handle:
    writer=csv.writer(handle,delimiter=";")
    writer.writerow(["GLB-Mesh","Bauteil","Gruppe","Geschoss","IFC-GlobalId","Material","Schematische Abschnitte","Status"])
    for host in plan["hosts"]:
        writer.writerow([host["id"],host["name"],host["category"],host.get("storey",""),
                         host.get("ifc",{}).get("GlobalId",""),host.get("ifc",{}).get("Material",""),
                         host["count"],host["status"]])
print("Final",len(plan["elements"]),"bars;",sum(bool(h["count"]) for h in plan["hosts"]),"hosts with bars;",
      len(excluded),"masonry hosts excluded")

