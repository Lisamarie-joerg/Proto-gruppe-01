/* Etappe 5 – Rhino-3D-Viewport (Three.js)
 * Lädt webapp/static/model.glb (RH7 Stockerau, RFEM-Export) in die
 * Mitte der Seite (#viewport3d) und bündelt alle Interaktion:
 *   - OrbitControls (Drehen / Zoomen / Schieben)
 *   - Layer-Checkboxes (31 Layer-Gruppen: MemberAxes + Members)
 *   - Farbmodus: Rhino-Material | nach CO₂e (grün → rot)
 *   - Material-Toggles (Baustahl / Beton) wirken auf die Sichtbarkeit
 *   - Bauteil-Klick → Info-Panel (Nr, Profil, Länge, Volumen, Masse, CO₂e)
 *   - Kamera-Presets (Perspektive / Draufsicht / Vorne / Seite)
 *
 * Brücke zum Haupt-Script (index.html):
 *   window.__appState   { dataset, module, view, colorMode, mats, axes }
 *   window.__appData    Daten aus /api/data (bars, datasets, ...)
 *   window.__barValue(bar)  angezeigter CO₂e-Wert (Beachten der Toggles)
 *   window.__rhinoSetView(name)  wird hier gesetzt (Kamera-Presets)
 *   window.__rhinoResize()       wird hier gesetzt (Resize)
 * Events: 'appdata' (Daten da), 'appchange' (Auswahl geändert)
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const container = document.getElementById('viewport3d');
const hint = document.getElementById('glbHint');
const state = () => window.__appState;

const fmtDE = (x, d = 1) =>
  Number(x).toLocaleString('de-DE', { maximumFractionDigits: d });

/* ---------- Renderer / Szene / Kamera ---------- */
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true });
} catch (error) {
  hint.textContent = '3D benötigt WebGL. Bewehrungsplan und Stabliste sind rechts verfügbar.';
  throw error;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf4f6f9);

const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000);
camera.up.set(0, 0, 1);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;

/* ---------- Licht ---------- */
scene.add(new THREE.AmbientLight(0xffffff, 1.0));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(25, -35, 40);
scene.add(sun);
const fill = new THREE.DirectionalLight(0xffffff, 0.7);
fill.position.set(-20, 25, 15);
scene.add(fill);

/* ---------- Bodenraster (Rhino-Modell: Z ist hoch) ---------- */
const grid = new THREE.GridHelper(60, 60, 0xcbd5e1, 0xe8edf3);
grid.rotation.x = Math.PI / 2;
grid.position.set(11.5, -5, -0.005);
scene.add(grid);

/* ---------- CO₂-Legende (ein-/ausblenden) ---------- */
const legend = document.createElement('div');
legend.id = 'co2Legend';
legend.className = 'hidden';
legend.style.cssText =
  'position:absolute;left:10px;bottom:10px;z-index:4;' +
  'background:rgba(255,255,255,.92);border:1px solid var(--line);' +
  'border-radius:8px;padding:8px 10px;font-size:11px;color:var(--ink);';
legend.innerHTML =
  '<div style="font-weight:600;margin-bottom:4px">CO₂e je Stab (kg)</div>' +
  '<div style="width:170px;height:10px;border-radius:5px;' +
  'background:linear-gradient(90deg,#16a34a,#facc15,#dc2626)"></div>' +
  '<div style="display:flex;justify-content:space-between;margin-top:2px">' +
  '<span id="lgMin">–</span><span id="lgMax">–</span></div>';
container.parentElement.appendChild(legend);

