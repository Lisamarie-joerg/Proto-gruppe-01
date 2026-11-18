# -*- coding: utf-8 -*-
"""Read IFC metadata from the active Bauteil6 document without changing objects."""
import json
import os
import Rhino
import scriptcontext as sc
import traceback

def as_text(value):
    if isinstance(value, str):
        try:
            return value.decode("utf-8")
        except UnicodeError:
            return value.decode("cp1252")
    return unicode(value)

def ascii_safe(value):
    if isinstance(value, basestring):
        return as_text(value).encode("ascii","xmlcharrefreplace")
    if isinstance(value, dict):
        result={}
        for key,item in value.items():
            result[ascii_safe(key)]=ascii_safe(item)
        return result
    if isinstance(value, list):
        return [ascii_safe(item) for item in value]
    return value

try:
    assert sc.doc.Name.lower()=="bauteil6.3dm"
    rows=[]
    for obj in sc.doc.Objects:
        attrs=obj.Attributes
        values=attrs.GetUserStrings()
        keys=[as_text(key) for key in values.AllKeys] if values else []
        data={}
        for key in keys:
            text=key.lower()
            if (key in ["IfcClass","GlobalId","IfcStorey","IfcStoreyElevation","Material","MaterialLayers"]
                or "rebar" in text or "bewehr" in text or "cover" in text or "betonguete" in text):
                data[key]=as_text(values[key])
        box=obj.Geometry.GetBoundingBox(True)
        row={"id":str(obj.Id),"name":as_text(attrs.Name),
             "layer":as_text(sc.doc.Layers[attrs.LayerIndex].FullPath),
             "bounds":[[box.Min.X/1000,box.Min.Y/1000,box.Min.Z/1000],
                       [box.Max.X/1000,box.Max.Y/1000,box.Max.Z/1000]],
             "ifc":data}
        rows.append(row)
    target=os.path.join(os.path.dirname(__file__),"static","projekt6-ifc.json")
    with open(target,"w") as handle:
        json.dump(ascii_safe({"source":as_text(sc.doc.Path),"units":"meters","objects":rows}),handle,
                  ensure_ascii=True,encoding="cp1252")
    print("IFC metadata exported: "+str(len(rows)))
except Exception as error:
    with open(os.path.join(os.path.dirname(__file__),"ifc-error.txt"),"w") as handle:
        handle.write(traceback.format_exc())
    print(str(error))

