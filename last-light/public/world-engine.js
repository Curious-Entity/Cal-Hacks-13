// Procedural scenery, WASD movement and follow camera adapted from the team's
// make-x20/fantasy-roam demo. Model output supplies data, never executable code.
import * as THREE from './vendor/three.module.min.js';

export function createWorldRenderer(host,world,options={}) {
  const palette=world.palette,biome=world.biome;
  let seed=[...(options.id||world.title)].reduce((n,c)=>(Math.imul(n,31)+c.charCodeAt(0))>>>0,2031);
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const scene=new THREE.Scene();scene.background=new THREE.Color(palette.sky);scene.fog=new THREE.FogExp2(palette.sky,.012);
  const camera=new THREE.PerspectiveCamera(54,1,.1,260);
  const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<700?1.4:1.8));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label','Explorable 3D world. WASD or arrow keys to move; drag to look.');host.append(renderer.domElement);
  const root=new THREE.Group();scene.add(root);const colliders=[],landmarks=new Map(),characters=new Map(),keys=new Set(),labels=[];
  const materials=[];const material=(color,glow=false)=>{const m=new THREE.MeshStandardMaterial({color,roughness:.88,flatShading:true,...(glow?{emissive:color,emissiveIntensity:.5}:{})});materials.push(m);return m;};
  const groundMat=material(palette.ground),leafMat=material(palette.foliage),stoneMat=material(palette.structure),accentMat=material(palette.accent,true),woodMat=material('#604b42');
  const height=(x,z)=>['space','city','interior'].includes(biome)?0:Math.sin(x*.09)*.55+Math.cos(z*.075)*.45+Math.sin((x+z)*.055)*.35;
  function mesh(parent,geometry,mat,x=0,y=0,z=0){const m=new THREE.Mesh(geometry,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  const box=(g,w,h,d,mat,x,y,z)=>mesh(g,new THREE.BoxGeometry(w,h,d),mat,x,y,z);
  const cylinder=(g,a,b,h,mat,x,y,z,sides=10)=>mesh(g,new THREE.CylinderGeometry(a,b,h,sides),mat,x,y,z);
  const sphere=(g,r,mat,x,y,z)=>mesh(g,new THREE.SphereGeometry(r,12,9),mat,x,y,z);
  function tree(g,s=1){cylinder(g,.23*s,.38*s,3.7*s,woodMat,0,1.85*s,0);mesh(g,new THREE.ConeGeometry(2.15*s,4.8*s,8),leafMat,0,4.6*s,0);mesh(g,new THREE.ConeGeometry(1.6*s,3.6*s,8),leafMat,0,6.3*s,0);}
  const groundGeo=new THREE.PlaneGeometry(110,110,44,44);groundGeo.rotateX(-Math.PI/2);const pos=groundGeo.attributes.position;for(let i=0;i<pos.count;i++)pos.setY(i,height(pos.getX(i),pos.getZ(i)));groundGeo.computeVertexNormals();mesh(root,groundGeo,groundMat);
  const hemi=new THREE.HemisphereLight('#d2e9ff',palette.ground,2.4);scene.add(hemi);
  const sun=new THREE.DirectionalLight('#fff1d7',2.6);sun.position.set(-25,40,20);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-45,right:45,top:45,bottom:-45,far:110});scene.add(sun);
  const skyOrb=sphere(root,biome==='space'?9:3.3,new THREE.MeshBasicMaterial({color:palette.accent}),-42,36,-62);
  if(biome==='space'){const ring=mesh(root,new THREE.TorusGeometry(14,.65,8,50),stoneMat,-42,36,-62);ring.rotation.x=1.05;}
  // A legible central hub and four unobstructed routes.
  const pathMat=material(new THREE.Color(palette.accent).lerp(new THREE.Color(palette.ground),.72));
  pathMat.side=THREE.DoubleSide;
  const hubGeo=new THREE.CircleGeometry(5.5,32);hubGeo.rotateX(-Math.PI/2);const hubPositions=hubGeo.attributes.position;for(let i=0;i<hubPositions.count;i++)hubPositions.setY(i,height(hubPositions.getX(i),hubPositions.getZ(i))+.07);hubGeo.computeVertexNormals();const hub=mesh(root,hubGeo,pathMat);hub.castShadow=false;
  for(const item of world.landmarks){const distance=Math.hypot(item.x,item.z),vertices=[],indices=[],px=item.z/distance*1.1,pz=-item.x/distance*1.1;
    for(let i=0;i<=24;i++){const x=item.x*i/24,z=item.z*i/24;for(const side of [-1,1]){const vx=x+px*side,vz=z+pz*side;vertices.push(vx,height(vx,vz)+.07,vz);}if(i<24){const n=i*2;indices.push(n,n+2,n+1,n+1,n+2,n+3);}}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();const path=mesh(root,geometry,pathMat);path.castShadow=false;
  }
  const inPath=(x,z)=>Math.hypot(x,z)<7||Math.abs(Math.abs(x)-Math.abs(z))<3.5||world.landmarks.some(p=>Math.hypot(p.x-x,p.z-z)<7);
  // Shared instance buffers keep repeated scenery inexpensive.
  const decor=[];for(let i=0;i<90;i++){const x=(random()-.5)*92,z=(random()-.5)*92;if(!inPath(x,z))decor.push({x,z,s:.7+random()*.7,h:2+random()*7});}
  const matrix=new THREE.Object3D();
  function instances(geo,mat,transform){const batch=new THREE.InstancedMesh(geo,mat,decor.length);decor.forEach((p,i)=>{matrix.position.set(p.x,height(p.x,p.z),p.z);matrix.rotation.set(0,0,0);matrix.scale.set(1,1,1);transform(matrix,p);matrix.updateMatrix();batch.setMatrixAt(i,matrix.matrix);});batch.castShadow=true;batch.receiveShadow=true;root.add(batch);}
  if(['forest','mountain'].includes(biome)){
    instances(new THREE.CylinderGeometry(.18,.3,3.2,6),woodMat,(m,p)=>{m.position.y+=1.6*p.s;m.scale.setScalar(p.s);});
    instances(new THREE.ConeGeometry(1.7,5.2,7),leafMat,(m,p)=>{m.position.y+=4.2*p.s;m.scale.setScalar(p.s);});
    decor.forEach(p=>colliders.push({x:p.x,z:p.z,r:.65}));
  }else if(biome==='city'){
    instances(new THREE.BoxGeometry(3,1,3),stoneMat,(m,p)=>{m.position.y+=p.h/2;m.scale.y=p.h;});
    instances(new THREE.BoxGeometry(2.3,.2,.05),accentMat,(m,p)=>{m.position.y+=p.h*.65;m.position.z+=1.53;});
    decor.forEach(p=>colliders.push({x:p.x,z:p.z,r:2.1}));
  }else if(biome==='ocean'){
    instances(new THREE.ConeGeometry(1,4,5),leafMat,(m,p)=>{m.position.y+=1.5*p.s;m.scale.set(p.s*.7,p.s,p.s*.7);m.rotation.z=.25;});
    instances(new THREE.OctahedronGeometry(1,0),accentMat,(m,p)=>{m.position.y+=.5;m.scale.set(p.s,.6*p.s,p.s);});
  }else{
    instances(new THREE.DodecahedronGeometry(1,0),stoneMat,(m,p)=>{m.position.y+=.4*p.s;m.scale.set(p.s,p.s*.7,p.s);});
  }
  if(biome==='mountain'||biome==='desert')for(let i=0;i<12;i++){const a=i*Math.PI/6,s=5+random()*7;mesh(root,new THREE.ConeGeometry(s,s*1.7,biome==='desert'?4:7),stoneMat,Math.sin(a)*57,s*.6,Math.cos(a)*57);}
  if(biome==='interior'){
    box(root,82,7,1.2,stoneMat,0,3.5,-41);box(root,1.2,7,82,stoneMat,-41,3.5,0);box(root,1.2,7,82,stoneMat,41,3.5,0);
    for(let x=-30;x<=30;x+=10){box(root,3,.2,.2,accentMat,x,4,-40.3);box(root,1,9,1,stoneMat,x,4.5,-39);}
  }
  // Every supported landmark is made from simple, reusable meshes.
  function buildLandmark(item,index){
    const group=new THREE.Group();group.position.set(item.x,height(item.x,item.z),item.z);root.add(group);
    const pedestal=mesh(group,new THREE.CylinderGeometry(3.8,4,.15,28),pathMat,0,.02,0);
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
      box(group,5.4,4.2,4.5,stoneMat,0,2.1,0);const roof=mesh(group,new THREE.ConeGeometry(4.4,2.6,4),woodMat,0,5.3,0);roof.rotation.y=Math.PI/4;
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
  function person(color){const g=new THREE.Group(),cloth=material(color),skin=material('#e6ba91');mesh(g,new THREE.ConeGeometry(.53,1.5,9),cloth,0,.9,0);cylinder(g,.35,.4,.75,cloth,0,1.45,0);sphere(g,.32,skin,0,2.1,0);mesh(g,new THREE.SphereGeometry(.34,10,7,0,Math.PI*2,0,Math.PI*.55),woodMat,0,2.23,0);return g;}
  function actor(appearance,color){
    const description=appearance.toLowerCase(),mat=material(color),g=new THREE.Group();
    if(/robot|android|automaton/.test(description)){box(g,.9,1.2,.6,mat,0,1.1,0);box(g,1, .7,.75,stoneMat,0,2.1,0);for(const x of [-.23,.23]){sphere(g,.1,accentMat,x,2.14,.4);box(g,.22,.7,.3,woodMat,x,.25,0);}cylinder(g,.035,.035,.5,woodMat,0,2.65,0);sphere(g,.13,accentMat,0,2.95,0);return g;}
    if(/dragon/.test(description)){const body=sphere(g,.8,mat,0,.9,0);body.scale.set(.8,1.2,.75);sphere(g,.58,mat,0,2.05,.18);const nose=sphere(g,.37,mat,0,1.98,.63);nose.scale.set(1,.7,1.4);for(const x of [-.35,.35]){mesh(g,new THREE.ConeGeometry(.12,.6,5),stoneMat,x,2.67,.03);sphere(g,.075,accentMat,x*.8,2.17,.67);const wing=mesh(g,new THREE.ConeGeometry(.75,1.6,3),mat,x*2.3,1.25,-.12);wing.rotation.z=x>0?-.7:.7;}const tail=mesh(g,new THREE.ConeGeometry(.3,2.4,7),mat,0,.5,-1);tail.rotation.x=-1.05;return g;}
    if(/cat|fox|dog/.test(description)){const body=sphere(g,.63,mat,0,.8,0);body.scale.z=1.5;sphere(g,.46,mat,0,1.23,.75);for(const x of [-.3,.3]){mesh(g,new THREE.ConeGeometry(.19,.55,4),mat,x,1.75,.72);for(const z of [-.5,.5])cylinder(g,.12,.15,.65,mat,x,.35,z);}const tail=cylinder(g,.1,.15,1.3,mat,0,1.15,-1.1);tail.rotation.x=.65;return g;}
    if(/octopus/.test(description)){sphere(g,.66,mat,0,1.25,0);for(let i=0;i<8;i++){const a=i*Math.PI/4,tentacle=cylinder(g,.12,.18,1.3,mat,Math.sin(a)*.55,.45,Math.cos(a)*.55);tentacle.rotation.z=Math.sin(a)*.65;tentacle.rotation.x=Math.cos(a)*.65;}for(const x of [-.23,.23])sphere(g,.1,accentMat,x,1.35,.61);return g;}
    return person(color);
  }
  const avatar=person('#ddd4ad');avatar.position.set(0,height(0,0),0);root.add(avatar);const staff=cylinder(avatar,.045,.045,2.5,woodMat,.6,1.3,0,6);sphere(avatar,.13,accentMat,.6,2.6,0);
  for(const personData of world.characters){const g=actor(personData.appearance,personData.color);const anchor=world.landmarks.find(p=>p.id===personData.landmarkId);g.position.set(anchor.x+4.5,height(anchor.x+4.5,anchor.z)+.05,anchor.z);root.add(g);characters.set(personData.id,{group:g,target:g.position.clone()});const label=document.createElement('div');label.className='world-label npc-label';label.textContent=personData.name;host.append(label);labels.push({node:label,actor:g,offset:3.5});}
  const particlesGeo=new THREE.BufferGeometry(),particlePositions=[];for(let i=0;i<140;i++)particlePositions.push((random()-.5)*90,random()*18+1,(random()-.5)*90);particlesGeo.setAttribute('position',new THREE.Float32BufferAttribute(particlePositions,3));
  const particles=new THREE.Points(particlesGeo,new THREE.PointsMaterial({color:palette.accent,size:biome==='ocean'?.13:.07,transparent:true,opacity:.7}));root.add(particles);
  let yaw=.1,pitch=.3,distance=14,dragging=false,lastX=0,lastY=0,beat=null,disposed=false,nearbyId=null,previousTime=performance.now(),lastNotice=0,frames=0;
  const follow=new THREE.Vector3(),look=new THREE.Vector3(),projection=new THREE.Vector3();
  const saved=options.position;if(saved&&Number.isFinite(saved.x)&&Number.isFinite(saved.z)){avatar.position.x=THREE.MathUtils.clamp(saved.x,-37,37);avatar.position.z=THREE.MathUtils.clamp(saved.z,-37,37);avatar.position.y=height(avatar.position.x,avatar.position.z);if(Number.isFinite(saved.yaw))yaw=saved.yaw;}
  const canMove=(x,z)=>!colliders.some(c=>Math.hypot(c.x-x,c.z-z)<c.r+.45);
  function move(dt){
    const forward=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0),side=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0);
    if(!forward&&!side)return;
    let dx=-Math.sin(yaw)*forward+Math.cos(yaw)*side,dz=-Math.cos(yaw)*forward-Math.sin(yaw)*side;const length=Math.hypot(dx,dz);dx/=length;dz/=length;
    const speed=keys.has('ShiftLeft')||keys.has('ShiftRight')?10:6;
    const nx=THREE.MathUtils.clamp(avatar.position.x+dx*speed*dt,-37,37);if(canMove(nx,avatar.position.z))avatar.position.x=nx;
    const nz=THREE.MathUtils.clamp(avatar.position.z+dz*speed*dt,-37,37);if(canMove(avatar.position.x,nz))avatar.position.z=nz;
    avatar.position.y=height(avatar.position.x,avatar.position.z);const desired=Math.atan2(dx,dz);const delta=THREE.MathUtils.euclideanModulo(desired-avatar.rotation.y+Math.PI,Math.PI*2)-Math.PI;avatar.rotation.y+=delta*Math.min(1,dt*12);
  }
  function applyState(state){
    beat=state.beat;scene.fog.density=beat.weather==='mist'?.023:beat.weather==='rain'?.018:.011;
    const nighttime=beat.timeOfDay==='night';hemi.intensity=nighttime?1.7:2.7;sun.intensity=nighttime?1.2:2.8;
    for(const item of beat.landmarkStates){const target=landmarks.get(item.landmarkId);target.status=item.status;target.flame.visible=item.status==='burning'||(target.item.kind==='campfire'&&item.status!=='dark');target.light.intensity=item.status==='dark'?0:['glowing','restored','open'].includes(item.status)?5:1.1;target.light.color.set(item.status==='burning'?'#ff974f':item.status==='locked'?'#d9787f':palette.accent);target.halo.material.color.set(item.status==='locked'?'#d9787f':palette.accent);target.halo.material.opacity=['glowing','restored','open'].includes(item.status)?.9:.3;target.group.userData.status=item.status;}
    for(const update of beat.characters){const target=characters.get(update.id),anchor=world.landmarks.find(p=>p.id===update.landmarkId);target.target.set(anchor.x+4.5,height(anchor.x+4.5,anchor.z)+.05,anchor.z);}
    for(const label of labels){if(!label.item)continue;const actionable=beat.actions.some(a=>a.landmarkId===label.item.id);label.node.dataset.actionable=String(actionable);label.node.dataset.state=landmarks.get(label.item.id).status;}
    host.dataset.worldStage=String(state.sceneIndex);host.dataset.worldWeather=beat.weather;
  }
  function nearest(){let best=null,range=6.3;for(const item of world.landmarks){const d=Math.hypot(item.x-avatar.position.x,item.z-avatar.position.z);if(d<range){range=d;best=item;}}return best;}
  function resize(){const w=host.clientWidth||innerWidth,h=host.clientHeight||innerHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}
  const observer=new ResizeObserver(resize);observer.observe(host);resize();
  function clearKeys(){keys.clear();dragging=false;}
  function keydown(e){if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)||document.querySelector('dialog[open]'))return;if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight'].includes(e.code)){keys.add(e.code);e.preventDefault();}}
  function keyup(e){keys.delete(e.code);}
  function down(e){dragging=true;lastX=e.clientX;lastY=e.clientY;renderer.domElement.setPointerCapture(e.pointerId);renderer.domElement.focus({preventScroll:true});}
  function drag(e){if(!dragging)return;yaw-=(e.clientX-lastX)*.007;pitch=THREE.MathUtils.clamp(pitch+(e.clientY-lastY)*.005,-.1,.85);lastX=e.clientX;lastY=e.clientY;}
  const up=()=>{dragging=false;};
  function wheel(e){e.preventDefault();distance=THREE.MathUtils.clamp(distance+e.deltaY*.01,8,23);}
  addEventListener('keydown',keydown);addEventListener('keyup',keyup);addEventListener('blur',clearKeys);document.addEventListener('visibilitychange',clearKeys);
  renderer.domElement.addEventListener('pointerdown',down);renderer.domElement.addEventListener('pointermove',drag);renderer.domElement.addEventListener('pointerup',up);renderer.domElement.addEventListener('pointercancel',up);renderer.domElement.addEventListener('wheel',wheel,{passive:false});
  function animate(now){if(disposed)return;const dt=Math.min((now-previousTime)/1000,.05);previousTime=now;const time=now/1000;if(!document.querySelector('dialog[open]'))move(dt);
    follow.set(avatar.position.x+Math.sin(yaw)*Math.cos(pitch)*distance,avatar.position.y+5+Math.sin(pitch)*distance,avatar.position.z+Math.cos(yaw)*Math.cos(pitch)*distance);camera.position.lerp(follow,1-Math.exp(-dt*7));look.set(avatar.position.x,avatar.position.y+1.5,avatar.position.z);camera.lookAt(look);
    for(const target of landmarks.values()){target.beacon.rotation.y=time*.8;target.beacon.position.y+=(Math.sin(time*2)*.001);target.flame.scale.y=1+Math.sin(time*10)*.16;target.halo.rotation.z=time*.08;if(target.group.userData.veil)target.group.userData.veil.material.opacity=target.status==='open'?.65:.25+Math.sin(time*2)*.08;}
    for(const target of characters.values())target.group.position.lerp(target.target,1-Math.exp(-dt*1.6));
    particles.rotation.y=time*.01;if(beat?.weather==='rain'){particles.position.y=-((time*5)%18);}else particles.position.y=Math.sin(time*.4)*.3;
    const near=nearest();if((near?.id||null)!==nearbyId){nearbyId=near?.id||null;options.onNearby?.(near);}
    const width=host.clientWidth,h=host.clientHeight;for(const label of labels){const x=label.actor?.position.x??label.item.x,z=label.actor?.position.z??label.item.z,y=label.actor?.position.y??height(x,z);projection.set(x,y+label.offset,z).project(camera);const visible=projection.z<1&&Math.abs(projection.x)<1&&Math.abs(projection.y)<1;label.node.hidden=!visible;if(visible)label.node.style.transform=`translate(${(projection.x*.5+.5)*width}px,${(-projection.y*.5+.5)*h}px) translate(-50%,-50%)`;}
    if(now-lastNotice>120){lastNotice=now;options.onMove?.({x:avatar.position.x,z:avatar.position.z,yaw});host.dataset.playerX=avatar.position.x.toFixed(2);host.dataset.playerZ=avatar.position.z.toFixed(2);}
    frames++;host.dataset.renderedFrames=String(frames);renderer.render(scene,camera);
  }
  camera.position.set(0,14,18);renderer.setAnimationLoop(animate);
  return {applyState,position:()=>({x:avatar.position.x,z:avatar.position.z,yaw}),nearby:nearest,setKey:(key,pressed)=>pressed?keys.add(key):keys.delete(key),focus:()=>renderer.domElement.focus({preventScroll:true}),dispose(){disposed=true;renderer.setAnimationLoop(null);observer.disconnect();removeEventListener('keydown',keydown);removeEventListener('keyup',keyup);removeEventListener('blur',clearKeys);document.removeEventListener('visibilitychange',clearKeys);root.traverse(n=>{n.geometry?.dispose();});for(const m of materials)m.dispose();renderer.dispose();renderer.domElement.remove();for(const label of labels)label.node.remove();}};
}
