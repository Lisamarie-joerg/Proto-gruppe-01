import * as THREE from './three/three.module.js';

// Rhino exports can contain identically named slab edges. Three.js appends suffixes
// to these names; use the original world bounds to keep their IFC identity distinct.
export function assignHosts(meshes,hosts) {
  const normalize=name=>String(name||'').replace(/[^a-z0-9]/gi,'').toLowerCase();
  const names=new Map(),used=new Set(),result=new Map();
  for(const host of hosts){const key=normalize(host.name);if(!names.has(key))names.set(key,[]);names.get(key).push(host);}
  const nearest=(mesh,candidates)=>{
    const box=new THREE.Box3().setFromObject(mesh),values=[...box.min,...box.max];let best=null,distance=Infinity;
    for(const host of candidates){if(used.has(host)||!host.bounds)continue;const target=host.bounds.flat();
      const delta=Math.max(...values.map((v,i)=>Math.abs(v-target[i])));if(delta<distance){distance=delta;best=host;}}
    return distance<.001?best:null;
  };
  for(const mesh of meshes){const candidates=(names.get(normalize(mesh.name))||[]).filter(h=>!used.has(h));
    const host=candidates.length===1?candidates[0]:nearest(mesh,candidates);
    if(host){result.set(mesh,host);used.add(host);}}
  for(const mesh of meshes)if(!result.has(mesh)){const host=nearest(mesh,hosts);if(host){result.set(mesh,host);used.add(host);}}
  return result;
}

export function meshTriangles(mesh) {
  mesh.updateWorldMatrix(true,false);
  const position=mesh.geometry.getAttribute('position'),index=mesh.geometry.index;
  const count=index?index.count:position.count, result=new Float64Array(count*3),p=new THREE.Vector3();
  for(let i=0;i<count;i++) {
    p.fromBufferAttribute(position,index?index.getX(i):i).applyMatrix4(mesh.matrixWorld);
    result.set(p.toArray(),i*3);
  }
  return result;
}
export function sourceFromHost(mesh,host) {
  return {id:String(host.id),name:host.name,storey:host.storey||'Unassigned',
    elevation:Number(host.ifc?.IfcStoreyElevation)||host.bounds?.[0]?.[2]||0,
    category:host.category,ifc:host.ifc,triangles:meshTriangles(mesh),
    barEvidence:host.id==='729'?'Partial plan reconstruction; erection laps assumed'+(host.count?'; schematic mats also present':'')
      :host.count?'Schematic mats / cages only; no PDF proof':'Reinforcement not modelled — execution plan required'};
}
export function sourceSignature(sources) {
  let hash=2166136261;
  const add=value=>{hash=Math.imul(hash^(value|0),16777619)>>>0;};
  for(const source of sources){for(const char of [source.id,source.name,source.storey,source.elevation,source.category,source.barEvidence].join('|'))add(char.charCodeAt(0));add(source.triangles.length);
    for(const value of source.triangles)add(Math.round(value*10000));}
  return hash.toString(16);
}