/* ---------- Modell-Zustand ---------- */
let model = null;
let allMeshes = [];                 // alle Blatt-Meshes (1297)
const layerObjs = [];               // {obj, name, path, kind, count}
const beamIndex = new Map();        // beamId -> [mesh, ...]
const barByBeam = new Map();        // beamId -> bar (aus data.json)
const origMat = new Map();          // mesh.uuid -> Originalmaterial
let bbox = null;
let selected = null;
const rebar = new THREE.Group();
scene.add(rebar);
const cageMaterials = [
  new THREE.MeshBasicMaterial({ color: 0xbe4318 }),
  new THREE.MeshBasicMaterial({ color: 0x233e61 }),
  new THREE.MeshBasicMaterial({ color: 0xf6a000 }),
];
const ghost = new THREE.MeshBasicMaterial({
  color: 0xaab6c7, transparent: true, opacity: 0.15, depthWrite: false,
});
const concrete = ghost.clone();
concrete.opacity = 0.28;
let rebarView = 'structure';
let focusedStrip = null;
let activePosition = null;
let strips = new Map();
const foundationInfo = document.getElementById('foundationInfo');

function stripKey(bar) {
  const alongX = Math.abs(bar.end[0] - bar.start[0]) > Math.abs(bar.end[1] - bar.start[1]);
  return alongX ? 'Y = ' + bar.start[1] + ' m' : 'X = ' + bar.start[0] + ' m';
}

function tube(points, radius, material, key, position) {
  const path = new THREE.CurvePath();
  for (let i = 1; i < points.length; i++) {
    path.add(new THREE.LineCurve3(points[i - 1], points[i]));
  }
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(path, (points.length - 1) * 4, radius, 6), material);
  mesh.userData = { key, position };
  rebar.add(mesh);
}

function buildCages(data) {
  for (const child of [...rebar.children]) {
    child.geometry.dispose();
    rebar.remove(child);
  }
  strips = new Map();
  for (const bar of data.bars.filter(b => b.gruppe === 'Beton')) {
    const key = stripKey(bar);
    if (!strips.has(key)) strips.set(key, []);
    strips.get(key).push(...[bar.start, bar.end].map(p => new THREE.Vector3(...p)));
  }
  const positions = window.__rebarPlan.positions;
  for (const [key, points] of strips) {
    const isAlongX = key.startsWith('Y');
    const axis = isAlongX ? 'x' : 'y';
    points.sort((a, b) => a[axis] - b[axis]);
    const start = points[0], end = points.at(-1);
    const axisLength = start.distanceTo(end);
    const tangent = end.clone().sub(start).normalize();
    const side = new THREE.Vector3(0, 0, 1).cross(tangent).normalize();
    const up = tangent.clone().cross(side).normalize();
    const stock = positions[isAlongX ? '2' : '4'].length;
    const pieces = isAlongX ? 2 : 3;
    const length = stock * pieces - (pieces - 1);
    const offset = (axisLength - length) / 2;
    const point = (at, x, z) => start.clone().addScaledVector(tangent, at + offset)
      .addScaledVector(side, x).addScaledVector(up, z);

    const stirrup = (at, sideways = false) => {
      const corners = [[-.205, -.205], [.205, -.205], [.205, .205],
        [-.205, .205], [-.205, -.205], [-.055, -.205]];
      const vertices = corners.map(([x, z]) => sideways
        ? point(at + x, 0, z) : point(at, x, z));
      tube(vertices, .005, cageMaterials[0], key, '1');
    };
    if (isAlongX) {
      for (let i = 0; i < 51; i++) stirrup((length - 10) / 2 + i * .20);
      // Detail 1 occurs at both ends and at the two crossing axes.
      const crossingCenters = [10, 13].map(x => (x - start.x) / tangent.x - offset);
      for (const center of [.23, ...crossingCenters, length - .23]) {
        for (const delta of [-.15, -.05, .05, .15]) {
          stirrup(center + delta);
          stirrup(center, true);
          // The transverse detail bars are distributed across the section.
          rebar.children.at(-1).position.addScaledVector(side, delta);
        }
      }
    } else {
      for (const center of [length / 4, length * 3 / 4]) {
        for (let i = -11; i <= 11; i++) stirrup(center + i * .20);
      }
    }

    const lanes = [-.194, -.065, .065, .194].flatMap(x =>
      [[x, -.194], [x, .194]]);
    lanes.push([-.194, 0], [.194, 0]);
    for (let i = 0; i < pieces; i++) {
      const at = i * (stock - 1);
      for (const [x, z] of lanes) {
        tube([point(at, x, z), point(at + stock, x, z)], .006,
          cageMaterials[1], key, isAlongX ? '2' : '4');
      }
    }
    for (const at of [0, length]) {
      const inner = at === 0 ? 1 : length - 1;
      for (const x of [-.194, -.065, .065, .194]) {
        tube([point(inner, x, -.195), point(at, x, -.195),
          point(at, x, .195), point(inner, x, .195)], .006, cageMaterials[1], key, '3');
      }
    }
  }
  for (const [id, position] of Object.entries(positions)) {
    const count = rebar.children.filter(mesh => mesh.userData.position === id).length;
    if (count !== position.count) throw new Error('3D-Stückzahl weicht von Planposition ' + id + ' ab.');
  }
  updateRebar();
}

