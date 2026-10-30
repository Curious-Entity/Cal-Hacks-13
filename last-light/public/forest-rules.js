import {createVillage,createVillagers,buildingDistance,stepVillagers} from './forest-village.js';
// A local, deterministic simulation. Rendering and story text observe these rules.
export const FOREST_SAVE_KEY = 'last-light-river-embers-v1';
export const CAMP = {x:-5,z:14};
export const TENT = {x:-11,z:20,w:3.4,d:4,angle:-.4};
export function tentDistance(x,z){const dx=x-TENT.x,dz=z-TENT.z;return Math.hypot(Math.max(0,Math.abs(Math.cos(TENT.angle)*dx-Math.sin(TENT.angle)*dz)-TENT.w/2),Math.max(0,Math.abs(Math.sin(TENT.angle)*dx+Math.cos(TENT.angle)*dz)-TENT.d/2));}
export const EXIT = {x:27,z:-9};
export const SPAWN = {x:-1,z:23};
export const riverCenter = z => 11 + Math.sin(z*.048)*6;
export const riverWidth = z => 6.8 + Math.cos(z*.07)*.8;
export const inRiver = (x,z) => Math.abs(x-riverCenter(z)) < riverWidth(z)*.5;
export function terrainHeight(x,z) {
  const edge=Math.abs(x-riverCenter(z))-riverWidth(z)*.5;
  const bank=Math.max(0,Math.min(1,(edge+1.6)/4));
  return -.75 + bank*(1.05+Math.sin(x*.13)*.22+Math.sin(z*.11)*.18+Math.sin((x+z)*.07)*.15)+Math.max(0,Math.min(2.5,(edge-5)*.13));
}
export function createForest(seed=317) {
  let value=seed>>>0;
  const random=()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;};
  const trees=[{x:-9,z:7,scale:1.1,kind:0},{x:-12,z:1,scale:1.2,kind:1},{x:-5,z:0,scale:1,kind:0},{x:-17,z:6,scale:1.15,kind:0}];
  for(let attempt=0;attempt<650&&trees.length<85;attempt++){
    const x=-49+random()*49,z=-50+random()*62;
    if(createVillage().some(b=>buildingDistance(b,x,z)<2.7)||Math.hypot(x-CAMP.x,z-CAMP.z)<8 || trees.some(t=>Math.hypot(t.x-x,t.z-z)<4.9))continue;
    trees.push({x,z,scale:.78+random()*.5,kind:random()>.65?1:0});
  }
  for(const z of [-4,-20,-38])trees.push({x:riverCenter(z)-riverWidth(z)/2-1.2,z,scale:1.7,kind:1,riverside:true});
  return trees.map((t,id)=>({...t,id,status:'green',fuel:42+random()*15,heat:0,wet:0,burningFor:0,seed:random()*100}));
}
export function newForestGame(seed=317) {
  return {version:2,tent:{...TENT,status:'intact',heat:0,wet:0,fuel:28,burningFor:0},floodExtinguished:0,buildings:createVillage(),villagers:createVillagers(),villageAlarm:false,buildingIgnitions:0,dam:{treeId:null,z:0,fall:0,blocked:false,cleared:false,clearProgress:0,removed:0,upstream:0,downstream:1,blockedFor:0},seed,time:0,player:{...SPAWN,health:100,burning:false,burnTime:0,wet:0,water:0},trees:createForest(seed),campLit:true,ending:null,startedFire:false,enteredRiver:false,ignited:0,extinguished:0,events:[],seen:[],cooldown:0};
}
// Flow travels from negative Z (upstream) toward positive Z (downstream).
export function waterProfile(s,z){
  const d=s.dam;if(!d||d.treeId===null)return {level:-.32,fill:1};
  const side=z-d.z;
  if(side<-.8)return {level:-.32+d.upstream*Math.exp(side/115),fill:1};
  if(side>.8){const fill=Math.min(1,d.downstream+Math.max(0,side-2)*.002);return {level:-.32-(1-fill)*.68,fill};}
  const mix=(side+.8)/1.6;return {level:(-.32+d.upstream)*(1-mix)+(-.32-(1-d.downstream)*.68)*mix,fill:1};
}
export function waterBounds(s,z){
  const {level}=waterProfile(s,z),center=riverCenter(z);let left=center,right=center;
  if(level<=terrainHeight(center,z)+.025)return {left:center,right:center,level};
  for(const side of [-1,1]){let wet=center,dry=center+side*25;for(let i=0;i<11;i++){const mid=(wet+dry)/2;if(terrainHeight(mid,z)<level-.015)wet=mid;else dry=mid;}if(side<0)left=wet;else right=wet;}
  return {left,right,level};
}
export function waterDepth(s,x,z){const bounds=waterBounds(s,z);return x>=bounds.left&&x<=bounds.right?Math.max(0,bounds.level-terrainHeight(x,z)):0;}
export function standingHeight(s,x,z){return Math.max(terrainHeight(x,z),waterDepth(s,x,z)>.8?waterProfile(s,z).level-.8:-Infinity);}
export function isInWater(s,x,z,jump=0){return waterDepth(s,x,z)>.07&&jump<.75;}
export function damDistance(s,x,z){if(s.dam.treeId===null||s.dam.cleared)return Infinity;const t=s.trees.find(t=>t.id===s.dam.treeId);if(!t)return Infinity;return Math.hypot(x-(t.x+4.5),z-t.z);}
export function clearRiver(s,dt){
  const d=s.dam;if(s.ending||!d.blocked||damDistance(s,s.player.x,s.player.z)>6)return false;
  d.clearProgress=Math.min(4,d.clearProgress+Math.max(0,Math.min(dt,.1)));
  if(d.clearProgress>=4){d.blocked=false;d.cleared=true;event(s,'dam-cleared','The last branch gives way. Water begins moving again. The flooded banks will drain, and the dry riverbed will slowly refill.');return true;}return false;
}
export function igniteBuilding(s,b){
  if(b.status!=='intact'||b.wet>0)return false;b.status='burning';b.burningFor=0;s.startedFire=true;s.buildingIgnitions++;s.villageAlarm=true;
  event(s,'village-fire',`Flames reach ${b.name}. A shout crosses the village. The villagers turn away from their homes and run for the high ground across the river.`);return true;
}
function stepRiver(s,dt){
  const d=s.dam;
  if(d.treeId===null){const candidates=s.trees.filter(t=>t.riverside&&t.status==='burning'&&t.burningFor>=6);if(candidates.length){const t=candidates[Math.abs(s.seed)%candidates.length];d.treeId=t.id;d.z=t.z;event(s,'tree-falling','A riverside trunk cracks. Its burning crown tips toward the water. The current is about to change.');}}
  if(d.treeId===null)return;
  const t=s.trees.find(t=>t.id===d.treeId);d.fall=Math.min(1,d.fall+dt/3);t.fall=d.fall;
  if(d.fall>=1&&!d.cleared){if(!d.blocked)event(s,'river-blocked','The fallen tree wedges across the river. Downstream, the flow thins. Upstream, water starts climbing the banks. Hold F beside the trunk to clear the blockage.');d.blocked=true;t.status='charred';}
  if(d.blocked){d.blockedFor+=dt;d.upstream=Math.min(1.65,d.upstream+dt*.038);d.downstream=Math.max(0,d.downstream-dt*.037);}
  else if(d.cleared){d.upstream=Math.max(0,d.upstream-dt*.047);d.downstream=Math.min(1,d.downstream+dt*.055);d.removed=Math.min(1,d.removed+dt/3);}
  if(d.upstream>.72)event(s,'river-overflow','Water slips over the upstream bank and spreads between the trees. Higher ground is becoming an escape route.');
  if(d.downstream<.22)event(s,'river-dry','Below the fallen tree, stones and silt replace the current. This dry stretch cannot cool your clothes or refill your flask. Find water upstream.');
}
export function igniteTent(s){
  const t=s.tent;if(t.status!=='intact'||t.wet>0)return false;t.status='burning';t.burningFor=0;s.startedFire=true;
  event(s,'tent-fire','A spark takes hold in the dry canvas. The tent catches, and the quiet camp becomes another fire to put out.');return true;
}
function stepTent(s,dt){
  const t=s.tent;t.wet=Math.max(0,t.wet-dt);
  if(t.status==='burning'){t.burningFor+=dt;t.fuel=Math.max(0,t.fuel-dt);if(t.fuel<=0){t.status='ruined';event(s,'tent-lost','The canvas collapses into scorched cloth. The campsite will have to be rebuilt.');}}
  else if(t.status==='intact'&&t.wet<=0){
    if(s.player.burning&&tentDistance(s.player.x,s.player.z)<.8)igniteTent(s);
    else{let heat=0;for(const source of [...s.trees,...s.buildings]){if(source.status!=='burning'||source.burningFor<1.8)continue;const distance=tentDistance(source.x,source.z);if(distance<7)heat+=(1-distance/8)*1.4;}t.heat=Math.max(0,t.heat+dt*(heat||-.4));if(t.heat>2.2)igniteTent(s);}
  }
}
function floodTrees(s){
  if(s.dam.upstream<=0)return;
  for(const t of s.trees){
    if(t.status==='charred'||waterDepth(s,t.x,t.z)<=.03)continue;
    t.wet=Math.max(t.wet,10);t.heat=0;
    if(t.status==='burning'){t.status='green';t.burningFor=0;s.extinguished++;s.floodExtinguished++;
      event(s,'flood-doused-tree','The rising river reaches a burning trunk. The flames hiss out. Wet trees stop carrying the fire onward.');}
  }
}
function stepVillage(s,dt){
  const sources=[...s.trees.filter(t=>t.status==='burning'),...s.buildings.filter(b=>b.status==='burning'),...(s.tent.status==='burning'?[s.tent]:[])];
  for(const b of s.buildings){b.wet=Math.max(0,b.wet-dt);if(b.status==='burning'){b.burningFor+=dt;b.fuel=Math.max(0,b.fuel-dt);if(b.fuel<=0){b.status='ruined';event(s,'house-lost','A wooden roof gives way. The people can find shelter; this home will have to be rebuilt.');}}else if(b.status==='intact'&&b.wet<=0){if(s.player.burning&&buildingDistance(b,s.player.x,s.player.z)<.85)igniteBuilding(s,b);else{let heat=0;for(const source of sources){if(source===b)continue;const distance=buildingDistance(b,source.x,source.z);if(distance<7&&source.burningFor>2)heat+=(1-distance/8)*1.4;}b.heat=Math.max(0,b.heat+dt*(heat||-.4));if(b.heat>3.6)igniteBuilding(s,b);}}}
  stepVillagers(s,dt,(x,z)=>waterDepth(s,x,z));
  if(s.villageAlarm&&s.villagers.every(p=>p.status==='sheltered'))event(s,'village-safe','The last villager reaches the stone cairn. Five people turn to look back at the river and the homes they left.');
}
function event(s,id,text){if(s.seen.includes(id))return;s.seen.push(id);s.events.push({id,text,time:Math.round(s.time)});}
export function igniteTree(s,t) {
  if(t.status!=='green'||t.wet>0)return false;
  t.status='burning';t.heat=0;s.ignited++;s.startedFire=true;
  event(s,'first-tree','Your coat brushes a dry trunk. A spark climbs into the leaves. What you carry changes what you leave behind.');
  return true;
}
export function splashWater(s) {
  if(s.ending)return {ok:false,text:'This crossing has ended.'};
  const p=s.player;
  if(p.water<25)return {ok:false,text:'Wade into the river to fill your flask.'};
  const shelterDistance=b=>b===s.tent?tentDistance(p.x,p.z):buildingDistance(b,p.x,p.z);
  const homes=[...s.buildings,s.tent].filter(b=>b.status==='burning'&&shelterDistance(b)<8).sort((a,b)=>shelterDistance(a)-shelterDistance(b));
  const targets=s.trees.filter(t=>t.status==='burning'&&Math.hypot(t.x-p.x,t.z-p.z)<8).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z));
  const camp=s.campLit&&Math.hypot(p.x-CAMP.x,p.z-CAMP.z)<6;
  if(!targets.length&&!homes.length&&!camp)return {ok:false,text:'Move closer to a burning tree, tent, cottage, or the campfire. Water reaches eight paces.'};
  p.water-=25;s.cooldown=.6;
  const home=homes[0];const target=home&&(!targets[0]||shelterDistance(home)<Math.hypot(targets[0].x-p.x,targets[0].z-p.z))?home:targets[0];
  if(target){target.status=target.w?'intact':'green';target.wet=22;target.heat=0;target.burningFor=0;s.extinguished++;event(s,target===s.tent?'tent-saved':target.w?'house-saved':'first-saved',target===s.tent?'Water soaks through the canvas. The tent survives, damp and darkened.':target.w?'You soak the wooden walls. The flames go out, and the home still stands.':'Water breaks the flame apart. The tree is still alive. You can return for more.');}
  else{s.campLit=false;s.extinguished++;event(s,'camp-out','The last ember hisses out beneath the stones. The clearing no longer has a source of sparks.');}
  if(!s.campLit&&!s.trees.some(t=>t.status==='burning')&&!s.buildings.some(b=>b.status==='burning')&&s.tent.status!=='burning'&&s.startedFire)event(s,'contained','The forest falls quiet. Some marks will remain, but the fire will travel no farther.');
  return {ok:true,text:target?target===s.tent?'The tent is doused. Its wet canvas resists sparks.':target.w?'The cottage is doused. Its wet walls resist sparks for a while.':'The flames go out. This tree is wet and protected for a while.':'The campfire is out.',target:target?{x:target.x,z:target.z}:{...CAMP}};
}
export function finishCrossing(s) {
  if(s.ending)return s.ending;
  const burning=s.trees.filter(t=>t.status==='burning').length,charred=s.trees.filter(t=>t.status==='charred').length;
  s.ending=s.startedFire?(burning||charred>2||s.campLit||s.tent.status!=='intact'||s.dam.blocked||s.buildings.some(b=>b.status!=='intact')||(s.villageAlarm&&s.villagers.some(p=>p.status!=='sheltered'))?'left-behind':'restored'):'quiet';
  event(s,'crossing',s.ending==='restored'?'You turn back at the far bank. The forest is scarred, but standing. You chose to return.':s.ending==='left-behind'?'Across the river, you are safe. Behind you, the forest remembers what you did not return for.':'You leave a quiet clearing behind. Not every possible consequence needs to become a memory.');
  return s.ending;
}
export function stepForest(s,dt,position={x:s.player.x,z:s.player.z},height=0) {
  if(s.ending)return;
  // Bounded substeps keep contact, health and spread independent of frame rate.
  let remaining=Math.max(0,Math.min(Number.isFinite(dt)?dt:0,.25));
  while(remaining>0){const d=Math.min(.025,remaining);remaining-=d;step(s,d,position,height);if(s.ending)break;}
}
function step(s,dt,position,height){
  s.time+=dt;s.cooldown=Math.max(0,s.cooldown-dt);const p=s.player;p.x=position.x;p.z=position.z;
  stepRiver(s,dt);
  floodTrees(s);
  const river=isInWater(s,p.x,p.z,height);
  p.wet=Math.max(0,p.wet-dt);
  if(river){
    if(p.burning)event(s,'river-rescue','Cold water takes the fire from your coat. You can breathe again. Beyond the water’s reach, embers can still travel.');
    p.burning=false;p.burnTime=0;p.wet=10;p.water=Math.min(100,p.water+dt*100);p.health=Math.min(100,p.health+dt*5);
    if(!s.enteredRiver){s.enteredRiver=true;event(s,'river','The river is shallow here. Your flask fills in the current; wet clothes will resist a spark for a little while.');}
  }
  const fireContact=s.campLit&&Math.hypot(p.x-CAMP.x,p.z-CAMP.z)<1.3&&height<1.1;
  const tentContact=s.tent.status==='burning'&&tentDistance(p.x,p.z)<1.1&&height<2;
  const houseContact=s.buildings.some(b=>b.status==='burning'&&buildingDistance(b,p.x,p.z)<1.1);
  const treeContact=s.trees.some(t=>t.status==='burning'&&Math.hypot(t.x-p.x,t.z-p.z)<1.65&&height<2);
  if(!river&&p.wet<=0&&(fireContact||treeContact||houseContact||tentContact)&&!p.burning){p.burning=true;p.burnTime=0;event(s,'on-fire','A spark catches your sleeve. The river is close. Move—before the warmth becomes everything.');}
  if(p.burning){p.burnTime+=dt;p.health=Math.max(0,p.health-dt*(p.burnTime>1?10:2));if(p.health<=0){p.burning=false;s.ending='lost';event(s,'lost','You did not reach the river. The clearing grows still, and your crossing remains unfinished.');return;}}
  const sources=[...s.trees.filter(t=>t.status==='burning'),...s.buildings.filter(b=>b.status==='burning'),...(s.tent.status==='burning'?[s.tent]:[])];
  for(const t of s.trees){
    t.wet=Math.max(0,t.wet-dt);
    if(t.status==='burning'){
      t.burningFor+=dt;t.fuel=Math.max(0,t.fuel-dt);
      if(t.fuel<=0){t.status='charred';event(s,'first-charred','A crown of leaves collapses into ash. Putting out a fire and bringing something back are different things.');}
    }else if(t.status==='green'&&t.wet<=0){
      if(p.burning&&Math.hypot(t.x-p.x,t.z-p.z)<1.7&&height<2)igniteTree(s,t);
      else{
        let heat=0;
        for(const source of sources){const dist=Math.hypot(t.x-source.x,t.z-source.z);if(dist<7.4&&source.burningFor>1.8)heat+=(1-dist/9.5)*(t.z<source.z?2.2:1.4);}
        t.heat=Math.max(0,t.heat+dt*(heat>0?heat:-.5));
        if(t.heat>2.4+(t.seed%1))igniteTree(s,t);
      }
    }
  }
  stepTent(s,dt);
  stepVillage(s,dt);
  if(s.ignited>=3)event(s,'spread','The wind carries embers from crown to crown. The wildfire no longer needs you to move.');
}
export function forestBeat(s){
  if(s.player.burning)return {chapter:'02 · WHAT YOU CARRY',title:'Get to the river.',objective:'Your clothes are burning. Find the blue river on the map and wade into the water.',mood:'danger'};
  if(s.buildings.some(b=>b.status==='burning'))return {chapter:'04 · A VILLAGE IN FLAMES',title:'The village is fleeing.',objective:'People are heading for high ground. Douse burning wooden walls with E. A blocked or flooded river can change their route.',mood:'fire'};
  if(s.dam.blocked)return {chapter:'05 · WHEN THE RIVER STOPS',title:s.dam.upstream>.72?'The banks cannot hold it.':'One fallen tree. Two different rivers.',objective:'Downstream is drying; upstream is rising. Hold F near the fallen trunk to clear it. Find flowing water before your flask runs dry.',mood:'river'};
  if(s.tent.status==='burning')return {chapter:'03 · THE CANVAS CATCHES',title:'The camp is burning.',objective:'Refill your flask in the river and press E near the tent to douse the canvas before it burns away.',mood:'fire'};
  const active=s.trees.filter(t=>t.status==='burning').length;
  if(active)return {chapter:'03 · WHAT YOU LEAVE',title:'The forest is answering.',objective:'Refill your flask in the river. Move near a burning tree and press E to douse it—or cross to the stone cairn and leave.',mood:'fire'};
  if(s.startedFire)return {chapter:'04 · THE OTHER BANK',title:'There is still something to save.',objective:s.campLit?'Douse the campfire to prevent another spark, then cross to the stone cairn.':'The flames are out. Cross the river and find the stone cairn to finish your story.',mood:'calm'};
  if(s.enteredRiver)return {chapter:'02 · THE RIVER REMEMBERS',title:'A little water. A little choice.',objective:'Your flask is full. You can douse the campfire with E, explore the forest, or cross to the stone cairn.',mood:'calm'};
  return {chapter:'01 · AN UNATTENDED FLAME',title:'Everything starts with a spark.',objective:'Explore the campfire, forest and river. Fire catches on contact; the river extinguishes it. A wooden village waits beyond the trees. A stone cairn marks high ground across the river.',mood:'calm'};
}
export function endingCopy(s){const charred=s.trees.filter(t=>t.status==='charred').length;return {title:s.ending==='lost'?'An unfinished crossing.':s.ending==='restored'?'What you chose to save.':s.ending==='left-behind'?'The safety of the other bank.':'A quiet crossing.',text:s.events.at(-1)?.text||'',detail:`${s.ignited} trees caught fire · ${s.extinguished} fires doused · ${charred} trees lost${s.tent.status==='ruined'?' · tent lost':''} · ${s.buildings.filter(b=>b.status==='ruined').length} homes lost · ${s.villageAlarm?s.villagers.filter(p=>p.status==='sheltered').length+'/5 villagers sheltered':'5 villagers safe at home'}${s.dam.blocked?' · river blocked':''}`};}

