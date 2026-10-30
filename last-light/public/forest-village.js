// A small shared blueprint: rendering, collision and evacuation use these same bounds.
export const VILLAGE = [
  {id:'hearth',name:'Ada’s cottage',x:-5,z:-13,w:5.2,d:4.6,roof:'#705044'},
  {id:'mill',name:'The cooper’s workshop',x:-7,z:-29,w:6,d:5,roof:'#76654c'},
  {id:'lodge',name:'The riverside lodge',x:-18,z:-21,w:6.4,d:5.2,roof:'#59684f'},
];
export const REFUGE={x:32,z:-8};
export const refugeSpot=p=>({x:REFUGE.x+(p.id%3-1)*1.6,z:REFUGE.z+1.8+Math.floor(p.id/3)*1.8});
export const buildingDistance=(b,x,z)=>Math.hypot(Math.max(0,Math.abs(x-b.x)-b.w/2),Math.max(0,Math.abs(z-b.z)-b.d/2));
export function createVillage(){return VILLAGE.map(b=>({...b,status:'intact',heat:0,fuel:75,burningFor:0,wet:0}));}
export function createVillagers(){return ['Ada','Ren','June','Tomas','Mira'].map((name,id)=>{const b=VILLAGE[id%3];return {id,name,home:b.id,x:b.x+(id>2?1.1:-1.1),z:b.z+b.d/2+1.5,status:'idle',path:[],pathIndex:0,replan:0,phase:id*1.7};});}

// A* on a modest grid. A route is checked against current fire and flood depth.
export function findEscapePath(state,person,waterDepth){
  const step=2,minX=-52,minZ=-54,width=48,height=48;
  const cell=(x,z)=>({i:Math.max(0,Math.min(width-1,Math.round((x-minX)/step))),j:Math.max(0,Math.min(height-1,Math.round((z-minZ)/step)))});
  const key=(i,j)=>j*width+i,start=cell(person.x,person.z),spot=refugeSpot(person),goal=cell(spot.x,spot.z),startKey=key(start.i,start.j),goalKey=key(goal.i,goal.j);
  const open=[startKey],scores=new Map([[startKey,0]]),parents=new Map(),closed=new Set(),costCache=new Map();
  const xy=id=>({x:minX+(id%width)*step,z:minZ+Math.floor(id/width)*step});
  function cost(id){if(costCache.has(id))return costCache.get(id);const p=xy(id),depth=waterDepth(p.x,p.z);let value=1+Math.max(0,depth)*3;
    if(depth>.82||state.buildings.some(b=>buildingDistance(b,p.x,p.z)<.6)||state.trees.some(t=>!t.fall&&Math.hypot(t.x-p.x,t.z-p.z)<(t.status==='burning'?2.2:.9)))value=Infinity;
    costCache.set(id,value);return value;
  }
  const estimate=id=>Math.hypot(id%width-goal.i,Math.floor(id/width)-goal.j);
  while(open.length&&closed.size<width*height){let best=0;for(let n=1;n<open.length;n++)if(scores.get(open[n])+estimate(open[n])<scores.get(open[best])+estimate(open[best]))best=n;const current=open.splice(best,1)[0];if(current===goalKey){const path=[];let at=current;while(at!==startKey){path.push(xy(at));at=parents.get(at);}return [...path.reverse(),spot];}closed.add(current);const i=current%width,j=Math.floor(current/width);
    for(const [di,dj]of [[0,1],[1,0],[0,-1],[-1,0],[1,1],[-1,1],[1,-1],[-1,-1]]){const ni=i+di,nj=j+dj;if(ni<0||ni>=width||nj<0||nj>=height)continue;const next=key(ni,nj);if(closed.has(next))continue;const c=cost(next);if(!Number.isFinite(c))continue;if(di&&dj&&(!Number.isFinite(cost(key(i+di,j)))||!Number.isFinite(cost(key(i,j+dj)))))continue;const score=scores.get(current)+c*(di&&dj?1.414:1);if(score<(scores.get(next)??Infinity)){scores.set(next,score);parents.set(next,current);if(!open.includes(next))open.push(next);}}
  }
  return [];
}
export function stepVillagers(state,dt,waterDepth){
  if(!state.villageAlarm){for(const p of state.villagers){const home=state.buildings.find(b=>b.id===p.home);p.x=home.x+(p.id>2?1.1:-1.1)+Math.sin(state.time*.35+p.phase)*.35;p.z=home.z+home.d/2+1.5+Math.cos(state.time*.35+p.phase)*.2;}return;}
  for(const p of state.villagers){
    if(p.status==='sheltered')continue;
    p.replan-=dt;
    if(p.replan<=0){p.path=findEscapePath(state,p,waterDepth);p.pathIndex=0;p.replan=3+p.id*.17;p.status=p.path.length?'fleeing':'stranded';}
    const target=p.path[p.pathIndex];if(!target)continue;
    const dx=target.x-p.x,dz=target.z-p.z,dist=Math.hypot(dx,dz),speed=2.7/(1+Math.max(0,waterDepth(p.x,p.z))*.8),travel=Math.min(dist,dt*speed);
    if(waterDepth(target.x,target.z)>.82){p.replan=0;continue;}
    p.x+=dx/(dist||1)*travel;p.z+=dz/(dist||1)*travel;
    if(dist<.2)p.pathIndex++;
    const shelter=refugeSpot(p);if(Math.hypot(p.x-shelter.x,p.z-shelter.z)<.35){p.status='sheltered';p.path=[];p.x=shelter.x;p.z=shelter.z;}
  }
}
