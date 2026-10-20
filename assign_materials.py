"""Materialzuweisung im Rhino-Modell (via rhino3dm) und Speichern.

Zuordnung laut Vorgabe:
  Rundrohr RO 139.7x8.0        -> Stahl
  Flachstäbe (Flat Bar *)      -> Holz
  Zugstäbe RD 12 (Dach)        -> Stahlseil
  Rechteck-Stäbe 500/500       -> Stahlbeton
"""
import os

import rhino3dm

SRC = r"Data\RH7 Stockerau Rhino Export from RFEM.3dm"
OUT_DIR = r"Abgabe_23.10"
OUT = os.path.join(OUT_DIR, "RH7 Stockerau - Materialien zugewiesen.3dm")

# --- Materialdefinitionen: Name -> (R, G, B, Shine) ---
MATERIALS = {
    "Stahl":       (168, 170, 175, 0.6),
    "Holz":        (156, 104,  52, 0.3),
    "Stahlseil":   ( 72,  78,  84, 0.7),
    "Stahlbeton":  (196, 196, 190, 0.1),
}

def make_color(r, g, b):
    return (r, g, b, 255)  # rhino3dm: Color als (R, G, B, A)-Tupel

def section_key(layer_path):
    sec = layer_path.split("::")[-1]
    if sec.startswith("RO 139"):
        return "Rundrohr"
    if sec.startswith("Flat Bar"):
        return "Flachstab"
    if sec.startswith("RD 12"):
        return "Zugstab_RD12"
    if sec.startswith("Rectangle"):
        return "Rechteck"
    return None

# Zuordnung Kategorie -> Materialname
CAT_TO_MAT = {
    "Rundrohr":   "Stahl",
    "Flachstab":  "Holz",
    "Zugstab_RD12": "Stahlseil",
    "Rechteck":   "Stahlbeton",
}

model = rhino3dm.File3dm.Read(SRC)
print(f"Geladen: {SRC}")
print(f"Objekte: {len(model.Objects)}, Layer: {len(model.Layers)}, Materialien: {len(model.Materials)}")

# --- bestehende Materialien auflisten ---
print("\nBestehende Materialien im Modell:")
for i, m in enumerate(model.Materials):
    print(f"  [{i}] {m.Name}")

# --- Materialien anlegen (oder vorhandene wiederverwenden) ---
mat_index = {}
for name, (r, g, b, shine) in MATERIALS.items():
    existing = next((i for i in range(len(model.Materials))
                     if model.Materials[i].Name.strip().lower() == name.lower()), None)
    if existing is not None:
        mat_index[name] = existing
        print(f"Material '{name}' bereits vorhanden -> Index {existing} (wird überschrieben)")
    else:
        mat = rhino3dm.Material()
        mat.Name = name
        mat.DiffuseColor = make_color(r, g, b)
        mat.SpecularColor = make_color(255, 255, 255)
        mat.Shine = shine
        idx = model.Materials.Add(mat)
        mat_index[name] = idx
        print(f"Material '{name}' angelegt -> Index {idx} (RGB {r},{g},{b})")

# --- Materialien OBJEKTWEISE zuweisen (rhino3dm unterstützt keine Layer-Materials) ---
assigned = {}   # material name -> Anzahl Objekte
layer_seen = {}  # material name -> set of layer names
for o in model.Objects:
    layer = model.Layers[o.Attributes.LayerIndex]
    cat = section_key(layer.FullPath)
    if not cat:
        continue
    if "RFEM_Export_260915" not in layer.FullPath:
        continue
    mat_name = CAT_TO_MAT[cat]
    o.Attributes.MaterialIndex = mat_index[mat_name]
    o.Attributes.MaterialSource = rhino3dm.ObjectMaterialSource.MaterialFromObject
    assigned[mat_name] = assigned.get(mat_name, 0) + 1
    layer_seen.setdefault(mat_name, set()).add(layer.FullPath)

print("\nZuweisung zusammengefasst (objektweise):")
for mat_name, cnt in assigned.items():
    print(f"  {mat_name:<12}: {cnt:>4} Objekte auf {len(layer_seen[mat_name])} Layern")

# --- Objekt-Zählung pro Material (zur Kontrolle) ---
counts = {}
for o in model.Objects:
    layer = model.Layers[o.Attributes.LayerIndex]
    cat = section_key(layer.FullPath)
    if cat and "RFEM_Export_260915" in layer.FullPath:
        mn = CAT_TO_MAT[cat]
        counts[mn] = counts.get(mn, 0) + 1
print("\nObjekte pro Material (Achsen + Solids):")
for mn, c in counts.items():
    print(f"  {mn:<12}: {c} Objekte")

os.makedirs(OUT_DIR, exist_ok=True)
ok = model.Write(OUT, 7)
print(f"\nGespeichert: {OUT}  (ok={ok})")
print(f"Dateigröße: {os.path.getsize(OUT)/1e6:.2f} MB")
