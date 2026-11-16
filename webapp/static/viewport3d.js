import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const byId = id => document.getElementById(id);
const fmt = (value, digits = 2) => value.toLocaleString('de-DE', {
  minimumFractionDigits: digits, maximumFractionDigits: digits,
});
const status = byId('status');
const titles = { Beton: 'Betonfundamente', Metall: 'Stahlstützen', Holz: 'Holzdach', Stahlseil: 'Stahlseile' };
const densities = { Beton: 2400, Metall: 7850, Holz: 450, Stahlseil: 7850 };
const grossMass = bar => bar.V_m3 * densities[bar.material_etappe03];
const buttons = [...document.querySelectorAll('[data-mode]')];
const detail = byId('detail');
const loader = new GLTFLoader();

let mode = 'combined';
let active = null;
let plan;
let planUrl;
const localPlans = new Map();
let importedPlan;
let projectCatalog;
let viewer;

async function json(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(url + ' · HTTP ' + res.status);
  return res.json();
}

function showStatus(text) {
  status.textContent = text;
  status.hidden = !text;
}

function renderMasses(data) {
  const sums = { Beton: 0, Metall: 0, Holz: 0, Stahlseil: 0 };
  data.bars.forEach(bar => { if (bar.gruppe !== 'Beton') sums[bar.material_etappe03] += grossMass(bar); });
  sums.Beton = plan.foundations.reduce((volume,f) => volume+f.length*f.width*f.height,0)*densities.Beton;
  byId('structureMass').innerHTML = Object.entries(sums)
    .map(([key, value]) => `<dt>${titles[key]}</dt><dd>${fmt(value, 0)} kg</dd>`).join('')
    + `<dt>Bewehrung im Modell</dt><dd>${fmt(plan.modelMass)} kg</dd>
       <dt><strong>Gesamt</strong></dt><dd><strong>${fmt(Object.values(sums).reduce((a,b)=>a+b,plan.modelMass),0)} kg</strong></dd>`;
}

function selection(position, item = null) {
  active = position;
  if (viewer?.isCustom()) {
    viewer.update();
    const record = projectCatalog?.find(row => row.key === position);
    if (record && byId('projectSheet').value !== record.sheet) {
      byId('projectSheet').value = record.sheet;
      drawProjectPositions();
    }
    document.querySelectorAll('#importGroups button').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.position === position));
    });
    const row = importedPlan?.positions[position];
    const amount = record ? (row?.modelCount ?? 0) + ' von ' + record.count + ' Stäben in 3D' : '';
    byId('importSelection').textContent = position
      ? ['Position ' + position, item?.id, amount, row && fmt(row.modelMass) + ' kg'].filter(Boolean).join(' · ')
      : 'Position im Modell oder in der Liste auswählen.';
    const sheet = record?.sheet ?? row?.sheet;
    const selectedPlanUrl = sheet
      ? [...localPlans.values()].find(file => file.sheet === sheet)?.url
      : planUrl;
    byId('projectPositions').querySelectorAll('button').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.position === position));
    });
    if (position && selectedPlanUrl) {
      byId('detailTitle').textContent = 'Planposition ' + position;
      byId('detailText').textContent = row?.detail || amount || 'Bewehrungsplan zum importierten Modell';
      const url = selectedPlanUrl + (row?.page ? '#page=' + row.page : '');
      byId('detailImage').parentElement.hidden = true;
      byId('detailPlanLink').href = url;
      byId('detailPdf').hidden = false;
      byId('detailPdf').src = url;
      if (!detail.open) detail.show();
    } else {
      if (sheet) byId('importSelection').textContent += ' · Originalplan ' + sheet + ' laden.';
      if (detail.open) detail.close();
    }
    return;
  }
  byId('detailImage').parentElement.hidden = false;
  byId('detailPdf').hidden = true;
  byId('detailPlanLink').href = './bewehrungsplan.pdf';
  const row = plan?.positions[position];
  const selected = byId('selection');
  document.querySelectorAll('#positions [data-position]').forEach(button => {
    const on = position === button.dataset.position;
    button.setAttribute('aria-pressed', String(on));
    button.closest('tr').classList.toggle('selected', on);
  });
  viewer?.update();
  if (!row) {
    if (detail.open) detail.close();
    selected.textContent = 'Stab im Modell oder Position in der Liste auswählen.';
    return;
  }
  byId('detailTitle').textContent = 'Planposition ' + position;
  byId('detailText').textContent = row.detail + (item ? ' · Modellstab ' + item.id : '');
  const section = { 'A-A': 'schnitt-a', 'B-B': 'schnitt-b', 'Detail 1': 'detail-1' }[item?.source];
  const url = './' + (section ?? 'position-' + position) + '.png';
  byId('detailImage').src = byId('detailOriginal').href = url;
  const barMass = item && item.length * 7850 * Math.PI * (row.diameter / 2000)**2;
  const equivalents = item && plan.elements.filter(element => element.position === item.position).length;
  selected.textContent = item
    ? `${item.id} · ${fmt(item.length)} m · ca. ${fmt(barMass)} kg · ${equivalents} Stäbe der Planposition`
    : `Position ${position} · ${row.modelCount} Modellstäbe · ca. ${fmt(row.modelMass)} kg im Modell`;
  if (!detail.open) detail.show();
}

function renderPlan() {
  byId('rebarMass').textContent = fmt(plan.mass);
  byId('modelSpec').textContent =
    `Modell: ${plan.elements.length} Stäbe · ca. ${fmt(plan.modelMass)} kg · mindestens ${fmt(plan.cover*100,0)} cm Betondeckung · ${fmt(plan.lap*100,0)} cm Längsüberdeckung · max. ${fmt(plan.maxLength,1)} m je Stab`;
  byId('positions').innerHTML = Object.entries(plan.positions).map(([id, p]) =>
    `<tr><th scope="row"><button type="button" data-position="${id}" aria-pressed="false">${id}</button></th>
       <td>${p.diameter}</td><td>${p.count}</td><td>${fmt(p.length)}</td><td>${fmt(p.mass)}</td></tr>`).join('');
  byId('positions').addEventListener('click', event => {
    const button = event.target.closest('[data-position]');
    if (!button || viewer?.isCustom()) return;
    if (mode === 'structure') setMode('rebar');
    selection(button.dataset.position);
  });
}

