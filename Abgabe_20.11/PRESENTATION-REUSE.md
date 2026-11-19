# Ten-minute live demo – from donor building to reusable products

## 0:00–1:00 · Purpose

“Our app helps a designer understand which concrete pieces could become reusable products, and how those pieces could leave the donor building. The workflow connects geometry, reinforcement evidence, lifting limits and transport allocation.”

Start with an empty viewport. Explain that the model and plans are inputs, and that reconstructed reinforcement and schematic additions have different evidence levels.

## 1:00–3:00 · Simple project

Import `Praesentationsdateien/01-Pavillon/Pavillon.glb`, then its PDF. Show material rendering, one reinforcement group and the original plan excerpt. Open **Reuse catalogue** and calculate the foundation products.

“A usable product must fit the selected transport envelope and the available lifting capacity. We keep the original source element and subtract the saw kerf where new cuts are proposed.”

## 3:00–5:00 · More complex building

Import `Praesentationsdateien/02-Projekt6/Bauteil6.glb`, then the four PDFs. Open the catalogue and calculate. Toggle storeys, inspect a stair source and switch to **Exploded parts**.

“For a multi-storey building, we retain the IFC storey and element identity. Different elements need different checks: stair cuts prefer broad landing regions, while beams, walls and slabs are divided by their geometric transport frame and lifting mass. Connections and temporary stability still require engineering review.”

## 5:00–7:00 · Product catalogue

Select a concrete product. Point out its highlighted table row, dimensions, mass method, reinforcement evidence and assigned truck. Use **Zoom to part**. Explain the difference between a transparent transport envelope and the selected actual clipped shape. Export the CSV if useful.

## 7:00–9:00 · Logistics and sequence

Use **Show assigned truck**. Select another product in the loading diagram. Show payload and available deck dimensions. Play or scrub the conceptual disassembly/loading sequence.

“Packing is a single-layer heuristic with rotations and clearance. The number of trucks belongs to these assumptions; it is not a claim of a globally optimal or approved transport plan.”

## 9:00–10:00 · What this supports

“The designer can compare equipment assumptions and see their consequences for component size, cuts and truck allocation. The next step is to connect this catalogue to a target design and verify structural capacity, lifting points, temporary support and actual transport constraints.”

Keep a backup screen recording for the presentation. Leave the local Python server running during the live demo.