function updateRebar() {
  rebar.visible = rebarView !== 'structure' && state().mats.Bewehrung;
  for (const mesh of rebar.children) {
    mesh.visible = focusedStrip === null || mesh.userData.key === focusedStrip;
    mesh.material = activePosition === mesh.userData.position ? cageMaterials[2]
      : mesh.userData.position === '1' ? cageMaterials[0] : cageMaterials[1];
  }
  document.querySelectorAll('[data-rebar-view]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.rebarView === rebarView));
  });
  for (const button of document.querySelectorAll('[data-position]')) {
    const isSelected = activePosition === button.dataset.position;
    button.setAttribute('aria-pressed', String(isSelected));
    button.closest('tr').classList.toggle('selected', isSelected);
  }
  const position = window.__rebarPlan.positions[activePosition];
  foundationInfo.textContent = (focusedStrip ? 'Fundamentstreifen ' + focusedStrip + '. ' : '')
    + (position ? 'Position ' + activePosition + ' · Ø ' + position.diameter
      + ' mm · Zuschnitt ' + fmtDE(position.length, 2) + ' m. ' : '')
    + 'Einbaulagen und Biegeradien im 3D-Modell sind angenähert. Zuschnitt und Masse laut Originalplan.';
}

for (const button of document.querySelectorAll('[data-position]')) {
  button.addEventListener('click', () => {
    focusedStrip = null;
    activePosition = button.dataset.position;
    if (rebarView === 'structure') setRebarView('combined');
    updateRebar();
    setView('persp');
    document.getElementById('planDetail').open = true;
  });
}

function setRebarView(view) {
  rebarView = view;
  updateRebar();
  applyColors();
  updateVisibility();
}

for (const button of document.querySelectorAll('[data-rebar-view]')) {
  button.addEventListener('click', () => setRebarView(button.dataset.rebarView));
}
document.getElementById('resetFoundation').addEventListener('click', () => {
  focusedStrip = null;
  activePosition = null;
  select(null);
  setRebarView(rebarView);
  setView('persp');
});
updateRebar();

/* ---------- CO₂-Farbe (gleiche Skala wie die Plotly-Ansicht) ---------- */
const CO2_STOPS = [
  [0.0, new THREE.Color('#16a34a')],
  [0.5, new THREE.Color('#facc15')],
  [1.0, new THREE.Color('#dc2626')],
];
const co2MatCache = new Map();
function co2Material(t) {
  const k = Math.max(0, Math.min(255, Math.round(t * 255)));
  if (co2MatCache.has(k)) return co2MatCache.get(k);
  const c = t <= 0.5
    ? CO2_STOPS[0][1].clone().lerp(CO2_STOPS[1][1], t / 0.5)
    : CO2_STOPS[1][1].clone().lerp(CO2_STOPS[2][1], (t - 0.5) / 0.5);
  const m = new THREE.MeshStandardMaterial({
    color: c, roughness: 0.55, metalness: 0.1,
  });
  co2MatCache.set(k, m);
  return m;
}
const lineCO2 = new Map();
function objectColor(object, t) {
  const mat = co2Material(t);
  if (!object.isLine) return mat;
  if (!lineCO2.has(mat)) lineCO2.set(mat, new THREE.LineBasicMaterial({ color: mat.color }));
  return lineCO2.get(mat);
}
const unknownMat =
  new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.7 });

