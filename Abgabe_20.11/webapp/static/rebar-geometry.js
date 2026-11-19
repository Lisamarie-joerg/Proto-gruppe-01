import * as T from './three/three.module.js';

export const ASSUMPTIONS={cover:.04,diameter:12,linkDiameter:10,spacing:.2,maxLength:7.5,lap:1.06};
const v=p=>new T.Vector3(...p),eps=1e-6;
export function surfaceFamilies(raw) {
  const families=[];
  for(let i=0;i<raw.length;i+=9){const a=v(raw.slice(i,i+3)),b=v(raw.slice(i+3,i+6)),c=v(raw.slice(i+6,i+9));
    const n=b.clone().sub(a).cross(c.clone().sub(a)),area=n.length()/2;if(area<1e-8)continue;n.normalize();
    if(n.z<-.0001||Math.abs(n.z)<.0001&&(n.x<-.0001||Math.abs(n.x)<.0001&&n.y<0))n.negate();
    let family=families.find(f=>f.n.dot(n)>.9999);if(!family){family={n,area:0,planes:new Map()};families.push(family);}family.area+=area;
    const w=a.dot(family.n),key=Math.round(w*1000);let plane=family.planes.get(key);
    if(!plane){plane={w,area:0,points:[]};family.planes.set(key,plane);}plane.area+=area;plane.points.push(a,b,c);
  }
  return families.sort((a,b)=>b.area-a.area);
}
export function frameFor(raw,normal) {
  const points=[];for(let i=0;i<raw.length;i+=3)points.push(v(raw.slice(i,i+3)));
  const origin=points.reduce((a,b)=>a.add(b),new T.Vector3()).divideScalar(points.length);
  const n=normal.clone().normalize(),u=Math.abs(n.z)<.999?new T.Vector3(0,0,1).cross(n).normalize():new T.Vector3(1,0,0),vv=n.clone().cross(u).normalize();
  const local=p=>{const q=(p.isVector3?p:v(p)).clone().sub(origin);return [q.dot(u),q.dot(vv),q.dot(n)];};
  const world=p=>origin.clone().addScaledVector(u,p[0]).addScaledVector(vv,p[1]).addScaledVector(n,p[2]).toArray();
  const flat=new Float64Array(raw.length);points.forEach((p,i)=>flat.set(local(p),i*3));
  const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity],triangles=[];
  for(let i=0;i<flat.length;i++){lo[i%3]=Math.min(lo[i%3],flat[i]);hi[i%3]=Math.max(hi[i%3],flat[i]);}
  for(let i=0;i<flat.length;i+=9)triangles.push(new T.Triangle(v(flat.slice(i,i+3)),v(flat.slice(i+3,i+6)),v(flat.slice(i+6,i+9))));
  return {local,world,flat,lo,hi,triangles,normal:n};
}
export function intervals(frame,axis,u,vv) {
  const transverse=[0,1,2].filter(k=>k!==axis),[i,j]=transverse,hits=[];
  for(const t of frame.triangles){const a=t.a.toArray(),b=t.b.toArray(),c=t.c.toArray();
    const determinant=(b[i]-a[i])*(c[j]-a[j])-(b[j]-a[j])*(c[i]-a[i]);if(Math.abs(determinant)<1e-10)continue;
    const q=((u-a[i])*(c[j]-a[j])-(vv-a[j])*(c[i]-a[i]))/determinant;
    const s=((b[i]-a[i])*(vv-a[j])-(b[j]-a[j])*(u-a[i]))/determinant;
    if(q>=-1e-8&&s>=-1e-8&&q+s<=1+1e-8)hits.push(a[axis]+q*(b[axis]-a[axis])+s*(c[axis]-a[axis]));
  }
  hits.sort((a,b)=>a-b);const unique=hits.filter((x,i)=>!i||x-hits[i-1]>1e-5);if(unique.length%2)return [];
  return unique.filter((_,i)=>i%2===0).map((x,i)=>[x,unique[i*2+1]]);
}
export function coordinates(lo,hi,spacing=.2) {
  if(hi<lo)return [];const count=Math.max(1,Math.ceil((hi-lo)/spacing));return Array.from({length:count+1},(_,i)=>lo+(hi-lo)*i/count);
}
const closest=new T.Vector3();
export function clearance(frame,p) {
  const point=v(p);let distance=Infinity;
  for(const triangle of frame.triangles){triangle.closestPointToPoint(point,closest);distance=Math.min(distance,closest.distanceToSquared(point));}
  return Math.sqrt(distance);
}
export function contains(frame,p) {
  const ray=new T.Ray(v(p),new T.Vector3(1,.37139,.18371).normalize()),hit=new T.Vector3(),distances=[];
  for(const triangle of frame.triangles)if(ray.intersectTriangle(triangle.a,triangle.b,triangle.c,false,hit))distances.push(hit.distanceTo(ray.origin));
  distances.sort((a,b)=>a-b);return distances.filter((d,i)=>d>1e-7&&(!i||d-distances[i-1]>1e-5)).length%2===1;
}
function segmentDistanceSquared(p,q,a,b){
  const d=[q.x-p.x,q.y-p.y,q.z-p.z],e=[b.x-a.x,b.y-a.y,b.z-a.z],r=[p.x-a.x,p.y-a.y,p.z-a.z];
  const dot=(x,y)=>x[0]*y[0]+x[1]*y[1]+x[2]*y[2],dd=dot(d,d),ee=dot(e,e),f=dot(e,r),clamp=x=>Math.max(0,Math.min(1,x));let s=0,t=0;
  if(dd<1e-16)t=ee>1e-16?clamp(f/ee):0;
  else{const c=dot(d,r);if(ee<1e-16)s=clamp(-c/dd);else{const de=dot(d,e),denom=dd*ee-de*de;s=denom>1e-16?clamp((de*f-c*ee)/denom):0;t=(de*s+f)/ee;if(t<0){t=0;s=clamp(-c/dd);}else if(t>1){t=1;s=clamp((de-c)/dd);}}}
  return r.reduce((sum,x,k)=>sum+(x+s*d[k]-t*e[k])**2,0);
}
export function segmentClearance(frame,a,b,threshold=0){
  const p=v(a),q=v(b),direction=q.clone().sub(p),lengthSquared=direction.lengthSq(),ray=new T.Ray(p,direction.normalize()),hit=new T.Vector3();let distance=Infinity;
  for(const triangle of frame.triangles){
    if(ray.intersectTriangle(triangle.a,triangle.b,triangle.c,false,hit)&&hit.distanceToSquared(p)<=lengthSquared+1e-12)return 0;
    triangle.closestPointToPoint(p,closest);distance=Math.min(distance,p.distanceToSquared(closest));triangle.closestPointToPoint(q,closest);distance=Math.min(distance,q.distanceToSquared(closest));
    distance=Math.min(distance,segmentDistanceSquared(p,q,triangle.a,triangle.b),segmentDistanceSquared(p,q,triangle.b,triangle.c),segmentDistanceSquared(p,q,triangle.c,triangle.a));
    if(distance<threshold*threshold)return Math.sqrt(distance);
  }
  return Math.sqrt(distance);
}
export function clippedLines(frame,axis,fixed,diameter=12) {
  const cross=[0,1,2].filter(k=>k!==axis),margin=ASSUMPTIONS.cover+diameter/2000,result=[];
  for(const [rawLo,rawHi] of intervals(frame,axis,fixed[cross[0]],fixed[cross[1]])){
    const lo=rawLo+margin,hi=rawHi-margin;if(hi-lo<.15)continue;
    const point=x=>{const p=[...fixed];p[axis]=x;return p;};
    const good=x=>clearance(frame,point(x))>=margin-1e-6;
    const count=Math.max(2,Math.ceil((hi-lo)/.08));let start=null,last=lo;
    for(let i=0;i<=count;i++){const x=lo+(hi-lo)*i/count,valid=good(x);
      if(valid&&start===null){let a=last,b=x;if(i&&!good(last))for(let k=0;k<10;k++){const m=(a+b)/2;if(good(m))b=m;else a=m;}start=i?(a+b)/2:x;}
      if(!valid&&start!==null){let a=last,b=x;for(let k=0;k<10;k++){const m=(a+b)/2;if(good(m))a=m;else b=m;}if(a-start>.15)result.push([point(start+.0001),point(a-.0001)]);start=null;}
      if(i===count&&start!==null&&x-start>.15)result.push([point(start+.0001),point(x-.0001)]);last=x;
    }
  }
  return result;
}
export function splitStraight(a,b,maxLength=7.5,lap=1.06) {
  const start=v(a),direction=v(b).sub(start),length=direction.length();direction.normalize();const pieces=[];
  const count=Math.max(1,Math.ceil((length-lap)/(maxLength-lap))),pieceLength=(length+(count-1)*lap)/count;
  for(let i=0;i<count;i++){const x=i*(pieceLength-lap),end=Math.min(length,x+pieceLength);pieces.push([start.clone().addScaledVector(direction,x).toArray(),start.clone().addScaledVector(direction,end).toArray()]);}
  return pieces;
}
export function roundedLink(axis,at,lo,hi,radius=.03) {
  const cross=[0,1,2].filter(k=>k!==axis),[u,w]=cross;
  const r=Math.min(radius,(hi[u]-lo[u])/4,(hi[w]-lo[w])/4),points=[];
  for(const [cu,cw,start] of [[hi[u]-r,hi[w]-r,0],[lo[u]+r,hi[w]-r,Math.PI/2],[lo[u]+r,lo[w]+r,Math.PI],[hi[u]-r,lo[w]+r,Math.PI*1.5]]){
    for(let step=0;step<=2;step++){const angle=start+step*Math.PI/4,p=[0,0,0];p[axis]=at;p[u]=cu+r*Math.cos(angle);p[w]=cw+r*Math.sin(angle);points.push(p);}}
  points.push([...points[0]]);return points;
}
