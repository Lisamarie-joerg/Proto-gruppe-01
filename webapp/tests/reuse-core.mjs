import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const base=path.resolve('webapp/static');
const THREE=await import(pathToFileURL(path.join(base,'three/three.module.js')));
const core=await import(pathToFileURL(path.join(base,'reuse-core.js')));
const raw=geometry=>geometry.toNonIndexed().getAttribute('position').array;
const cube=raw(new THREE.BoxGeometry(2,2,2));
assert(Math.abs(core.clipMesh(cube,[[-1,-1,-1],[1,1,1]]).volume-8)<1e-6);
assert(Math.abs(core.clipMesh(cube,[[-1,-1,-1],[0,1,1]]).volume-4)<1e-6);
assert(Math.abs(core.clipMesh(cube,[[-.5,-.5,-.5],[.5,.5,.5]]).volume-1)<1e-6);
assert(core.auditMesh(cube));
const shape=new THREE.Shape();
shape.moveTo(-1.5,-1.5);shape.lineTo(1.5,-1.5);shape.lineTo(1.5,1.5);shape.lineTo(-1.5,1.5);shape.closePath();
const hole=new THREE.Path();hole.moveTo(-.5,-.5);hole.lineTo(-.5,.5);hole.lineTo(.5,.5);hole.lineTo(.5,-.5);hole.closePath();shape.holes.push(hole);
const ring=new THREE.ExtrudeGeometry(shape,{depth:1,bevelEnabled:false});
const ringRaw=ring.index?raw(ring):ring.getAttribute('position').array;
assert(Math.abs(core.clipMesh(ringRaw,[[-1.5,-1.5,0],[1.5,1.5,1]]).volume-8)<1e-5);
assert(Math.abs(core.clipMesh(ringRaw,[[-1.5,-1.5,0],[0,1.5,1]]).volume-4)<1e-5);
const settings={...core.DEFAULTS,liftLimit:3000,rigging:0,deckLength:5,deckWidth:2.45,payload:5000,kerf:.01};
const result=core.buildPlan([{id:'A',name:'Slab',storey:'L1',elevation:3,category:'Decken und Fundamente',triangles:cube}],settings);
assert(result.parts.length>1);
assert(result.parts.every(p=>p.mass<=3000.01&&core.orientations(p.dimensions,settings).length));
assert(Math.abs(result.parts.reduce((s,p)=>s+p.volume,0)+result.lossVolume-8)<1e-5);
for(const truck of result.trucks){
 const parts=result.parts.filter(p=>p.truck===truck.id);
 assert(truck.mass<=settings.payload+.01);
 for(const p of parts){assert(p.load.x>=settings.gap-1e-7);assert(p.load.x+p.load.length<=settings.deckLength-settings.gap+1e-6);assert(p.load.y+p.load.width<=settings.deckWidth-settings.gap+1e-6);}
 for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++){
  const a=parts[i].load,b=parts[j].load;
  assert(a.x+a.length<=b.x+1e-6||b.x+b.length<=a.x+1e-6||a.y+a.width<=b.y+1e-6||b.y+b.width<=a.y+1e-6);
 }
}
assert.deepEqual(core.clipSegment([-2,0,0],[2,0,0],[[-1,-1,-1],[1,1,1]]),[[-1,0,0],[1,0,0]]);
assert.equal(core.clipSegment([-2,3,0],[2,3,0],[[-1,-1,-1],[1,1,1]]),null);
console.log('Passed: closed mesh volumes, holes, exact clipping, mass and dimension limits, kerf conservation, truck non-overlap and payload, rebar clipping.');