function setMode(value) {
  mode = value;
  buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === mode)));
  if (value === 'structure' && active) selection(null);
  viewer?.update();
}

function createGroundGrid(grid, bounds) {
  const group = new THREE.Group();
  group.position.z = bounds.min.z-.09;
  const [left, right] = [grid.x[0][1], grid.x.at(-1)[1]];
  const [bottom, top] = [grid.y[0][1], grid.y.at(-1)[1]];
  const axes = [];
  const dims = [];
  const line = (target, x1, y1, x2, y2) => target.push(x1, y1, 0, x2, y2, 0);
  function textLabel(text, x, y, turn = 0, marker = false) {
    const canvas = document.createElement('canvas');
    canvas.width = marker ? 128 : 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f5f8f4';
    ctx.strokeStyle = '#345751';
    if (marker) {
      ctx.beginPath();
      ctx.arc(64,64,53,0,Math.PI*2);
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.stroke();
    } else {
      ctx.fillRect(0,25,256,78);
    }
    ctx.fillStyle = '#254942';
    ctx.font = marker ? 'bold 61px sans-serif' : 'bold 52px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text,canvas.width/2,65);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(marker ? .44 : .97, marker ? .44 : .48),
      new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,side:THREE.DoubleSide}));
    mesh.position.set(x,y,.008);
    mesh.rotation.z = turn;
    group.add(mesh);
    return mesh;
  }

  const dimensionY = Math.min(bottom,bounds.min.y)-.69;
  const dimensionX = Math.min(left,bounds.min.x)-.69;
  const outerTop = Math.max(top,bounds.max.y)+.52;
  const outerRight = Math.max(right,bounds.max.x)+.52;
  const tick = .075;
  grid.x.forEach(([name,x], i) => {
    line(axes,x,bottom-.36,x,outerTop-.19);
    line(dims,x,bottom-.24,x,dimensionY-.16);
    line(dims,x-tick,dimensionY-tick,x+tick,dimensionY+tick);
    textLabel(name,x,outerTop,0,true).userData.axis = {name, kind:"x", coord:x};
    if (i) {
      const previous = grid.x[i-1][1];
      textLabel(fmt(x-previous)+' m',(x+previous)/2,dimensionY-.21);
    }
  });
  grid.y.forEach(([name,y], i) => {
    line(axes,left-.36,y,outerRight-.19,y);
    line(dims,left-.24,y,dimensionX-.16,y);
    line(dims,dimensionX-tick,y-tick,dimensionX+tick,y+tick);
    textLabel(name,outerRight,y,0,true).userData.axis = {name, kind:"y", coord:y};
    if (i) {
      const previous = grid.y[i-1][1];
      textLabel(fmt(y-previous)+' m',dimensionX-.24,(y+previous)/2,Math.PI/2);
    }
  });
  line(dims,left,dimensionY,right,dimensionY);
  line(dims,dimensionX,bottom,dimensionX,top);
  for (const [vertices,color,opacity] of [[axes,0x5d8076,.50],[dims,0x355c54,.83]]) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    group.add(new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color,transparent:true,opacity})));
  }
  return group;
}

