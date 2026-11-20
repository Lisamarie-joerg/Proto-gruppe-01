using System;
using System.Collections.Generic;
using System.Linq;
using Rhino;
using Rhino.DocObjects;
using Rhino.Geometry;

var doc = RhinoDoc.ActiveDoc;
output.AppendLine("Rhino-Version: " + RhinoApp.Version);
output.AppendLine("Dokument: " + doc.Name + " | Units: " + doc.ModelUnitSystem);
output.AppendLine("Objekte: " + doc.Objects.Count);

// Layer-Pfade der Member-Objekte (Solids + Achsen) zaehlen
var layerCounts = new Dictionary<string, int>();
var layerTypes = new Dictionary<string, HashSet<string>>();
int solids = 0, curves = 0, other = 0;
foreach (var o in doc.Objects)
{
    var lp = doc.Layers[o.Attributes.LayerIndex].FullPath;
    if (lp.Contains("MemberAxes") || lp == "Members" || lp.StartsWith("Members::")
        || lp == "RD 12" || lp.StartsWith("Flat Bar") || lp.StartsWith("Rectangle") || lp.StartsWith("RO "))
    {
        if (!layerCounts.ContainsKey(lp)) layerCounts[lp] = 0;
        layerCounts[lp]++;
        var g = o.Geometry;
        string kind = (g is Brep) ? "Brep" : (g is Surface) ? "Surf" : (g is Mesh) ? "Mesh"
                    : (g is LineCurve) ? "Line" : (g is Curve) ? "Curve" : "other";
        if (!layerTypes.ContainsKey(lp)) layerTypes[lp] = new HashSet<string>();
        layerTypes[lp].Add(kind);
        if (kind == "Brep" || kind == "Surf" || kind == "Mesh") solids++;
        else if (g is Curve) curves++;
        else other++;
    }
}
output.AppendLine("Member-Objekte: " + (solids + curves + other)
    + " (Brep/Surf/Mesh: " + solids + ", Kurven: " + curves + ", andere: " + other + ")");
output.AppendLine("--- Member-Layer-Pfade ---");
foreach (var kv in layerCounts.OrderBy(k => k.Key))
    output.AppendLine("  " + kv.Value.ToString().PadLeft(4) + "  " + kv.Key
        + "  [" + string.Join(",", layerTypes[kv.Key]) + "]");

// UserStrings eines Beispiel-Objekts pro Layer-Typ + Skalen-Check (Achsenlaenge vs CSV)
int shown = 0;
foreach (var o in doc.Objects)
{
    var lp = doc.Layers[o.Attributes.LayerIndex].FullPath;
    var g = o.Geometry;
    if (!(g is LineCurve)) continue;
    var us = o.Attributes.GetUserStrings();
    if (us.Count == 0) continue;
    var lc = (LineCurve)g;
    output.AppendLine("--- Beispiel-Achse @" + lp
        + " | Laenge=" + lc.Line.Length.ToString("F3")
        + " | TraegerNr=" + (us["Etappe02_TraegerNr"] ?? "?")
        + " | BeamId=" + (us["BG_RFEM_Exchange_BeamId"] ?? "?").Substring(0, 12) + "…"
        + " ---");
    foreach (var k in us.AllKeys)
        output.AppendLine("    " + k + " = " + us[k]);
    if (++shown >= 3) break;
}

// Render-Materialien im Dokument + Layer-Farben
output.AppendLine("--- Render-Materialien im Dokument: " + doc.RenderMaterials.Count + " ---");
foreach (var rm in doc.RenderMaterials)
    output.AppendLine("  " + rm.Name + " | Id=" + rm.Id + " | DiffuseColor=" + rm.DiffuseColor.Name);
output.AppendLine("--- Layer-Farben der Member-Layer ---");
foreach (var lp in layerCounts.Keys.OrderBy(k => k))
{
    int li = doc.Layers.FindByFullPath(lp, true);
    if (li < 0) { output.AppendLine("  " + lp + " | (Layer nicht gefunden!)"); continue; }
    var layer = doc.Layers[li];
    output.AppendLine("  " + lp + " | LayerColor=" + layer.Color.Name);
}

// Farb-Quelle an Beispielen: Objekt-Material vs Layer-Farbe
int be = 0;
foreach (var o in doc.Objects)
{
    var lp = doc.Layers[o.Attributes.LayerIndex].FullPath;
    bool isMember = layerCounts.ContainsKey(lp);
    if (!isMember) continue;
    var a = o.Attributes;
    string src = "LayerFarbe";
    System.Drawing.Color c = doc.Layers[a.LayerIndex].Color;
    if (a.MaterialSource == ObjectMaterialSource.MaterialFromObject && a.MaterialIndex >= 0
        && a.MaterialIndex < doc.RenderMaterials.Count)
    {
        var rm = doc.RenderMaterials[a.MaterialIndex];
        src = "ObjektMaterial=" + rm.Name;
        c = rm.DiffuseColor;
    }
    output.AppendLine("  (" + (be + 1) + ") " + a.Name + " @" + lp
        + " | Quelle=" + src + " | Farbe=" + c.Name);
    if (++be >= 6) break;
}