/* ---------- Sichtbarkeit: Material-Toggles (Baustahl/Beton) ---------- */
function updateVisibility() {
  if (!model) return;
  const st = state();
  for (const m of allMeshes) {
    const bar = barByBeam.get(String(m.userData.beamId));
    const g = bar ? bar.gruppe : null;
    m.visible = rebarView !== 'rebar' && (!g || st.mats[g] !== false)
      && (rebarView !== 'combined' || m.isMesh || g !== 'Beton');
  }
  updateRebar();
  for (const m of allMeshes.filter(o => o.isMesh)) {
    if (rebarView !== 'combined') continue;
    const b = barByBeam.get(String(m.userData.beamId));
    m.material = b?.gruppe === 'Beton' && (!focusedStrip || stripKey(b) === focusedStrip) ? concrete : ghost;
  }
}

/* ---------- Farbmodus: Rhino-Material | nach CO₂e ---------- */
function applyColors() {
  if (!model) return;
  const st = state();
  if (st.colorMode === 'co2' && barByBeam.size) {
    const vals = window.__appData.bars.map(b => window.__barValue(b));
    const vmin = Math.min(...vals);
    const vmax = Math.max(...vals);
    const span = vmax - vmin || 1;
    for (const m of allMeshes) {
      const bar = barByBeam.get(String(m.userData.beamId));
      m.material = bar
        ? objectColor(m, (window.__barValue(bar) - vmin) / span)
        : unknownMat;
    }
    document.getElementById('lgMin').textContent = fmtDE(vmin);
    document.getElementById('lgMax').textContent = fmtDE(vmax);
    legend.classList.remove('hidden');
  } else {
    for (const m of allMeshes) m.material = origMat.get(m.uuid);
    legend.classList.add('hidden');
  }
  refreshHighlight();
}

/* ---------- Events von Haupt-Script ---------- */
document.addEventListener('appdata', () => {
  barByBeam.clear();
  const d = window.__appData;
  if (d && d.bars) {
    for (const b of d.bars) barByBeam.set(String(b.beam_id), b);
    buildCages(d);
  }
  applyColors();
  updateVisibility();
});
document.addEventListener('appchange', () => {
  applyColors();
  updateVisibility();
});

/* ---------- Modell laden ---------- */
new GLTFLoader().load(new URL('./model.glb', import.meta.url).href, gltf => {
  model = gltf.scene;
  scene.add(model);
  model.updateMatrixWorld(true);

  model.traverse(o => {
    if (o.isMesh || o.isLine) {
      allMeshes.push(o);
      origMat.set(o.uuid, o.material);
      if (o.isMesh && !o.geometry.getAttribute('normal')) o.geometry.computeVertexNormals();   // GLB enthält keine Normalen
      const bid = o.userData.beamId;
      if (bid != null) {
        const key = String(bid);
        if (!beamIndex.has(key)) beamIndex.set(key, []);
        beamIndex.get(key).push(o);
      }
    } else if (o.userData && o.userData.isLayerNode) {
      const path = o.userData.layer || '';
      const kind = path.includes('MemberAxes') ? 'Achse' : 'Körper';
      let n = 0;
      o.traverse(c => { if (c.isMesh || c.isLine) n++; });
      layerObjs.push({
        obj: o,
        name: o.name || path.split('::').pop(),
        path, kind, count: n,
      });
    }
  });

  bbox = new THREE.Box3().setFromObject(model);
  const size = bbox.getSize(new THREE.Vector3());
  document.getElementById('modelDimensions').textContent =
    'Modellabmessungen X × Y × Z: ' + [size.x, size.y, size.z].map(v => fmtDE(v, 2)).join(' × ') + ' m';
  const dimensions = bbox.getCenter(new THREE.Vector3());
  grid.position.set(dimensions.x, dimensions.y, bbox.min.z - .02);
  buildLayerList();
  window.__rhinoSetView = setView;
  setView('persp');
  applyColors();
  updateVisibility();
  hint.classList.add('hidden');
}, undefined, err => {
  hint.textContent = 'Modell konnte nicht geladen werden: ' +
    (err && err.message ? err.message : err);
});

