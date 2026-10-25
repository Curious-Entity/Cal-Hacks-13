import * as THREE from './vendor/three.module.min.js';
import {terrainHeight,standingHeight} from './forest-rules.js';
import {REFUGE} from './forest-village.js';

export function createVillageView(env,state,avatar,clothes){
  const {root,mat,add,box,segment,mergeParts,wood,stone,textures,materials}=env;
  const houses=state.buildings.map(b=>{
    const group=new THREE.Group();group.position.set(b.x,terrainHeight(b.x,b.z),b.z);root.add(group);
    const timber=mat('#b18b63',{map:wood.map}),roofMat=mat(b.roof,{map:wood.map}),woodParts=new THREE.Group(),roof=new THREE.Group();group.add(woodParts,roof);
    const hw=b.w/2,hd=b.d/2;
    box(group,b.w+.35,.23,b.d+.3,stone,0,.1,0);
    for(let i=0;i<8;i++){const y=.35+i*.33;for(const z of [-hd,hd])segment(woodParts,[-hw-.15,y,z],[hw+.15,y,z],.18,.18,timber,12);for(const x of [-hw,hw])segment(woodParts,[x,y,-hd-.15],[x,y,hd+.15],.18,.18,timber,12);}
    box(woodParts,b.w+.6,.2,1.3,timber,0,.22,hd+.65);for(let i=0;i<2;i++)box(woodParts,1.7,.13,1.1-i*.3,timber,0,.07+i*.1,hd+1.3-i*.3);
    for(const x of [-hw+.2,hw-.2])segment(woodParts,[x,.3,hd+1.1],[x,2.7,hd+1.1],.09,.09,timber,12);
    box(woodParts,b.w+.4,.13,.14,timber,0,2.65,hd+1.1);
    mergeParts(woodParts,timber);
    const rise=1.5,half=hw+.55,length=Math.hypot(half,rise),angle=Math.atan2(rise,half);
    for(const side of [-1,1])for(let j=0;j<7;j++)for(let k=0;k<4;k++){
      const u=(j+.5)/7,x=side*half*u,y=4.2-rise*u,z=-hd-.5+(k+.5)*(b.d+1)/4;
      const tile=box(roof,length/7+.04,.12,(b.d+1)/4+.05,roofMat,x,y,z);tile.rotation.z=-side*angle;
    }
    segment(roof,[0,4.2,-hd-.6],[0,4.2,hd+.6],.12,.12,roofMat,12);mergeParts(roof,roofMat);
    const gable=new THREE.BufferGeometry(),gableVertices=[];for(const z of [-hd-.08,hd+.08])gableVertices.push(-hw,2.7,z,hw,2.7,z,0,4.12,z);gable.setAttribute('position',new THREE.Float32BufferAttribute(gableVertices,3));gable.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,.5,1,0,0,1,0,.5,1],2));gable.computeVertexNormals();const gableMat=timber.clone();gableMat.side=THREE.DoubleSide;materials.add(gableMat);add(group,gable,gableMat);
    const door=mat('#483e31');box(group,1.05,1.95,.12,door,0,1.18,hd+.2);for(let i=0;i<5;i++)box(group,.025,1.75,.035,timber,-.45+i*.225,1.18,hd+.28);add(group,new THREE.SphereGeometry(.045,10,8),mat('#b79b5c',{metalness:.6}),.35,1.2,hd+.3);
    const glass=mat('#e4ca8d',{emissive:'#daac58',emissiveIntensity:.4,roughness:.3});for(const x of [-hw+.85,hw-.85]){box(group,.83,.85,.08,glass,x,1.6,hd+.2);for(const dx of [-.48,0,.48])box(group,.065,1,.09,timber,x+dx,1.6,hd+.28);for(const dy of [-.5,0,.5])box(group,1,.065,.09,timber,x,1.6+dy,hd+.28);}
    // Chimney, porch bench, stacked firewood and a rain barrel.
    box(group,.55,1.9,.6,stone,hw-.9,3.7,-hd+.8);box(group,.7,.15,.73,stone,hw-.9,4.7,-hd+.8);
    box(group,1.3,.1,.4,timber,-hw+.7,.72,hd+.9);for(const x of [-hw+.25,-hw+1.15])box(group,.1,.5,.3,timber,x,.42,hd+.9);
    const barrel=add(group,new THREE.CylinderGeometry(.38,.32,.85,20),timber,hw+1,.5,hd-.7);for(const y of [.2,.7]){const hoop=add(group,new THREE.TorusGeometry(.35,.025,6,24),mat('#6d7268',{metalness:.4}),hw+1,y,hd-.7);hoop.rotation.x=Math.PI/2;}
    return {group,timber,roof,glass,roofMat,gableMat};
  });
  const people=state.villagers.map((p,i)=>{
    const actor=avatar.clone(true),clones=new Map();actor.rotation.set(0,0,0);actor.scale.setScalar(.92+i*.025);root.add(actor);
    actor.traverse(o=>{if(o.material){if(!clones.has(o.material)){const original=o.material,m=original.clone();if(original===clothes.coat)m.color.set(['#ab7354','#6d7f71','#b3a580','#657789','#8e6a6c'][i]);if(original===clothes.hair)m.color.set(i===3?'#b6afa0':'#574534');clones.set(original,m);materials.add(m);}o.material=clones.get(o.material);}});
    actor.children.filter(o=>o.name==='pack'||o.name==='flask').forEach(o=>actor.remove(o));
    const legs=[],arms=[];actor.traverse(o=>{if(o.name==='leg')legs.push(o);if(o.name==='arm')arms.push(o);});
    return {actor,legs,arms,x:p.x,z:p.z};
  });
  const flag=new THREE.Group();flag.position.set(REFUGE.x,terrainHeight(REFUGE.x,REFUGE.z),REFUGE.z);root.add(flag);segment(flag,[0,0,0],[0,3,0],.07,.07,wood,12);box(flag,.9,.55,.04,mat('#d9d5b3'),.43,2.55,0);
  return {obstacles:houses.map(h=>h.group),update(time){
    state.buildings.forEach((b,i)=>{const view=houses[i],burned=b.status==='ruined',burning=b.status==='burning';view.timber.color.set(burned?'#352c24':burning?'#795039':'#b18b63');view.gableMat.color.copy(view.timber.color);view.roofMat.color.set(burned?'#38312a':b.roof);view.glass.emissiveIntensity=burned?0:burning?1.8:.4;view.glass.emissive.set(burning?'#ff7127':'#daac58');view.roof.position.y=burned?-1.6:0;view.roof.rotation.z=burned?.16:0;});
    state.villagers.forEach((p,i)=>{const view=people[i],moving=Math.hypot(p.x-view.x,p.z-view.z)>.001;view.actor.position.set(p.x,standingHeight(state,p.x,p.z),p.z);if(moving)view.actor.rotation.y=Math.atan2(p.x-view.x,p.z-view.z);else if(p.status==='idle')view.actor.rotation.y=Math.sin(time*.4+p.phase)*.5;view.legs.forEach((leg,n)=>leg.rotation.x=moving?Math.sin(time*10+n*Math.PI)*(p.status==='idle'?.035:.6):0);view.arms.forEach((arm,n)=>arm.rotation.x=moving&&p.status==='fleeing'?-Math.sin(time*10+n*Math.PI)*.35:0);view.x=p.x;view.z=p.z;});
  }};
}
