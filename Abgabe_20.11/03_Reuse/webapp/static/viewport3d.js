import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {createReuseWorkflow} from './reuse-workflow.js';
import {meshTriangles,sourceFromHost,assignHosts} from './reuse-sources.js';

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
const stockLegend = byId('materialLegend').innerHTML;
const loader = new GLTFLoader();

let mode = 'combined';
let active = null;
let activeGroup = null;
let plan;
let planUrl;
const localPlans = new Map();
let importedPlan;
let projectCatalog;
let viewer;
let projectKind = null;
let shapeGroups=new Map();

function rebarOrigin(item){return item.origin??(item.schematic?'schematic':item.planAxisId?'plan_reconstruction':'unverified');}
function evidenceMatches(item){const filter=byId('rebarOrigin').value;const origin=rebarOrigin(item);return !filter||filter==='plan'&&origin==='plan_reconstruction'||filter==='schematic'&&origin==='schematic'||filter==='unverified'&&origin==='unverified';}

async function json(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(url + ' · HTTP ' + res.status);
  return res.json();
}
async function contentHash(bytes) {
  if (!crypto.subtle) return null;
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))]
    .map(byte => byte.toString(16).padStart(2,'0')).join('');
}
const planHashes = {
  '069772f8a6a7b4af1301d6d6fc94d491e4fa1e0505a5dbd232fd545697a1303b':'2438',
  '39a57322b1480686593811c6d2f880e413bc30eb178665e63aa27da68f2c1b79':'2448',
  '5e706b82c55dfb3e3dee59d613886c0730c2596a8a7ef2986460d39b95183e9f':'2458',
  '305d7331c142665f82d94d96dbcc3850435236a9244eaf7925131e031750bbed':'2648',
};

function rebarGroupKey(item, diameter) {
  const distance = (a,b) => Math.hypot(...a.map((value,i) => value-b[i]));
  const points = [];
  for (const point of item.points) {
    if (!points.length || distance(points.at(-1),point) > .000001) points.push(point);
  }
  // Extra vertices on a straight length do not change its bending shape.
  for (let i=1;i<points.length-1;) {
    const a=points[i-1], b=points[i], c=points[i+1];
    if (Math.abs(distance(a,b)+distance(b,c)-distance(a,c)) < .0000001) points.splice(i,1);
    else i++;
  }
  let length = 0;
  for (let i=1;i<points.length;i++) length += distance(points[i-1],points[i]);
  const closed = points.length>2 && distance(points[0],points.at(-1)) < .000001;
  if (closed) points.pop();
  let simplifyClosed = closed;
  while (simplifyClosed && points.length>3) {
    simplifyClosed = false;
    for (let i=0;i<points.length;i++) {
      const a=points[(i+points.length-1)%points.length], b=points[i], c=points[(i+1)%points.length];
      if (Math.abs(distance(a,b)+distance(b,c)-distance(a,c)) < .0000001) {
        points.splice(i,1);
        simplifyClosed = true;
        break;
      }
    }
  }
  const describe = ordered => {
    const measurements = [];
    for (let i=0;i<ordered.length;i++) {
      for (let j=i+1;j<ordered.length;j++) measurements.push(Math.round(distance(ordered[i],ordered[j])*1000));
    }
    // Signed volumes preserve the handedness of non-planar bending shapes.
    const turns = [];
    for (let i=0;i<ordered.length-3;i++) {
      const origin=ordered[i];
      const u=ordered[i+1].map((value,j)=>value-origin[j]);
      const v=ordered[i+2].map((value,j)=>value-origin[j]);
      const w=ordered[i+3].map((value,j)=>value-origin[j]);
      const volume=u[0]*(v[1]*w[2]-v[2]*w[1])-u[1]*(v[0]*w[2]-v[2]*w[0])+u[2]*(v[0]*w[1]-v[1]*w[0]);
      const area=Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]);
      turns.push(Math.abs(volume)<Math.max(1e-9,area*.00001) ? 0 : Math.sign(volume));
    }
    return measurements.join(',')+';'+turns.join(',');
  };
  const candidates = [];
  for (const ordered of [points,[...points].reverse()]) {
    for (let shift=0;shift<(closed ? ordered.length : 1);shift++) {
      candidates.push(describe([...ordered.slice(shift),...ordered.slice(0,shift)]));
    }
  }
  return [Math.round(diameter*1000),Math.round(length*1000),closed ? 'closed' : 'open',
    points.length,candidates.sort()[0]].join('|');
}

function matchesRebar(item) {
  return activeGroup ? item.groupKey === activeGroup : !active || item.position === active;
}