/* ---------- Layer-Liste (Checkboxes) ---------- */
let layerRows = [];
function buildLayerList() {
  const list = document.getElementById('layerList');
  layerRows = [...layerObjs].sort((a, b) =>
    a.kind === b.kind
      ? a.name.localeCompare(b.name, 'de')
      : (a.kind === 'Achse' ? -1 : 1));
  const tag = kind => kind === 'Achse'
    ? '<span style="font-size:9px;color:#fff;background:#94a3b8;' +
      'border-radius:4px;padding:1px 4px;margin-right:5px">Achse</span>'
    : '<span style="font-size:9px;color:#fff;background:#2563eb;' +
      'border-radius:4px;padding:1px 4px;margin-right:5px">Körper</span>';
  list.innerHTML = layerRows.map((r, i) =>
    '<label><input type="checkbox" checked data-i="' + i + '">' +
    tag(r.kind) + r.name +
    '<span class="cnt">' + r.count + '×</span></label>').join('');
}
document.getElementById('layerList').addEventListener('change', e => {
  const cb = e.target.closest('input[type="checkbox"]');
  if (!cb) return;
  const r = layerRows[Number(cb.dataset.i)];
  if (r) r.obj.visible = cb.checked;
});
function setAllLayers(v) {
  layerRows.forEach(r => { r.obj.visible = v; });
  document.querySelectorAll('#layerList input[type="checkbox"]')
    .forEach(cb => { cb.checked = v; });
}
document.getElementById('layersAll')
  .addEventListener('click', () => setAllLayers(true));
document.getElementById('layersNone')
  .addEventListener('click', () => setAllLayers(false));

