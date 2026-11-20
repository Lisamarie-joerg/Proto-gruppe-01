import fs from 'node:fs';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import * as T from '../static/three/three.module.js';
import {assignHosts,meshTriangles} from '../static/reuse-sources.js';
import {frameFor,clearance,contains,segmentClearance} from '../static/rebar-geometry.js';
registerHooks({resolve(s,c,next){return s==='three'?next(new URL('../static/three/three.module.js',import.meta.url).href,c):next(s,c);}});
globalThis.ProgressEvent=class{};
const {GLTFLoader}=await import('../static/three/addons/loaders/GLTFLoader.js');
const base=new URL('../static/',import.meta.url),data=JSON.parse(fs.readFileSync(new URL('bauteil6-bewehrung.json',base)));
const cube=new T.BoxGeometry(2,2,2).toNonIndexed(),cubeFrame=frameFor(cube.getAttribute('position').array,new T.Vector3(0,0,1));
assert(contains(cubeFrame,cubeFrame.local([0,0,0])));assert(!contains(cubeFrame,cubeFrame.local([2,0,0])));
assert(Math.abs(segmentClearance(cubeFrame,cubeFrame.local([-.8,0,.95]),cubeFrame.local([.8,0,.95]))-.05)<1e-6);
assert.equal(segmentClearance(cubeFrame,cubeFrame.local([-2,0,0]),cubeFrame.local([2,0,0])),0);
const bytes=fs.readFileSync(new URL('projekt6/Bauteil6.glb',base)),gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
gltf.scene.rotation.x=Math.PI/2;gltf.scene.updateMatrixWorld(true);const meshes=[];gltf.scene.traverse(m=>{if(m.isMesh)meshes.push(m);});
const assigned=assignHosts(meshes,data.hosts),frames=new Map();for(const [mesh,host] of assigned)if(host.reinforcementExpected)frames.set(host.id,frameFor(meshTriangles(mesh),new T.Vector3(0,0,1)));
const origins=new Set(),byHost=new Map();let verticalWalls=0,horizontalWalls=0,inclinedStairs=0,links=0,checked=0;
assert.equal(data.originalPlanAxes.length,101);assert.equal(new Set(data.elements.map(e=>e.id)).size,data.elements.length);
for(const item of data.elements){const diameter=data.positions[item.position].diameter;origins.add(item.origin);
  const length=item.points.slice(1).reduce((s,p,i)=>s+Math.hypot(...p.map((x,k)=>x-item.points[i][k])),0);assert(length<=7.50001);
  if(!item.schematic){assert.equal(item.origin,'plan_reconstruction');assert(item.planAxisId);assert(data.positions[item.position].sheet);continue;}
  assert.equal(item.origin,'schematic');assert(!data.positions[item.position].sheet,'Assumed reinforcement must not acquire a PDF position.');
  if(!byHost.has(item.host))byHost.set(item.host,[]);byHost.get(item.host).push(item);
  const frame=frames.get(item.host);assert(frame);const samples=item.points.map(frame.local);
  for(let i=1;i<item.points.length;i++)samples.push(frame.local(item.points[i].map((x,k)=>(x+item.points[i-1][k])/2)));
  for(const point of samples){const distance=clearance(frame,point)-diameter/2000;
    assert(distance>=.0398,`${item.id}: cover ${distance}`);
    assert(contains(frame,point),item.id+' outside its host mesh');checked++;}
  const a=new T.Vector3(...item.points[0]),b=new T.Vector3(...item.points.at(-1)),direction=b.clone().sub(a).normalize();
  if(item.category==='Wände'){verticalWalls+=Math.abs(direction.z)>.8;horizontalWalls+=Math.abs(direction.z)<.05;}
  if(item.category==='Treppen')inclinedStairs+=Math.abs(direction.z)>.15&&Math.abs(direction.z)<.95;
  if(item.kind==='closed-link'){links++;assert(a.distanceTo(b)<1e-6);assert(item.points.length>8);}
}
for(const [id,items] of byHost){const kinds=new Set(items.map(e=>e.kind)),host=data.hosts.find(h=>h.id===id);
  if(/Stützen|Träger/.test(host.category)){assert(kinds.has('closed-link')&&kinds.has('longitudinal'));
    const link=items.find(e=>e.kind==='closed-link'),p=link.points.map(a=>new T.Vector3(...a)),normal=p[1].clone().sub(p[0]).cross(p[2].clone().sub(p[0])).normalize();
    const bar=items.find(e=>e.kind==='longitudinal'),direction=new T.Vector3(...bar.points[1]).sub(new T.Vector3(...bar.points[0])).normalize();assert(Math.abs(normal.dot(direction))>.999,'Links must be transverse to longitudinal rods.');
  }else assert(kinds.has('mat-U')&&kinds.has('mat-V'),'Both grid directions are required.');
}
assert(origins.has('plan_reconstruction')&&origins.has('schematic'));assert(verticalWalls>100&&horizontalWalls>100&&inclinedStairs>10&&links>100);
assert.equal(data.audit.counts.schematicBars,data.elements.filter(e=>e.schematic).length);
console.log(`Passed provenance, max bar length, ${checked} mesh containment / 40 mm cover samples, wall horizontal+vertical grids, inclined stair grids, longitudinal cages with transverse closed links and explicit open hosts.`);
