"""Generate a mesh-bound illustrative reinforcement grid for the building.
The generated groups carry no PDF position numbers and are explicitly schematic.
"""
import json
import math
from pathlib import Path
import struct
import sys
from collections import Counter

COVER = 0.04
RADIUS = 0.006
SPACING = 0.20

def mesh_data(path):
    data = path.read_bytes()
    size = struct.unpack_from("<I", data, 12)[0]
    gltf = json.loads(data[20:20+size])
    offset = 28+size
    def read(index, fmt):
        a = gltf["accessors"][index]
        v = gltf["bufferViews"][a["bufferView"]]
        start = offset+v.get("byteOffset",0)+a.get("byteOffset",0)
        stride = v.get("byteStride", struct.calcsize(fmt))
        return [struct.unpack_from(fmt,data,start+i*stride) for i in range(a["count"])]
    for node in gltf["nodes"]:
        name = node.get("name","")
        if any(word in name.lower() for word in ["mwk","mauer","hea","heb","he-a","he-b","u-profile","ipe"]):
            continue
        if not any(word in name.lower() for word in ["stb","slab","wall","wand","wände","decken","stützen","trepp","mg_th","mg3_t","ramp"]):
            continue
        primitive = gltf["meshes"][node["mesh"]]["primitives"][0]
        if primitive.get("mode",4)!=4: continue
        points = [(x,-z,y) for x,y,z in read(primitive["attributes"]["POSITION"],"<fff")]
        accessor = gltf["accessors"][primitive["indices"]]
        idx=[x for x, in read(primitive["indices"],{5121:"<B",5123:"<H",5125:"<I"}[accessor["componentType"]])]
        triangles = [[points[j] for j in idx[i:i+3]] for i in range(0,len(idx),3)]
        category = ("Treppen" if any(k in name.lower() for k in ["trepp","mg_th","mg3_t","ramp"])
                    else "Stützen" if "sco_" in name.lower() or "stützen" in name.lower()
                    else "Träger" if "sfr_" in name.lower() or "slab edge" in name.lower()
                    else "Decken und Fundamente" if any(k in name.lower() for k in ["slab","floor","decken"])
                    else "Wände")
        yield str(node["mesh"]),name,category,points,triangles

def intervals(triangles,axis,u,v):
    transverse = [i for i in range(3) if i!=axis]
    hits=[]
    for triangle in triangles:
        a,b,c=triangle
        i,j=transverse
        determinant=(b[i]-a[i])*(c[j]-a[j])-(b[j]-a[j])*(c[i]-a[i])
        if abs(determinant)<1e-10: continue
        q=((u-a[i])*(c[j]-a[j])-(v-a[j])*(c[i]-a[i]))/determinant
        s=((b[i]-a[i])*(v-a[j])-(b[j]-a[j])*(u-a[i]))/determinant
        if q>=-1e-8 and s>=-1e-8 and q+s<=1+1e-8:
            hits.append(a[axis]+q*(b[axis]-a[axis])+s*(c[axis]-a[axis]))
    unique=[]
    for hit in sorted(hits):
        if not unique or hit-unique[-1]>1e-5: unique.append(hit)
    # Odd intersections indicate an open or ambiguous mesh slice.
    if len(unique)%2: return []
    return list(zip(unique[::2],unique[1::2]))

def coordinates(lo,hi):
    inset=COVER+RADIUS
    lo+=inset
    hi-=inset
    if hi<lo: return []
    if hi-lo<.02: return [(hi+lo)/2]
    count=max(1,math.ceil((hi-lo)/SPACING))
    return [lo+(hi-lo)*i/count for i in range(count+1)]

def run(model,output):
    plan=json.loads(output.read_text(encoding="utf-8"))
    plan["elements"]=[e for e in plan["elements"] if not e.get("schematic")]
    plan["positions"]={k:v for k,v in plan["positions"].items() if not v.get("schematic")}
    plan["hosts"]=[]
    for host,name,category,points,triangles in mesh_data(model):
        minimum=[min(p[i] for p in points) for i in range(3)]
        maximum=[max(p[i] for p in points) for i in range(3)]
        group_count=0
        for axis in range(3):
            cross=[i for i in range(3) if i!=axis]
            if maximum[axis]-minimum[axis]<.18: continue
            key="Ergänzung / "+host+" / "+"XYZ"[axis]
            result=[]
            for u in coordinates(minimum[cross[0]],maximum[cross[0]]):
                for v in coordinates(minimum[cross[1]],maximum[cross[1]]):
                    for lo,hi in intervals(triangles,axis,u,v):
                        lo+=COVER+RADIUS
                        hi-=COVER+RADIUS
                        if hi-lo<.15: continue
                        # Inset the entire sampled bar against the other two surfaces.
                        valid=True
                        for t in range(max(2,math.ceil((hi-lo)/.10))+1):
                            p=[0.,0.,0.]
                            p[axis]=lo+(hi-lo)*t/max(2,math.ceil((hi-lo)/.10))
                            p[cross[0]],p[cross[1]]=u,v
                            for cut in cross:
                                other=[k for k in range(3) if k!=cut]
                                if not any(a+COVER+RADIUS-1e-5<=p[cut]<=b-COVER-RADIUS+1e-5
                                           for a,b in intervals(triangles,cut,p[other[0]],p[other[1]])):
                                    valid=False
                                    break
                            if not valid: break
                        if not valid: continue
                        start=lo
                        while start<hi-.001:
                            end=min(start+7.5,hi)
                            a=[0.,0.,0.];b=[0.,0.,0.]
                            a[axis],b[axis]=start,end
                            for k,value in zip(cross,[u,v]): a[k]=b[k]=value
                            result.append({"id":key+"-"+str(len(result)+1),"position":key,
                                           "points":[[round(x,5) for x in a],[round(x,5) for x in b]],
                                           "schematic":True,"host":host,"category":category})
                            if end==hi: break
                            start=end-1.06
            if result:
                plan["positions"][key]={"diameter":12,"schematic":True,"host":host,"category":category,
                    "detail":name+" · geometrische Ergänzung Ø12 / max. 20 cm; Einbaulage und Bemessung offen."}
                plan["elements"].extend(result)
                group_count+=len(result)
        plan["hosts"].append({"id":host,"name":name,"category":category,"count":group_count,
                              "bounds":[minimum,maximum],
                              "status":"geometrische Ergänzung" if group_count else "Geometrie offen"})
        print(host,category,group_count,flush=True)
    plan["scope"]="E02-Planrekonstruktion und ausdrücklich schematische Ergänzung im gesamten Betontragwerk."
    output.write_text(json.dumps(plan,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
    print("TOTAL",len(plan["elements"]),Counter(e.get("category","Plan") for e in plan["elements"]),flush=True)

if __name__=="__main__":
    run(Path(sys.argv[1]),Path(sys.argv[2]))

