import * as THREE from './three/three.module.js';
import {DEFAULTS,validateSettings,clipMesh,clipSegment,worldPoint} from './reuse-core.js';
import {sourceSignature} from './reuse-sources.js';

const $=id=>document.getElementById(id),fmt=(n,d=1)=>Number(n).toLocaleString('en-GB',{maximumFractionDigits:d});
const palette=[0x388d85,0xc78443,0x667fcc,0x9a64b1,0x5d9770,0xbd6e77,0x8c9160,0x558ba4];
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dimensions=p=>p.dimensions.map(n=>fmt(n,2)).join(' × ');

export function createReuseWorkflow({scene,snapshot,onChange,fit,endSection}) {
  const panel=document.createElement('section');panel.className='panel reuse-panel';panel.id='reusePanel';panel.hidden=true;
  panel.innerHTML=`<p class="project">Donor structure → reusable products</p><h2>Reuse catalogue</h2>
    <p class="note">Divide concrete into transportable products, inspect each piece and plan its truck.</p>
    <details><summary>Transport & lifting assumptions</summary><div id="reuseSettings" class="reuse-settings"></div>
      <p class="note">Net component limit = lifting capacity minus rigging reserve. Single-layer loading; rotations allowed. Settings describe the chosen equipment.</p></details>
    <button id="reuseBuild" class="reuse-primary">Create / recalculate catalogue</button>
    <p id="reuseStatus" role="status" class="note">Import a model and its reinforcement data first.</p>
    <div id="reuseResults" hidden>
      <div id="reuseStats" class="reuse-stats"></div>
      <details open><summary>Visible storeys</summary><div class="switch"><button id="reuseAllFloors">All</button><button id="reuseNoFloors">None</button></div><div id="reuseFloors" class="reuse-floors"></div></details>
      <div class="switch reuse-stages"><button data-reuse-stage="building">Building & cuts</button><button data-reuse-stage="exploded">Exploded parts</button><button data-reuse-stage="truck">Truck loading</button></div>
      <div class="switch"><label><input type="checkbox" id="reuseCuts" checked> Cuts</label><label><input type="checkbox" id="reuseBars" checked> Reinforcement</label></div>
      <p class="note">Coloured translucent blocks = transport envelopes. Gold = largest piece per source element. Pink = selected product; its actual clipped shape is shown.</p>
      <div class="reuse-sequence"><button id="reusePlay">Play sequence</button><button id="reuseSequenceReset">Reset</button><input id="reuseTimeline" type="range" min="0" max="1" step="1" value="0" aria-label="Disassembly and loading sequence"><p id="reuseStep" class="note"></p></div>
      <label for="reuseTruck">Truck allocation</label><select id="reuseTruck"></select>
      <canvas id="reuseDeck" width="900" height="240" aria-label="Truck loading plan, select a part" role="img"></canvas><p id="reuseTruckInfo" class="note"></p>
      <div id="reuseSelected" class="reuse-selected" aria-live="polite">Select a block, table row or truck rectangle.</div>
      <div class="switch"><input id="reuseSearch" placeholder="Find ID, floor or source" aria-label="Search catalogue"><select id="reuseSort" aria-label="Sort catalogue"><option value="floor">Floor / size</option><option value="mass">Mass, largest first</option><option value="truck">Truck</option></select><button id="reuseCSV">Export CSV</button></div>
      <p id="reuseRows" class="note"></p><div class="reuse-table"><table><thead><tr><th>Product / storey</th><th>L × W × H, m</th><th>kg</th><th>Truck</th></tr></thead><tbody id="reuseCatalogue"></tbody></table></div>
      <div class="switch"><button id="reusePrev">Previous</button><button id="reuseNext">Next</button></div>
      <details><summary>Rules, evidence & limits</summary><p class="note">Concrete sources only; steel, timber and masonry are excluded. Existing element boundaries are retained. Cuts follow each element’s horizontal bounding frame; size and mass determine further cuts. Broad stair landings are preferred when feasible. Saw kerf is subtracted. Envelopes and single-layer MaxRects packing are a heuristic, not a guaranteed minimum truck count.</p>
      <p class="note">Mass uses closed mesh volume × density; open/non-manifold meshes use a labelled bounding-box upper estimate. Reinforcement in cut pieces is clipped from the existing overlay; schematic reinforcement remains schematic. Cutting bars does not prove anchorage or residual capacity.</p>
      <p class="note">Concept sequence: top-down removal into temporary staging, followed by truck loading. Temporary supports, connections, lifting points, permissible transport orientation, axle loads and restraints need project-specific verification.</p>
      <p class="note">Truck size reference: <a href="https://www.cargobull.com/en/products/curtainsider/curtainsider-semi-trailer/s-cs-universal" target="_blank" rel="noopener">Schmitz S.CS</a>. <a href="https://eur-lex.europa.eu/legal-content/en/TXT/?uri=CELEX%3A31996L0053" target="_blank" rel="noopener">EU transport framework</a>. Payload and crane defaults are planning assumptions.</p></details>
    </div>`;
  document.querySelector('aside').prepend(panel);
  const toggle=document.createElement('button');toggle.id='reuseToggle';toggle.textContent='Reuse catalogue';toggle.setAttribute('aria-pressed','false');
  document.querySelector('.toolbar .switch').append(toggle);
  const labels={deckLength:'Deck length (m)',deckWidth:'Deck width (m)',loadHeight:'Load height (m)',payload:'Payload (kg)',liftLimit:'Lifting capacity (kg)',rigging:'Rigging reserve (kg)',density:'Concrete density (kg/m³)',gap:'Packing clearance (m)',kerf:'Saw kerf (m)'};
  for(const [key,value] of Object.entries(DEFAULTS)) {
    const label=document.createElement('label');label.textContent=labels[key];const input=document.createElement('input');
    input.type='number';input.id='reuse-'+key;input.value=value;input.min='0';input.step=key==='density'||key==='payload'||key==='liftLimit'||key==='rigging'?'100':'.01';label.append(input);$('reuseSettings').append(label);
  }
  const root=new THREE.Group();root.name='Reuse transport envelopes';scene.add(root);root.visible=false;
  let active=false,plan=null,sources=[],reinforcement=[],worker=null,generation=0,stage='building',selected=null,page=0,truck=1;
  let floors=new Map(),floorColors=new Map(),boxes=null,edges=null,barMesh=null,cutLines=null,actual=null,deck=null;
  let lineParts=[],barSegments=[],partMap=new Map(),sourceMap=new Map(),poses=[],playing=false,frame=0,timeline=0,sequence=false,lastTime=0;
  const zero=new THREE.Matrix4().makeScale(0,0,0),matrix=new THREE.Matrix4(),unitBox=new THREE.BoxGeometry(1,1,1);
  const direction=new THREE.Vector3(),quaternion=new THREE.Quaternion(),up=new THREE.Vector3(0,1,0);

  function dispose() {
    for(const child of [...root.children]) {root.remove(child);child.geometry?.dispose();if(Array.isArray(child.material))child.material.forEach(m=>m.dispose());else child.material?.dispose();}
    boxes=edges=barMesh=cutLines=actual=deck=null;barSegments=[];lineParts=[];poses=[];
  }
  function stop(){playing=false;cancelAnimationFrame(frame);$('reusePlay').textContent='Play sequence';}
  function reset() {
    generation++;worker?.terminate();worker=null;stop();active=false;plan=null;selected=null;sources=[];sourceMap.clear();
    dispose();root.visible=false;panel.hidden=true;document.body.classList.remove('reuse-active');toggle.setAttribute('aria-pressed','false');$('reuseResults').hidden=true;
    $('reuseBuild').disabled=false;$('reuseStatus').textContent='Import a model and its reinforcement data first.';
    onChange();
  }
  function setActive(value) {
    if(!value)stop();
    active=value;root.visible=value&&Boolean(plan);panel.hidden=!value;toggle.setAttribute('aria-pressed',String(value));
    document.body.classList.toggle('reuse-active',value);endSection();onChange();if(plan&&value)fit();
  }
  toggle.addEventListener('click',()=>setActive(!active));
  document.querySelectorAll('[data-mode]').forEach(button=>button.addEventListener('click',()=>setActive(false)));
  function settings(){return validateSettings(Object.fromEntries(Object.keys(DEFAULTS).map(key=>[key,Number($('reuse-'+key).value)])));}
  function finish(result,token) {
    if(token!==generation)return;
    plan=result;partMap=new Map(plan.parts.map((p,i)=>[p.id,{...p,index:i}]));plan.parts=[...partMap.values()];
    floors=new Map([...new Set(sources.map(s=>s.storey))].sort((a,b)=>sources.find(s=>s.storey===a).elevation-sources.find(s=>s.storey===b).elevation).map(s=>[s,true]));
    floorColors=new Map([...floors.keys()].map((f,i)=>[f,palette[i%palette.length]]));
    $('reuseFloors').replaceChildren();
    for(const [floor] of floors){const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.checked=true;
      input.addEventListener('change',()=>{floors.set(floor,input.checked);page=0;renderTable();renderScene();});label.append(input,document.createTextNode(floor));$('reuseFloors').append(label);}
    const upper=plan.audit.filter(x=>x.method!=='Mesh volume').length;
    $('reuseStats').innerHTML=[['products',fmt(plan.parts.length,0)],['trucks',fmt(plan.trucks.length,0)],['total tonnes',fmt(plan.totalMass/1000)],['new cuts',fmt(plan.cuts.length,0)]].map(([label,value])=>`<div><strong>${value}</strong><span>${label}</span></div>`).join('');
    $('reuseStatus').textContent=`${sources.length} concrete source elements · ${upper} with upper-estimate mass · ${fmt(plan.lossVolume,2)} m³ saw loss. Select any product to inspect its evidence.`;
    $('reuseTruck').replaceChildren(...plan.trucks.map(t=>new Option(`Truck ${t.id} · ${t.parts.length} products · ${fmt(t.mass/1000)} t`,t.id)));
    truck=1;selected=null;page=0;timeline=0;sequence=false;stage='building';$('reuseTimeline').max=2*plan.parts.length;$('reuseTimeline').value=0;
    buildScene();$('reuseResults').hidden=false;$('reuseBuild').disabled=false;renderTable();renderScene();setActive(true);
  }
  $('reuseBuild').addEventListener('click',async()=>{
    worker?.terminate();stop();const token=++generation;
    try {
      const input=settings(),snapshotData=snapshot();sources=snapshotData.sources;reinforcement=snapshotData.reinforcement;
      if(!sources.length)throw new Error('No concrete sources with material / floor metadata. Import a supported model and reinforcement JSON first.');
      if(sources.some(s=>s.triangles.length%9))throw new Error('Source contains incomplete triangles.');
      sourceMap=new Map(sources.map(s=>[s.id,s]));$('reuseBuild').disabled=true;$('reuseStatus').textContent='Preparing source geometry…';
      if(sources.length>500&&Object.keys(DEFAULTS).every(key=>input[key]===DEFAULTS[key])) {
        try {
          const cached=await (await fetch('./reuse-default-projekt6.json')).json();
          if(cached.version==='reuse-v1'&&cached.sourceSignature===sourceSignature(sources)&&cached.sourceIds.length===sources.length&&cached.sourceIds.every(id=>sourceMap.has(id))) {finish(cached,token);return;}
        }catch(error){console.info('Live reuse calculation',error);}
      }
      if(token!==generation)return;
      worker=new Worker(new URL('./reuse-worker.js',import.meta.url),{type:'module'});
      worker.onmessage=({data})=>{if(token!==generation)return;if(data.type==='progress')$('reuseStatus').textContent=`Calculating ${data.done} / ${data.total} concrete elements…`;
        if(data.type==='complete'){worker.terminate();worker=null;finish(data.plan,token);}if(data.type==='error')fail(data.message,token);};
      worker.onerror=event=>fail(event.message||'Worker could not start. Open this app through its local server.',token);
      worker.postMessage({sources,settings:input});
    }catch(error){fail(error.message,token);}
  });
  function fail(message,token){if(token!==generation)return;worker?.terminate();worker=null;$('reuseBuild').disabled=false;$('reuseStatus').textContent='Calculation stopped: '+message;}
  function localPoint(p,angle){const c=Math.cos(angle),s=Math.sin(angle);return [c*p[0]+s*p[1],-s*p[0]+c*p[1],p[2]];}
  function buildScene() {
    dispose();const count=plan.parts.length;
    boxes=new THREE.InstancedMesh(unitBox.clone(),new THREE.MeshBasicMaterial({transparent:true,opacity:.13,depthWrite:false,side:THREE.DoubleSide}),count);boxes.frustumCulled=false;root.add(boxes);
    const wire=new THREE.EdgesGeometry(unitBox),wireVertices=wire.getAttribute('position').array,wireArray=new Float32Array(count*wireVertices.length),wireColors=new Float32Array(wireArray.length);
    const color=new THREE.Color();
    plan.parts.forEach((p,i)=>{color.setHex(floorColors.get(p.storey));boxes.setColorAt(i,color);lineParts.push({vertices:wireVertices,offset:i*wireVertices.length});for(let j=i*wireVertices.length;j<(i+1)*wireVertices.length;j+=3)color.toArray(wireColors,j);});wire.dispose();
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(wireArray,3));geometry.setAttribute('color',new THREE.BufferAttribute(wireColors,3));
    edges=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.65}));edges.frustumCulled=false;root.add(edges);
    const sourceParts=new Map();plan.parts.forEach(p=>{if(!sourceParts.has(p.sourceId))sourceParts.set(p.sourceId,[]);sourceParts.get(p.sourceId).push(p);});
    sourceCenters=new Map([...sourceParts].map(([id,list])=>{
      const total=list.reduce((s,p)=>s+p.volume,0),center=new THREE.Vector3();
      for(const p of list)center.addScaledVector(new THREE.Vector3(...p.center),p.volume/total);
      return [id,center];
    }));
    for(const item of reinforcement) {
      const candidates=sourceParts.get(String(item.host));if(!candidates?.length)continue;
      const angle=candidates[0].sourceAngle,points=item.points.map(p=>localPoint(p,angle));
      for(let i=1;i<points.length;i++)for(const p of candidates){const segment=clipSegment(points[i-1],points[i],p.localBox);if(!segment)continue;
        const [a,b]=segment.map(point=>point.map((v,k)=>v-p.localCenter[k]));
        barSegments.push({part:p.index,a,b,radius:(item.diameter||12)/2000,schematic:item.schematic});}
    }
    if(barSegments.length) {
      barMesh=new THREE.InstancedMesh(new THREE.CylinderGeometry(1,1,1,5),new THREE.MeshBasicMaterial(),barSegments.length);barMesh.frustumCulled=false;
      barSegments.forEach((s,i)=>barMesh.setColorAt(i,new THREE.Color(s.schematic?0xb6752b:0x3c454a)));root.add(barMesh);
    }
    const cutGeometry=new THREE.BufferGeometry(),cutVertices=[];
    for(const cut of plan.cuts){const axes=[0,1,2].filter(a=>a!==cut.axis),corners=[[0,0],[1,0],[1,1],[0,1]].map(pair=>{const p=[0,0,0];p[cut.axis]=cut.coordinate;axes.forEach((a,i)=>p[a]=cut.box[pair[i]][a]);return worldPoint(p,cut.sourceAngle);});
      for(let j=0;j<4;j++)cutVertices.push(...corners[j],...corners[(j+1)%4]);}
    cutGeometry.setAttribute('position',new THREE.Float32BufferAttribute(cutVertices,3));cutLines=new THREE.LineSegments(cutGeometry,new THREE.LineBasicMaterial({color:0xe34137}));root.add(cutLines);
    deck=new THREE.Mesh(new THREE.BoxGeometry(plan.settings.deckLength,plan.settings.deckWidth,.16),new THREE.MeshStandardMaterial({color:0x667a83,roughness:.8}));deck.position.set(plan.settings.deckLength/2,plan.settings.deckWidth/2,-.13);root.add(deck);
    root.visible=active;
  }
  let buildingCenter=new THREE.Vector3(),sourceCenters=new Map();
  function pose(p) {
    const m=new THREE.Matrix4();
    if(stage==='truck') {
      const order=p.load.order,axes=order.map(i=>new THREE.Vector3(...[0,1,2].map(j=>i===j?1:0)));
      const rotation=new THREE.Matrix4().makeBasis(axes[0],axes[1],axes[2]).transpose();
      if(rotation.determinant()<0){const e=rotation.elements;e[0]*=-1;e[4]*=-1;e[8]*=-1;}
      rotation.setPosition(p.load.x+p.load.length/2,p.load.y+p.load.width/2,p.load.height/2);return rotation;
    }
    m.makeRotationZ(p.sourceAngle);const center=[...p.center];
    if(stage==='exploded') {
      const v=new THREE.Vector3(...p.center).sub(buildingCenter);v.z=0;if(v.length()<.1)v.set(1,0,0);v.normalize().multiplyScalar(1.8);
      const separation=new THREE.Vector3(...p.center).sub(sourceCenters.get(p.sourceId)).multiplyScalar(.18);
      center[0]+=v.x+separation.x;center[1]+=v.y+separation.y;center[2]+=[...floors.keys()].indexOf(p.storey)*.8+separation.z;
    }
    m.setPosition(...center);return m;
  }
  function visible(p) {
    if(!floors.get(p.storey))return false;
    if(stage==='truck')return p.truck===truck&&(!sequence||timeline<plan.parts.length||loadingSet.has(p.id));
    return !sequence||!removedSet.has(p.id);
  }
  let removedSet=new Set(),loadingSet=new Set();
  function renderScene() {
    if(!plan)return;
    const n=plan.parts.length;
    removedSet=new Set(sequence?plan.removal.slice(0,Math.min(n,timeline)):[]);
    loadingSet=new Set(sequence?plan.loading.slice(0,Math.max(0,timeline-n)):[]);
    const edgeArray=edges.geometry.attributes.position.array,edgeColors=edges.geometry.attributes.color.array;
    buildingCenter=sourceBounds().getCenter(new THREE.Vector3());
    const color=new THREE.Color(),point=new THREE.Vector3();poses=plan.parts.map(p=>pose(p));
    plan.parts.forEach(p=>{
      const show=visible(p),poseMatrix=poses[p.index];matrix.copy(poseMatrix).scale(new THREE.Vector3(...p.dimensions));boxes.setMatrixAt(p.index,show?matrix:zero);
      color.setHex(p.id===selected?0xff1495:floorColors.get(p.storey));boxes.setColorAt(p.index,color);
      const {vertices,offset}=lineParts[p.index];color.setHex(p.id===selected?0xff1495:p.largest?0xc18b20:floorColors.get(p.storey));
      for(let j=0;j<vertices.length;j+=3){point.fromArray(vertices,j).multiply(new THREE.Vector3(...p.dimensions)).applyMatrix4(poseMatrix);if(!show)point.set(0,0,0);point.toArray(edgeArray,offset+j);color.toArray(edgeColors,offset+j);}
    });
    boxes.instanceMatrix.needsUpdate=true;boxes.instanceColor.needsUpdate=true;boxes.boundingSphere=null;boxes.boundingBox=null;edges.geometry.attributes.position.needsUpdate=true;edges.geometry.attributes.color.needsUpdate=true;
    if(barMesh){barSegments.forEach((segment,i)=>{
      const p=plan.parts[segment.part];if(!visible(p)){barMesh.setMatrixAt(i,zero);return;}
      const a=new THREE.Vector3(...segment.a),b=new THREE.Vector3(...segment.b);direction.subVectors(b,a);const length=direction.length();quaternion.setFromUnitVectors(up,direction.normalize());
      matrix.compose(a.add(b).multiplyScalar(.5),quaternion,new THREE.Vector3(segment.radius,length,segment.radius));matrix.premultiply(poses[p.index]);barMesh.setMatrixAt(i,matrix);
      });barMesh.instanceMatrix.needsUpdate=true;barMesh.visible=$('reuseBars').checked;}
    cutLines.visible=$('reuseCuts').checked&&stage==='building';
    // Individual cut rectangles follow their source floor visibility.
    const cutArray=cutLines.geometry.attributes.position.array;
    plan.cuts.forEach((cut,i)=>{const axes=[0,1,2].filter(a=>a!==cut.axis);const corners=[[0,0],[1,0],[1,1],[0,1]].map(pair=>{const p=[0,0,0];p[cut.axis]=cut.coordinate;axes.forEach((a,j)=>p[a]=cut.box[pair[j]][a]);return floors.get(cut.storey)?worldPoint(p,cut.sourceAngle):[0,0,0];});for(let j=0;j<4;j++){cutArray.set(corners[j],i*24+j*6);cutArray.set(corners[(j+1)%4],i*24+j*6+3);}});cutLines.geometry.attributes.position.needsUpdate=true;
    deck.visible=stage==='truck';updateActual();drawDeck();
    $('reuseStep').textContent=sequence?(timeline<n?`Disassembly ${timeline} / ${n} — top-down into staging`:`Loading ${timeline-n} / ${n} — truck ${truck}`):'Explore the complete proposal, then play its conceptual sequence.';
    document.querySelectorAll('[data-reuse-stage]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.reuseStage===stage)));
  }
  function updateActual() {
    if(actual){root.remove(actual);actual.geometry.dispose();actual.material.dispose();actual=null;}
    const p=partMap.get(selected);if(!p||!visible(p))return;
    const source=sourceMap.get(p.sourceId),c=Math.cos(p.sourceAngle),s=Math.sin(p.sourceAngle),local=new Float64Array(source.triangles.length);
    for(let i=0;i<local.length;i+=3){const x=source.triangles[i],y=source.triangles[i+1];local[i]=c*x+s*y;local[i+1]=-s*x+c*y;local[i+2]=source.triangles[i+2];}
    const geometry=clipMesh(local,p.localBox,true).geometry;
    for(let i=0;i<geometry.length;i++)geometry[i]-=p.localCenter[i%3];
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(geometry,3));g.computeVertexNormals();
    actual=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:0xff72b6,transparent:true,opacity:.28,depthWrite:false,side:THREE.DoubleSide}));actual.matrixAutoUpdate=false;actual.matrix.copy(poses[p.index]);root.add(actual);
  }
  function sourceBounds(){const b=new THREE.Box3();for(const p of plan.parts)b.expandByPoint(new THREE.Vector3(...p.center));return b;}
  function bounds(){if(!active||!plan)return null;const b=new THREE.Box3();if(stage==='truck')return b.set(new THREE.Vector3(0,0,-.3),new THREE.Vector3(plan.settings.deckLength,plan.settings.deckWidth,plan.settings.loadHeight));for(const p of plan.parts)if(visible(p)){const box=new THREE.Box3(new THREE.Vector3(...p.dimensions).multiplyScalar(-.5),new THREE.Vector3(...p.dimensions).multiplyScalar(.5)).applyMatrix4(poses[p.index]);b.union(box);}return b.isEmpty()?null:b;}
  function filtered(){const q=$('reuseSearch').value.toLowerCase(),sort=$('reuseSort').value;return plan.parts.filter(p=>floors.get(p.storey)&&(!q||`${p.id} ${p.storey} ${p.name}`.toLowerCase().includes(q))).sort((a,b)=>sort==='mass'?b.mass-a.mass:sort==='truck'?a.truck-b.truck||b.mass-a.mass:a.elevation-b.elevation||a.storey.localeCompare(b.storey)||b.volume-a.volume);}
  function renderTable(){if(!plan)return;const list=filtered(),size=80;page=Math.max(0,Math.min(page,Math.ceil(list.length/size)-1));$('reuseCatalogue').innerHTML=list.slice(page*size,(page+1)*size).map(p=>`<tr data-part="${escape(p.id)}" class="${p.id===selected?'selected':''}" tabindex="0"><td><strong>${escape(p.id)}</strong><small>${escape(p.storey)}</small></td><td>${dimensions(p)}</td><td>${fmt(p.mass,0)}</td><td>${p.truck}</td></tr>`).join('');
    $('reuseRows').textContent=`${list.length} products · page ${page+1} / ${Math.max(1,Math.ceil(list.length/size))}`;$('reusePrev').disabled=page===0;$('reuseNext').disabled=(page+1)*size>=list.length;}
  function select(id){const p=partMap.get(id);if(!p)return;selected=id;truck=p.truck;$('reuseTruck').value=truck;
    $('reuseSelected').innerHTML=`<strong>${escape(p.id)}</strong><p>${escape(p.storey)} · ${escape(p.category)}</p><p>${dimensions(p)} m<br><strong>${fmt(p.mass,0)} kg</strong> · Truck ${p.truck}</p><small>${escape(p.massMethod)} · ${fmt(p.volume,3)} m³<br>${escape(p.barEvidence)}<br>Source: ${escape(p.name)}${p.ifcId?'<br>IFC '+escape(p.ifcId):''}</small><div class="switch"><button id="reuseFocus">Zoom to part</button><button id="reuseShowTruck">Show assigned truck</button></div>`;
    $('reuseFocus').onclick=()=>{const b=new THREE.Box3(new THREE.Vector3(...p.dimensions).multiplyScalar(-.7),new THREE.Vector3(...p.dimensions).multiplyScalar(.7)).applyMatrix4(poses[p.index]);fit(b);};
    $('reuseShowTruck').onclick=()=>{stage='truck';sequence=false;stop();renderScene();fit();};
    const list=filtered();page=Math.max(0,Math.floor(list.findIndex(x=>x.id===id)/80));renderTable();renderScene();
    $('reuseCatalogue').querySelector('.selected')?.scrollIntoView({block:'nearest'});
  }
  function drawDeck(){const canvas=$('reuseDeck'),ctx=canvas.getContext('2d'),s=plan.settings,pad=22,scale=Math.min((canvas.width-2*pad)/s.deckLength,(canvas.height-2*pad)/s.deckWidth);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#e4ebe7';ctx.fillRect(pad,pad,s.deckLength*scale,s.deckWidth*scale);ctx.strokeStyle='#39564b';ctx.strokeRect(pad,pad,s.deckLength*scale,s.deckWidth*scale);
    for(const id of plan.trucks[truck-1]?.parts??[]){const p=partMap.get(id),r=p.load;ctx.globalAlpha=sequence&&timeline>=plan.parts.length&&!loadingSet.has(id)?.18:1;ctx.fillStyle=id===selected?'#ff1495':'#'+new THREE.Color(floorColors.get(p.storey)).getHexString();ctx.fillRect(pad+r.x*scale,pad+r.y*scale,r.length*scale,r.width*scale);ctx.fillStyle='#172a32';ctx.font='12px sans-serif';if(r.length*scale>45)ctx.fillText(id,pad+r.x*scale+3,pad+r.y*scale+14,Math.max(10,r.length*scale-6));}ctx.globalAlpha=1;
    const t=plan.trucks[truck-1];$('reuseTruckInfo').textContent=t?`Truck ${truck} · ${t.parts.length} products · ${fmt(t.mass/1000)} / ${fmt(s.payload/1000)} t · ${fmt(s.deckLength,2)} × ${fmt(s.deckWidth,2)} m deck`:'No products';}
  $('reuseDeck').addEventListener('click',event=>{if(!plan)return;const canvas=$('reuseDeck'),rect=canvas.getBoundingClientRect(),s=plan.settings,pad=22,scale=Math.min((canvas.width-2*pad)/s.deckLength,(canvas.height-2*pad)/s.deckWidth),x=((event.clientX-rect.left)*canvas.width/rect.width-pad)/scale,y=((event.clientY-rect.top)*canvas.height/rect.height-pad)/scale;const p=plan.parts.find(p=>p.truck===truck&&x>=p.load.x&&x<=p.load.x+p.load.length&&y>=p.load.y&&y<=p.load.y+p.load.width);if(p)select(p.id);});
  $('reuseCatalogue').addEventListener('click',event=>{const row=event.target.closest('[data-part]');if(row)select(row.dataset.part);});
  $('reuseCatalogue').addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){const row=event.target.closest('[data-part]');if(row){event.preventDefault();select(row.dataset.part);}}});
  for(const id of ['reuseSearch','reuseSort'])$(id).addEventListener('input',()=>{page=0;renderTable();});
  $('reusePrev').onclick=()=>{page--;renderTable();};$('reuseNext').onclick=()=>{page++;renderTable();};
  $('reuseTruck').onchange=()=>{truck=Number($('reuseTruck').value);sequence=false;stop();renderScene();if(stage==='truck')fit();};
  document.querySelectorAll('[data-reuse-stage]').forEach(button=>button.onclick=()=>{stage=button.dataset.reuseStage;sequence=false;stop();renderScene();fit();});
  for(const id of ['reuseCuts','reuseBars'])$(id).onchange=()=>renderScene();
  function allFloors(value){for(const floor of floors.keys())floors.set(floor,value);$('reuseFloors').querySelectorAll('input').forEach(input=>input.checked=value);page=0;renderTable();renderScene();}
  $('reuseAllFloors').onclick=()=>allFloors(true);$('reuseNoFloors').onclick=()=>allFloors(false);
  function step(value){const before=stage;timeline=value;sequence=true;stage=value<plan.parts.length?'building':'truck';if(stage==='truck'&&value>plan.parts.length){truck=partMap.get(plan.loading[Math.min(plan.parts.length-1,value-plan.parts.length-1)]).truck;$('reuseTruck').value=truck;}$('reuseTimeline').value=value;renderScene();if(before!==stage)fit();}
  $('reuseTimeline').oninput=()=>{stop();step(Number($('reuseTimeline').value));};
  $('reuseSequenceReset').onclick=()=>{stop();sequence=false;timeline=0;stage='building';$('reuseTimeline').value=0;renderScene();fit();};
  $('reusePlay').onclick=()=>{if(playing){stop();return;}if(!plan)return;if(timeline>=2*plan.parts.length)timeline=0;playing=true;sequence=true;lastTime=0;$('reusePlay').textContent='Pause';const start=timeline,startTime=performance.now();const tick=now=>{if(!playing)return;const next=Math.min(2*plan.parts.length,start+Math.floor((now-startTime)/35000*2*plan.parts.length));if(next!==timeline&&now-lastTime>130){step(next);lastTime=now;}if(next>=2*plan.parts.length){stop();return;}frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);};
  $('reuseCSV').onclick=()=>{if(!plan)return;const cell=s=>'"'+String(s??'').replaceAll('"','""')+'"',rows=[['Product','Storey','Source','Category','Length m','Width m','Height m','Volume m3','Mass kg','Truck','Mass method','Rebar evidence','IFC ID'],...filtered().map(p=>[p.id,p.storey,p.name,p.category,...p.dimensions,p.volume,p.mass,p.truck,p.massMethod,p.barEvidence,p.ifcId])];const url=URL.createObjectURL(new Blob(['\ufeff'+rows.map(row=>row.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='reuse-product-catalogue.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  return {reset,isActive:()=>active,hasPlan:()=>Boolean(plan),bounds,pick:ray=>{if(!active||!boxes)return false;root.updateMatrixWorld(true);const hit=ray.intersectObject(boxes,false).find(hit=>visible(plan.parts[hit.instanceId]));if(hit)select(plan.parts[hit.instanceId].id);return true;},group:root};
}