// Intersect each circular bar segment with the section plane. The resulting
// polygons close only the exposed steel surfaces, leaving the bar sides colored.
function sectionCaps(plan, plane, axis) {
  const vertices = [];
  const facets = 12;
  const epsilon = 1e-7;
  for (const bar of plan.elements) {
    const radius = plan.positions[bar.position].diameter / 2000;
    const points = bar.points.map(point => new THREE.Vector3(...point));
    for (let i = 1; i < points.length; i++) {
      const a = points[i-1], b = points[i];
      const da = plane.distanceToPoint(a), db = plane.distanceToPoint(b);
      if (Math.min(da,db) > radius || Math.max(da,db) < -radius) continue;
      const tangent = b.clone().sub(a).normalize();
      const reference = Math.abs(tangent.z) > .9 ? new THREE.Vector3(1,0,0) : new THREE.Vector3(0,0,1);
      const u = tangent.clone().cross(reference).normalize();
      const v = tangent.clone().cross(u).normalize();
      const rings = [a,b].map(center => Array.from({length:facets}, (_,j) => {
        const theta = j * Math.PI * 2 / facets;
        return center.clone().addScaledVector(u,radius*Math.cos(theta))
          .addScaledVector(v,radius*Math.sin(theta));
      }));
      const slice = [];
      function insert(point) {
        if (!slice.some(existing => existing.distanceToSquared(point) < epsilon**2)) slice.push(point);
      }
      function edge(p,q) {
        const x = plane.distanceToPoint(p), y = plane.distanceToPoint(q);
        if (Math.abs(x) < epsilon) insert(p);
        if (Math.abs(y) < epsilon) insert(q);
        if (x*y < -(epsilon**2)) insert(p.clone().lerp(q,x/(x-y)));
      }
      for (let j = 0; j < facets; j++) {
        const next = (j+1)%facets;
        edge(rings[0][j],rings[0][next]);
        edge(rings[1][j],rings[1][next]);
        edge(rings[0][j],rings[1][j]);
      }
      if (slice.length < 3) continue;
      const mid = slice.reduce((center,p) => center.add(p),new THREE.Vector3())
        .multiplyScalar(1/slice.length);
      const lateral = axis === 'x' ? 'y' : 'x';
      const angle = p => Math.atan2(p.z-mid.z,p[lateral]-mid[lateral]);
      slice.sort((p,q) => angle(p)-angle(q));
      for (let j = 1; j < slice.length-1; j++) {
        for (const p of [slice[0],slice[j],slice[j+1]]) {
          vertices.push(...p.clone().addScaledVector(plane.normal,.00005).toArray());
        }
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  return geometry;
}

function createViewer(data) {
  const mount = byId('viewport3d');
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  mount.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe7eee9);
  const camera = new THREE.PerspectiveCamera(43, 1, .01, 1500);
  camera.up.set(0, 0, 1);
  const sectionCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, .01, 1500);
  sectionCamera.up.set(0,0,1);
  const orbit = new OrbitControls(camera, renderer.domElement);
  orbit.enableDamping = true;
  const key = new THREE.DirectionalLight(0xffffff, 2.35);
  key.position.set(14, -19, 28);
  scene.add(key, new THREE.HemisphereLight(0xf3f5ff, 0xa2a796, 2.2));

  const materials = {
    Beton: new THREE.MeshStandardMaterial({color: 0xa8aca1, roughness: .96}),
    Metall: new THREE.MeshStandardMaterial({color: 0x51697f, roughness: .34, metalness: .37}),
    Holz: new THREE.MeshStandardMaterial({color: 0xae7034, roughness: .78}),
    Stahlseil: new THREE.LineBasicMaterial({color: 0x394957}),
  };
  const transparentConcrete = new THREE.MeshStandardMaterial({
    color: 0xa8aca1, roughness: .94, opacity: .56, transparent: true, depthWrite: false,
  });
  const ordinary = new THREE.MeshBasicMaterial({ color: 0x811649 });
  const highlighted = new THREE.MeshBasicMaterial({ color: 0xff1495 });
  const muted = new THREE.MeshBasicMaterial({ color: 0x7b8584, transparent: true, opacity: .40, depthWrite: false });
  function makeBars(dataset) {
    const group = new THREE.Group();
    for (const item of dataset.elements) {
      const path = new THREE.CurvePath();
      const points = item.points.map(p => new THREE.Vector3(...p));
      for (let i = 1; i < points.length; i++) {
        path.add(new THREE.LineCurve3(points[i-1], points[i]));
      }
      const radius = dataset.positions[item.position].diameter / 2000;
      const mesh = new THREE.Mesh(new THREE.TubeGeometry(path, (points.length-1)*6, radius, 8), ordinary);
      mesh.userData.rebar = item;
      mesh.userData.centerline = points;
      group.add(mesh);
    }
    return group;
  }
  function disposeOverlay() {
    if (!importedOverlay) return;
    scene.remove(importedOverlay);
    importedOverlay.children.forEach(mesh => mesh.geometry.dispose());
    importedOverlay = null;
  }

  const bars = makeBars(plan);
  scene.add(bars);

  const foundations = new THREE.Group();
  for (const item of plan.foundations) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(item.length,item.width,item.height), materials.Beton);
    const direction = new THREE.Vector3(...item.direction);
    mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(direction,
      new THREE.Vector3(...item.side),new THREE.Vector3(...item.up)));
    mesh.position.set(...item.start).addScaledVector(direction,item.length/2);
    mesh.userData.foundation = item;
    foundations.add(mesh);
  }
  scene.add(foundations);

  const byBeam = new Map(data.bars.map(bar => [String(bar.beam_id), bar]));
  let model;
  let stockModel;
  let importedMeshes = [];
  let importedOverlay;
  let activeGrid;
  let customGrid;

  function setAxes(grid) {
    activeGrid = grid;
    axisMenu.options.length = 1;
    for (const kind of ['x','y']) {
      for (const [name,coord] of grid[kind]) {
        axisMenu.add(new Option('Achse '+name, JSON.stringify({name,kind,coord})));
      }
    }
  }

  const axisPosition = object => {
    let fallback;
    let rawPosition;
    for (let node = object; node; node = node.parent) {
      rawPosition ??= node.userData.Position ?? node.userData.position;
      const name = node.name || '';
      const isRebar = /bewehr|rebar|reinforcement/i.test(name) || node.userData.rebar === true;
      if (node.userData.rebarPosition != null && String(node.userData.rebarPosition).trim()) return String(node.userData.rebarPosition).trim();
      if (isRebar && rawPosition != null && String(rawPosition).trim()) return String(rawPosition).trim();
      const id = name.match(/^P([0-9]+)[_-][0-9]+(?:_|$)/i);
      const pos = isRebar && name.match(/(?:pos(?:ition)?)[\s_.:-]+([a-z0-9]+)|(?:bewehrung|rebar|reinforcement)[\s_.:-]+([0-9]+)/i);
      if (id || pos) return id?.[1] ?? pos[1] ?? pos[2];
      if (isRebar) fallback ??= name || 'Bewehrung';
    }
    return fallback ?? null;
  };
  const importMaterial = (mesh, properties) => mesh.isLine
    ? new THREE.LineBasicMaterial(properties)
    : mesh.isPoints ? new THREE.PointsMaterial({...properties,size:3,sizeAttenuation:false})
      : new THREE.MeshBasicMaterial({...properties,side:THREE.DoubleSide});
  const isConcrete = object => {
    for (let node = object; node; node = node.parent) {
      if (/beton|concrete|fundament|foundation|slab[ _]edge|stb(?![a-z])/i.test(node.name + ' ' + (node.userData.material ?? ''))) return true;
    }
    return false;
  };

  function prepareImport(root) {
    const group = new THREE.Group();
    group.add(root);
    const meshes = [];
    group.traverse(mesh => {
      if ((!mesh.isMesh && !mesh.isLine && !mesh.isPoints) || !mesh.geometry?.getAttribute('position')?.count) return;
      if (mesh.isMesh && !mesh.geometry.hasAttribute('normal')) mesh.geometry.computeVertexNormals();
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const converted = materials.map(material => {
        const color = material?.color?.clone() ?? new THREE.Color(0xadb6ba);
        if (Math.max(color.r,color.g,color.b) < .025) {
          color.setHex(isConcrete(mesh) ? 0xb6b1a6 : /(?:heb|hea|ipe)[ _-]*\d/i.test(mesh.name) ? 0x50677a : 0xadb6ba);
        }
        if (mesh.isLine) return new THREE.LineBasicMaterial({color});
        if (mesh.isPoints) return new THREE.PointsMaterial({color,size:2,sizeAttenuation:false});
        return new THREE.MeshBasicMaterial({color,map:material?.map ?? null,
          vertexColors: Boolean(material?.vertexColors),side:THREE.DoubleSide});
      });
      const neutral = mesh.isMesh ? new THREE.MeshStandardMaterial({
        color:0xb3bec2,roughness:.85,side:THREE.DoubleSide,
      }) : mesh.isLine ? new THREE.LineBasicMaterial({color:0x66777d})
        : new THREE.PointsMaterial({color:0x66777d,size:2,sizeAttenuation:false});
      const position = axisPosition(mesh);
      const rebar = position && [ordinary,highlighted,muted].map(mat => importMaterial(mesh,{
        color:mat.color, transparent:mat.transparent, opacity:mat.opacity, depthWrite:mat.depthWrite,
      }));
      const concrete = !position && mesh.isMesh && (isConcrete(mesh) ||
        materials.some(mat => /beton|concrete|fundament|foundation/i.test(mat?.name ?? '')))
        ? importMaterial(mesh,{color:0xaeb7bb,transparent:true,opacity:.38,depthWrite:false}) : null;
      meshes.push({mesh, material:Array.isArray(mesh.material) ? converted : converted[0], neutral, position, rebar, concrete});
    });
    const box = new THREE.Box3().setFromObject(group);
    if (!meshes.length || box.isEmpty() || ![...box.min,...box.max].every(Number.isFinite)) {
      throw new Error('Das Modell enthält keine darstellbare Geometrie.');
    }
    importedMeshes = meshes;
    return group;
  }

  function importedPositions() {
    return importedPlan ? Object.keys(importedPlan.positions)
      : [...new Set(importedMeshes.map(item => item.position).filter(Boolean))].sort();
  }
  let bounds;
  let groundGrid;
  let axisChoice;
  let cutDirection = 0;
  let cutPlane;
  let cutZoom = 1;
  const cutOffset = new THREE.Vector3();
  const cutSurfaces = new THREE.Mesh(new THREE.BufferGeometry(),
    new THREE.MeshBasicMaterial({color:0x000000,side:THREE.DoubleSide,
      polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));
  cutSurfaces.visible = false;
  scene.add(cutSurfaces);
  const sectionControls = byId('sectionControls');

  const axisMenu = byId('sectionAxis');
  setAxes(plan.grid);
  axisMenu.addEventListener('change', () => {
    if (axisMenu.value) chooseAxis(JSON.parse(axisMenu.value));
    else { endSection(); setCamera(); }
  });

  function fitSection() {
    if (!cutDirection || !axisChoice || !bounds) return;
    const isX = axisChoice.kind === 'x';
    const normal = new THREE.Vector3(isX ? cutDirection : 0,isX ? 0 : cutDirection,0);
    const center = bounds.getCenter(new THREE.Vector3());
    center[axisChoice.kind] = axisChoice.coord;
    cutPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal,center);
    renderer.clippingPlanes = [cutPlane];
    const size = bounds.getSize(new THREE.Vector3());
    const aspect = Math.max(.1,camera.aspect);
    const halfHeight = Math.max(.001,size.z/2,(isX ? size.y : size.x)/(2*aspect))*1.19/cutZoom;
    sectionCamera.left = -halfHeight*aspect;
    sectionCamera.right = halfHeight*aspect;
    sectionCamera.top = halfHeight;
    sectionCamera.bottom = -halfHeight;
    center.add(cutOffset);
    const distance = Math.max(30,size.length()*2);
    sectionCamera.far = distance*3;
    sectionCamera.position.copy(center).addScaledVector(normal,-distance);
    sectionCamera.lookAt(center);
    sectionCamera.updateMatrixWorld();
    sectionCamera.updateProjectionMatrix();
  }

  function endSection() {
    cutDirection = 0;
    axisChoice = null;
    cutPlane = null;
    cutZoom = 1;
    cutOffset.set(0,0,0);
    cutSurfaces.visible = false;
    byId("sectionZoom").hidden = true;
    renderer.clippingPlanes = [];
    orbit.enabled = true;
    sectionControls.hidden = true;
    axisMenu.value = "";
    if (groundGrid) groundGrid.visible = model === stockModel;
    if (customGrid) customGrid.visible = model !== stockModel;
  }

  function chooseAxis(axis) {
    endSection();
    axisChoice = axis;
    axisMenu.value = JSON.stringify({name:axis.name,kind:axis.kind,coord:axis.coord});
    sectionControls.hidden = false;
    byId('sectionInfo').textContent = 'Achse ' + axis.name + ' · Blickrichtung wählen';
    byId('sectionMinus').textContent = 'Richtung −' + axis.kind.toUpperCase();
    byId('sectionPlus').textContent = 'Richtung +' + axis.kind.toUpperCase();
  }

  function startSection(direction) {
    if (!axisChoice) return;
    cutDirection = direction;
    orbit.enabled = false;
    if (groundGrid) groundGrid.visible = false;
    if (customGrid) customGrid.visible = false;
    byId('sectionInfo').textContent = 'Schnitt ' + axisChoice.name + ' · Blick nach ' +
      (direction > 0 ? '+' : '−') + axisChoice.kind.toUpperCase();
    fitSection();
    cutSurfaces.geometry.dispose();
    const dataset = model === stockModel ? plan : importedPlan;
    cutSurfaces.geometry = dataset ? sectionCaps(dataset,cutPlane,axisChoice.kind) : new THREE.BufferGeometry();
    cutSurfaces.visible = Boolean(dataset) && mode !== 'structure';
    byId('sectionZoom').hidden = false;
  }

  function zoomSection(factor) {
    if (!cutDirection) return;
    cutZoom = THREE.MathUtils.clamp(cutZoom*factor,.7,20);
    fitSection();
  }

  byId('sectionZoomIn').addEventListener('click',() => zoomSection(1.25));
  byId('sectionZoomOut').addEventListener('click',() => zoomSection(.8));
  renderer.domElement.addEventListener('wheel',event => {
    if (!cutDirection) return;
    event.preventDefault();
    const box = renderer.domElement.getBoundingClientRect();
    const anchor = new THREE.Vector3(
      2*(event.clientX-box.left)/box.width-1, 1-2*(event.clientY-box.top)/box.height, 0);
    const before = anchor.clone().unproject(sectionCamera);
    zoomSection(Math.exp(-THREE.MathUtils.clamp(event.deltaY,-300,300)*.003));
    cutOffset.add(before.sub(anchor.unproject(sectionCamera)));
    cutOffset[axisChoice.kind] = 0;
    fitSection();
  },{passive:false});

  byId('sectionMinus').addEventListener('click', () => startSection(-1));
  byId('sectionPlus').addEventListener('click', () => startSection(1));
  byId('sectionClear').addEventListener('click', () => { endSection(); setCamera(); });
  let parts = [];
  const ray = new THREE.Raycaster();
  ray.params.Line.threshold = .04;

  function update() {
    const custom = model !== stockModel;
    bars.visible = !custom && mode !== 'structure';
    cutSurfaces.visible = Boolean(cutDirection) && (bars.visible || (custom && importedPlan && mode !== 'structure'));
    if (importedOverlay) importedOverlay.visible = custom && mode !== 'structure';
    if (custom) {
      const showConcrete = mode === 'combined' && (importedOverlay || importedMeshes.some(item => item.position));
      for (const item of importedMeshes) {
        item.mesh.visible = item.position ? !importedPlan && mode !== 'structure' : mode !== 'rebar';
        item.mesh.material = item.position ? item.rebar[item.position === active ? 1 : active ? 2 : 0]
          : showConcrete && item.concrete ? item.concrete : byId('neutralImport').checked ? item.neutral : item.material;
      }
    }
    const selectedOverlayPosition = importedPlan?.positions[active]?.modelCount ? active : null;
    for (const mesh of importedOverlay?.children ?? []) {
      mesh.material = mesh.userData.rebar.position === selectedOverlayPosition ? highlighted
        : selectedOverlayPosition ? muted : ordinary;
    }
    if (model) model.visible = custom || mode !== 'rebar';
    foundations.visible = !custom && mode !== 'rebar';
    for (const part of foundations.children) {
      part.material = mode === 'combined' ? transparentConcrete : materials.Beton;
    }
    for (const object of parts) {
      const material = object.userData.part.material_etappe03;
      object.material = material === 'Beton' && mode === 'combined'
        ? transparentConcrete : materials[material];
    }
    for (const mesh of bars.children) {
      const item = mesh.userData.rebar;
      const matches = item.position === active;
      mesh.material = matches ? highlighted : active ? muted : ordinary;
      mesh.renderOrder = matches ? 2 : 0;
    }
  }

  function setCamera(top = false) {
    if (!bounds) return;
    const rebarGroup = model === stockModel ? bars : importedOverlay;
    const viewBounds = mode === 'rebar' && rebarGroup
      ? new THREE.Box3().setFromObject(rebarGroup) : bounds.clone();
    const grid = model === stockModel ? groundGrid : customGrid;
    if (top && grid?.visible) viewBounds.union(new THREE.Box3().setFromObject(grid));
    const center = viewBounds.getCenter(new THREE.Vector3());
    const size = Math.max(.001,viewBounds.getSize(new THREE.Vector3()).length());
    const half = THREE.MathUtils.degToRad(camera.fov / 2);
    const angle = Math.min(half, Math.atan(Math.tan(half) * camera.aspect));
    const spans = viewBounds.getSize(new THREE.Vector3());
    const distance = top
      ? Math.max(spans.y,spans.x/camera.aspect)*.57/Math.tan(half)+spans.z/2
      : (size / 2) / Math.sin(angle);
    camera.near = Math.max(.001, distance / 5000);
    camera.far = distance * 25;
    camera.updateProjectionMatrix();
    camera.position.copy(new THREE.Vector3(...(top ? [0,-.001,1] : [1.4,-1.7,1.2]))
      .normalize().multiplyScalar(distance).add(center));
    orbit.target.copy(center);
    orbit.update();
  }

  function refreshImport() {
    if (model === stockModel) return;
    endSection();
    model.rotation.x = byId('zUpImport').checked ? 0 : Math.PI/2;
    model.updateMatrixWorld(true);
    bounds = new THREE.Box3().setFromObject(model);
    disposeOverlay();
    importedOverlay = importedPlan ? makeBars(importedPlan) : null;
    if (importedOverlay) {
      scene.add(importedOverlay);
      bounds.union(new THREE.Box3().setFromObject(importedOverlay));
    }
    if (customGrid) scene.remove(customGrid);
    customGrid = importedPlan?.grid ? createGroundGrid(importedPlan.grid,bounds) : null;
    if (customGrid) scene.add(customGrid);
    const center = (importedOverlay
      ? new THREE.Box3().setFromObject(importedOverlay) : bounds).getCenter(new THREE.Vector3());
    setAxes(importedPlan?.grid ?? {x:[['X Mitte',center.x]],y:[['Y Mitte',center.y]]});
    update();
    setCamera();
  }

  function useModel(next, stock = false, importing = false) {
    if (importing) {
      next = prepareImport(next);
      importedPlan = null;
    }
    if (model) scene.remove(model);
    model = next;
    if (stock) stockModel = next;
    parts = [];
    if (next === stockModel) {
      model.traverse(obj => {
        if (!obj.isMesh && !obj.isLine) return;
        const bar = byBeam.get(String(obj.userData.beamId));
        if (!bar || !materials[bar.material_etappe03]) return;
        if (bar.gruppe === 'Beton' || (obj.isLine && bar.koerper)) {
          obj.visible = false;
          return;
        }
        if (obj.isMesh && !obj.geometry.hasAttribute('normal')) obj.geometry.computeVertexNormals();
        obj.userData.part = bar;
        parts.push(obj);
      });
    }
    scene.add(model);
    model.updateMatrixWorld(true);
    bounds = new THREE.Box3().setFromObject(model);
    endSection();
    if (next === stockModel) {
      bounds.union(new THREE.Box3().setFromObject(foundations));
      if (!groundGrid) {
        groundGrid = createGroundGrid(plan.grid,bounds);
        scene.add(groundGrid);
      }
      bounds.union(new THREE.Box3().setFromObject(bars));
    }
    if (groundGrid) groundGrid.visible = next === stockModel;
    if (next !== stockModel) { refreshImport(); return; }
    disposeOverlay();
    if (customGrid) { scene.remove(customGrid); customGrid = null; }
    setAxes(plan.grid);
    update();
    setCamera();
  }

  const a = new THREE.Vector3(), b = new THREE.Vector3();
  const pointOnRay = new THREE.Vector3(), pointOnBar = new THREE.Vector3();
  const visiblePoint = p => !cutPlane || cutPlane.distanceToPoint(p) >= -1e-5;
  function nearBar(meshes = bars.children) {
    let best;
    let thresholdSquared = Infinity;
    for (const mesh of meshes) {
      const points = mesh.userData.centerline;
      for (let i = 1; i < points.length; i++) {
        a.copy(points[i - 1]);
        b.copy(points[i]);
        const distanceSquared = ray.ray.distanceSqToSegment(a, b, pointOnRay, pointOnBar);
        const depth = ray.ray.origin.distanceTo(pointOnRay);
        const fourPixels = 8 * depth * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / mount.clientHeight;
        const tolerance = cutDirection ? 8*sectionCamera.top/mount.clientHeight : fourPixels;
        if (visiblePoint(pointOnBar) && distanceSquared < tolerance ** 2 && distanceSquared < thresholdSquared) {
          thresholdSquared = distanceSquared;
          best = mesh;
        }
      }
    }
    return best;
  }

  let pointer;
  renderer.domElement.addEventListener('pointerdown', e => { pointer = [e.clientX,e.clientY]; });
  renderer.domElement.addEventListener('pointerup', e => {
    if (!pointer || Math.hypot(e.clientX-pointer[0],e.clientY-pointer[1]) > 6) return;
    const box = renderer.domElement.getBoundingClientRect();
    const coords = new THREE.Vector2((e.clientX-box.left)/box.width*2-1, 1-(e.clientY-box.top)/box.height*2);
    ray.setFromCamera(coords, cutDirection ? sectionCamera : camera);
    const clickableGrid = model === stockModel ? groundGrid : customGrid;
    if (clickableGrid?.visible) {
      const axis = ray.intersectObjects(clickableGrid.children.filter(item => item.userData.axis),false)[0];
      if (axis) {
        chooseAxis(axis.object.userData.axis);
        return;
      }
    }
    if (model !== stockModel && mode !== 'structure') {
      const meshes = importedOverlay?.children ?? importedMeshes.filter(item => item.position).map(item => item.mesh);
      const selected = ray.intersectObjects(meshes,false).find(hit => visiblePoint(hit.point))?.object
        ?? (importedOverlay ? nearBar(meshes) : null);
      if (selected) {
        const data = selected.userData.rebar;
        const position = data?.position ?? importedMeshes.find(item => item.mesh === selected)?.position;
        if (position) selection(position,data);
        return;
      }
    }
    if (bars.visible) {
      const mesh = ray.intersectObjects(bars.children, false).find(hit => visiblePoint(hit.point))?.object || nearBar();
      if (mesh) {
        selection(mesh.userData.rebar.position, mesh.userData.rebar);
        return;
      }
    }
    const hit = model?.visible
      ? ray.intersectObjects([...parts,...(foundations.visible ? foundations.children : [])], false)
        .find(item => visiblePoint(item.point))
      : null;
    if (!hit && clickableGrid?.visible) {
      const point = ray.ray.intersectPlane(
        new THREE.Plane(new THREE.Vector3(0,0,1), -clickableGrid.position.z),new THREE.Vector3());
      if (point) {
        const candidates = [];
        for (const kind of ['x','y']) {
          const other = kind === 'x' ? 'y' : 'x';
          const cross = activeGrid[other];
          if (point[other] < cross[0][1]-.45 || point[other] > cross.at(-1)[1]+.45) continue;
          for (const [name,coord] of activeGrid[kind]) {
            candidates.push({name,kind,coord,distance:Math.abs(point[kind]-coord)});
          }
        }
        const axis = candidates.sort((a,b)=>a.distance-b.distance)[0];
        if (axis?.distance < .11) {
          chooseAxis(axis);
          return;
        }
      }
    }
    if (hit?.object.userData.foundation) {
      const foundation = hit.object.userData.foundation;
      selection(null);
      byId('selection').textContent = `Betonfundament · ${foundation.strip} · ${fmt(foundation.length)} m`;
      return;
    }
    if (hit) {
      const bar = hit.object.userData.part;
      selection(null);
      byId('selection').textContent = `${titles[bar.material_etappe03]} · ${bar.nr} · ca. ${fmt(grossMass(bar))} kg`;
    }
  });
  function resize() {
    const width = mount.clientWidth, height = mount.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width,height,false);
    camera.aspect = width/height;
    camera.updateProjectionMatrix();
    fitSection();
  }
  new ResizeObserver(resize).observe(mount);
  resize();
  renderer.setAnimationLoop(() => { orbit.update(); renderer.render(scene,cutDirection ? sectionCamera : camera); });
  return {
    update, setCamera, endSection, useModel, refreshImport, importedPositions, isCustom: () => model !== stockModel,
    restore: () => useModel(stockModel),
  };
}

