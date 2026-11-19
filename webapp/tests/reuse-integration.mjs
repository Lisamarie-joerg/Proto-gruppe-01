import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {registerHooks} from 'node:module';
const base=path.resolve('webapp/static'),url=p=>pathToFileURL(path.join(base,p)).href;
registerHooks({resolve(s,c,n){return s==='three'?n(url('three/three.module.js'),c):n(s,c);}});
const THREE=await import(url('three/three.module.js'));
const core=await import(url('reuse-core.js'));
const {sourceFromHost,sourceSignature,assignHosts,meshTriangles}=await import(url('reuse-sources.js'));
const {GLTFLoader}=await import(url('three/addons/loaders/GLTFLoader.js'));
globalThis.ProgressEvent=class{};
const elements=new Map(),stageButtons=[];
class Element {
 set id(value){this._id=value;elements.set(value,this);}get id(){return this._id;}
 constructor(){this.children=[];this.listeners={};this.value='';this.checked=false;this.hidden=false;this.dataset={};this.classList={add(){},remove(){},toggle(){}};this.style={};}
 set innerHTML(html){this.html=html;for(const match of html.matchAll(/id="([^"]+)"/g)){const e=el(match[1]);if(new RegExp('id="'+match[1]+'"[^>]*checked').test(html))e.checked=true;}if(html.includes('data-reuse-stage'))for(const name of ['building','exploded','truck'])stageButtons.push(Object.assign(new Element(),{dataset:{reuseStage:name}}));}
 get innerHTML(){return this.html||'';}
 append(...items){this.children.push(...items);}prepend(...items){this.children.unshift(...items);}
 replaceChildren(...items){this.children=items;}addEventListener(event,fn){this.listeners[event]=fn;}
 setAttribute(key,value){this[key]=value;}querySelector(){return null;}scrollIntoView(){}
 querySelectorAll(selector){return selector==='input'?this.children.flatMap(c=>c.children.filter(e=>e.type==='checkbox')):[];}
 getContext(){return new Proxy({}, {get:()=>()=>{},set:()=>true});}
 getBoundingClientRect(){return {left:0,top:0,width:900,height:240};}
}
const el=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
globalThis.document={getElementById:el,createElement:()=>new Element(),createTextNode:text=>({text}),querySelector:s=>el(s),querySelectorAll:s=>s==='[data-reuse-stage]'?stageButtons:[],body:new Element()};
globalThis.Option=class extends Element {constructor(text,value){super();this.text=text;this.value=value;}};
globalThis.requestAnimationFrame=()=>1;globalThis.cancelAnimationFrame=()=>{};
globalThis.fetch=async relative=>new Response(fs.readFileSync(path.join(base,String(relative))));
globalThis.Worker=class {
 terminate(){this.stopped=true;}
 postMessage(data){Promise.resolve().then(()=>{if(this.stopped)return;try{this.onmessage({data:{type:'complete',plan:core.buildPlan(data.sources,data.settings)}});}catch(error){this.onmessage({data:{type:'error',message:error.message}});}});}
};
const {createReuseWorkflow}=await import(url('reuse-workflow.js'));
const bytes=fs.readFileSync(path.join(base,'projekt6/Bauteil6.glb'));
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
gltf.scene.rotation.x=Math.PI/2;gltf.scene.updateMatrixWorld(true);
const imported=JSON.parse(fs.readFileSync(path.join(base,'bauteil6-bewehrung.json')));
const meshes=[];gltf.scene.traverse(mesh=>{if(mesh.isMesh)meshes.push(mesh);});
const assigned=assignHosts(meshes,imported.hosts),sources=meshes.filter(mesh=>assigned.get(mesh)?.reinforcementExpected).map(mesh=>sourceFromHost(mesh,assigned.get(mesh)));
assert.equal(sources.length,imported.hosts.filter(h=>h.reinforcementExpected).length);
assert.equal(new Set(sources.map(s=>s.id)).size,sources.length);
const plan=JSON.parse(fs.readFileSync(path.join(base,'reuse-default-projekt6.json')));
assert.equal(plan.sourceSignature,sourceSignature(sources));assert.equal(plan.sourceIds.length,sources.length);
const ids=new Map(plan.parts.map(p=>[p.id,p]));
assert.equal(ids.size,plan.parts.length);
assert.equal(new Set(plan.removal).size,ids.size);assert.equal(new Set(plan.loading).size,ids.size);
for(const p of plan.parts){
 assert(p.mass<=plan.settings.liftLimit-plan.settings.rigging+.01);
 assert(p.load.height<=plan.settings.loadHeight+1e-6);
 assert(p.load.x>=plan.settings.gap-1e-6&&p.load.y>=plan.settings.gap-1e-6);
 assert(p.load.x+p.load.length<=plan.settings.deckLength-plan.settings.gap+1e-6);
 assert(p.load.y+p.load.width<=plan.settings.deckWidth-plan.settings.gap+1e-6);
}
for(const t of plan.trucks){
 assert(t.mass<=plan.settings.payload+.01);
 assert(Math.abs(t.parts.reduce((s,id)=>s+ids.get(id).mass,0)-t.mass)<1e-5);
 const parts=t.parts.map(id=>ids.get(id));
 for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++){
  const a=parts[i].load,b=parts[j].load;
  assert(a.x+a.length+plan.settings.gap<=b.x+1e-6||b.x+b.length+plan.settings.gap<=a.x+1e-6||a.y+a.width+plan.settings.gap<=b.y+1e-6||b.y+b.width+plan.settings.gap<=a.y+1e-6);
 }
}
assert(Math.abs(plan.audit.reduce((s,a)=>s+a.volume,0)-plan.parts.reduce((s,p)=>s+p.volume,0)-plan.lossVolume)<1e-5);
const scene=new THREE.Scene();let fits=0;
const workflow=createReuseWorkflow({scene,snapshot:()=>({sources,reinforcement:imported.elements.map(item=>({...item,host:item.host??'729',diameter:imported.positions[item.position].diameter}))}),onChange(){},fit(){fits++;assert(workflow.bounds());},endSection(){}});
el('reuseToggle').listeners.click();await el('reuseBuild').listeners.click();
assert(workflow.hasPlan(),el('reuseStatus').textContent);assert(workflow.isActive());assert.equal(el('reuseBuild').disabled,false);
const boxes=workflow.group.children.find(child=>child.isInstancedMesh);
const bars=workflow.group.children.filter(child=>child.isInstancedMesh)[1];
assert.equal(boxes.count,plan.parts.length);assert(bars.count>50000);
assert(workflow.bounds().getSize(new THREE.Vector3()).length()>20);
const pickPart=plan.parts.find(p=>p.category==='Treppen')||plan.parts[0];
workflow.group.updateMatrixWorld(true);
new THREE.Raycaster(new THREE.Vector3(...pickPart.center).add(new THREE.Vector3(0,0,100)),new THREE.Vector3(0,0,-1)).intersectObject(boxes);
el('reuseCatalogue').listeners.click({target:{closest:()=>({dataset:{part:pickPart.id}})}});
assert(el('reuseSelected').innerHTML.includes(pickPart.id));assert(el('reuseSelected').innerHTML.includes('Truck '+pickPart.truck));
assert.equal(Number(el('reuseTruck').value),pickPart.truck);assert(el('reuseCatalogue').innerHTML.includes('class="selected"'));
const color=new THREE.Color();boxes.getColorAt(plan.parts.findIndex(p=>p.id===pickPart.id),color);assert.equal(color.getHex(),0xff1495);
el('reuseShowTruck').onclick();
const actual=workflow.group.children.find(child=>child.isMesh&&!child.isInstancedMesh&&child.material.color.getHex()===0xff72b6);
assert(actual);assert(actual.matrix.determinant()>.99);
const matrix=new THREE.Matrix4();boxes.getMatrixAt(plan.parts.findIndex(p=>p.id===pickPart.id),matrix);
const truckBox=new THREE.Box3(new THREE.Vector3(-.5,-.5,-.5),new THREE.Vector3(.5,.5,.5)).applyMatrix4(matrix);
assert(Math.abs(truckBox.min.x-pickPart.load.x)<1e-4);assert(Math.abs(truckBox.max.y-pickPart.load.y-pickPart.load.width)<1e-4);
workflow.group.updateMatrixWorld(true);
const loadRay=new THREE.Raycaster(new THREE.Vector3(pickPart.load.x+pickPart.load.length/2,pickPart.load.y+pickPart.load.width/2,20),new THREE.Vector3(0,0,-1));
assert(loadRay.intersectObject(boxes).some(hit=>hit.instanceId===plan.parts.findIndex(p=>p.id===pickPart.id)),'Picking must update bounds when moving from building to truck.');
el('reuseNoFloors').onclick();assert.equal(workflow.bounds().max.x,plan.settings.deckLength);
for(let i=0;i<boxes.count;i++){boxes.getMatrixAt(i,matrix);assert.equal(matrix.determinant(),0);}
el('reuseAllFloors').onclick();assert(fits>0);
el('reuseTimeline').value=plan.parts.length+20;el('reuseTimeline').oninput();assert.match(el('reuseStep').textContent,/Loading 20/);
const visibleCount=()=>{let n=0;for(let i=0;i<boxes.count;i++){boxes.getMatrixAt(i,matrix);if(matrix.determinant()!==0)n++;}return n;};
assert(visibleCount()>0&&visibleCount()<=20);
el('reuseSequenceReset').onclick();assert.equal(visibleCount(),plan.parts.length);
const ray=new THREE.Raycaster(new THREE.Vector3(...pickPart.center).add(new THREE.Vector3(0,0,100)),new THREE.Vector3(0,0,-1));
assert(workflow.pick(ray));assert(el('reuseSelected').innerHTML.includes('Truck'));
workflow.reset();assert(!workflow.hasPlan());assert(!workflow.group.visible);assert.equal(workflow.group.children.length,0);
el('reuseToggle').listeners.click();el('reuse-liftLimit').value='-1';await el('reuseBuild').listeners.click();assert.match(el('reuseStatus').textContent,/Calculation stopped/);
console.log('Passed actual Project 6: '+sources.length+' source meshes, '+plan.parts.length+' products, '+plan.trucks.length+' non-overlapping truck loads; volume conservation; lifting limits; cache fingerprint; real Three scene; clipped reinforcement; linked selection; floor toggles; rigid truck transforms; sequence; reset; invalid settings.');
workflow.reset();
const stock=JSON.parse(fs.readFileSync(path.join(base,'bewehrung.json')));
const foundationSources=stock.foundations.map((f,i)=>{
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(f.length,f.width,f.height));
 const direction=new THREE.Vector3(...f.direction);
 mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(direction,new THREE.Vector3(...f.side),new THREE.Vector3(...f.up)));
 mesh.position.set(...f.start).addScaledVector(direction,f.length/2);
 return {id:'foundation-'+i,name:f.strip,storey:'Foundations',elevation:0,category:'Concrete foundation',triangles:meshTriangles(mesh)};
});
const stripIds=new Map(stock.foundations.map((f,i)=>[f.strip,'foundation-'+i]));
const stockWorkflow=createReuseWorkflow({scene,snapshot:()=>({sources:foundationSources,reinforcement:stock.elements.map(item=>({...item,host:stripIds.get(item.strip),diameter:stock.positions[item.position].diameter}))}),onChange(){},fit(){assert(stockWorkflow.bounds());},endSection(){}});
el('reuseToggle').listeners.click();await el('reuseBuild').listeners.click();
assert(stockWorkflow.hasPlan(),el('reuseStatus').textContent);
assert(stockWorkflow.group.children.filter(child=>child.isInstancedMesh).length===2);
assert(stockWorkflow.group.children.find(child=>child.isInstancedMesh).count>5);
stockWorkflow.reset();assert.equal(stockWorkflow.group.children.length,0);
console.log('Passed Pavilion catalogue: corrected foundation meshes, live worker calculation, clipped bars, initial camera bounds and reset.');
