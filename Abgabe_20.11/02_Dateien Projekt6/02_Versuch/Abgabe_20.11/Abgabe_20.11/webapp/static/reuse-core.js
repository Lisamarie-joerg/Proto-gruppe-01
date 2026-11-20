import {ShapeUtils,Vector2} from './three/three.module.js';
// Geometry and packing routines shared by the worker and verification scripts.
const EPS = 1e-7;
export const DEFAULTS = Object.freeze({
  deckLength:13.6, deckWidth:2.45, loadHeight:2.6,
  payload:24000, liftLimit:5000, rigging:200, density:2500,
  gap:0.08, kerf:0.01,
});
const subtract=(a,b)=>a.map((value,i)=>value-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a.reduce((sum,value,i)=>sum+value*b[i],0);
export function boundsOf(triangles) {
  const lo=[Infinity,Infinity,Infinity], hi=[-Infinity,-Infinity,-Infinity];
  for(let n=0;n<triangles.length;n++) {
    const axis=n%3;
    lo[axis]=Math.min(lo[axis],triangles[n]);
    hi[axis]=Math.max(hi[axis],triangles[n]);
  }
  return [lo,hi];
}
const sizeOf=box=>box[1].map((value,i)=>Math.max(0,value-box[0][i]));
const boxVolume=box=>sizeOf(box).reduce((a,b)=>a*b,1);
function hull(points) {
  const sorted=[...new Map(points.map(p=>[p[0].toFixed(5)+','+p[1].toFixed(5),p])).values()]
    .sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  if(sorted.length<3) return sorted;
  const turn=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const build=list=>{
    const result=[];
    for(const p of list) {
      while(result.length>1&&turn(result.at(-2),result.at(-1),p)<=0)result.pop();
      result.push(p);
    }
    return result;
  };
  return [...build(sorted).slice(0,-1),...build([...sorted].reverse()).slice(0,-1)];
}
export function localFrame(worldTriangles) {
  const points=[];
  for(let i=0;i<worldTriangles.length;i+=3)points.push([worldTriangles[i],worldTriangles[i+1]]);
  const outline=hull(points);
  let angle=0, area=Infinity;
  for(let i=0;i<outline.length;i++) {
    const a=outline[i],b=outline[(i+1)%outline.length];
    const theta=Math.atan2(b[1]-a[1],b[0]-a[0]);
    const c=Math.cos(theta),s=Math.sin(theta);
    const x=outline.map(p=>c*p[0]+s*p[1]), y=outline.map(p=>-s*p[0]+c*p[1]);
    const candidate=(Math.max(...x)-Math.min(...x))*(Math.max(...y)-Math.min(...y));
    if(candidate<area-EPS){area=candidate;angle=theta;}
  }
  const c=Math.cos(angle),s=Math.sin(angle);
  const triangles=new Float64Array(worldTriangles.length);
  for(let i=0;i<triangles.length;i+=3) {
    triangles[i]=c*worldTriangles[i]+s*worldTriangles[i+1];
    triangles[i+1]=-s*worldTriangles[i]+c*worldTriangles[i+1];
    triangles[i+2]=worldTriangles[i+2];
  }
  return {angle,triangles};
}
export function worldPoint(point,angle) {
  const c=Math.cos(angle),s=Math.sin(angle);
  return [c*point[0]-s*point[1],s*point[0]+c*point[1],point[2]];
}
function clipPolygon(polygon,axis,value,keepGreater) {
  const result=[];
  const distance=p=>(p[axis]-value)*(keepGreater?1:-1);
  for(let i=0;i<polygon.length;i++) {
    const a=polygon[i],b=polygon[(i+1)%polygon.length];
    const da=distance(a),db=distance(b);
    if(da>=-EPS)result.push(a);
    if((da>EPS&&db<-EPS)||(da<-EPS&&db>EPS)) {
      const t=da/(da-db);
      result.push(a.map((v,k)=>v+t*(b[k]-v)));
    }
  }
  return result;
}
function capTriangles(edges,axis,normalSign) {
  if(!edges.length)return [];
  const key=point=>point.map(value=>Math.round(value*1e6)).join(',');
  const pending=new Map();
  for(const [a,b] of edges) {
    if(key(a)===key(b))continue;
    const list=pending.get(key(a))||[];
    list.push([a,b]);pending.set(key(a),list);
  }
  const loops=[];
  while(pending.size) {
    const first=pending.values().next().value.pop();
    if(!pending.get(key(first[0])).length)pending.delete(key(first[0]));
    const loop=[first[0]],start=key(first[0]);
    let current=first[1],guard=0;
    while(key(current)!==start&&guard++<edges.length+1) {
      loop.push(current);
      const choices=pending.get(key(current));
      if(!choices?.length)break;
      const edge=choices.pop();
      if(!choices.length)pending.delete(key(current));
      current=edge[1];
    }
    if(key(current)===start&&loop.length>=3)loops.push(loop);
  }
  const u=(axis+1)%3,v=(axis+2)%3;
  const projected=loops.map(points=>({points,flat:points.map(p=>new Vector2(p[u],p[v]))}));
  const signedArea=flat=>flat.reduce((sum,p,i)=>sum+p.x*flat[(i+1)%flat.length].y-flat[(i+1)%flat.length].x*p.y,0)/2;
  const contains=(flat,point)=>{
    let result=false;
    for(let i=0,j=flat.length-1;i<flat.length;j=i++) {
      const a=flat[i],b=flat[j];
      if((a.y>point.y)!==(b.y>point.y)&&point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x)result=!result;
    }
    return result;
  };
  projected.sort((a,b)=>Math.abs(signedArea(b.flat))-Math.abs(signedArea(a.flat)));
  for(let i=0;i<projected.length;i++) {
    projected[i].parent=-1;
    let parentArea=Infinity;
    for(let j=0;j<i;j++)if(contains(projected[j].flat,projected[i].flat[0])) {
      const area=Math.abs(signedArea(projected[j].flat));
      if(area<parentArea){projected[i].parent=j;parentArea=area;}
    }
    projected[i].depth=projected[i].parent<0?0:projected[projected[i].parent].depth+1;
  }
  const triangles=[];
  for(let i=0;i<projected.length;i++) {
    const outer=projected[i];
    if(outer.depth%2)continue;
    const holes=projected.filter(loop=>loop.parent===i&&loop.depth===outer.depth+1);
    const vertices=[...outer.points,...holes.flatMap(hole=>hole.points)];
    const faces=ShapeUtils.triangulateShape(outer.flat,holes.map(hole=>hole.flat));
    for(const face of faces) {
      const triangle=face.map(index=>vertices[index]);
      const area=(triangle[1][u]-triangle[0][u])*(triangle[2][v]-triangle[0][v])
        -(triangle[1][v]-triangle[0][v])*(triangle[2][u]-triangle[0][u]);
      if(area*normalSign<0)[triangle[1],triangle[2]]=[triangle[2],triangle[1]];
      triangles.push(triangle);
    }
  }
  return triangles;
}
export function clipMesh(triangles,box,includeGeometry=false) {
  let polygons=[];
  for(let n=0;n<triangles.length;n+=9)polygons.push([
    Array.from(triangles.slice(n,n+3)),Array.from(triangles.slice(n+3,n+6)),Array.from(triangles.slice(n+6,n+9))]);
  for(let axis=0;axis<3;axis++)for(let side=0;side<2;side++) {
    const value=box[side][axis],keepGreater=side===0,edges=[],next=[];
    for(const polygon of polygons) {
      const distance=p=>(p[axis]-value)*(keepGreater?1:-1);
      const outside=polygon.some(point=>distance(point)<-EPS);
      if(!outside){next.push(polygon);continue;}
      if(!polygon.some(point=>distance(point)>EPS))continue;
      const clipped=clipPolygon(polygon,axis,value,keepGreater);
      if(clipped.length<3)continue;
      next.push(clipped);
      for(let j=0;j<clipped.length;j++) {
        const a=clipped[j],b=clipped[(j+1)%clipped.length];
        if(Math.abs(a[axis]-value)<EPS&&Math.abs(b[axis]-value)<EPS)edges.push([b,a]);
      }
    }
    next.push(...capTriangles(edges,axis,keepGreater?-1:1));
    polygons=next;
  }
  const origin=box[0],geometry=[];
  let volume=0;
  for(const polygon of polygons)for(let i=1;i<polygon.length-1;i++) {
    volume+=dot(subtract(polygon[0],origin),cross(subtract(polygon[i],origin),subtract(polygon[i+1],origin)))/6;
    if(includeGeometry)geometry.push(...polygon[0],...polygon[i],...polygon[i+1]);
  }
  return {volume:Math.abs(volume),geometry:includeGeometry?new Float64Array(geometry):null};
}

export function auditMesh(triangles) {
  const edges=new Map();
  for(let i=0;i<triangles.length;i+=9) {
    const vertices=[0,3,6].map(offset=>[0,1,2].map(k=>Math.round(triangles[i+offset+k]*10000)).join(','));
    for(let j=0;j<3;j++) {
      const a=vertices[j],b=vertices[(j+1)%3];
      if(a===b)continue;
      const key=a<b?a+'|'+b:b+'|'+a;
      const edge=edges.get(key)||{count:0,direction:0};edge.count++;edge.direction+=a<b?1:-1;edges.set(key,edge);
    }
  }
  return edges.size>0&&[...edges.values()].every(edge=>edge.count===2&&edge.direction===0);
}
export function orientations(size,settings) {
  const result=[];
  for(const order of [[0,1,2],[1,0,2],[0,2,1],[2,0,1],[1,2,0],[2,1,0]]) {
    const [length,width,height]=order.map(i=>size[i]);
    if(length<=settings.deckLength-2*settings.gap+EPS&&width<=settings.deckWidth-2*settings.gap+EPS&&height<=settings.loadHeight+EPS)
      result.push({order,length,width,height});
  }
  return result.sort((a,b)=>a.height-b.height||a.width-b.width);
}
export function validateSettings(input) {
  const settings={...DEFAULTS,...input};
  for(const [key,value] of Object.entries(settings))if(!Number.isFinite(value)||value<0)throw new Error('Invalid '+key);
  for(const key of ['deckLength','deckWidth','loadHeight','payload','liftLimit','density'])if(settings[key]<=0)throw new Error(key+' must be positive.');
  if(settings.gap*2>=Math.min(settings.deckLength,settings.deckWidth))throw new Error('Clearance exceeds the deck.');
  if(settings.rigging>=settings.liftLimit)throw new Error('Rigging reserve exceeds the lifting limit.');
  if(settings.kerf>.1)throw new Error('Saw kerf must not exceed 0.10 m.');
  return settings;
}
function preferredStairCut(triangles,axis,proposed,box) {
  if(axis===2)return proposed;
  let best=proposed,delta=Infinity;
  for(let n=0;n<triangles.length;n+=9) {
    const p=[Array.from(triangles.slice(n,n+3)),Array.from(triangles.slice(n+3,n+6)),Array.from(triangles.slice(n+6,n+9))];
    if(Math.max(...p.map(v=>v[2]))-Math.min(...p.map(v=>v[2]))>.002)continue;
    const low=Math.min(...p.map(v=>v[axis])), high=Math.max(...p.map(v=>v[axis]));
    if(high-low<.65)continue;
    const candidate=(low+high)/2;
    if(candidate<=box[0][axis]+.2||candidate>=box[1][axis]-.2)continue;
    if(Math.abs(candidate-proposed)<delta){delta=Math.abs(candidate-proposed);best=candidate;}
  }
  return delta<.7?best:proposed;
}
export function partitionSource(source,input) {
  const settings=validateSettings(input);
  const {angle,triangles}=localFrame(source.triangles);
  const sourceBox=boundsOf(triangles);
  const closed=auditMesh(triangles);
  const whole=clipMesh(triangles,sourceBox).volume;
  const sourceVolume=closed&&whole>EPS?whole:boxVolume(sourceBox);
  const massMethod=closed&&whole>EPS?'Mesh volume':'Bounding-box upper estimate';
  const volume=box=>massMethod==='Mesh volume'?clipMesh(triangles,box).volume:boxVolume(box);
  const maxMass=Math.min(settings.payload,settings.liftLimit-settings.rigging);
  const queue=[sourceBox], parts=[], cuts=[];
  let sequence=0;
  while(queue.length) {
    if(parts.length+queue.length>15000)throw new Error('Too many pieces. Increase the lifting or transport limits.');
    const box=queue.pop(), size=sizeOf(box), v=volume(box);
    if(v<EPS)continue;
    const mass=v*settings.density;
    if(mass<=maxMass+.01&&orientations(size,settings).length) {
      const clipped=clipMesh(triangles,box,true);
      if(!clipped.geometry.length)continue;
      const actual=boundsOf(clipped.geometry),actualSize=sizeOf(actual);
      const center=actual[0].map((value,i)=>(value+actual[1][i])/2);
      parts.push({id:source.id+'-P'+String(++sequence).padStart(3,'0'),sourceId:source.id,
        name:source.name,storey:source.storey,elevation:source.elevation,category:source.category,
        sourceAngle:angle,center:worldPoint(center,angle),localCenter:center,localBox:box,dimensions:actualSize,
        volume:v,mass,massMethod,ifcId:source.ifc?.GlobalId||'',barEvidence:source.barEvidence||'Not modelled'});
      continue;
    }
    const sorted=[0,1,2].sort((a,b)=>size[b]-size[a]);
    const limits=[settings.deckLength-2*settings.gap,settings.deckWidth-2*settings.gap,settings.loadHeight].sort((a,b)=>b-a);
    const violated=sorted.find((axis,index)=>size[axis]>limits[index]+EPS);
    const axis=violated??sorted[0];
    let cut=box[0][axis]+(violated==null?size[axis]/2:limits[sorted.indexOf(axis)]+settings.kerf/2);
    if(mass>maxMass) {
      let lo=box[0][axis],hi=Math.min(cut,box[1][axis]);
      for(let iteration=0;iteration<22;iteration++) {
        const mid=(lo+hi)/2;
        const child=[box[0].slice(),box[1].slice()];
        child[1][axis]=mid-settings.kerf/2;
        if(volume(child)*settings.density>maxMass)hi=mid;
        else lo=mid;
      }
      cut=lo;
    }
    const structuralStair=/Treppen|Stair/i.test(source.category);
    if(structuralStair) {
      const candidate=preferredStairCut(triangles,axis,cut,box);
      const left=[box[0].slice(),box[1].slice()];left[1][axis]=candidate-settings.kerf/2;
      if(volume(left)*settings.density<=maxMass+.01&&candidate<=cut+EPS)cut=candidate;
    }
    if(cut<=box[0][axis]+settings.kerf/2+.001||cut>=box[1][axis]-settings.kerf/2-.001)
      throw new Error('Cannot split '+source.name+' within these limits. Review its geometry or lifting limit.');
    const left=[box[0].slice(),box[1].slice()],right=[box[0].slice(),box[1].slice()];
    left[1][axis]=cut-settings.kerf/2;right[0][axis]=cut+settings.kerf/2;
    cuts.push({sourceId:source.id,sourceAngle:angle,axis,coordinate:cut,box,storey:source.storey,
      rule:structuralStair?'Landing preferred; connection review required':'Maximum transport envelope and net lifting mass'});
    queue.push(right,left);
  }
  const sum=parts.reduce((total,part)=>total+part.volume,0);
  const largest=Math.max(0,...parts.map(item=>item.volume));
  for(const part of parts)part.largest=part.volume>=largest-EPS;
  if(sum>sourceVolume+Math.max(.001,sourceVolume*.00001))throw new Error('Volume conservation failed for '+source.name);
  return {parts,cuts,sourceVolume,lossVolume:Math.max(0,sourceVolume-sum),massMethod};
}
const intersect=(a,b)=>a.x<b.x+b.w-EPS&&a.x+a.w>b.x+EPS&&a.y<b.y+b.h-EPS&&a.y+a.h>b.y+EPS;
const inside=(a,b)=>a.x>=b.x-EPS&&a.y>=b.y-EPS&&a.x+a.w<=b.x+b.w+EPS&&a.y+a.h<=b.y+b.h+EPS;
function occupy(free,used) {
  const next=[];
  for(const rect of free) {
    if(!intersect(rect,used)){next.push(rect);continue;}
    if(used.x>rect.x+EPS)next.push({...rect,w:used.x-rect.x});
    if(used.x+used.w<rect.x+rect.w-EPS)next.push({...rect,x:used.x+used.w,w:rect.x+rect.w-used.x-used.w});
    if(used.y>rect.y+EPS)next.push({...rect,h:used.y-rect.y});
    if(used.y+used.h<rect.y+rect.h-EPS)next.push({...rect,y:used.y+used.h,h:rect.y+rect.h-used.y-used.h});
  }
  return next.filter((a,i)=>a.w>EPS&&a.h>EPS&&!next.some((b,j)=>j!==i&&inside(a,b)&&(!inside(b,a)||j<i)));
}
export function packParts(parts,input) {
  const settings=validateSettings(input),trucks=[];
  const sorted=[...parts].sort((a,b)=>{
    const aa=orientations(a.dimensions,settings)[0],bb=orientations(b.dimensions,settings)[0];
    if(!aa||!bb)throw new Error('Transport envelope exceeds limits: '+(!aa?a.id:b.id));
    return bb.length*bb.width-aa.length*aa.width||b.mass-a.mass;
  });
  for(const part of sorted) {
    const choices=orientations(part.dimensions,settings);
    if(!choices.length||part.mass>settings.payload+.01)throw new Error('Part '+part.id+' exceeds transport limits.');
    let best=null;
    for(const truck of trucks) {
      if(truck.mass+part.mass>settings.payload+.01)continue;
      for(const rect of truck.free)for(const option of choices) {
        const w=option.length+settings.gap,h=option.width+settings.gap;
        if(w>rect.w+EPS||h>rect.h+EPS)continue;
        const score=Math.min(rect.w-w,rect.h-h)+.001*Math.max(rect.w-w,rect.h-h);
        if(!best||score<best.score)best={truck,rect,option,w,h,score};
      }
    }
    if(!best) {
      const truck={id:trucks.length+1,mass:0,parts:[],free:[{x:settings.gap,y:settings.gap,
        w:settings.deckLength-settings.gap,h:settings.deckWidth-settings.gap}]};
      trucks.push(truck);
      const option=choices[0];
      best={truck,rect:truck.free[0],option,w:option.length+settings.gap,h:option.width+settings.gap};
    }
    const {truck,rect,option,w,h}=best;
    part.truck=truck.id;
    part.load={x:rect.x,y:rect.y,...option};
    truck.parts.push(part.id);truck.mass+=part.mass;
    truck.free=occupy(truck.free,{x:rect.x,y:rect.y,w,h});
  }
  return trucks.map(({free,...truck})=>truck);
}
export function buildPlan(sources,input,onProgress=()=>{}) {
  const settings=validateSettings(input),parts=[],cuts=[],audit=[];
  let lossVolume=0;
  for(let i=0;i<sources.length;i++) {
    const result=partitionSource(sources[i],settings);
    parts.push(...result.parts);cuts.push(...result.cuts);lossVolume+=result.lossVolume;
    audit.push({sourceId:sources[i].id,method:result.massMethod,volume:result.sourceVolume,parts:result.parts.length});
    onProgress(i+1,sources.length);
  }
  const trucks=packParts(parts,settings);
  const removal=[...parts].sort((a,b)=>b.elevation-a.elevation||b.center[2]-a.center[2]||b.mass-a.mass).map(p=>p.id);
  const loading=trucks.flatMap(truck=>truck.parts);
  return {settings,parts,cuts,trucks,audit,removal,loading,lossVolume,
    totalMass:parts.reduce((sum,p)=>sum+p.mass,0)};
}
export function clipSegment(a,b,box) {
  let low=0,high=1;
  for(let axis=0;axis<3;axis++) {
    const delta=b[axis]-a[axis];
    if(Math.abs(delta)<EPS) {
      if(a[axis]<box[0][axis]-EPS||a[axis]>box[1][axis]+EPS)return null;
    } else {
      let u=(box[0][axis]-a[axis])/delta,v=(box[1][axis]-a[axis])/delta;
      if(u>v)[u,v]=[v,u];
      low=Math.max(low,u);high=Math.min(high,v);
      if(high-low<EPS)return null;
    }
  }
  return [a.map((value,i)=>value+(b[i]-value)*low),a.map((value,i)=>value+(b[i]-value)*high)];
}