/* ---------- Bauteil-Klick (Raycast) ---------- */
const ray = new THREE.Raycaster();
ray.params.Line.threshold = 0.045;
let downXY = null;
renderer.domElement.addEventListener('pointerdown', e => {
  downXY = [e.clientX, e.clientY];
});
renderer.domElement.addEventListener('pointerup', e => {
  if (!downXY) return;
  const dx = e.clientX - downXY[0];
  const dy = e.clientY - downXY[1];
  downXY = null;
  if (dx * dx + dy * dy > 36) return;   // >6px = Drehen, kein Klick
  pick(e);
});
function isShown(o) {
  for (let n = o; n; n = n.parent) {
    if (!n.visible) return false;
  }
  return true;
}
function pick(e) {
  if (!model) return;
  const r = renderer.domElement.getBoundingClientRect();
  const ndc = new THREE.Vector2(
    ((e.clientX - r.left) / r.width) * 2 - 1,
    -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const rebarHit = rebar.visible && ray.intersectObjects(rebar.children, false)
    .find(h => h.object.visible);
  if (rebarHit) {
    focusedStrip = null;
    activePosition = rebarHit.object.userData.position;
    updateRebar();
    if (activePosition) document.getElementById('planDetail').open = true;
    return;
  }
  const hits = ray.intersectObjects(allMeshes, false)
    .filter(h => isShown(h.object));
  select(hits.length ? hits[0].object : null);
}
function select(mesh) {
  selected = mesh;
  applyColors();          // Materialien zurücksetzen + neu highlighten
  showPartInfo(mesh);
  const bar = mesh && barByBeam.get(String(mesh.userData.beamId));
  if (bar?.gruppe === 'Beton') {
    focusedStrip = stripKey(bar);
    activePosition = null;
    setRebarView('combined');
    setView('persp');
  }
}
let activeHighlight;
function refreshHighlight() {
  if (selected && selected.parent) {
    const hl = selected.material.clone();
    activeHighlight?.dispose();
    activeHighlight = hl;
    if (selected.isLine) hl.color.set(0x2563eb);
    else {
      hl.emissive.set(0x2563eb);
      hl.emissiveIntensity = 0.35;
    }
    selected.material = hl;
  }
}

/* ---------- Bauteil-Info-Panel ---------- */
function prow(k, v) {
  return '<div class="partinfo-row"><span>' + k + '</span>' +
    '<span class="v">' + v + '</span></div>';
}
function showPartInfo(mesh) {
  const box = document.getElementById('partInfo');
  if (!mesh || mesh.userData.beamId == null) {
    box.innerHTML = '<p class="note">Bauteil im 3D-Viewport anklicken …</p>';
    return;
  }
  const st = state();
  const bar = barByBeam.get(String(mesh.userData.beamId));
  const layerPath = mesh.userData.layer || '';
  const kind = layerPath.includes('MemberAxes') ? 'Stabachse' : 'Stabkörper';
  const shortLayer = layerPath.split('::').slice(-2).join('::');
  const head =
    prow('Nr', bar ? bar.nr : '–') +
    prow('BeamId (RFEM)', mesh.userData.beamId) +
    prow('Objekt', kind) +
    prow('Profil', mesh.userData.profil || '–');
  if (!bar) {
    box.innerHTML = head + prow('Layer', shortLayer);
    return;
  }
  const co2 = window.__barValue(bar);
  const ds = window.__appData.datasets[st.dataset];
  const modLbl = (window.__appData.module.find(m => m.id === st.module) || {}).label;
  let rebar = 0;
  if (bar.gruppe === 'Beton') {
    rebar = window.__rebarMass(bar) * ds.betonstahl.gwp[st.module];
  }
  box.innerHTML = head +
    prow('Typ / Gruppe', (bar.typ || '–') + ' · ' + bar.gruppe) +
    prow('Länge', fmtDE(bar.L_m, 3) + ' m') +
    prow('Querschnitt', fmtDE(bar.A_mm2, 0) + ' mm²') +
    prow('Volumen', fmtDE(bar.V_m3, 4) + ' m³') +
    prow('Masse', fmtDE(bar.m_kg, 1) + ' kg') +
    prow('CO₂e (' + ds.label + ', ' + modLbl + ')',
         '<b>' + fmtDE(co2, 2) + ' kg</b>') +
    (bar.gruppe === 'Beton'
      ? prow('Bewehrungsanteil (nach Betonvolumen)', fmtDE(rebar, 2) + ' kg')
      : '') +
    prow('Layer', shortLayer);
}

/* ---------- Kamera-Presets ---------- */
function setView(v) {
  if (!bbox) return;
  const viewBox = focusedStrip && strips.has(focusedStrip)
    ? new THREE.Box3().setFromPoints(strips.get(focusedStrip)).expandByScalar(.4) : bbox;
  const c = viewBox.getCenter(new THREE.Vector3());
  const R = viewBox.getSize(new THREE.Vector3()).length() / 2;
  const halfAngle = THREE.MathUtils.degToRad(camera.fov / 2);
  const horizontal = Math.atan(Math.tan(halfAngle) * camera.aspect);
  const dist = R / Math.sin(Math.min(halfAngle, horizontal));
  const P = {
    persp: [[1.7, -1.7, 1.15], [0, 0, 1]],
    top:   [[0, -0.001, 1], [0, 0, 1]],
    front: [[0, -1, 0.05], [0, 0, 1]],
    side:  [[1, 0, 0.05], [0, 0, 1]],
  }[v] || [[1.7, -1.7, 1.15], [0, 0, 1]];
  camera.up.set(P[1][0], P[1][1], P[1][2]);
  camera.position.set(P[0][0], P[0][1], P[0][2])
    .normalize().multiplyScalar(dist).add(c);
  controls.target.copy(c);
  controls.update();
}

/* ---------- Resize ---------- */
function resize() {
  const w = container.clientWidth;
  const h = container.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
if (window.ResizeObserver) {
  new ResizeObserver(resize).observe(container);
}
window.addEventListener('resize', resize);
window.__rhinoResize = resize;
resize();

/* ---------- Render-Schleife ---------- */
renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});