function renderShapeGroups(){
  shapeGroups=new Map();const grouped=new Map();
  for(const item of importedPlan?.elements??[]){
    if(!evidenceMatches(item)||item.schematic&&!byId('showSchematic').checked)continue;
    const key=item.groupKey??rebarGroupKey(item,importedPlan.positions[item.position].diameter);item.groupKey=key;
    if(!grouped.has(key))grouped.set(key,{key,item,count:0,plan:0,assumed:0});
    const g=grouped.get(key);g.count++;g.plan+=rebarOrigin(item)==='plan_reconstruction';g.assumed+=Boolean(item.schematic);
  }
  const list=[...grouped.values()].sort((a,b)=>importedPlan.positions[a.item.position].diameter-importedPlan.positions[b.item.position].diameter||b.item.length-a.item.length);
  const options=[new Option('Alle Stäbe anzeigen','')];
  list.forEach((g,i)=>{const id='G'+(i+1);shapeGroups.set(id,g);const diameter=importedPlan.positions[g.item.position].diameter;
    options.push(new Option(`Ø${diameter} · ${fmt(g.item.length,3)} m · ${g.item.kind==='closed-link'?'Bügel':g.item.points.length>2?'gebogen':'gerade'} · ${g.count} Stäbe (Plan ${g.plan} / Annahme ${g.assumed})`,id));});
  byId('rebarShapeGroup').replaceChildren(...options);
  byId('rebarShapeGroup').value=[...shapeGroups].find(([,g])=>g.key===activeGroup)?.[0]??'';
  const items=importedPlan?.elements??[],p=items.filter(e=>rebarOrigin(e)==='plan_reconstruction').length,s=items.filter(e=>e.schematic).length;
  byId('rebarEvidenceSummary').textContent=`${p} blaue Abschnitte mit Planbezug · ${s} orange schematische Stäbe · ${items.length-p-s} ungeprüfte Importstäbe. ${importedPlan?.audit?.counts?.planAxes??''} ursprüngliche Planachsen; Lage und Montagestöße sind angenähert.`;
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
  if(position&&!item){const dataset=viewer?.isCustom()?importedPlan:plan;item=dataset?.elements.filter(e=>e.position===position).sort((a,b)=>(b.length??0)-(a.length??0))[0]??null;}
  active = position;
  activeGroup = item?.groupKey ?? null;
  if(activeGroup&&importedPlan){
    byId('buildingCategory').value=byId('buildingStorey').value=byId('buildingHost').value='';
    drawBuildingHosts();
  }
  byId('clearSelection').hidden = !position;
  if (!viewer?.hasModel()) return;
  const dataset=viewer.isCustom()?importedPlan:plan;
  const same=dataset?.elements.filter(e=>matchesRebar(e)&&(!viewer.isCustom()||evidenceMatches(e)))??[];
  const planCount=same.filter(e=>rebarOrigin(e)==='plan_reconstruction').length;
  byId('rebarSelectionAudit').textContent=activeGroup?`${same.length} von ${dataset.elements.length} Stäben ausgewählt · ${planCount} mit Planbezug · ${same.filter(e=>e.schematic).length} schematisch · übrige Stäbe ausgeblendet`:position&&!item?'Planposition ohne zugeordnete 3D-Stäbe. Keine Modellierung als Nachweis vorhanden.':'Keine Gruppenisolation aktiv.';
  byId('rebarShapeGroup').value=[...shapeGroups].find(([,g])=>g.key===activeGroup)?.[0]??'';
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
    if (row?.schematic) {
      byId('importSelection').textContent = row.detail + ' · ' + row.modelCount + ' Stababschnitte · ca. '
        + fmt(row.modelMass) + ' kg · ohne Zuordnung zu einer PDF-Position.';
    }
    if (activeGroup && importedPlan) {
      const same = importedPlan.elements.filter(element => matchesRebar(element));
      byId('importSelection').textContent = item.id + ' · ' + same.length + ' gleiche Stäbe · '
        + fmt(item.length) + ' m · Ø' + row.diameter + ' mm';
    }
    const sheet = record?.sheet ?? row?.sheet;
    const selectedPlan = item?.schematic?null:sheet ? [...localPlans.values()].find(file => file.sheet === sheet)
      : rebarOrigin(item??{})==='plan_reconstruction'?[...localPlans.values()].find(file => file.url === planUrl):null;
    const selectedPlanUrl = selectedPlan?.url;
    byId('projectPositions').querySelectorAll('button').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.position === position));
    });
    if (position && selectedPlanUrl) {
      byId('detailTitle').textContent = 'Planposition ' + position;
      byId('detailText').textContent = (item?'PLANBEZUG — 3D-Lage rekonstruiert; Montagestöße gegebenenfalls angenommen. ':'PLANPOSITION — noch keine 3D-Geometrie zugeordnet. ')+(row?.detail || amount || '');
      const url = selectedPlanUrl + (row?.page ? '#page=' + row.page : '');
      byId('detailImage').parentElement.hidden = true;
      byId('detailPlanLink').href = url;
      byId('detailPdf').hidden = false;
      byId('detailPdf').src = url;
      if (selectedPlan?.image) {
        byId('detailImage').parentElement.hidden = false;
        byId('detailImage').src = selectedPlan.image;
        byId('detailOriginal').href = selectedPlan.image;
        byId('detailPdf').hidden = true;
      }
      if (!detail.open) detail.show();
    } else {
      if(detail.open)detail.close();byId('detailPdf').src='about:blank';
      if(item?.schematic)byId('importSelection').textContent+=' · SCHEMATISCH — kein Nachweis aus dem PDF. '+(item.kind??'')+' · '+(item.surface??'');
      if (sheet) byId('importSelection').textContent += ' · Originalplan ' + sheet + ' laden.';
      if (detail.open) detail.close();
    }
    return;
  }
  byId('detailImage').parentElement.hidden = false;
  byId('detailPdf').hidden = true;
  byId('detailPlanLink').href = planUrl ?? './bewehrungsplan.pdf';
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
  const equivalents = item && plan.elements.filter(element => matchesRebar(element)).length;
  selected.textContent = item
    ? `${item.id} · ${fmt(item.length)} m · ca. ${fmt(barMass)} kg · ${equivalents} gleiche Stäbe · Ø${row.diameter} mm`
    : `Position ${position} · ${row.modelCount} Modellstäbe · ca. ${fmt(row.modelMass)} kg im Modell`;
  if (planUrl) {
    if (!detail.open) detail.show();
  } else {
    if (detail.open) detail.close();
    selected.textContent += ' · Bewehrungsplan importieren, um das Detail zu öffnen.';
  }
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
  let reuse;
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
  const ordinary = new THREE.MeshBasicMaterial({ color: 0x237bca });
  const unverified = new THREE.MeshBasicMaterial({color:0x858f98});
  const highlighted = new THREE.MeshBasicMaterial({ color: 0xff1495 });
  const muted = new THREE.MeshBasicMaterial({ color: 0x7b8584, transparent: true, opacity: .40, depthWrite: false });
  function makeBars(dataset) {
    const group = new THREE.Group();
    const schematic = dataset.elements.filter(item => item.schematic);
    for (const item of dataset.elements) {
      item.origin??=item.schematic?'schematic':dataset===plan||dataset.positions[item.position].sheet?'plan_reconstruction':'unverified';
      item.length=item.points.slice(1).reduce((sum,p,i)=>sum+Math.hypot(...p.map((v,k)=>v-item.points[i][k])),0);
      item.groupKey = rebarGroupKey(item,dataset.positions[item.position].diameter);
      if (item.schematic) continue;
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
    if (schematic.length) {
      const material = new THREE.MeshBasicMaterial({color:0xffffff});
      const count=schematic.reduce((sum,item)=>sum+item.points.length-1,0);
      const mesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(1,1,1,6),material,count);
      const matrix = new THREE.Matrix4();
      const up = new THREE.Vector3(0,1,0);
      const rotation = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      const instances=[],pickItems=[];let index=0;
      schematic.forEach(item => {
        pickItems.push({item,index,points:item.points});
        for(let segment=1;segment<item.points.length;segment++){
        const a = new THREE.Vector3(...item.points[segment-1]);
        const b = new THREE.Vector3(...item.points[segment]);
        rotation.setFromUnitVectors(up,b.clone().sub(a).normalize());
        const radius = dataset.positions[item.position].diameter / 2000;
        scale.set(radius,a.distanceTo(b),radius);
        matrix.compose(a.add(b).multiplyScalar(.5),rotation,scale);
        mesh.setMatrixAt(index,matrix);
        mesh.setColorAt(index,new THREE.Color(0xbf6b20));
        instances.push(item);index++;
        }
      });
      mesh.userData.instances = instances;mesh.userData.pickItems=pickItems;
      mesh.userData.originalMatrices = mesh.instanceMatrix.array.slice();
      group.add(mesh);
    }
    return group;
  }
  function disposeOverlay() {
    if (!importedOverlay) return;
    scene.remove(importedOverlay);
    importedOverlay.children.forEach(mesh => mesh.geometry.dispose());
    importedOverlay.children.filter(mesh => mesh.isInstancedMesh).forEach(mesh => {
      mesh.material.dispose();
      mesh.dispose();
    });
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
  let hostById = new Map();
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
    updateCaps();
    byId('sectionZoom').hidden = false;
  }

  function updateCaps() {
    cutSurfaces.geometry.dispose();
    let dataset = model === stockModel ? plan : importedPlan;
    if (model !== stockModel && dataset) {
      dataset = {...dataset,elements:dataset.elements.filter(item =>
        (!item.schematic || byId('showSchematic').checked) &&
        hostMatches(hostById.get(item.host ?? '729'))&&evidenceMatches(item))};
    }
    if (dataset && active) dataset = {...dataset,elements:dataset.elements.filter(matchesRebar)};
    cutSurfaces.geometry = dataset ? sectionCaps(dataset,cutPlane,axisChoice.kind) : new THREE.BufferGeometry();
    cutSurfaces.visible = Boolean(dataset) && mode !== 'structure';
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
  function hostMatches(host) {
    const category = byId('buildingCategory').value;
    const hostId = byId('buildingHost').value;
    const storey = byId('buildingStorey').value;
    return (!category || category === host?.category) && (!hostId || hostId === host?.id)
      && (!storey || storey === host?.storey);
  }

  function update() {
    if (reuse?.isActive() && reuse.hasPlan()) {
      if(model)model.visible=false;
      bars.visible=foundations.visible=cutSurfaces.visible=false;
      if(importedOverlay)importedOverlay.visible=false;
      if(groundGrid)groundGrid.visible=false;
      if(customGrid)customGrid.visible=false;
      return;
    }
    if (!model) {
      bars.visible = foundations.visible = cutSurfaces.visible = false;
      if (groundGrid) groundGrid.visible = false;
      if (customGrid) customGrid.visible = false;
      if (importedOverlay) importedOverlay.visible = false;
      return;
    }
    const custom = model !== stockModel;
    bars.visible = !custom && mode !== 'structure';
    cutSurfaces.visible = Boolean(cutDirection) && (bars.visible || (custom && importedPlan && mode !== 'structure'));
    if (importedOverlay) importedOverlay.visible = custom && mode !== 'structure';
    if (custom) {
      const showConcrete = mode === 'combined' && (importedOverlay || importedMeshes.some(item => item.position));
      for (const item of importedMeshes) {
        if (item.concrete) item.concrete.opacity = Number(byId('concreteOpacity').value) || .25;
        item.mesh.visible = item.position ? !importedPlan && mode !== 'structure' : mode !== 'rebar';
        if (item.position && active) item.mesh.visible = item.mesh.visible && item.position === active;
        if (importedPlan?.hosts?.length) item.mesh.visible = item.mesh.visible && hostMatches(item.host);
        item.mesh.material = item.position ? item.rebar[item.position === active ? 1 : active ? 2 : 0]
          : showConcrete && item.concrete ? item.concrete : byId('neutralImport').checked ? item.neutral : item.material;
      }
    }
    const selectedOverlayPosition = importedPlan?.positions[active]?.modelCount ? active : null;
    for (const mesh of importedOverlay?.children ?? []) {
      if (mesh.isInstancedMesh) {
        mesh.visible = byId('showSchematic').checked;
        const selected = new THREE.Color(0xff1495);
        const normal = new THREE.Color(0xbf6b20);
        const hiddenMatrix = new THREE.Matrix4().makeScale(0,0,0).toArray();
        let anyVisible = false;
        mesh.userData.instances.forEach((item,index) => {
          const visible = hostMatches(hostById.get(item.host)) && matchesRebar(item) && evidenceMatches(item);
          anyVisible ||= visible;
          const original = mesh.userData.originalMatrices;
          const offset = index * 16;
          mesh.instanceMatrix.array.set(visible ? original.subarray(offset,offset+16) : hiddenMatrix,offset);
          mesh.setColorAt(index,active && matchesRebar(item) ? selected : normal);
        });
        mesh.instanceMatrix.needsUpdate = true;
        mesh.boundingSphere=null;mesh.boundingBox=null;
        mesh.instanceColor.needsUpdate = true;
        mesh.visible = mesh.visible && anyVisible;
        continue;
      }
      mesh.visible = !importedPlan?.hosts?.length || hostMatches(hostById.get('729'));
      mesh.visible = mesh.visible && matchesRebar(mesh.userData.rebar)&&evidenceMatches(mesh.userData.rebar);
      mesh.material = active && matchesRebar(mesh.userData.rebar) ? highlighted
        : rebarOrigin(mesh.userData.rebar)==='plan_reconstruction'?ordinary:unverified;
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
      const matches = matchesRebar(item);
      mesh.visible = matches;
      mesh.material = active && matches ? highlighted : ordinary;
      mesh.renderOrder = active && matches ? 2 : 0;
    }
    if (cutDirection) updateCaps();
  }

  function setCamera(top = false, override = null) {
    if (!bounds || !model) return;
    const rebarGroup = model === stockModel ? bars : importedOverlay;
    let viewBounds = mode === 'rebar' && rebarGroup
      ? new THREE.Box3().setFromObject(rebarGroup) : bounds.clone();
    const category = byId('buildingCategory').value;
    const storey = byId('buildingStorey').value;
    const hostId = byId('buildingHost').value;
    const selectedHost = importedPlan?.hosts?.find(host => host.id === hostId);
    if (model !== stockModel && selectedHost?.bounds) {
      viewBounds.min.set(...selectedHost.bounds[0]);
      viewBounds.max.set(...selectedHost.bounds[1]);
    }
    if (model !== stockModel && (category || storey) && importedPlan && !selectedHost) {
      const points = importedPlan.elements.filter(item => hostMatches(hostById.get(item.host ?? '729'))).flatMap(item => item.points);
      if (points.length) viewBounds.setFromPoints(points.map(p => new THREE.Vector3(...p)));
    }
    const grid = model === stockModel ? groundGrid : customGrid;
    if (top && grid?.visible) viewBounds.union(new THREE.Box3().setFromObject(grid));
    viewBounds=override || reuse?.bounds() || viewBounds;
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
    reuse?.reset();
    endSection();
    model.rotation.x = byId('zUpImport').checked ? 0 : Math.PI/2;
    model.updateMatrixWorld(true);
    const assignedHosts=assignHosts(importedMeshes.map(item=>item.mesh),importedPlan?.hosts??[]);
    hostById = new Map((importedPlan?.hosts ?? []).map(host => [host.id,host]));
    importedMeshes.forEach(item => {
      item.host = assignedHosts.get(item.mesh);
      if (item.host?.category === 'Mauerwerk') {
        const materials = Array.isArray(item.material) ? item.material : [item.material];
        materials.forEach(material => material.color.setHex(0xba9c78));
      }
      if (item.host && !item.concrete) {
        item.concrete = new THREE.MeshBasicMaterial({color:0xaeb7bb,transparent:true,opacity:.25,depthWrite:false,
          side:THREE.DoubleSide});
      }
    });
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
    reuse?.reset();
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
    let best,score=Infinity;
    for(const mesh of meshes) {
      if(!mesh.visible)continue;
      const candidates=mesh.userData.instances
        ? mesh.userData.pickItems??mesh.userData.instances.map((item,index)=>({item,index,points:item.points}))
        : [{item:mesh.userData.rebar,points:mesh.userData.centerline}];
      for(const candidate of candidates) {
        if(!candidate.points||!candidate.item)continue;
        if(mesh.isInstancedMesh) {
          const o=candidate.index*16,m=mesh.instanceMatrix.array;
          if(Math.abs(m[o])+Math.abs(m[o+5])+Math.abs(m[o+10])<1e-12)continue;
        }
        for(let i=1;i<candidate.points.length;i++) {
          const p=candidate.points[i-1],q=candidate.points[i];
          p.isVector3?a.copy(p):a.fromArray(p);q.isVector3?b.copy(q):b.fromArray(q);
          const distanceSquared=ray.ray.distanceSqToSegment(a,b,pointOnRay,pointOnBar);
          const depth=ray.ray.origin.distanceTo(pointOnRay);
          const tolerance=cutDirection?10*sectionCamera.top/mount.clientHeight
            :10*depth*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))/mount.clientHeight;
          const next=distanceSquared/(tolerance*tolerance)+depth*.00000001;
          if(visiblePoint(pointOnBar)&&distanceSquared<tolerance*tolerance&&next<score) {
            score=next;best={mesh,item:candidate.item};
          }
        }
      }
    }
    return best;
  }

  let pointer;
  renderer.domElement.addEventListener('pointerdown', e => { pointer = [e.clientX,e.clientY]; });
  renderer.domElement.addEventListener('pointerup', e => {
    if (!model) return;
    if (!pointer || Math.hypot(e.clientX-pointer[0],e.clientY-pointer[1]) > 6) return;
    const box = renderer.domElement.getBoundingClientRect();
    const coords = new THREE.Vector2((e.clientX-box.left)/box.width*2-1, 1-(e.clientY-box.top)/box.height*2);
    ray.setFromCamera(coords, cutDirection ? sectionCamera : camera);
    if(reuse?.isActive() && reuse.pick(ray))return;
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
      const hit = ray.intersectObjects(meshes.filter(mesh => mesh.visible),false).find(hit => visiblePoint(hit.point));
      const selected = hit ? {mesh:hit.object,item:hit.object.userData.instances?.[hit.instanceId]??hit.object.userData.rebar} : (importedOverlay ? nearBar(meshes) : null);
      if (selected) {
        const data = selected.item;
        const position = data?.position ?? importedMeshes.find(item => item.mesh === selected.mesh)?.position;
        if (position) selection(position,data);
        return;
      }
    }
    if (model !== stockModel && mode !== 'rebar') {
      const hit = ray.intersectObjects(importedMeshes.map(item => item.mesh).filter(mesh => mesh.visible),false)
        .find(hit => visiblePoint(hit.point));
      const host = hit && importedMeshes.find(item => item.mesh === hit.object)?.host;
      if (host) {
        byId('buildingCategory').value = host.category;
        drawBuildingHosts(host.id);
        selection(null);
        update();
        byId('importSelection').textContent = host.name + ' · ' + host.count + ' geometrische Stababschnitte · '
          + host.status;
        showHostInfo(host);
        return;
      }
    }
    if (bars.visible) {
      const hitBar=ray.intersectObjects(bars.children.filter(mesh=>mesh.visible),false).find(hit=>visiblePoint(hit.point))?.object;
      const picked=hitBar?{mesh:hitBar,item:hitBar.userData.rebar}:nearBar();
      if(picked) {
        selection(picked.item.position,picked.item);
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
  reuse=createReuseWorkflow({scene,onChange:update,endSection,onRebarOverview:()=>{
    byId('buildingCategory').value=byId('buildingStorey').value=byId('buildingHost').value='';
    drawBuildingHosts();byId('showSchematic').checked=true;selection(null);setMode('rebar');setCamera();
  },fit:box=>setCamera(false,box),snapshot:()=>{
    if(!model)return {sources:[],reinforcement:[]};
    if(model===stockModel){
      const sources=foundations.children.map((mesh,i)=>({id:'foundation-'+i,name:mesh.userData.foundation.strip,
        storey:'Foundations',elevation:0,category:'Concrete foundation',triangles:meshTriangles(mesh),
        barEvidence:'P-01 reinforcement reconstruction'}));
      const stripIds=new Map(foundations.children.map((mesh,i)=>[mesh.userData.foundation.strip,'foundation-'+i]));
      return {sources,reinforcement:plan.elements.map(item=>({...item,host:stripIds.get(item.strip),diameter:plan.positions[item.position].diameter}))};
    }
    return {sources:importedMeshes.filter(item=>item.host?.reinforcementExpected).map(item=>sourceFromHost(item.mesh,item.host)),
      reinforcement:(importedPlan?.elements??[]).map(item=>({...item,host:item.host??'729',diameter:importedPlan.positions[item.position].diameter}))};
  }});
  update();
  renderer.setAnimationLoop(() => { orbit.update(); renderer.render(scene,cutDirection ? sectionCamera : camera); });
  return {
    update, setCamera, endSection, useModel, refreshImport, importedPositions, isCustom: () => model !== stockModel,
    hasModel: () => Boolean(model),
    clear: () => {
      reuse.reset();
      if (model) scene.remove(model);
      model = null;
      bounds = null;
      disposeOverlay();
      endSection();
      update();
    },
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
  byId('headerPlan').href = planUrl;
  byId('headerPlan').hidden = false;
  byId('headerPlan').textContent = 'Importierten Originalplan öffnen ↗';
}
function clearPlans() {
  for (const file of localPlans.values()) {
    if (file.url.startsWith('blob:')) URL.revokeObjectURL(file.url);
  }
  localPlans.clear();
  planUrl = null;
  planChoice.replaceChildren();
  planChoice.hidden = true;
  byId('planPreview').src = 'about:blank';
  byId('planPreview').hidden = true;
  byId('openPlan').hidden = true;
  byId('headerPlan').hidden = true;
  byId('detailPdf').src = 'about:blank';
  if (detail.open) detail.close();
}
function setViewerEnabled(enabled) {
  buttons.forEach(button => { button.disabled = !enabled; });
  for (const id of ['reset','top','sectionAxis']) byId(id).disabled = !enabled;
}
const planChoice = byId('planChoice');
planChoice.addEventListener('change', () => previewPlan(planChoice.value));
setupInput('planDrop','planFile',async files => {
  if (!viewer?.hasModel()) {
    byId('uploadStatus').textContent = 'Bitte zuerst das zugehörige GLB-Modell importieren.';
    return;
  }
  const pdfs = files.filter(file => /\.pdf$/i.test(file.name));
  if (!pdfs.length) {
    byId('uploadStatus').textContent = 'Bitte Bewehrungspläne im PDF-Format auswählen.';
    return;
  }
  const request = modelRequest;
  try {
    const prepared = await Promise.all(pdfs.map(async file => {
      const hash = await contentHash(await file.arrayBuffer());
      const knownSheet = projectKind === 'project6' ? planHashes[hash] : null;
      const sheet = knownSheet ?? file.name.match(/_E02_(2438|2448|2458|2648)(?=[_\-.])/i)?.[1];
      return {file,sheet,image:knownSheet ? './projekt6/' + knownSheet + '.png' : null};
    }));
    if (request !== modelRequest) return;
    for (const {file,sheet,image} of prepared) {
      const previous = localPlans.get(file.name);
      if (previous?.url.startsWith('blob:')) URL.revokeObjectURL(previous.url);
      localPlans.set(file.name,{url:URL.createObjectURL(file),sheet,image});
    }
    planChoice.replaceChildren(...[...localPlans.keys()].map(name => new Option(name,name)));
    planChoice.hidden = localPlans.size < 2;
    planChoice.value = pdfs[0].name;
    previewPlan(planChoice.value);
    byId('uploadStatus').textContent = localPlans.size + ' Original-PDF(s) geladen.';
    if (mode === 'structure' && (projectKind === 'stock' || viewer.importedPositions().length)) setMode('combined');
    if (active) selection(active,(projectKind==='stock'?plan:importedPlan)?.elements.find(item=>item.groupKey===activeGroup&&item.position===active));
  } catch(error) {
    if (request === modelRequest) byId('uploadStatus').textContent = 'PDF konnte nicht importiert werden: ' + error.message;
  }
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
async function loadCustomModel(file) {
  byId('rebarOrigin').value='';byId('showSchematic').checked=true;
  if (!viewer || !file.name.toLowerCase().endsWith('.glb')) {
    byId('uploadStatus').textContent = 'Bitte bei geladenem Viewer eine GLB-Datei auswählen. 3DM in Rhino als GLB exportieren.';
    return;
  }
  const request = ++modelRequest;
  byId('uploadStatus').textContent = file.name + ' wird geladen …';
  try {
    const bytes = await file.arrayBuffer();
    const hash = await contentHash(bytes);
    if (hash === '6fd7b2273e968fd0e29732ff1d1b5f5aa6f15f3e8c7c7dea2708bf1583e8d894') {
      if (request !== modelRequest) return;
      clearPlans();
      showStockModel();
      byId('uploadStatus').textContent = file.name + ' · Pavillon importiert. Jetzt den Bewehrungsplan als PDF importieren.';
      return;
    }
    const result = await loader.parseAsync(bytes, './');
    let projectPlan;
    let catalog;
    if (hash && bytes.byteLength === 1916120) {
      if (hash === 'd7576f41e671a6d75ddc6fa0595425d7d92df09b2be869d9bb0d3104e7cd25fc') {
        projectPlan = readImportPlan(await json('./bauteil6-bewehrung.json'));
        catalog = await loadProjectCatalog();
      }
    }
    if (request !== modelRequest) return;
    clearPlans();
    projectKind = projectPlan ? 'project6' : 'custom';
    importedPlan = null;
    active = null;
    activeGroup = null;
    byId('zUpImport').checked = false;
    viewer.useModel(result.scene,false,true);
    projectCatalog = catalog;
    byId('buildingCategory').value = '';
    byId('buildingHost').value = '';
    byId('buildingStorey').value = '';
    if (projectPlan) {
      importedPlan = projectPlan;
      viewer.refreshImport();
    }
    selection(null);
    const count = showImportOptions();
    setViewerEnabled(true);
    buttons.forEach(button => { button.disabled = !count && button.dataset.mode !== 'structure'; });
    setMode('structure');
    byId('materialLegend').hidden = false;
    showStatus('');
    byId('uploadStatus').textContent = file.name + (projectPlan
      ? ' · Gebäude und Positionsliste E02 geladen. Original-PDFs für die Planansicht hinzufügen.'
      : count
      ? ' · ' + count + ' Bewehrungsgruppen erkannt.'
      : ' · Modell sichtbar. Für die Bewehrungsansicht Bewehrungsgeometrie mit Positionsnamen oder passende JSON-Daten laden.');
  } catch (error) {
    if (request === modelRequest) byId('uploadStatus').textContent = 'GLB konnte nicht geladen werden: ' + error.message;
  }
}
setupInput('modelDrop','modelFile',loadCustomModel);

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
    positions[id] = {diameter:row.diameter,schematic:Boolean(row.schematic),origin:row.origin,category:row.category,host:row.host,
      sheet:typeof row.sheet === 'string' ? row.sheet : null,
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
    return {position,points,id:String(item.id ?? ('Stab '+(i+1))),length,
      schematic:Boolean(item.schematic??positions[position].schematic),origin:item.origin??positions[position].origin,host:item.host,category:item.category,
      kind:item.kind,surface:item.surface,evidence:item.evidence,planAxisId:item.planAxisId,detailingAssumed:item.detailingAssumed};
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
  return {positions,elements,grid,hosts:source.hosts ?? [],audit:source.audit,assumptions:source.assumptions,scope:typeof source.scope === 'string' ? source.scope : ''};
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
  renderShapeGroups();
  byId('stockPanel').hidden = true;
  byId('importPanel').hidden = false;
  byId('importSettings').hidden = false;
  byId('buildingControls').hidden = !importedPlan?.hosts?.length;
  if (importedPlan?.hosts?.length) {
    const hosts = importedPlan.hosts;
    const concrete = hosts.filter(host => host.reinforcementExpected);
    byId('buildingCoverage').textContent = hosts.filter(host => host.count).length + ' von ' + concrete.length
      + ' Betonbauteilen mit schematischen Matten / Körben. '
      + concrete.filter(host => !host.count).length + ' Beton-Geometrien sind offen. '
      + hosts.filter(host => !host.reinforcementExpected).length + ' Mauerwerksbauteile laut Rhino-Material.';
    const storeys = [...new Set(hosts.map(host => host.storey).filter(Boolean))].sort();
    const storeySelect = byId('buildingStorey');
    storeySelect.replaceChildren(new Option('Alle Geschosse',''),...storeys.map(name => new Option(name,name)));
    storeySelect.value = '';
    byId('projectTitle').textContent = 'Projekt 6 · Tragwerk und Bewehrung';
    document.title = 'Projekt 6 · Tragwerk und Bewehrung';
    byId('materialLegend').innerHTML = '<span><i class="evidence-blue"></i>Blau: Planbezug / rekonstruiert</span>'
      + '<span><i class="wood"></i>Orange: schematische Matten / Körbe</span>'
      + '<span><i class="pink"></i>Gleiche Stäbe ausgewählt</span>';
    drawBuildingHosts();
  }
  byId('importMass').textContent = importedPlan
    ? (importedPlan.scope ? importedPlan.scope + ' ' : '') +
      'Modellmasse der dargestellten Bewehrung: ca. ' + fmt(Object.values(importedPlan.positions)
      .reduce((sum,p) => sum+p.modelMass,0)) + ' kg (Stabdurchmesser, Länge und 7.850 kg/m³).'
    : 'Gewichte und Planpositionen aus einem Zusatzdatensatz können hier ergänzt werden.';
  if (importedPlan?.hosts?.length) {
    const sum = schematic => Object.values(importedPlan.positions)
      .filter(row => row.schematic === schematic).reduce((sum,row) => sum + row.modelMass,0);
    byId('importMass').textContent = 'Rekonstruierte E02-Stäbe ca. ' + fmt(sum(false)) + ' kg. '
      + 'Geometrische Ergänzungen unter den gewählten Annahmen ca. ' + fmt(sum(true)) + ' kg.';
  }
  const panel = byId('importGroups');
  panel.replaceChildren();
  byId('projectPlans').hidden = !projectCatalog;
  if (projectCatalog) {
    const sheet = byId('projectSheet');
    sheet.replaceChildren(...Object.entries(sheetNames).map(([id,name]) => new Option(id + ' · ' + name,id)));
    sheet.value = '2448';
    const planned = projectCatalog.reduce((sum,row) => sum + row.count,0);
    byId('projectCoverage').textContent = fmt(planned,0) + ' Stück laut Biegelisten · '
      + fmt(importedPlan.audit?.counts?.planAxes??importedPlan.elements.filter(item=>!item.schematic).length,0)+' Planachsen / '
      + fmt(importedPlan.elements.filter(item => !item.schematic).length,0) + ' rekonstruierte Montageabschnitte in 3D. '
      + fmt(importedPlan.elements.filter(item => item.schematic).length,0) + ' geometrische Ergänzungen im Gebäude.';
    drawProjectPositions();
  }
  for (const position of projectCatalog ? [] : positions.filter(id => !importedPlan?.positions[id]?.schematic)) {
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
  if (!viewer?.hasModel() || !viewer.isCustom()) {
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
byId('concreteOpacity').addEventListener('input',() => viewer?.update());
byId('showSchematic').addEventListener('change',() => {
  renderShapeGroups();
  viewer?.endSection();
  viewer?.update();
});
byId('rebarOrigin').addEventListener('change',()=>{selection(null);renderShapeGroups();viewer?.update();});
byId('rebarShapeGroup').addEventListener('change',()=>{const group=shapeGroups.get(byId('rebarShapeGroup').value);selection(group?.item.position??null,group?.item??null);});
byId('buildingCategory').addEventListener('change',() => {
  drawBuildingHosts();
  selection(null);
  viewer?.endSection();
  viewer?.update();
  viewer?.setCamera();
});
function drawBuildingHosts(selected = '') {
  const category = byId('buildingCategory').value;
  const storey = byId('buildingStorey').value;
  const select = byId('buildingHost');
  select.replaceChildren(new Option('Alle Bauteile',''),...(importedPlan?.hosts ?? [])
    .filter(host => !category || category === host.category)
    .filter(host => !storey || storey === host.storey)
    .map(host => new Option(host.name + ' · ' + host.count + ' Abschnitte',host.id)));
  select.value = selected;
}
function showHostInfo(host) {
  const ratio = Object.entries(host?.ifc ?? {}).find(([key]) => /bewehrungsgrad/i.test(key));
  byId('buildingHostInfo').textContent = host
    ? [host.storey,host.ifc?.IfcClass,host.ifc?.Material,host.ifc?.GlobalId,
      host.status,...(host.rebarWarnings??[]),ratio ? 'IFC-Bewehrungsgrad ' + ratio[1] : ''].filter(Boolean).join(' · ')
    : '';
}
byId('buildingStorey').addEventListener('change',() => {
  drawBuildingHosts();
  selection(null);
  showHostInfo(null);
  viewer?.endSection();
  viewer?.update();
  viewer?.setCamera();
});
byId('buildingHost').addEventListener('change',() => {
  selection(null);
  viewer?.endSection();
  viewer?.update();
  viewer?.setCamera();
  const host = importedPlan?.hosts?.find(host => host.id === byId('buildingHost').value);
  if (host) byId('importSelection').textContent = host.name + ' · ' + host.count + ' geometrische Abschnitte · ' + host.status;
  showHostInfo(host);
});
byId('zUpImport').addEventListener('change',() => viewer?.refreshImport());

function showStockModel() {
  projectKind = 'stock';
  importedPlan = null;
  projectCatalog = null;
  byId('buildingCategory').value = '';
  byId('buildingHost').value = '';
  byId('buildingStorey').value = '';
  byId('projectTitle').textContent = 'Pavillon Stockerau';
  document.title = 'Stockerau · Tragwerk und Bewehrung';
  byId('materialLegend').innerHTML = stockLegend;
  byId('materialLegend').hidden = false;
  byId('headerPlan').href = './bewehrungsplan.pdf';
  byId('headerPlan').textContent = 'Originalplan P-01 ↗';
  viewer.restore();
  byId('importPanel').hidden = true;
  byId('importSettings').hidden = true;
  byId('stockPanel').hidden = false;
  selection(null);
  setMode('structure');
  buttons.forEach(button => { button.disabled = false; });
  document.querySelectorAll('[data-position]').forEach(button => { button.disabled = false; });
  setViewerEnabled(true);
  showStatus('');
}

function emptyViewport() {
  byId('rebarOrigin').value='';byId('rebarShapeGroup').replaceChildren(new Option('Alle Stäbe anzeigen',''));shapeGroups.clear();
  ++modelRequest;
  viewer?.clear();
  importedPlan = null;
  projectCatalog = null;
  projectKind = null;
  active = null;
  activeGroup = null;
  clearPlans();
  byId('stockPanel').hidden = true;
  byId('importPanel').hidden = true;
  byId('importSettings').hidden = true;
  byId('materialLegend').hidden = true;
  byId('clearSelection').hidden = true;
  byId('projectTitle').textContent = 'Projekt importieren';
  document.title = 'Bewehrung · Projektimport';
  setViewerEnabled(false);
  showStatus('GLB-Modell importieren, danach den zugehörigen PDF-Bewehrungsplan.');
  byId('uploadStatus').textContent = 'Bereit für den Import eines Projekts.';
}
byId('emptyViewport').addEventListener('click',emptyViewport);
byId('clearSelection').addEventListener('click',() => selection(null));
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
  emptyViewport();
} catch (error) {
  showStatus('3D-Ansicht konnte nicht gestartet werden: ' + error.message);
  console.error(error);
}