function setupInput(dropId, inputId, onFile, multiple = false) {
  const zone = byId(dropId), input = byId(inputId);
  const pick = files => { if (files.length) onFile(multiple ? [...files] : files[0]); };
  input.addEventListener('change', () => { pick(input.files); input.value = ''; });
  zone.addEventListener('dragover', event => { event.preventDefault(); zone.classList.add('drag'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag'));
  zone.addEventListener('drop', event => {
    event.preventDefault(); zone.classList.remove('drag'); pick(event.dataTransfer.files);
  });
}

function previewPlan(name) {
  planUrl = localPlans.get(name)?.url;
  if (!planUrl) return;
  const preview = byId('planPreview'), link = byId('openPlan');
  preview.src = link.href = planUrl;
  preview.hidden = link.hidden = false;
}
const planChoice = byId('planChoice');
planChoice.addEventListener('change', () => previewPlan(planChoice.value));
setupInput('planDrop','planFile',files => {
  const pdfs = files.filter(file => /\.pdf$/i.test(file.name));
  if (!pdfs.length) {
    byId('uploadStatus').textContent = 'Bitte Bewehrungspläne im PDF-Format auswählen.';
    return;
  }
  for (const file of pdfs) {
    const previous = localPlans.get(file.name);
    if (previous) URL.revokeObjectURL(previous.url);
    const sheet = file.name.match(/_E02_(2438|2448|2458|2648)(?=[_\-.])/i)?.[1];
    localPlans.set(file.name,{url:URL.createObjectURL(file),sheet});
  }
  planChoice.replaceChildren(...[...localPlans.keys()].map(name => new Option(name,name)));
  planChoice.hidden = localPlans.size < 2;
  planChoice.value = pdfs[0].name;
  previewPlan(planChoice.value);
  byId('uploadStatus').textContent = localPlans.size + ' Original-PDF(s) geladen.';
  if (viewer?.isCustom() && active) selection(active);
},true);

let modelRequest = 0;
const sheetNames = {
  2438:'Wände und Stützen', 2448:'Untere Deckenlage',
  2458:'Randnadeln und Träger', 2648:'Wandscheiben 105–108',
};
async function loadProjectCatalog() {
  const response = await fetch('./projekt6-plan-soll.csv');
  if (!response.ok) throw new Error('Positionsliste für Projekt 6 fehlt.');
  return (await response.text()).trim().split(/\r?\n/).slice(1).map(line => {
    const [sheet,,position,count] = line.split(',');
    return {sheet,position,count:Number(count),key:sheet + ' / ' + position};
  });
}
setupInput('modelDrop','modelFile',async file => {
  if (!viewer || !file.name.toLowerCase().endsWith('.glb')) {
    byId('uploadStatus').textContent = 'Bitte bei geladenem Viewer eine GLB-Datei auswählen. 3DM in Rhino als GLB exportieren.';
    return;
  }
  const request = ++modelRequest;
  byId('uploadStatus').textContent = file.name + ' wird geladen …';
  try {
    const bytes = await file.arrayBuffer();
    const result = await loader.parseAsync(bytes, './');
    let projectPlan;
    let catalog;
    if (crypto.subtle && bytes.byteLength === 1916120) {
      const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))]
        .map(byte => byte.toString(16).padStart(2,'0')).join('');
      if (hash === 'd7576f41e671a6d75ddc6fa0595425d7d92df09b2be869d9bb0d3104e7cd25fc') {
        projectPlan = readImportPlan(await json('./bauteil6-bewehrung.json'));
        catalog = await loadProjectCatalog();
      }
    }
    if (request !== modelRequest) return;
    byId('zUpImport').checked = false;
    viewer.useModel(result.scene,false,true);
    projectCatalog = catalog;
    if (projectPlan) {
      importedPlan = projectPlan;
      viewer.refreshImport();
    }
    selection(null);
    const count = showImportOptions();
    setMode(count ? 'combined' : 'structure');
    byId('restore').hidden = false;
    byId('uploadStatus').textContent = file.name + (projectPlan
      ? ' · Gebäude und Positionsliste E02 geladen. Original-PDFs für die Planansicht hinzufügen.'
      : count
      ? ' · ' + count + ' Bewehrungsgruppen erkannt.'
      : ' · Modell sichtbar. Für die Bewehrungsansicht Bewehrungsgeometrie mit Positionsnamen oder passende JSON-Daten laden.');
  } catch (error) {
    if (request === modelRequest) byId('uploadStatus').textContent = 'GLB konnte nicht geladen werden: ' + error.message;
  }
});