export function restoreForestGame(raw){
  if(typeof raw!=='string'||raw.length>1000000)throw Error('Invalid crossing');
  const saved=JSON.parse(raw),finite=Number.isFinite;
  if(![1,2].includes(saved?.version)||!finite(saved.seed)||!finite(saved.time)||!Array.isArray(saved.trees)||saved.trees.length>150||!Array.isArray(saved.events)||!Array.isArray(saved.seen)||!saved.player||!['quiet','restored','left-behind','lost',null].includes(saved.ending))throw Error('Unsupported crossing');
  if(!['x','z','health','water','wet','burnTime'].every(k=>finite(saved.player[k]))||!saved.trees.every(t=>['green','burning','charred'].includes(t.status)&&['id','x','z','scale','seed','fuel','wet','heat','burningFor'].every(k=>finite(t[k]))))throw Error('Damaged crossing');
  const result={...newForestGame(saved.seed),...saved,version:2};
  if(saved.version===1){
    result.buildings=createVillage();result.villagers=createVillagers();result.villageAlarm=false;result.buildingIgnitions=0;result.dam=newForestGame(saved.seed).dam;
    result.trees=saved.trees.filter(t=>!result.buildings.some(b=>buildingDistance(b,t.x,t.z)<2.7));
    let next=Math.max(...saved.trees.map(t=>t.id))+1;
    result.trees.push(...createForest(saved.seed).filter(t=>t.riverside).map(t=>({...t,id:next++})));
  }
  if(!result.tent||!['intact','burning','ruined'].includes(result.tent.status)||!['fuel','heat','wet','burningFor'].every(k=>finite(result.tent[k])))throw Error('Damaged campsite');
  if(!Array.isArray(result.buildings)||result.buildings.length!==3||!result.buildings.every(b=>['intact','burning','ruined'].includes(b.status)&&['x','z','w','d','fuel','heat','wet','burningFor'].every(k=>finite(b[k])))||!Array.isArray(result.villagers)||result.villagers.length!==5||!result.villagers.every(p=>['idle','fleeing','stranded','sheltered'].includes(p.status)&&finite(p.x)&&finite(p.z)&&Array.isArray(p.path))||!result.dam||!['fall','z','upstream','downstream','clearProgress','removed','blockedFor'].every(k=>finite(result.dam[k]))||(result.dam.treeId!==null&&!result.trees.some(t=>t.id===result.dam.treeId)))throw Error('Damaged village');
  return result;
}
