import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {registerHooks} from 'node:module';
import assert from 'node:assert/strict';
const base=path.resolve('webapp/static');
const three=pathToFileURL(path.join(base,'three/three.module.js')).href;
registerHooks({resolve(s,c,n){return s==='three'?n(three,c):n(s,c);}});
let scene;
class Element {
  listeners={}; children=[]; options=[{}]; value=""; checked=false; dataset={}; clientWidth=1100;clientHeight=700;style={};
  classList={add(){},remove(){},toggle(){}};
  set id(value){this._id=value;els.set(value,this);}get id(){return this._id;}
  set innerHTML(value){this.html=value;for(const match of value.matchAll(/id="([^"]+)"/g)){const e=el(match[1]);if(new RegExp('id="'+match[1]+'"[^>]*checked').test(value))e.checked=true;}}
  get innerHTML(){return this.html??'';}
  addEventListener(name,fn){const previous=this.listeners[name];this.listeners[name]=previous?event=>{previous(event);fn(event);}:fn;}
  add(x){this.options.push(x);}prepend(x){this.children.unshift(x);}append(...x){this.children.push(...x);}
  replaceChildren(...x){this.children=x;}setAttribute(k,v){this[k]=v;}scrollIntoView(){}
  querySelector(){return null;}
  querySelectorAll(selector){return selector==='input'?this.children.flatMap(c=>(c.children??[]).filter(e=>e.type==='checkbox')):this.children.flatMap(row=>row.children?.[0]?.children??[]);}
  getBoundingClientRect(){return {left:0,top:0,width:1100,height:700};}
  show(){this.open=true;}close(){this.open=false;}
  getContext(){return new Proxy({}, {get:()=>()=>{}});}
}
const els=new Map();
const el=id=>{if(!els.has(id))els.set(id,new Element());return els.get(id);};
el('detailImage').parentElement=new Element(); el('showSchematic').checked=true;
const buttons=['structure','combined','rebar'].map(mode=>Object.assign(new Element(),{dataset:{mode}}));
globalThis.document={body:new Element(),createTextNode:text=>({textContent:text}),querySelector:el,getElementById:el,createElement:()=>new Element(),querySelectorAll:s=>s==='[data-mode]'?buttons:s==='#importGroups button'?el('importGroups').children:[]};
globalThis.window={};
globalThis.Option=class{constructor(text,value){Object.assign(this,{text,value});}};
globalThis.ResizeObserver=class{observe(){}};
globalThis.ProgressEvent=class{constructor(type,props){Object.assign(this,props);}};
globalThis.fetch=async url=>new Response(fs.readFileSync(path.join(base,String(url.url ?? url).replace(/^https?:\/\/test\//,''))));
const threeModule=await import(three);
globalThis.fakeThree={...threeModule,WebGLRenderer:class{
  domElement=new Element(); constructor(){globalThis.canvas=this.domElement;}
  setPixelRatio(){} setSize(){}
  setAnimationLoop(fn){fn();}
  render(value,camera){scene=value;globalThis.testCamera=camera;}
}};
const gltf=pathToFileURL(path.join(base,'three/addons/loaders/GLTFLoader.js')).href;
const code=fs.readFileSync(path.join(base,'viewport3d.js'),'utf8').split('\n').slice(5).join('\n');
globalThis.fakeThree.createReuseWorkflow=(await import(pathToFileURL(path.join(base,'reuse-workflow.js')))).createReuseWorkflow;
const {buildPlan}=await import(pathToFileURL(path.join(base,'reuse-core.js')));
globalThis.requestAnimationFrame=()=>1;globalThis.cancelAnimationFrame=()=>{};
globalThis.Worker=class{terminate(){this.stopped=true;}postMessage(data){Promise.resolve().then(()=>{if(!this.stopped)this.onmessage({data:{type:'complete',plan:buildPlan(data.sources,data.settings)}});});}};

globalThis.reuseSources=await import(pathToFileURL(path.join(base,'reuse-sources.js')));
await import('data:text/javascript;base64,'+Buffer.from("const THREE=globalThis.fakeThree; const createReuseWorkflow=THREE.createReuseWorkflow; const {assignHosts,meshTriangles,sourceFromHost}=globalThis.reuseSources; class OrbitControls {target=new THREE.Vector3();constructor(camera){this.camera=camera;}update(){this.camera.lookAt(this.target);this.camera.updateMatrixWorld();}} import {GLTFLoader} from '"+gltf+"';"+ code.replace("loader.loadAsync('./model.glb')","loader.loadAsync('http://test/model.glb')")).toString('base64'));

assert.match(el('status').textContent,/GLB-Modell importieren/);
assert.equal(el('stockPanel').hidden,true);
assert.equal(el('importPanel').hidden,true);
assert.equal(el('sectionAxis').disabled,true);
let visibleGeometry=0;
scene.traverseVisible(o=>{if(o.isMesh||o.isLine)visibleGeometry++;});
assert.equal(visibleGeometry,0);
const waitFor=async predicate=>{
  for(let n=0;n<500&&!predicate();n++)await new Promise(r=>setTimeout(r,20));
  assert(predicate(),'Import completion condition');
};
const importFile=(id,files)=>{
  el(id).files=files;
  el(id).listeners.change();
};
const fileAt=(name,relative)=>new File([fs.readFileSync(path.join(base,relative))],name);
importFile('modelFile',[fileAt('Pavillon.glb','model.glb')]);
await waitFor(()=>/Pavillon importiert/.test(el('uploadStatus').textContent));
assert.equal(el('stockPanel').hidden,false);
assert.equal(el('planChoice').children.length,0);
const stockBars=scene.children.find(o=>o.children.length===509&&o.children.every(m=>m.userData.rebar));
assert(stockBars);
assert.equal(stockBars.visible,false);
importFile('planFile',[fileAt('Pavillon-Bewehrungsplan.pdf','bewehrungsplan.pdf')]);
await waitFor(()=>/1 Original-PDF/.test(el('uploadStatus').textContent));
assert(stockBars.visible);
const chooseStock=position=>el('positions').listeners.click({target:{closest:()=>({dataset:{position}})}});
chooseStock('2');
assert.equal(stockBars.children.filter(m=>m.visible).length,60);
assert(stockBars.children.filter(m=>m.visible).every(m=>m.userData.rebar.position==='2'&&m.material.color.getHex()===0xff1495));
assert(el('detail').open);
assert.match(el('detailPlanLink').href,/^blob:/);
el('clearSelection').listeners.click();
assert.equal(stockBars.children.filter(m=>m.visible).length,509);
scene.updateMatrixWorld(true);
const stockItem=stockBars.children[0].userData.rebar;
const stockPoint=new threeModule.Vector3(...stockItem.points[0]).add(new threeModule.Vector3(...stockItem.points[1])).multiplyScalar(.5);
const stockScreen=stockPoint.project(globalThis.testCamera);
const stockEvent={clientX:(stockScreen.x+1)*550,clientY:(1-stockScreen.y)*350};
globalThis.canvas.listeners.pointerdown(stockEvent);
globalThis.canvas.listeners.pointerup(stockEvent);
const stockVisible=stockBars.children.filter(m=>m.visible);
assert(stockVisible.length>0&&stockVisible.length<509);
assert.equal(new Set(stockVisible.map(m=>m.userData.rebar.groupKey)).size,1);
assert.equal(stockVisible.length,stockBars.children.filter(m=>m.userData.rebar.groupKey===stockVisible[0].userData.rebar.groupKey).length);
assert(stockVisible.every(m=>m.material.color.getHex()===0xff1495));
el('clearSelection').listeners.click();

el('sectionAxis').value=JSON.stringify({name:'D',kind:'x',coord:10});
el('sectionAxis').listeners.change();
el('sectionPlus').listeners.click();
const caps=scene.children.find(m=>m.isMesh&&m.material?.polygonOffset&&m.material.color.getHex()===0);
const capCount=caps.geometry.getAttribute('position').count;
chooseStock('2');
assert(caps.geometry.getAttribute('position').count<capCount);
el('clearSelection').listeners.click();
assert.equal(caps.geometry.getAttribute('position').count,capCount);
importFile('modelFile',[fileAt('Projekt6.glb','projekt6/Bauteil6.glb')]);
await waitFor(()=>/Gebäude und Positionsliste/.test(el('uploadStatus').textContent));
assert.equal(el('stockPanel').hidden,true);
assert.equal(el('planChoice').children.length,0);
assert.equal(el('headerPlan').hidden,true);
assert.equal(el('planPreview').hidden,true);
assert.equal(el('detail').open,false);
const steel=scene.children.find(o=>o.children.some(m=>m.isInstancedMesh));
assert(steel&&!steel.visible);
const pdfFiles=['2438','2448','2458','2648'].map((sheet,i)=>fileAt('Umbenannter-Plan-'+i+'.pdf','projekt6/'+sheet+'.pdf'));
importFile('planFile',pdfFiles);
await waitFor(()=>/4 Original-PDF/.test(el('uploadStatus').textContent));
assert(steel.visible);
el('projectPositions').children[8].children[0].children[0].listeners.click();
assert.equal(steel.children.filter(m=>m.userData.rebar&&m.visible).length,81);
assert.equal(steel.children.find(m=>m.isInstancedMesh).visible,false);
assert.equal(el('detailImage').src,'./projekt6/2448.png');
assert.match(el('detailPlanLink').href,/^blob:.*#page=1$/);
el('clearSelection').listeners.click();
assert.equal(steel.children.filter(m=>m.userData.rebar&&m.visible).length,101);

el('buildingCategory').value='';
el('buildingCategory').listeners.change();
const schematic=steel.children.find(m=>m.isInstancedMesh);
const first=schematic.userData.instances.find(item=>item.category==='Treppen');
scene.updateMatrixWorld(true);
const point=new threeModule.Vector3(...first.points[0]).add(new threeModule.Vector3(...first.points[1])).multiplyScalar(.5);
const screen=point.project(globalThis.testCamera);
const e={clientX:(screen.x+1)*550,clientY:(1-screen.y)*350};
globalThis.canvas.listeners.pointerdown(e);
globalThis.canvas.listeners.pointerup(e);
assert.match(el('importSelection').textContent,/gleiche Stäbe/);
const color=new threeModule.Color();
const keys=new Set();
let visible=0,hidden=0;
for(let i=0;i<schematic.count;i++){
  const a=schematic.instanceMatrix.array;
  if(Math.hypot(a[i*16],a[i*16+1],a[i*16+2])===0){hidden++;continue;}
  schematic.getColorAt(i,color);
  assert.equal(color.getHex(),0xff1495);
  keys.add(schematic.userData.instances[i].groupKey);
  visible++;
}
assert.equal(keys.size,1);
const actualKey=[...keys][0];
assert.equal(visible,schematic.userData.instances.filter(item=>item.groupKey===actualKey).length);
assert(visible>0&&hidden>0);
assert(steel.children.filter(m=>m.userData.rebar).every(m=>m.visible===(m.userData.rebar.groupKey===actualKey)));
el('clearSelection').listeners.click();
assert.equal(schematic.visible,true);
el('emptyViewport').listeners.click();
visibleGeometry=0;
scene.traverseVisible(o=>{if(o.isMesh||o.isLine)visibleGeometry++;});
assert.equal(visibleGeometry,0);
assert.equal(el('planChoice').children.length,0);
assert.equal(el('sectionAxis').disabled,true);
importFile('modelFile',[fileAt('Pavillon-erneut.glb','model.glb')]);
await waitFor(()=>/Pavillon importiert/.test(el('uploadStatus').textContent));
assert.equal(el('stockPanel').hidden,false);
assert.equal(el('planChoice').children.length,0);
console.log('Passed presentation sequence: empty startup; pavilion and PDF; group isolation and caps; project change clears PDFs; project 6 plus four renamed PDFs; instanced bar isolation; reset to empty and repeat import.');

importFile('planFile',[fileAt('Pavillon-Bewehrungsplan.pdf','bewehrungsplan.pdf')]);
await waitFor(()=>/1 Original-PDF/.test(el('uploadStatus').textContent));
el('reuseToggle').listeners.click();
await el('reuseBuild').listeners.click();
await waitFor(()=>el('reuseResults').hidden===false);
const reuseRoot=scene.children.find(o=>o.name==='Reuse transport envelopes');
assert(reuseRoot.visible);
el('reuseRebarOverview').onclick();
assert(!reuseRoot.visible);
const restored=scene.children.find(o=>o.children.length===509&&o.children.every(m=>m.userData.rebar));
assert(restored.visible);
scene.updateMatrixWorld(true);
const restoredPoint=new threeModule.Vector3(...restored.children[0].userData.rebar.points[0]).project(globalThis.testCamera);
const restoredEvent={clientX:(restoredPoint.x+1)*550,clientY:(1-restoredPoint.y)*350};
globalThis.canvas.listeners.pointerdown(restoredEvent);globalThis.canvas.listeners.pointerup(restoredEvent);
const selectedBars=restored.children.filter(m=>m.visible);
assert(selectedBars.length>0&&selectedBars.length<509);
assert.equal(new Set(selectedBars.map(m=>m.userData.rebar.groupKey)).size,1);
assert(selectedBars.every(m=>m.material.color.getHex()===0xff1495));
el('clearSelection').listeners.click();
assert.equal(restored.children.filter(m=>m.visible).length,509);
console.log('Passed real workflow integration: enter catalogue, calculate, leave via reinforcement overview, pick an individual bar, isolate identical geometry, restore all bars.');
importFile('modelFile',[fileAt('Projekt6.glb','projekt6/Bauteil6.glb')]);
await waitFor(()=>/Gebäude und Positionsliste/.test(el('uploadStatus').textContent));
importFile('planFile',['2438','2448','2458','2648'].map(sheet=>fileAt(sheet+'.pdf','projekt6/'+sheet+'.pdf')));
await waitFor(()=>/4 Original-PDF/.test(el('uploadStatus').textContent));
el('reuseToggle').listeners.click();await el('reuseBuild').listeners.click();
await waitFor(()=>el('reuseResults').hidden===false);assert(reuseRoot.visible);
buttons.find(button=>button.dataset.mode==='rebar').listeners.click();assert(!reuseRoot.visible);
const instanceGroup=scene.children.find(group=>group.children.some(m=>m.isInstancedMesh&&m.userData.instances?.length===56345));
const nativeBars=instanceGroup.children.find(m=>m.isInstancedMesh);assert(instanceGroup.visible&&nativeBars.visible);
scene.updateMatrixWorld(true);
const nearTarget=nativeBars.userData.instances[0],nearPoint=new threeModule.Vector3(...nearTarget.points[0]).add(new threeModule.Vector3(...nearTarget.points[1])).multiplyScalar(.5).project(globalThis.testCamera);
const nearEvent={clientX:(nearPoint.x+1)*550+1,clientY:(1-nearPoint.y)*350};
const originalRaycast=threeModule.Raycaster.prototype.intersectObjects;
threeModule.Raycaster.prototype.intersectObjects=()=>[];
globalThis.canvas.listeners.pointerdown(nearEvent);globalThis.canvas.listeners.pointerup(nearEvent);
threeModule.Raycaster.prototype.intersectObjects=originalRaycast;
const isolatedKeys=new Set();let isolatedInstances=0;
for(let i=0;i<nativeBars.count;i++){const offset=i*16,m=nativeBars.instanceMatrix.array;if(Math.abs(m[offset])+Math.abs(m[offset+5])+Math.abs(m[offset+10])>1e-12){isolatedInstances++;isolatedKeys.add(nativeBars.userData.instances[i].groupKey);}}
assert(isolatedInstances>0&&isolatedInstances<56345);assert.equal(isolatedKeys.size,1);
el('clearSelection').listeners.click();
console.log('Passed Project 6 real catalogue → legacy reinforcement overview and pixel-tolerant individual instanced-bar selection.');