function readImportPlan(source) {
  if (!source || !Array.isArray(source.elements) || !source.elements.length || !source.positions
      || Array.isArray(source.positions)) {
    throw new Error('JSON benötigt positions und elements mit 3D-Stabkoordinaten in Metern.');
  }
  const positions = Object.create(null);
  for (const [id,row] of Object.entries(source.positions)) {
    if (!row || !Number.isFinite(row.diameter) || row.diameter <= 0) {
      throw new Error('Positionsdurchmesser in mm fehlt: ' + id);
    }
    positions[id] = {diameter:row.diameter,sheet:typeof row.sheet === 'string' ? row.sheet : null,
      detail:typeof row.detail === 'string' ? row.detail : '',
      page:Number.isInteger(row.page) && row.page > 0 ? row.page : null,modelMass:0,modelCount:0};
  }
  const elements = source.elements.map((item,i) => {
    const position = String(item?.position);
    const points = item?.points;
    if (!positions[position] || !Array.isArray(points) || points.length < 2 ||
      points.some(p => !Array.isArray(p) || p.length !== 3 || !p.every(Number.isFinite))) {
      throw new Error('Ungültige Position oder 3D-Koordinate bei Stab ' + (i+1));
    }
    let length = 0;
    for (let k=1;k<points.length;k++) {
      const segment = Math.hypot(...points[k].map((value,j)=>value-points[k-1][j]));
      if (!segment) throw new Error('Doppelte Stabkoordinate bei Stab ' + (i+1));
      length += segment;
    }
    positions[position].modelMass += length * 7850 * Math.PI * (positions[position].diameter/2000)**2;
    positions[position].modelCount++;
    return {position,points,id:String(item.id ?? ('Stab '+(i+1))),length};
  });
  let grid;
  if (source.grid != null) {
    grid = {};
    for (const kind of ['x','y']) {
      const items = source.grid[kind];
      if (!Array.isArray(items) || items.length < 2
          || items.some(pair => !Array.isArray(pair) || typeof pair[0] !== 'string' || !Number.isFinite(pair[1]))) {
        throw new Error('Das Achsraster benötigt beschriftete X- und Y-Koordinaten.');
      }
      grid[kind] = [...items].sort((a,b)=>a[1]-b[1]);
    }
  }
  return {positions,elements,grid,scope:typeof source.scope === 'string' ? source.scope : ''};
}

