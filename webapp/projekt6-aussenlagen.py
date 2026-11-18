"""Retain the two exterior reinforcement layers from the generated volume grid."""
import json
from pathlib import Path
import sys
from importlib.machinery import SourceFileLoader
module=SourceFileLoader("building",str(Path(__file__).with_name("projekt6-gebaeude.py"))).load_module()
data_path=Path(sys.argv[2])
data=json.loads(data_path.read_text(encoding="utf-8"))
bounds={}
for host,_,category,points,_ in module.mesh_data(Path(sys.argv[1])):
    lo=[min(p[i] for p in points) for i in range(3)]
    hi=[max(p[i] for p in points) for i in range(3)]
    bounds[host]=(lo,hi,category)
kept=[]
for item in data["elements"]:
    if not item.get("schematic"):
        kept.append(item)
        continue
    lo,hi,category=bounds[item["host"]]
    thin=min(range(3),key=lambda i:hi[i]-lo[i])
    a,b=item["points"]
    axis=max(range(3),key=lambda i:abs(b[i]-a[i]))
    if category in ["Wände","Decken und Fundamente"] and axis==thin:
        continue
    if axis!=thin and min(abs(a[thin]-lo[thin]),abs(hi[thin]-a[thin]))>.065:
        continue
    kept.append(item)
data["elements"]=kept
positions={key:value for key,value in data["positions"].items() if not value.get("schematic")}
for item in kept:
    if not item.get("schematic"): continue
    length=round(sum((a-b)**2 for a,b in zip(*item["points"]))**0.5,3)
    direction="XYZ"[max(range(3),key=lambda axis:abs(item["points"][1][axis]-item["points"][0][axis]))]
    key="Ergänzung / "+item["host"]+" / "+direction+" / Ø12 / "+format(length,".3f")+" m"
    item["position"]=key
    positions[key]={"diameter":12,"schematic":True,
                    "detail":"Geometrische Ergänzung · Bauteil "+item["host"]+" · Richtung "+direction+
                             " · gerade Ø12 · "+format(length,".3f")+" m · Planzuordnung offen."}
data["positions"]=positions
active={item["position"] for item in kept}
data["positions"]={key:value for key,value in data["positions"].items() if key in active}
from collections import Counter
counts=Counter(item.get("host") for item in kept)
for host in data["hosts"]:
    host["count"]=counts[host["id"]]
    host["status"]="geometrische Ergänzung" if host["count"] else "Geometrie offen"
data_path.write_text(json.dumps(data,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
print(len(kept),Counter(item.get("category","Plan") for item in kept))
print("hosts",len(data["hosts"]),"with bars",sum(bool(h["count"]) for h in data["hosts"]))

