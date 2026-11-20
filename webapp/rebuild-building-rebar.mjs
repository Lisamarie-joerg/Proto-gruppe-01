import fs from 'node:fs';
import {registerHooks} from 'node:module';
import * as T from './static/three/three.module.js';
import {assignHosts,meshTriangles} from './static/reuse-sources.js';
import {ASSUMPTIONS as A,surfaceFamilies,frameFor,intervals,coordinates,clearance,segmentClearance,contains,clippedLines,splitStraight,roundedLink} from './static/rebar-geometry.js';
import {auditMesh} from './static/reuse-core.js';
registerHooks({resolve(s,c,next){return s==='three'?next(new URL('./static/three/three.module.js',import.meta.url).href,c):next(s,c);}});
globalThis.ProgressEvent=class{};
const {GLTFLoader}=await import('./static/three/addons/loaders/GLTFLoader.js');
const file=new URL('./static/bauteil6-bewehrung.json',import.meta.url),data=JSON.parse(fs.readFileSync(file));
const original=data.originalPlanAxes??data.elements.filter(e=>!e.schematic);
const positions=Object.fromEntries(Object.entries(data.positions).filter(([,p])=>!p.schematic)),elements=[];
for(const axis of original){const diameter=positions[axis.position].diameter,pieces=splitStraight(axis.points[0],axis.points.at(-1));
  const direction=new T.Vector3(...axis.points.at(-1)).sub(new T.Vector3(...axis.points[0])).normalize(),offset=new T.Vector3(0,0,1).cross(direction).normalize().multiplyScalar(diameter/1000+.002);
  pieces.forEach((points,i)=>{if(i%2)points=points.map(p=>new T.Vector3(...p).add(offset).toArray());elements.push({...axis,points,id:axis.id+'-S'+(i+1),origin:'plan_reconstruction',planAxisId:axis.id,detailingAssumed:pieces.length>1,
    evidence:'Plan position and design length referenced; 3D placement reconstructed; offset erection laps assumed'});});}