function drawProjectPositions() {
  const sheet = byId('projectSheet').value;
  const table = byId('projectPositions');
  table.replaceChildren();
  for (const record of projectCatalog?.filter(row => row.sheet === sheet) ?? []) {
    const row = document.createElement('tr');
    const label = document.createElement('th');
    label.scope = 'row';
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.position = record.key;
    button.textContent = record.position;
    button.setAttribute('aria-pressed', String(active === record.key));
    button.addEventListener('click', () => {
      if (mode === 'structure' && importedPlan.positions[record.key]?.modelCount) setMode('combined');
      selection(record.key);
    });
    label.append(button);
    const planned = document.createElement('td');
    planned.textContent = record.count;
    const modeled = document.createElement('td');
    modeled.textContent = importedPlan.positions[record.key]?.modelCount ?? 0;
    row.append(label,planned,modeled);
    table.append(row);
  }
}
byId('projectSheet').addEventListener('change', drawProjectPositions);

function showImportOptions() {
  const positions = viewer.importedPositions();
  byId('stockPanel').hidden = true;
  byId('importPanel').hidden = false;
  byId('importSettings').hidden = false;
  byId('importMass').textContent = importedPlan
    ? (importedPlan.scope ? importedPlan.scope + ' ' : '') +
      'Modellmasse der dargestellten Bewehrung: ca. ' + fmt(Object.values(importedPlan.positions)
      .reduce((sum,p) => sum+p.modelMass,0)) + ' kg (Stabdurchmesser, Länge und 7.850 kg/m³).'
    : 'Gewichte und Planpositionen aus einem Zusatzdatensatz können hier ergänzt werden.';
  const panel = byId('importGroups');
  panel.replaceChildren();
  byId('projectPlans').hidden = !projectCatalog;
  if (projectCatalog) {
    const sheet = byId('projectSheet');
    sheet.replaceChildren(...Object.entries(sheetNames).map(([id,name]) => new Option(id + ' · ' + name,id)));
    sheet.value = '2448';
    const planned = projectCatalog.reduce((sum,row) => sum + row.count,0);
    byId('projectCoverage').textContent = fmt(planned,0) + ' Stück laut Biegelisten · '
      + fmt(importedPlan.elements.length,0) + ' Stäbe in 3D';
    drawProjectPositions();
  }
  for (const position of projectCatalog ? [] : positions) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.position = position;
    button.textContent = position;
    button.setAttribute('aria-pressed','false');
    button.addEventListener('click',() => {
      if (mode === 'structure') setMode('combined');
      selection(position);
    });
    panel.append(button);
  }
  buttons.forEach(button => { button.disabled = !positions.length && button.dataset.mode !== 'structure'; });
  return positions.length;
}

