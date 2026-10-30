// Procedural scenery, WASD movement and follow camera adapted from the team's
// make-x20/fantasy-roam demo. Model output supplies data, never executable code.
import {createMissionSystem} from './world-missions.js';
import {distanceToRoute} from './world-layout.js';
import * as THREE from './vendor/three.module.min.js';

export function createWorldRenderer(host,world,options={}) {
  const palette=world.palette,biome=world.biome,active=world.playMode==='active',gateX=world.layout?.gate.x||0,gateZ=world.layout?.gate.z??-25,sourcePoint=world.landmarks.find(p=>p.id==='source');
  let seed=[...(options.id||world.title)].reduce((n,c)=>(Math.imul(n,31)+c.charCodeAt(0))>>>0,2031);
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const scene=new THREE.Scene();scene.background=new THREE.Color(palette.sky);scene.fog=new THREE.FogExp2(palette.sky,.012);
  const camera=new THREE.PerspectiveCamera(54,1,.1,260);
  const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<700?1.4:1.8));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
  renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label','Explorable 3D world. WASD or arrow keys to move; drag to look.');host.append(renderer.domElement);
  const root=new THREE.Group();scene.add(root);const colliders=[],landmarks=new Map(),characters=new Map(),keys=new Set(),labels=[];
  const materials=[];const material=(color,glow=false)=>{const m=new THREE.MeshStandardMaterial({color,roughness:.72,flatShading:false,...(glow?{emissive:color,emissiveIntensity:.5}:{})});materials.push(m);return m;};
  const groundMat=material(palette.ground),leafMat=material(palette.foliage),stoneMat=material(palette.structure),accentMat=material(palette.accent,true),woodMat=material('#604b42');
  const height=(x,z)=>['space','city','interior'].includes(biome)?0:(active?1.7:1)*(Math.sin(x*.09)*.55+Math.cos(z*.075)*.45+Math.sin((x+z)*.055)*.35);
  function mesh(parent,geometry,mat,x=0,y=0,z=0){const m=new THREE.Mesh(geometry,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  const box=(g,w,h,d,mat,x,y,z)=>mesh(g,new THREE.BoxGeometry(w,h,d),mat,x,y,z);
  const cylinder=(g,a,b,h,mat,x,y,z,sides=24)=>mesh(g,new THREE.CylinderGeometry(a,b,h,sides),mat,x,y,z);
  const sphere=(g,r,mat,x,y,z)=>mesh(g,new THREE.SphereGeometry(r,24,18),mat,x,y,z);
  const textures=[];
  function texture(kind,base){const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d');ctx.fillStyle=base;ctx.fillRect(0,0,256,256);
    for(let i=0;i<2600;i++){const x=random()*256,y=random()*256;ctx.fillStyle=i%2?'#ffffff12':'#00000018';ctx.fillRect(x,y,kind==='wood'?1:2,kind==='wood'?18+random()*70:2+random()*3);}
    if(kind==='stone'){ctx.strokeStyle='#10191d55';ctx.lineWidth=3;for(let y=0;y<256;y+=32){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(256,y);ctx.stroke();for(let x=(y%64?32:0);x<256;x+=64){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+32);ctx.stroke();}}}
    const t=new THREE.CanvasTexture(canvas);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(kind==='ground'?24:kind==='wood'?2:3,kind==='ground'?24:3);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());textures.push(t);return t;}
  woodMat.map=texture('wood','#a6937a');stoneMat.map=texture('stone','#c4c7c5');groundMat.map=texture('ground','#b3b4a5');
  function tree(g,s=1){cylinder(g,.25*s,.44*s,5*s,woodMat,0,2.5*s,0);for(let i=0;i<7;i++){const a=i*2.4,branch=cylinder(g,.07*s,.17*s,2*s,woodMat,Math.sin(a)*.7*s,(3+i*.35)*s,Math.cos(a)*.7*s);branch.rotation.z=Math.sin(a)*.7;branch.rotation.x=Math.cos(a)*.7;const crown=sphere(g,(1.5+(i%3)*.2)*s,leafMat,Math.sin(a)*1.25*s,(4.6+i*.4)*s,Math.cos(a)*1.25*s);crown.scale.y=.85;}}
  const groundGeo=new THREE.PlaneGeometry(125,125,88,88);groundGeo.rotateX(-Math.PI/2);const pos=groundGeo.attributes.position;for(let i=0;i<pos.count;i++)pos.setY(i,height(pos.getX(i),pos.getZ(i)));groundGeo.computeVertexNormals();mesh(root,groundGeo,groundMat);
  const hemi=new THREE.HemisphereLight('#d2e9ff',palette.ground,2.4);scene.add(hemi);
  const sun=new THREE.DirectionalLight('#fff1d7',2.6);sun.position.set(-25,40,20);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.normalBias=.06;Object.assign(sun.shadow.camera,{left:-56,right:56,top:56,bottom:-56,far:110});scene.add(sun);
  const skyOrb=sphere(root,biome==='space'?9:3.3,new THREE.MeshBasicMaterial({color:palette.accent}),-42,36,-62);
  if(biome==='space'){const ring=mesh(root,new THREE.TorusGeometry(14,.65,8,50),stoneMat,-42,36,-62);ring.rotation.x=1.05;}
  // Winding, connected districts replace the repeated hub-and-spoke arrangement.
  const pathMat=material(new THREE.Color(palette.structure).lerp(new THREE.Color(palette.ground),.5));pathMat.side=THREE.DoubleSide;
  const hubGeo=new THREE.CircleGeometry(active?4.5:5.5,48);hubGeo.rotateX(-Math.PI/2);const hubPositions=hubGeo.attributes.position;for(let i=0;i<hubPositions.count;i++)hubPositions.setY(i,height(hubPositions.getX(i),hubPositions.getZ(i))+.07);hubGeo.computeVertexNormals();const hub=mesh(root,hubGeo,pathMat);hub.castShadow=false;
  if(active){const safe=mesh(root,new THREE.RingGeometry(4.3,4.6,64),material('#65dfea',true),0,height(0,0)+.1,0);safe.rotation.x=-Math.PI/2;}
  const routes=active?world.layout.paths:world.landmarks.map(p=>[{x:0,z:0},{x:p.x,z:p.z}]),routeSamples=[];
  for(const points of routes){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(p.x,0,p.z))),samples=curve.getPoints(40);routeSamples.push(samples);const vertices=[],indices=[],uv=[];
    samples.forEach((p,i)=>{const next=samples[Math.min(i+1,40)],previous=samples[Math.max(0,i-1)],dx=next.x-previous.x,dz=next.z-previous.z,len=Math.hypot(dx,dz)||1;for(const side of [-1,1]){const x=p.x+dz/len*.95*side,z=p.z-dx/len*.95*side;vertices.push(x,height(x,z)+.065,z);uv.push(side===-1?0:1,i*.3);}if(i<40){const n=i*2;indices.push(n,n+2,n+1,n+1,n+2,n+3);}});
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();mesh(root,geometry,pathMat).castShadow=false;
  }
  const inPath=(x,z)=>Math.hypot(x,z)<7||Math.abs(z-gateZ)<4||distanceToRoute(x,z,routeSamples)<3.6||world.landmarks.some(p=>Math.hypot(p.x-x,p.z-z)<12);
  // Shared instance buffers keep repeated scenery inexpensive.
  const decor=[];for(let i=0;i<170;i++){const x=(random()-.5)*92,z=(random()-.5)*92;if(!inPath(x,z))decor.push({x,z,s:.7+random()*.7,h:2+random()*7});}
  const matrix=new THREE.Object3D();
  function instances(geo,mat,transform){const batch=new THREE.InstancedMesh(geo,mat,decor.length);decor.forEach((p,i)=>{matrix.position.set(p.x,height(p.x,p.z),p.z);matrix.rotation.set(0,0,0);matrix.scale.set(1,1,1);transform(matrix,p);matrix.updateMatrix();batch.setMatrixAt(i,matrix.matrix);});batch.castShadow=true;batch.receiveShadow=true;root.add(batch);}
  if(['forest','mountain'].includes(biome)){
    instances(new THREE.CylinderGeometry(.18,.3,3.2,6),woodMat,(m,p)=>{m.position.y+=1.6*p.s;m.scale.setScalar(p.s);});
    for(let crown=0;crown<3;crown++)instances(new THREE.SphereGeometry(1.65,20,14),leafMat,(m,p)=>{m.position.y+=(4.2+crown*.8)*p.s;m.position.x+=Math.sin(crown*2.4)*p.s;m.position.z+=Math.cos(crown*2.4)*p.s;m.scale.set(p.s,1.05*p.s,p.s);});
    decor.forEach(p=>colliders.push({x:p.x,z:p.z,r:.65}));
  }else if(biome==='city'){
    instances(new THREE.BoxGeometry(3,1,3),stoneMat,(m,p)=>{m.position.y+=p.h/2;m.scale.y=p.h;});
    instances(new THREE.BoxGeometry(2.3,.2,.05),accentMat,(m,p)=>{m.position.y+=p.h*.65;m.position.z+=1.53;});
    decor.forEach(p=>colliders.push({x:p.x,z:p.z,r:2.1}));
  }else if(biome==='ocean'){
    instances(new THREE.CylinderGeometry(.18,.36,4,16),leafMat,(m,p)=>{m.position.y+=1.5*p.s;m.scale.set(p.s*.7,p.s,p.s*.7);m.rotation.z=.25;});for(let branch=0;branch<3;branch++){instances(new THREE.CylinderGeometry(.1,.2,2,12),leafMat,(m,p)=>{m.position.y+=(2+branch*.5)*p.s;m.position.x+=Math.sin(branch*2.4)*p.s;m.position.z+=Math.cos(branch*2.4)*p.s;m.rotation.z=Math.sin(branch*2.4)*.8;m.rotation.x=Math.cos(branch*2.4)*.8;m.scale.setScalar(p.s);});instances(new THREE.SphereGeometry(.5,16,12),leafMat,(m,p)=>{m.position.y+=(3+branch*.4)*p.s;m.position.x+=Math.sin(branch*2.4)*1.4*p.s;m.position.z+=Math.cos(branch*2.4)*1.4*p.s;m.scale.set(p.s,.7*p.s,p.s);});}
    instances(new THREE.OctahedronGeometry(1,0),accentMat,(m,p)=>{m.position.y+=.5;m.scale.set(p.s,.6*p.s,p.s);});
  }else{
    instances(new THREE.DodecahedronGeometry(1,1),stoneMat,(m,p)=>{m.position.y+=.4*p.s;m.scale.set(p.s,p.s*.7,p.s);});
  }
  if(biome==='mountain'||biome==='desert')for(let i=0;i<12;i++){const a=i*Math.PI/6,s=5+random()*7;mesh(root,new THREE.ConeGeometry(s,s*1.7,biome==='desert'?4:7),stoneMat,Math.sin(a)*57,s*.6,Math.cos(a)*57);}
  if(biome==='interior'){
    box(root,104,7,1.2,stoneMat,0,3.5,-52);box(root,1.2,7,104,stoneMat,-52,3.5,0);box(root,1.2,7,104,stoneMat,52,3.5,0);
    for(let x=-30;x<=30;x+=10){box(root,3,.2,.2,accentMat,x,4,-40.3);box(root,1,9,1,stoneMat,x,4.5,-39);}
  }
  // Every supported landmark is made from simple, reusable meshes.
  function buildLandmark(item,index){
    const group=new THREE.Group();group.position.set(item.x,height(item.x,item.z),item.z);root.add(group);
    if(!active)mesh(group,new THREE.CylinderGeometry(3.8,4,.15,28),pathMat,0,.02,0);
    const kind=item.kind;
    if(kind==='tree')tree(group,1.15);
    if(kind==='well'){
      cylinder(group,2,2.2,1.2,stoneMat,0,.6,0,18);const water=mesh(group,new THREE.CircleGeometry(1.65,32),accentMat,0,1.23,0);water.rotation.x=-Math.PI/2;
      const ring=mesh(group,new THREE.TorusGeometry(2,.22,8,24),stoneMat,0,1.2,0);ring.rotation.x=Math.PI/2;
    }
    if(kind==='campfire')for(let i=0;i<4;i++){const log=cylinder(group,.2,.2,2.5,woodMat,0,.3,0);log.rotation.set(0,i*Math.PI/2,Math.PI/2);}
    if(kind==='portal'){
      box(group,.65,5,.7,stoneMat,-2.6,2.5,0);box(group,.65,5,.7,stoneMat,2.6,2.5,0);
      const rim=mesh(group,new THREE.TorusGeometry(2.6,.3,9,32),stoneMat,0,3.1,0);
      const veil=mesh(group,new THREE.CircleGeometry(2.35,32),new THREE.MeshBasicMaterial({color:palette.accent,transparent:true,opacity:.35,side:THREE.DoubleSide}),0,3.1,0);group.userData.veil=veil;
    }
    if(kind==='cottage'){
      box(group,5.4,4.2,4.5,stoneMat,0,2.1,0);const roof=mesh(group,new THREE.ConeGeometry(4.4,2.6,4),woodMat,0,5.3,0);roof.rotation.y=Math.PI/4;group.userData.roof=roof;for(const x of [-2.3,2.3])box(group,.18,4.5,.2,woodMat,x,2.25,2.3);box(group,5.7,.2,.3,woodMat,0,3.9,2.4);cylinder(group,.3,.3,2,stoneMat,1.6,6,0);for(let i=0;i<5;i++){const step=box(group,1.6,.18,.45,woodMat,0,.1+i*.13,3.5-i*.38);}
      box(group,1.25,2.5,.09,woodMat,0,1.25,2.3);for(const x of [-1.7,1.7])box(group,.9,1,.1,accentMat,x,2.5,2.31);
    }
    if(kind==='terminal'){
      cylinder(group,.8,1.2,1.8,stoneMat,0,.9,0);box(group,2.8,1.8,.4,stoneMat,0,2.7,0);box(group,2.4,1.35,.05,accentMat,0,2.7,.23);
      for(let i=0;i<4;i++)box(group,.3,.06,.6,pathMat,-.75+i*.5,1.86,.7);
    }
    if(kind==='tower'){
      cylinder(group,1.2,1.8,6.5,stoneMat,0,3.25,0);mesh(group,new THREE.ConeGeometry(2.1,2,8),woodMat,0,7.4,0);sphere(group,.6,accentMat,0,8.8,0);
    }
    if(kind==='crystal')for(let i=0;i<5;i++){const crystal=mesh(group,new THREE.OctahedronGeometry(.8,0),accentMat,Math.sin(i*2.4)*1.3,1.4+(i%2)*.4,Math.cos(i*2.4)*1.3);crystal.scale.y=2;}
    if(kind==='archive'){
      for(const x of [-1.9,1.9])box(group,.25,4,.9,woodMat,x,2,0);
      for(let row=0;row<3;row++){box(group,4,.2,.9,woodMat,0,.5+row*1.3,0);for(let n=0;n<7;n++){const book=box(group,.35,.8,.6,n%2?leafMat:stoneMat,-1.5+n*.48,1+row*1.3,0);book.rotation.z=(n%3-1)*.08;}}
    }
    if(kind==='garden'){
      cylinder(group,2.7,2.9,.4,woodMat,0,.2,0,16);
      for(let i=0;i<12;i++){const x=Math.sin(i*2.4)*(1+random()),z=Math.cos(i*2.4)*(1+random());cylinder(group,.04,.04,1.4,leafMat,x,.9,z,5);sphere(group,.2,accentMat,x,1.65,z);}
    }
    const haloMat=new THREE.MeshBasicMaterial({color:palette.accent,transparent:true,opacity:.4,side:THREE.DoubleSide});
    const halo=mesh(group,new THREE.RingGeometry(3.9,4.07,40),haloMat,0,.15,0);halo.rotation.x=-Math.PI/2;
    const flame=mesh(group,new THREE.ConeGeometry(.65,2.2,7),new THREE.MeshBasicMaterial({color:'#ffb66c',transparent:true,opacity:.85}),0,1.4,0);flame.visible=kind==='campfire';
    const light=new THREE.PointLight(palette.accent,2,16,2);light.position.set(0,3,0);group.add(light);
    const beacon=mesh(group,new THREE.OctahedronGeometry(.35,0),accentMat,0,kind==='tree'?10:kind==='tower'?10:7,0);
    const label=document.createElement('div');label.className='world-label';label.textContent=item.name;label.dataset.landmarkId=item.id;host.append(label);labels.push({node:label,item,offset:kind==='tree'||kind==='tower'?11:8});
    colliders.push({x:item.x,z:item.z,r:kind==='cottage'?3.6:kind==='tree'?1:kind==='portal'?2.3:kind==='garden'?2.7:1.9});
    landmarks.set(item.id,{group,halo,flame,light,beacon,item,status:'idle'});
  }
  world.landmarks.forEach(buildLandmark);
  // Permanent boundary walls prevent walking around a story-locked passage.
  const gate=new THREE.Group();gate.position.set(gateX,height(gateX,gateZ),gateZ);root.add(gate);
  box(gate,gateX+45,active?3.2:6,1.3,stoneMat,(-50-gateX-5)/2,active?1.6:3,0);box(gate,45-gateX,active?3.2:6,1.3,stoneMat,(50-gateX+5)/2,active?1.6:3,0);
  const leftGate=box(gate,5,5.8,.7,woodMat,-2.5,2.9,0),rightGate=box(gate,5,5.8,.7,woodMat,2.5,2.9,0);
  for(const x of [-5.5,5.5]){cylinder(gate,.65,.8,8,stoneMat,x,4,0);sphere(gate,.35,accentMat,x,8.3,0);}
  const bridge=[];for(let i=0;i<10;i++){const z=gateZ+4-i*.8,plank=box(root,6,.18,.6,woodMat,gateX,height(gateX,z)+.11,z);bridge.push(plank);}
  const vault=landmarks.get('vault').group,door=box(vault,5.7,5,.4,stoneMat,0,2.5,2.4);
  for(const x of [-3.2,3.2])box(vault,.6,6,.8,woodMat,x,3,2.4);box(vault,7,.6,1,stoneMat,0,6,2.4);
  const relic=mesh(vault,new THREE.IcosahedronGeometry(.65,2),accentMat,0,3,3.2);
  const relayBeam=cylinder(landmarks.get('relay').group,.12,.4,32,accentMat,0,19,0);relayBeam.visible=false;
  const orbiters=[];for(let i=0;i<8;i++){const a=i*Math.PI/4,g=landmarks.get('sanctum').group;orbiters.push(mesh(g,new THREE.IcosahedronGeometry(.5,1),stoneMat,Math.sin(a)*5,2,Math.cos(a)*5));}
  const machinery=[];for(let i=0;i<3;i++){const g=landmarks.get('workshop').group,m=mesh(g,new THREE.TorusGeometry(1,.23,12,30),woodMat,-3+i*3,3,2);for(let n=0;n<8;n++){const a=n*Math.PI/4,tooth=box(m,.4,.5,.4,stoneMat,Math.sin(a)*1.15,Math.cos(a)*1.15,0);tooth.rotation.z=-a;}machinery.push(m);}
  const rubble=[];for(let i=0;i<14;i++){const a=i*2.4,r=3.7+(i%3)*.65,p=world.landmarks.find(p=>p.id==='source'),x=p.x+Math.sin(a)*r,z=p.z+Math.cos(a)*r,m=mesh(root,new THREE.DodecahedronGeometry(.55,1),stoneMat,x,height(x,z)+.35,z);m.rotation.set(random(),random(),random());rubble.push(m);}
  const hazard=mesh(root,new THREE.RingGeometry(3.2,6.5,64),new THREE.MeshBasicMaterial({color:'#ff6b39',transparent:true,opacity:.3,side:THREE.DoubleSide}),sourcePoint.x,height(sourcePoint.x,sourcePoint.z)+.13,sourcePoint.z);hazard.rotation.x=-Math.PI/2;hazard.visible=false;
  const blossoms=new THREE.Group();root.add(blossoms);for(let i=0;i<70;i++){const a=random()*Math.PI*2,r=7+random()*33,x=Math.sin(a)*r,z=Math.cos(a)*r;if(z<gateZ+2)continue;const flower=sphere(blossoms,.18,accentMat,x,height(x,z)+.3,z);flower.scale.y=1.5;}blossoms.visible=false;
  const collectibles=new Map();for(const [id,place,flag] of [['records','archive','records_found'],['tools','workshop','tools_scavenged'],['cell','source','source_stable']]){const g=landmarks.get(place).group,pickup=new THREE.Group();pickup.position.set(-2,1.7,2.5);g.add(pickup);if(id==='records'){box(pickup,1,.12,.65,woodMat,0,0,0);box(pickup,.85,.08,.6,pathMat,0,.1,0);}else if(id==='tools'){box(pickup,.9,.5,.6,woodMat,0,0,0);const handle=mesh(pickup,new THREE.TorusGeometry(.23,.05,8,16),stoneMat,0,.4,0);}else sphere(pickup,.3,accentMat,0,0,0);collectibles.set(id,{group:pickup,flag});}
  if(active)for(const p of collectibles.values())p.group.visible=false;
  const banners=[];for(const x of [-3,3]){const g=landmarks.get('ally').group;cylinder(g,.05,.06,3.3,woodMat,x,1.65,2.5);const flag=box(g,1.1,.8,.06,leafMat,x+.5,2.6,2.5);banners.push(flag);}
  // Scene dressing follows clear routes rather than filling walkable paths.
  for(let i=0;i<world.landmarks.length;i++){const p=world.landmarks[i];for(const side of [-1,1]){const x=p.x+side*4.8,z=p.z+3.2,y=height(x,z);cylinder(root,.06,.09,2.3,woodMat,x,y+1.15,z);const lamp=sphere(root,.19,accentMat,x,y+2.4,z);const frame=mesh(root,new THREE.TorusGeometry(.28,.035,8,18),woodMat,x,y+2.4,z);}}
  const grassPoints=[];for(let i=0;i<550;i++){const x=(random()-.5)*100,z=(random()-.5)*100;if(!inPath(x,z))grassPoints.push({x,z,s:.3+random()*.5});}
  const grasses=new THREE.InstancedMesh(new THREE.ConeGeometry(.11,.8,4),leafMat,grassPoints.length);grassPoints.forEach((p,i)=>{matrix.position.set(p.x,height(p.x,p.z)+p.s*.4,p.z);matrix.scale.set(p.s,p.s,p.s);matrix.rotation.set(0,random()*6.28,.12);matrix.updateMatrix();grasses.setMatrixAt(i,matrix.matrix);});root.add(grasses);
  const sentries=[];for(let i=0;i<2;i++){const g=new THREE.Group();sphere(g,.36,accentMat,0,0,0);const ring=mesh(g,new THREE.TorusGeometry(.7,.055,10,32),stoneMat);ring.rotation.x=.6;root.add(g);sentries.push(g);}
  let campaign=null,routeOpen=false,gateAmount=0,vaultAmount=0,health=100,damageCooldown=0,stamina=100,jumpHeight=0,verticalSpeed=0,locked=false;

  function person(color){const g=new THREE.Group();g.userData.legs=[];const cloth=material(color),skin=material('#e6ba91');const coat=sphere(g,.53,cloth,0,1.05,0);coat.scale.set(1,1.3,.7);for(const x of [-.24,.24]){const leg=cylinder(g,.13,.14,.75,woodMat,x,.4,0);g.userData.legs.push(leg);sphere(g,.17,woodMat,x,.12,.12);}for(const x of [-.52,.52]){const arm=cylinder(g,.12,.14,.85,cloth,x,1.3,0);arm.rotation.z=x>0?-.15:.15;sphere(g,.13,skin,x, .83,0);}box(g,.6,.75,.25,woodMat,0,1.3,-.38);cylinder(g,.35,.4,.75,cloth,0,1.45,0);sphere(g,.32,skin,0,2.1,0);for(const x of [-.12,.12])sphere(g,.035,woodMat,x,2.15,.29);mesh(g,new THREE.SphereGeometry(.34,10,7,0,Math.PI*2,0,Math.PI*.55),woodMat,0,2.23,0);return g;}
  function actor(appearance,color){
    const description=appearance.toLowerCase(),mat=material(color),g=new THREE.Group();
    if(/robot|android|automaton/.test(description)){box(g,.9,1.2,.6,mat,0,1.1,0);box(g,1, .7,.75,stoneMat,0,2.1,0);for(const x of [-.23,.23]){sphere(g,.1,accentMat,x,2.14,.4);box(g,.22,.7,.3,woodMat,x,.25,0);}cylinder(g,.035,.035,.5,woodMat,0,2.65,0);sphere(g,.13,accentMat,0,2.95,0);return g;}
    if(/dragon/.test(description)){const body=sphere(g,.8,mat,0,.9,0);body.scale.set(.8,1.2,.75);sphere(g,.58,mat,0,2.05,.18);const nose=sphere(g,.37,mat,0,1.98,.63);nose.scale.set(1,.7,1.4);for(const x of [-.35,.35]){mesh(g,new THREE.ConeGeometry(.12,.6,5),stoneMat,x,2.67,.03);sphere(g,.075,accentMat,x*.8,2.17,.67);const wing=mesh(g,new THREE.ConeGeometry(.75,1.6,3),mat,x*2.3,1.25,-.12);wing.rotation.z=x>0?-.7:.7;}const tail=mesh(g,new THREE.ConeGeometry(.3,2.4,7),mat,0,.5,-1);tail.rotation.x=-1.05;return g;}
    if(/cat|fox|dog/.test(description)){const body=sphere(g,.63,mat,0,.8,0);body.scale.z=1.5;sphere(g,.46,mat,0,1.23,.75);for(const x of [-.3,.3]){mesh(g,new THREE.ConeGeometry(.19,.55,4),mat,x,1.75,.72);for(const z of [-.5,.5])cylinder(g,.12,.15,.65,mat,x,.35,z);}const tail=cylinder(g,.1,.15,1.3,mat,0,1.15,-1.1);tail.rotation.x=.65;return g;}
    if(/octopus/.test(description)){sphere(g,.66,mat,0,1.25,0);for(let i=0;i<8;i++){const a=i*Math.PI/4,tentacle=cylinder(g,.12,.18,1.3,mat,Math.sin(a)*.55,.45,Math.cos(a)*.55);tentacle.rotation.z=Math.sin(a)*.65;tentacle.rotation.x=Math.cos(a)*.65;}for(const x of [-.23,.23])sphere(g,.1,accentMat,x,1.35,.61);return g;}
    return person(color);
  }
  const avatar=person('#ddd4ad');avatar.userData.cameraIgnore=true;avatar.position.set(0,height(0,0),0);root.add(avatar);const staff=cylinder(avatar,.045,.045,2.5,woodMat,.6,1.3,0,6);sphere(avatar,.13,accentMat,.6,2.6,0);
  for(const personData of world.characters){const g=actor(personData.appearance,personData.color);g.userData.cameraIgnore=true;const anchor=world.landmarks.find(p=>p.id===personData.landmarkId);g.position.set(anchor.x+4.5,height(anchor.x+4.5,anchor.z)+.05,anchor.z);root.add(g);characters.set(personData.id,{group:g,target:g.position.clone()});const label=document.createElement('div');label.className='world-label npc-label';label.textContent=personData.name;host.append(label);labels.push({node:label,actor:g,offset:3.5});}

  if(active){
    const glass=new THREE.MeshStandardMaterial({color:biome==='ocean'?'#1d849a':palette.accent,transparent:true,opacity:.36,roughness:.2,metalness:.35,side:THREE.DoubleSide});materials.push(glass);
    const basin=mesh(root,new THREE.CircleGeometry(10,64),glass,sourcePoint.x,height(sourcePoint.x,sourcePoint.z)-.08,sourcePoint.z);basin.rotation.x=-Math.PI/2;
    for(let i=0;i<7;i++){const a=i*Math.PI/3.5,x=sourcePoint.x+Math.sin(a)*11,z=sourcePoint.z+Math.cos(a)*11;const rock=sphere(root,1.1,stoneMat,x,height(x,z)+.5,z);rock.scale.set(1.8,.8,1);}
    const archive=world.landmarks.find(p=>p.id==='archive');for(let i=0;i<6;i++){const x=archive.x+(i%2?7:-7),z=archive.z-5+Math.floor(i/2)*4;cylinder(root,.4,.55,3+(i%3),stoneMat,x,height(x,z)+1.5,z);colliders.push({x,z,r:.6});}box(root,13,2,.6,stoneMat,archive.x,height(archive.x,archive.z-6)+1,archive.z-6);colliders.push({x:archive.x,z:archive.z-6,w:13,d:.6});
    const camp=world.landmarks.find(p=>p.id==='ally');for(const side of [-1,1]){const g=new THREE.Group();g.position.set(camp.x+side*9,height(camp.x+side*9,camp.z),camp.z);root.add(g);const tent=mesh(g,new THREE.ConeGeometry(3,3.5,4),leafMat,0,1.75,0);tent.rotation.y=Math.PI/4;colliders.push({x:camp.x+side*9,z:camp.z,r:2.3});box(g,1.5,1.5,.1,woodMat,0,.75,2.1);}
    const shop=world.landmarks.find(p=>p.id==='workshop');for(let i=0;i<4;i++){box(root,1.4,1.2,1.4,woodMat,shop.x+7,height(shop.x+7,shop.z-5+i*2)+.6,shop.z-5+i*2);}
    for(const role of ['vault','sanctum','relay']){const p=world.landmarks.find(p=>p.id===role);for(let i=0;i<3;i++){const x=p.x-7+i*7,z=p.z-5,h=2+i%2*2;const pillar=cylinder(root,.6,.9,h,stoneMat,x,height(x,z)+h/2,z);pillar.rotation.z=(i-1)*.08;}}
    for(let i=0;i<18;i++){const a=i*Math.PI/9,x=Math.sin(a)*55,z=Math.cos(a)*55,m=sphere(root,4+random()*3,stoneMat,x,height(x,z)+2,z);m.scale.set(1,1+random()*1.7,1);}
  }

  const particlesGeo=new THREE.BufferGeometry(),particlePositions=[];for(let i=0;i<140;i++)particlePositions.push((random()-.5)*90,random()*18+1,(random()-.5)*90);particlesGeo.setAttribute('position',new THREE.Float32BufferAttribute(particlePositions,3));
  const particles=new THREE.Points(particlesGeo,new THREE.PointsMaterial({color:palette.accent,size:biome==='ocean'?.13:.07,transparent:true,opacity:.7}));root.add(particles);
  let yaw=.1,pitch=.3,distance=14,dragging=false,lastX=0,lastY=0,beat=null,disposed=false,nearbyId=null,previousTime=performance.now(),lastNotice=0,frames=0;
  const follow=new THREE.Vector3(),look=new THREE.Vector3(),projection=new THREE.Vector3();
  const saved=options.position;if(saved&&Number.isFinite(saved.x)&&Number.isFinite(saved.z)){avatar.position.x=THREE.MathUtils.clamp(saved.x,-50,50);avatar.position.z=THREE.MathUtils.clamp(saved.z,-50,50);avatar.position.y=height(avatar.position.x,avatar.position.z);if(Number.isFinite(saved.yaw))yaw=saved.yaw;}
  const canMove=(x,z)=>!(Math.abs(z-gateZ)<1.25&&(Math.abs(x-gateX)>4.4||!routeOpen))&&!colliders.some(c=>c.w?Math.abs(c.x-x)<c.w/2+.45&&Math.abs(c.z-z)<c.d/2+.45:Math.hypot(c.x-x,c.z-z)<c.r+.45)&&!(active&&missions.blocked(x,z))&&!(hazard.visible&&jumpHeight<.85&&rubble.some(r=>Math.hypot(r.position.x-x,r.position.z-z)<.8));
  const cameraRay=new THREE.Raycaster(),cameraObstacles=[];root.traverse(n=>{if(!n.isMesh||n.material?.transparent)return;for(let parent=n;parent;parent=parent.parent)if(parent.userData.cameraIgnore)return;cameraObstacles.push(n);});
  const cameraDirection=new THREE.Vector3();let cameraCollisionDistance=Infinity,lastCameraCheck=0;
  const missions=createMissionSystem({THREE,world,root,material,mesh,box,sphere,height,avatar,characters,landmarks,canMove:(x,z)=>canMove(x,z),saved:options.missions,onComplete:options.onComplete,onTask:options.onTask,onTaskProgress:options.onTaskProgress,onNotice:options.onNotice,onDamage:amount=>{health=Math.max(1,health-amount);},onTone:options.onTone});
  function jump(){if(jumpHeight<=.001&&verticalSpeed<=0){verticalSpeed=8.8;options.onJump?.();}}
  function unlock(){if(document.pointerLockElement===renderer.domElement)document.exitPointerLock();}
  async function toggleLock(){if(locked){unlock();return;}try{await renderer.domElement.requestPointerLock();}catch{options.onNotice?.('Camera lock was blocked by the browser. Click the camera button or use drag to look.');}}
  function lockChange(){locked=document.pointerLockElement===renderer.domElement;host.dataset.cameraLocked=String(locked);options.onLock?.(locked);clearKeys();}
  function mouseLook(e){if(!locked)return;yaw-=e.movementX*.003;pitch=THREE.MathUtils.clamp(pitch+e.movementY*.002,-.15,.8);}
  function move(dt){
    const forward=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0),side=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0);
    const running=keys.has('KeyR')&&stamina>2&&(forward||side);stamina=THREE.MathUtils.clamp(stamina+(running?-22:17)*dt,0,100);verticalSpeed-=24*dt;jumpHeight=Math.max(0,jumpHeight+verticalSpeed*dt);if(!jumpHeight)verticalSpeed=0;avatar.position.y=height(avatar.position.x,avatar.position.z)+jumpHeight;if(!forward&&!side){if(locked)avatar.rotation.y=yaw+Math.PI;return;}
    let dx=-Math.sin(yaw)*forward+Math.cos(yaw)*side,dz=-Math.cos(yaw)*forward-Math.sin(yaw)*side;const length=Math.hypot(dx,dz);dx/=length;dz/=length;
    const speed=running?10:6;
    const nx=THREE.MathUtils.clamp(avatar.position.x+dx*speed*dt,-50,50);if(canMove(nx,avatar.position.z))avatar.position.x=nx;
    const nz=THREE.MathUtils.clamp(avatar.position.z+dz*speed*dt,-50,50);if(canMove(avatar.position.x,nz))avatar.position.z=nz;
    avatar.position.y=height(avatar.position.x,avatar.position.z)+jumpHeight;const desired=locked?yaw+Math.PI:Math.atan2(dx,dz);const delta=THREE.MathUtils.euclideanModulo(desired-avatar.rotation.y+Math.PI,Math.PI*2)-Math.PI;avatar.rotation.y+=delta*Math.min(1,dt*12);
  }
  function applyState(state){
    campaign=state.campaign;routeOpen=campaign.flags.includes('route_open')||campaign.ending==='restore';hazard.visible=campaign.flags.includes('source_broken')&&!['restore','pact'].includes(campaign.ending);rubble.forEach(m=>m.visible=hazard.visible);for(const pickup of collectibles.values())pickup.group.visible=!active&&!campaign.flags.includes(pickup.flag);banners.forEach(b=>b.scale.x=campaign.flags.includes('ally_rescued')||campaign.flags.includes('ally_rescued_late')?1:.08);relic.visible=campaign.flags.includes('vault_open')&&!campaign.flags.includes('relic_found');relayBeam.visible=campaign.flags.includes('relay_online');blossoms.visible=['restore','pact'].includes(campaign.ending);host.dataset.routeOpen=String(routeOpen);host.dataset.ending=campaign.ending||'';host.dataset.sourceBroken=String(hazard.visible);beat=state.beat;scene.background.set(campaign.ending==='restore'?'#b5d4d9':campaign.ending==='pact'?'#171e45':palette.sky);scene.fog.color.copy(scene.background);scene.fog.density=beat.weather==='mist'?.016:beat.weather==='rain'?.018:.011;
    const nighttime=beat.timeOfDay==='night';hemi.intensity=nighttime?1.7:2.7;sun.intensity=nighttime?1.2:2.8;
    for(const item of beat.landmarkStates){const target=landmarks.get(item.landmarkId);target.status=item.status;target.flame.visible=item.status==='burning'||(target.item.kind==='campfire'&&item.status!=='dark');target.light.intensity=item.status==='dark'?0:['glowing','restored','open'].includes(item.status)?5:1.1;target.light.color.set(item.status==='burning'?'#ff974f':item.status==='locked'?'#d9787f':palette.accent);target.halo.material.color.set(item.status==='locked'?'#d9787f':palette.accent);target.halo.material.opacity=['glowing','restored','open'].includes(item.status)?.9:.3;target.group.userData.status=item.status;}
    for(const update of beat.characters){const target=characters.get(update.id),anchor=world.landmarks.find(p=>p.id===update.landmarkId);const rescued=campaign.flags.includes('ally_rescued')||campaign.flags.includes('ally_rescued_late');if(active&&update.id===world.characters[0].id&&rescued&&!campaign.ending)target.target.set(1,height(1,0),0);else target.target.set(anchor.x+4.5,height(anchor.x+4.5,anchor.z)+.05,anchor.z);}
    for(const label of labels){if(!label.item)continue;const actionable=beat.actions.some(a=>a.landmarkId===label.item.id);label.node.dataset.actionable=String(actionable);label.node.dataset.state=landmarks.get(label.item.id).status;}
    missions.setState(state);host.dataset.worldStage=String(state.sceneIndex);host.dataset.worldWeather=beat.weather;
  }
  function nearest(){let best=null,range=6.3;for(const item of world.landmarks){const d=Math.hypot(item.x-avatar.position.x,item.z-avatar.position.z);if(d<range){range=d;best=item;}}return best;}
  function resize(){const w=host.clientWidth||innerWidth,h=host.clientHeight||innerHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}
  const observer=new ResizeObserver(resize);observer.observe(host);resize();
  function clearKeys(){keys.clear();dragging=false;}
  function keydown(e){if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)||document.querySelector('dialog[open]'))return;if(['ShiftLeft','ShiftRight'].includes(e.code)){e.preventDefault();if(!e.repeat)toggleLock();return;}if(e.code==='Space'){e.preventDefault();if(!e.repeat)jump();return;}if(['KeyW','KeyA','KeyS','KeyD','KeyR','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)){keys.add(e.code);e.preventDefault();}}
  function keyup(e){keys.delete(e.code);}
  function down(e){dragging=true;lastX=e.clientX;lastY=e.clientY;renderer.domElement.setPointerCapture(e.pointerId);renderer.domElement.focus({preventScroll:true});}
  function drag(e){if(!dragging||locked)return;yaw-=(e.clientX-lastX)*.007;pitch=THREE.MathUtils.clamp(pitch+(e.clientY-lastY)*.005,-.1,.85);lastX=e.clientX;lastY=e.clientY;}
  const up=()=>{dragging=false;};
  function wheel(e){e.preventDefault();distance=THREE.MathUtils.clamp(distance+e.deltaY*.01,8,23);}
  addEventListener('keydown',keydown);addEventListener('keyup',keyup);addEventListener('blur',clearKeys);document.addEventListener('visibilitychange',clearKeys);
  document.addEventListener('pointerlockchange',lockChange);document.addEventListener('mousemove',mouseLook);renderer.domElement.addEventListener('pointerdown',down);renderer.domElement.addEventListener('pointermove',drag);renderer.domElement.addEventListener('pointerup',up);renderer.domElement.addEventListener('pointercancel',up);renderer.domElement.addEventListener('wheel',wheel,{passive:false});
  function animate(now){if(disposed)return;const paused=!!document.querySelector('dialog[open]'),dt=paused?0:Math.min((now-previousTime)/1000,.05);previousTime=now;const time=now/1000;if(!document.querySelector('dialog[open]'))move(dt);missions.tick(dt,jumpHeight);
    const cameraDistance=locked?9:distance,shoulder=locked?1.25:0;
    follow.set(avatar.position.x+Math.cos(yaw)*shoulder+Math.sin(yaw)*Math.cos(pitch)*cameraDistance,avatar.position.y+5+Math.sin(pitch)*cameraDistance,avatar.position.z-Math.sin(yaw)*shoulder+Math.cos(yaw)*Math.cos(pitch)*cameraDistance);look.set(avatar.position.x,avatar.position.y+1.5,avatar.position.z);cameraDirection.copy(follow).sub(look).normalize();if(now-lastCameraCheck>70){lastCameraCheck=now;scene.updateMatrixWorld(true);const span=follow.distanceTo(look);cameraRay.set(look,cameraDirection);cameraRay.far=span;const hit=cameraRay.intersectObjects(cameraObstacles,false).find(h=>{if(h.distance<=.7)return false;for(let n=h.object;n;n=n.parent)if(!n.visible)return false;return true;});cameraCollisionDistance=hit?Math.max(2.8,hit.distance-.6):Infinity;}const desiredDistance=follow.distanceTo(look);if(cameraCollisionDistance<desiredDistance)follow.copy(look).addScaledVector(cameraDirection,cameraCollisionDistance);camera.position.lerp(follow,1-Math.exp(-dt*(cameraCollisionDistance<desiredDistance?20:7)));camera.lookAt(look);
    if(campaign){gateAmount=THREE.MathUtils.damp(gateAmount,routeOpen?1:0,3,dt);leftGate.position.x=-2.5-gateAmount*5;rightGate.position.x=2.5+gateAmount*5;bridge.forEach((p,i)=>{p.scale.x=Math.max(.02,gateAmount);p.position.y=height(gateX,p.position.z)+.11-(1-gateAmount)*2;});vaultAmount=THREE.MathUtils.damp(vaultAmount,campaign.flags.includes('vault_open')||campaign.ending==='restore'?1:0,3,dt);door.position.y=2.5+vaultAmount*5.5;relic.rotation.y=time;relic.position.y=3+Math.sin(time*2)*.2;
      const roof=landmarks.get('workshop').group.userData.roof;if(roof)roof.rotation.z=THREE.MathUtils.damp(roof.rotation.z,campaign.flags.includes('workshop_ready')?0:.22,4,dt);
      const walking=keys.has('KeyW')||keys.has('KeyS')||keys.has('KeyA')||keys.has('KeyD');avatar.userData.legs.forEach((leg,i)=>leg.rotation.x=walking?Math.sin(time*(keys.has('KeyR')?15:10)+i*Math.PI)*.45:0);
      sentries.forEach((g,i)=>{g.visible=routeOpen&&!campaign.flags.includes('relay_online')&&!campaign.ending;g.position.set(Math.sin(time*.65+i*Math.PI)*13,height(0,-34)+.8,-34+Math.cos(time*.65+i*Math.PI)*3);g.rotation.y=time;if(!paused&&g.visible&&jumpHeight<1&&Math.hypot(g.position.x-avatar.position.x,g.position.z-avatar.position.z)<1.5&&time>damageCooldown){health=Math.max(0,health-25);damageCooldown=time+1.2;options.onNotice?.('A wandering energy surge! Jump to dodge it. Activate the relay to calm this district.');if(!health){avatar.position.set(0,height(0,0),0);health=100;}}});for(const p of collectibles.values()){p.group.rotation.y=Math.sin(time)*.12;}
      if(campaign.flags.includes('workshop_ready'))machinery.forEach((g,i)=>g.rotation.z=time*(i%2?1:-1));orbiters.forEach((m,i)=>{const active=campaign.flags.includes('sanctum_open'),a=i*Math.PI/4+(active?time*.3:0);m.position.set(Math.sin(a)*5,active?3+Math.sin(time+i)*1.2:.4,Math.cos(a)*5);});
      if(hazard.visible){hazard.material.opacity=.22+Math.sin(time*4)*.1;const d=Math.hypot(avatar.position.x-sourcePoint.x,avatar.position.z-sourcePoint.z);if(!paused&&d<6.5&&d>3&&jumpHeight<.7&&time>damageCooldown){health=Math.max(0,health-20);damageCooldown=time+1.2;options.onNotice?.('Unstable energy! Jump over debris, leave the field, or repair the source.');if(!health){avatar.position.set(0,height(0,0),0);jumpHeight=verticalSpeed=0;health=100;options.onNotice?.('The surge sent you back to the clearing. Your story progress is safe.');}}}else health=Math.min(100,health+dt*6);host.dataset.playerY=jumpHeight.toFixed(3);host.dataset.stamina=Math.round(stamina);host.dataset.health=Math.round(health);options.onVitals?.({health,stamina});}
    for(const target of landmarks.values()){target.beacon.rotation.y=time*.8;target.beacon.position.y+=(Math.sin(time*2)*.001);target.flame.scale.y=1+Math.sin(time*10)*.16;target.halo.rotation.z=time*.08;if(target.group.userData.veil)target.group.userData.veil.material.opacity=target.status==='open'?.65:.25+Math.sin(time*2)*.08;}
    for(const [id,target] of characters){if(id===world.characters[0].id&&missions.controlsCompanion())continue;target.group.position.lerp(target.target,1-Math.exp(-dt*1.6));target.group.rotation.y=Math.sin(time*.6)*.25;}
    particles.rotation.y=time*.01;if(beat?.weather==='rain'){particles.position.y=-((time*5)%18);}else particles.position.y=Math.sin(time*.4)*.3;
    const near=nearest();if((near?.id||null)!==nearbyId){nearbyId=near?.id||null;options.onNearby?.(near);}
    const width=host.clientWidth,h=host.clientHeight;for(const label of labels){const x=label.actor?.position.x??label.item.x,z=label.actor?.position.z??label.item.z,y=label.actor?.position.y??height(x,z);projection.set(x,y+label.offset,z).project(camera);const visible=projection.z<1&&Math.abs(projection.x)<1&&Math.abs(projection.y)<1;label.node.hidden=!visible;if(visible)label.node.style.transform=`translate(${(projection.x*.5+.5)*width}px,${(-projection.y*.5+.5)*h}px) translate(-50%,-50%)`;}
    if(now-lastNotice>120){lastNotice=now;options.onMove?.({x:avatar.position.x,z:avatar.position.z,yaw});host.dataset.playerX=avatar.position.x.toFixed(2);host.dataset.playerZ=avatar.position.z.toFixed(2);}
    frames++;host.dataset.renderedFrames=String(frames);renderer.render(scene,camera);
  }
  camera.position.set(0,14,18);renderer.setAnimationLoop(animate);
  return {applyState,missions:()=>missions.snapshot(),jump,toggleLock,unlock,position:()=>({x:avatar.position.x,z:avatar.position.z,yaw}),nearby:nearest,setKey:(key,pressed)=>pressed?keys.add(key):keys.delete(key),focus:()=>renderer.domElement.focus({preventScroll:true}),dispose(){disposed=true;renderer.setAnimationLoop(null);observer.disconnect();removeEventListener('keydown',keydown);removeEventListener('keyup',keyup);removeEventListener('blur',clearKeys);document.removeEventListener('visibilitychange',clearKeys);document.removeEventListener('pointerlockchange',lockChange);document.removeEventListener('mousemove',mouseLook);unlock();missions.dispose();for(const t of textures)t.dispose();const usedMaterials=new Set(materials);root.traverse(n=>{n.geometry?.dispose();if(n.material)for(const m of Array.isArray(n.material)?n.material:[n.material])usedMaterials.add(m);});for(const m of usedMaterials)m.dispose();renderer.dispose();renderer.domElement.remove();for(const label of labels)label.node.remove();}};
}