const bytes=fs.readFileSync(new URL('./static/projekt6/Bauteil6.glb',import.meta.url));
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
gltf.scene.rotation.x=Math.PI/2;gltf.scene.updateMatrixWorld(true);
const meshes=[];gltf.scene.traverse(m=>{if(m.isMesh)meshes.push(m);});const hosts=assignHosts(meshes,data.hosts);
const audit=[];
for(const mesh of meshes){const host=hosts.get(mesh);if(!host?.reinforcementExpected)continue;
  const raw=meshTriangles(mesh),families=surfaceFamilies(raw),start=elements.length,warnings=[];let serial=0;
  const add=(points,diameter,kind,surface)=>{
    const length=points.slice(1).reduce((s,p,i)=>s+Math.hypot(...p.map((x,k)=>x-points[i][k])),0);if(length<.15||length>A.maxLength+.001)return;
    const key='Schematic / '+host.id+' / '+kind+' / '+diameter;
    positions[key]??={diameter,schematic:true,origin:'schematic',host:host.id,category:host.category,detail:'SCHEMATIC — '+kind+'; assumed diameter / spacing / laps; no plan position.'};
    elements.push({id:'S-'+host.id+'-'+(++serial),position:key,points:points.map(p=>p.map(x=>+x.toFixed(6))),schematic:true,origin:'schematic',host:host.id,category:host.category,kind,surface,
      evidence:'Geometric assumption; no PDF reinforcement position',coverAssumption:A.cover,spacingAssumption:A.spacing});
  };
  const line=(frame,a,b,diameter,kind,surface,offsetAxis)=>{
    const pieces=splitStraight(a,b);for(let i=0;i<pieces.length;i++){
      const pair=pieces[i].map(p=>[...p]);if(i%2&&offsetAxis!=null){const mid=(frame.lo[offsetAxis]+frame.hi[offsetAxis])/2,shift=(pair[0][offsetAxis]<mid?1:-1)*(diameter/1000+.002);pair.forEach(p=>p[offsetAxis]+=shift);
        const samples=Math.max(2,Math.ceil(new T.Vector3(...pair[0]).distanceTo(new T.Vector3(...pair[1]))/.1));
        if(Array.from({length:samples+1},(_,j)=>pair[0].map((x,k)=>x+(pair[1][k]-x)*j/samples)).some(p=>clearance(frame,p)<A.cover+diameter/2000-1e-5)){
          if(!warnings.includes('Some assumed lap offsets could not be fitted at 40 mm cover.'))warnings.push('Some assumed lap offsets could not be fitted at 40 mm cover.');continue;}}
      add(pair.map(frame.world),diameter,kind,surface);
    }
  };
  const mats=(frame,lo=frame.lo,hi=frame.hi,label='two-face mat')=>{
    const inset=A.cover+A.diameter/2000,separation=A.diameter/1000+.002;
    if(hi[2]-lo[2]<2*inset+2*separation+.008){warnings.push('Section too thin for two separated assumed mats at 40 mm cover.');return;}
    for(const [axis,w,face] of [[0,lo[2]+inset,'face A'],[1,lo[2]+inset+separation,'face A'],[0,hi[2]-inset-separation,'face B'],[1,hi[2]-inset,'face B']]){
      const cross=axis===0?1:0;
      for(const at of coordinates(lo[cross]+inset,hi[cross]-inset,A.spacing)){
        const fixed=[0,0,w];fixed[cross]=at;
        for(const [a,b] of clippedLines(frame,axis,fixed,A.diameter)){
          a[axis]=Math.max(a[axis],lo[axis]+inset);b[axis]=Math.min(b[axis],hi[axis]-inset);if(b[axis]-a[axis]<.15)continue;
          line(frame,a,b,A.diameter,axis===0?'mat-U':'mat-V',label+' / '+face,cross);
        }
      }
    }
  };
  if(!auditMesh(raw)){warnings.push('Open or inconsistently oriented mesh: inside and cover cannot be inferred reliably.');}
  else if(!families.length){warnings.push('No non-degenerate mesh faces.');}
  else if(/Stützen|Träger/.test(host.category)){
    // The cap-plane normal with the largest span is the member axis, including inclined members.
    const span=n=>{let lo=Infinity,hi=-Infinity;for(let i=0;i<raw.length;i+=3){const d=raw[i]*n.x+raw[i+1]*n.y+raw[i+2]*n.z;lo=Math.min(lo,d);hi=Math.max(hi,d);}return hi-lo;};
    const normal=[...families].sort((a,b)=>span(b.n)-span(a.n))[0].n,frame=frameFor(raw,normal);
    const linkInset=A.cover+A.linkDiameter/2000;
    const lo=frame.lo.map(x=>x+linkInset),hi=frame.hi.map(x=>x-linkInset);
    if(hi[0]-lo[0]>2.5||hi[1]-lo[1]>2.5||Math.min(hi[0]-lo[0],hi[1]-lo[1])<.04){warnings.push('Member section unsuitable for the assumed link cage; not filled with arbitrary rods.');}
    else {
      const radius=Math.min(.03,(hi[0]-lo[0])/4,(hi[1]-lo[1])/4),rodClearance=A.diameter/2000+A.linkDiameter/2000+.002;
      const mainInset=Math.max(A.cover+A.linkDiameter/1000+A.diameter/2000,linkInset+radius-Math.max(0,radius-rodClearance)/Math.sqrt(2));
      const xs=coordinates(frame.lo[0]+mainInset,frame.hi[0]-mainInset,.25),ys=coordinates(frame.lo[1]+mainInset,frame.hi[1]-mainInset,.25);
      for(let i=0;i<xs.length;i++)for(let j=0;j<ys.length;j++){if(i&&i<xs.length-1&&j&&j<ys.length-1)continue;
        for(const [a,b] of clippedLines(frame,2,[xs[i],ys[j],0],A.diameter))line(frame,a,b,A.diameter,'longitudinal','inside link cage',0);}
      for(const at of coordinates(lo[2],hi[2],A.spacing)){
        const points=roundedLink(2,at,lo,hi,.03),valid=points.slice(1).every((p,i)=>clearance(frame,p)>=linkInset-1e-5&&clearance(frame,p.map((x,k)=>(x+points[i][k])/2))>=linkInset-1e-5);
        if(valid)add(points.map(frame.world),A.linkDiameter,'closed-link','assumed rounded link; closure hooks not established');
      }
    }
  } else if(host.category==='Treppen') {
    const slopes=families.filter(f=>f.n.z>.12&&f.n.z<.98).slice(0,2),chosen=slopes.length?slopes:[families[0]];
    const horizontal=families.find(f=>f.n.z>.999);if(slopes.length&&horizontal)chosen.push(horizontal);
    for(const family of chosen){
      const frame=frameFor(raw,family.n),planes=[...family.planes.values()].filter(p=>p.area>.65).sort((a,b)=>b.area-a.area).slice(0,5);
      for(const plane of planes){
        const projected=plane.points.map(frame.local),lo=[0,1,2].map(k=>Math.min(...projected.map(p=>p[k]))),hi=[0,1,2].map(k=>Math.max(...projected.map(p=>p[k]))),w=lo[2],samples=[];
        for(const point of projected){for(const pair of intervals(frame,2,point[0],point[1])){if(Math.abs(pair[0]-w)<.003&&pair[1]-pair[0]>.13)samples.push(pair[1]-pair[0]);}}
        if(!samples.length)continue;lo[2]=w;hi[2]=w+Math.min(...samples);
        mats(frame,lo,hi,family.n.z>.999?'landing mat':'inclined flight mat');
      }
    }
    if(elements.length===start)warnings.push('No unambiguous flight/landing mat could be fitted; reinforcement remains open.');
  } else mats(frameFor(raw,families[0].n));
  const checkFrame=frameFor(raw,new T.Vector3(0,0,1)),proposed=elements.slice(start),valid=[];
  for(const item of proposed){const margin=A.cover+positions[item.position].diameter/2000;let good=true;
    for(let segment=1;segment<item.points.length&&good;segment++){
      const a=checkFrame.local(item.points[segment-1]),b=checkFrame.local(item.points[segment]);
      if(!contains(checkFrame,a)||!contains(checkFrame,b)||segmentClearance(checkFrame,a,b,margin-1e-5)<margin-1e-5)good=false;
    }
    if(good)valid.push(item);
  }
  elements.splice(start,elements.length-start,...valid);
  if(valid.length<proposed.length)warnings.push((proposed.length-valid.length)+' proposed rods rejected by segment-to-mesh containment / 40 mm cover checks.');
  const generated=elements.slice(start),kinds=new Set(generated.map(e=>e.kind));
  const incomplete=/Stützen|Träger/.test(host.category)?kinds.size&&(!kinds.has('longitudinal')||!kinds.has('closed-link')):kinds.size&&(!kinds.has('mat-U')||!kinds.has('mat-V'));
  if(incomplete){elements.length=start;warnings.push('Incomplete grid/cage suppressed: a plausible second direction or closed links could not be fitted.');}
  host.count=elements.length-start;host.status=host.count?'SCHEMATIC — category-oriented cage / mats':'OPEN — no plausible cage generated';
  host.rebarKinds=[...new Set(elements.slice(start).map(e=>e.kind))];host.rebarWarnings=warnings;
  audit.push({host:host.id,category:host.category,count:host.count,kinds:host.rebarKinds,warnings});
  if(audit.length%25===0)console.log(audit.length+'/633',host.category,host.count);
}
for(const host of data.hosts)if(!host.reinforcementExpected){host.count=0;host.status='Outside concrete reinforcement scope';}
const counts={planAxes:original.length,planSegments:elements.filter(e=>!e.schematic).length,schematicBars:elements.filter(e=>e.schematic).length,
  links:elements.filter(e=>e.kind==='closed-link').length,hostsWithSchematic:audit.filter(h=>h.count).length,openHosts:audit.filter(h=>!h.count).length};
const used=new Set(elements.map(e=>e.position));
data.originalPlanAxes=original;data.elements=elements;data.positions=Object.fromEntries(Object.entries(positions).filter(([id])=>used.has(id)));data.assumptions=A;data.audit={counts,hosts:audit,
  provenance:'Only plan_reconstruction elements have a PDF position. Schematic grids/cages do not establish existing reinforcement or capacity.',
  detailingReference:'https://www.concretecentre.com/Concrete-Design/Design-Codes/Eurocode-2/Detailing.aspx'};
data.scope='Blue: plan-referenced reconstruction (placement and erection laps approximate). Orange: assumed category-oriented mats/cages, not evidenced by PDF plans.';
fs.writeFileSync(file,JSON.stringify(data));console.log(JSON.stringify(counts));
