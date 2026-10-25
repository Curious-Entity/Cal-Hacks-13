// A local, deterministic simulation. Rendering and story text observe these rules.
export const FOREST_SAVE_KEY = 'last-light-river-embers-v1';
export const CAMP = {x:-5,z:14};
export const EXIT = {x:27,z:-9};
export const SPAWN = {x:-1,z:23};
export const riverCenter = z => 11 + Math.sin(z*.048)*6;
export const riverWidth = z => 6.8 + Math.cos(z*.07)*.8;
export const inRiver = (x,z) => Math.abs(x-riverCenter(z)) < riverWidth(z)*.5;
export function terrainHeight(x,z) {
  const edge=Math.abs(x-riverCenter(z))-riverWidth(z)*.5;
  const bank=Math.max(0,Math.min(1,(edge+1.6)/4));
  return -.75 + bank*(1.05+Math.sin(x*.13)*.22+Math.sin(z*.11)*.18+Math.sin((x+z)*.07)*.15);
}
export function createForest(seed=317) {
  let value=seed>>>0;
  const random=()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;};
  const trees=[{x:-9,z:7,scale:1.1,kind:0},{x:-12,z:1,scale:1.2,kind:1},{x:-5,z:0,scale:1,kind:0},{x:-17,z:6,scale:1.15,kind:0}];
  for(let attempt=0;attempt<650&&trees.length<85;attempt++){
    const x=-49+random()*49,z=-50+random()*62;
    if(Math.hypot(x-CAMP.x,z-CAMP.z)<8 || trees.some(t=>Math.hypot(t.x-x,t.z-z)<4.9))continue;
    trees.push({x,z,scale:.78+random()*.5,kind:random()>.65?1:0});
  }
  return trees.map((t,id)=>({...t,id,status:'green',fuel:42+random()*15,heat:0,wet:0,burningFor:0,seed:random()*100}));
}
export function newForestGame(seed=317) {
  return {version:1,seed,time:0,player:{...SPAWN,health:100,burning:false,burnTime:0,wet:0,water:0},trees:createForest(seed),campLit:true,ending:null,startedFire:false,enteredRiver:false,ignited:0,extinguished:0,events:[],seen:[],cooldown:0};
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
  const targets=s.trees.filter(t=>t.status==='burning'&&Math.hypot(t.x-p.x,t.z-p.z)<8).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z));
  const camp=s.campLit&&Math.hypot(p.x-CAMP.x,p.z-CAMP.z)<6;
  if(!targets.length&&!camp)return {ok:false,text:'Move closer to a burning tree or the campfire. Water reaches eight paces.'};
  p.water-=25;s.cooldown=.6;
  const target=targets[0];
  if(target){target.status='green';target.wet=22;target.heat=0;target.burningFor=0;s.extinguished++;event(s,'first-saved','Water breaks the flame apart. The tree is still alive. You can return for more.');}
  else{s.campLit=false;s.extinguished++;event(s,'camp-out','The last ember hisses out beneath the stones. The clearing no longer has a source of sparks.');}
  if(!s.campLit&&!s.trees.some(t=>t.status==='burning')&&s.startedFire)event(s,'contained','The forest falls quiet. Some marks will remain, but the fire will travel no farther.');
  return {ok:true,text:target?'The flames go out. This tree is wet and protected for a while.':'The campfire is out.',target:target?{x:target.x,z:target.z}:{...CAMP}};
}
export function finishCrossing(s) {
  if(s.ending)return s.ending;
  const burning=s.trees.filter(t=>t.status==='burning').length,charred=s.trees.filter(t=>t.status==='charred').length;
  s.ending=s.startedFire?(burning||charred>2||s.campLit?'left-behind':'restored'):'quiet';
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
  const river=inRiver(p.x,p.z)&&height<.75;
  p.wet=Math.max(0,p.wet-dt);
  if(river){
    if(p.burning)event(s,'river-rescue','Cold water takes the fire from your coat. You can breathe again. The river cannot undo what is burning on the other bank.');
    p.burning=false;p.burnTime=0;p.wet=10;p.water=Math.min(100,p.water+dt*100);p.health=Math.min(100,p.health+dt*5);
    if(!s.enteredRiver){s.enteredRiver=true;event(s,'river','The river is shallow here. Your flask fills in the current; wet clothes will resist a spark for a little while.');}
  }
  const fireContact=s.campLit&&Math.hypot(p.x-CAMP.x,p.z-CAMP.z)<1.3&&height<1.1;
  const treeContact=s.trees.some(t=>t.status==='burning'&&Math.hypot(t.x-p.x,t.z-p.z)<1.65&&height<2);
  if(!river&&p.wet<=0&&(fireContact||treeContact)&&!p.burning){p.burning=true;p.burnTime=0;event(s,'on-fire','A spark catches your sleeve. The river is close. Move—before the warmth becomes everything.');}
  if(p.burning){p.burnTime+=dt;p.health=Math.max(0,p.health-dt*(p.burnTime>1?10:2));if(p.health<=0){p.burning=false;s.ending='lost';event(s,'lost','You did not reach the river. The clearing grows still, and your crossing remains unfinished.');return;}}
  const sources=s.trees.filter(t=>t.status==='burning');
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
  if(s.ignited>=3)event(s,'spread','The wind carries embers from crown to crown. The wildfire no longer needs you to move.');
}
export function forestBeat(s){
  if(s.player.burning)return {chapter:'02 · WHAT YOU CARRY',title:'Get to the river.',objective:'Your clothes are burning. Find the blue river on the map and wade into the water.',mood:'danger'};
  const active=s.trees.filter(t=>t.status==='burning').length;
  if(active)return {chapter:'03 · WHAT YOU LEAVE',title:'The forest is answering.',objective:'Refill your flask in the river. Move near a burning tree and press E to douse it—or cross to the stone cairn and leave.',mood:'fire'};
  if(s.startedFire)return {chapter:'04 · THE OTHER BANK',title:'There is still something to save.',objective:s.campLit?'Douse the campfire to prevent another spark, then cross to the stone cairn.':'The flames are out. Cross the river and find the stone cairn to finish your story.',mood:'calm'};
  if(s.enteredRiver)return {chapter:'02 · THE RIVER REMEMBERS',title:'A little water. A little choice.',objective:'Your flask is full. You can douse the campfire with E, explore the forest, or cross to the stone cairn.',mood:'calm'};
  return {chapter:'01 · AN UNATTENDED FLAME',title:'Everything starts with a spark.',objective:'Explore the campfire, forest and river. Fire catches on contact; the river extinguishes it. A stone cairn waits on the far bank.',mood:'calm'};
}
export function endingCopy(s){const charred=s.trees.filter(t=>t.status==='charred').length;return {title:s.ending==='lost'?'An unfinished crossing.':s.ending==='restored'?'What you chose to save.':s.ending==='left-behind'?'The safety of the other bank.':'A quiet crossing.',text:s.events.at(-1)?.text||'',detail:`${s.ignited} trees caught fire · ${s.extinguished} fires doused · ${charred} trees lost`};}