setupInput('rebarDrop','rebarFile',async file => {
  if (!viewer?.isCustom()) {
    byId('uploadStatus').textContent = 'Bitte zuerst das eigene GLB laden, dem die Bewehrungsdaten zugeordnet werden sollen.';
    return;
  }
  const request = modelRequest;
  try {
    const source = readImportPlan(JSON.parse(await file.text()));
    if (request !== modelRequest) return;
    importedPlan = source;
    viewer.refreshImport();
    showImportOptions();
    setMode('combined');
    selection(null);
    byId('uploadStatus').textContent = file.name + ' · ' + source.elements.length + ' Bewehrungsstäbe geladen.';
  } catch(error) {
    if (request === modelRequest) byId('uploadStatus').textContent = 'Bewehrungsdaten konnten nicht geladen werden: ' + error.message;
  }
});
byId('neutralImport').addEventListener('change',() => viewer?.update());
byId('zUpImport').addEventListener('change',() => viewer?.refreshImport());

byId('restore').addEventListener('click', () => {
  ++modelRequest;
  projectCatalog = null;
  viewer.restore();
  byId('importPanel').hidden = true;
  byId('importSettings').hidden = true;
  byId('stockPanel').hidden = false;
  selection(null);
  setMode('combined');
  buttons.forEach(button => { button.disabled = false; });
  document.querySelectorAll('[data-position]').forEach(button => { button.disabled = false; });
  byId('restore').hidden = true;
  byId('uploadStatus').textContent = 'Stockerau-Modell wieder geöffnet.';
});
byId('reset').addEventListener('click', () => { selection(null); viewer?.endSection(); viewer?.setCamera(); });
byId('top').addEventListener('click', () => { viewer?.endSection(); viewer?.setCamera(true); });
buttons.forEach(button => button.addEventListener('click', () => {
  const refit = mode === 'rebar' || button.dataset.mode === 'rebar';
  setMode(button.dataset.mode);
  if (refit) viewer?.setCamera();
}));

try {
  const [rebarPlan, data] = await Promise.all([json('./bewehrung.json'), json('./data.json')]);
  plan = rebarPlan;
  renderPlan();
  renderMasses(data);
  const gltf = await loader.loadAsync('./model.glb');
  viewer = createViewer(data);
  viewer.useModel(gltf.scene, true);
  showStatus('');
} catch (error) {
  showStatus('3D-Ansicht konnte nicht gestartet werden: ' + error.message);
  console.error(error);
}
