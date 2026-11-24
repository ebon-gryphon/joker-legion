/** Articulated raster puppets. Source pixels are separated once at load time;
 * every frame moves shoulders, elbows, hips, knees, cloth and equipment independently. */
import { UNIFORM_ROLES, uniformRoleForJob } from './outfits.js'
import { UNIFORM_KITS, UNIFORM_WEAPONS } from './uniformArt.js'
import { HIGH_TIER_ATLAS, highTierVisualForFrame, highTierFusionModules, highTierArtReady, drawHighTierPart, drawHighTierFusionModule } from './highTierArt.js'

const rigs = new WeakMap()
const P = (...points) => points
const limb = (a,b,r=.09) => {
  const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy),x=-dy/length*r,y=dx/length*r
  return P([a[0]+x,a[1]+y],[b[0]+x,b[1]+y],[b[0]-x,b[1]-y],[a[0]-x,a[1]-y])
}
function imagePart(record,index,polygons,subtract=[]) {
  const b=record.bounds[index], canvas=document.createElement('canvas')
  canvas.width=Math.ceil(b.width);canvas.height=Math.ceil(b.height)
  const c=canvas.getContext('2d');c.imageSmoothingEnabled=false
  c.drawImage(record.image,b.x,b.y,b.width,b.height,0,0,canvas.width,canvas.height)
  function mask(items,composite) {
    c.globalCompositeOperation=composite;c.fillStyle='#fff';c.beginPath()
    for(const polygon of items){polygon.forEach(([x,y],i)=>i?c.lineTo(x*canvas.width,y*canvas.height):c.moveTo(x*canvas.width,y*canvas.height));c.closePath()}
    c.fill()
  }
  if(polygons.length){
    const m=document.createElement('canvas');m.width=canvas.width;m.height=canvas.height
    const mc=m.getContext('2d');mc.fillStyle='#fff';mc.beginPath()
    for(const polygon of polygons){polygon.forEach(([x,y],i)=>i?mc.lineTo(x*m.width,y*m.height):mc.moveTo(x*m.width,y*m.height));mc.closePath()};mc.fill()
    c.globalCompositeOperation='destination-in';c.drawImage(m,0,0)
  }
  if(subtract.length)mask(subtract,'destination-out')
  return canvas
}
function assembleRig(record,index,enemy=false) {
  let cache=rigs.get(record);if(!cache){cache=new Map();rigs.set(record,cache)}
  const key=index+':'+enemy;if(cache.has(key))return cache.get(key)
  const b=record.bounds[index]
  const card=enemy==='card', queen=enemy==='queen', bat=enemy===true && index===1
  const designIndex=card?0:index
  const front=enemy ? (queen ? [[.59,.29],[.69,.45],[.80,.57]] :
    designIndex===2 ? [[.44,.35],[.58,.43],[.80,.39]] : designIndex===3 ? [[.43,.36],[.60,.48],[.80,.44]] :
    designIndex===5 ? [[.36,.31],[.51,.38],[.71,.24]] : designIndex>=6 ? [[.52,.34],[.62,.50],[.71,.62]] : [[.48,.36],[.66,.47],[.72,.51]])
    : [[.59,.32],[.73,.39],[.91,.35]]
  const rear=enemy ? [[.34,.36],[.25,.48],[.24,.61]] : [[.32,.35],[.22,.47],[.15,.60]]
  const hips=enemy ? [[.39,.70],[.60,.70]] : [[.42,.70],[.60,.70]]
  const knees=enemy ? [[.30,.84],[.64,.84]] : [[.35,.84],[.65,.84]]
  const feet=enemy ? [[.28,.98],[.79,.98]] : [[.26,.98],[.79,.98]]
  const frontMasks=[limb(front[0],front[1],.10),limb(front[1],front[2],.09)]
  const rearMasks=[limb(rear[0],rear[1],.085),limb(rear[1],rear[2],.075)]
  // Weapons on the original enemy atlas move with the corresponding forearm.
  if(enemy && !queen && !bat && !card){
    const tool = index===0?P([.71,.25],[1,.26],[1,.65],[.69,.65]):
      index===2?P([.69,0],[1,0],[1,.78],[.77,.78]):
      index===3?P([.74,.33],[1,.33],[1,.71],[.74,.71]):
      index===4?P([.68,0],[1,0],[1,.91],[.68,.91]):
      index===5?P([.57,.14],[1,.14],[1,.85],[.57,.85]):
      P([.66,.45],[1,.45],[1,1],[.66,1])
    frontMasks[1]=[...frontMasks[1]];frontMasks.push(tool)
  }
  const legMasks=hips.map((hip,i)=>[limb(hip,knees[i],.115),limb(knees[i],feet[i],.12)])
  const headMask=P([.22,0],[.82,0],[.76,.32],[.39,.34],[.20,.23])
  const capeMask=enemy?P([0,.28],[.32,.29],[.40,.68],[.20,.92],[0,1]):P([0,.28],[.27,.28],[.38,.70],[.22,.95],[0,.95])
  const cuts=[...frontMasks,...rearMasks,...legMasks.flat(),headMask,capeMask]
  const rig={width:b.width,height:b.height,front,rear,hips,knees,feet,
    body:imagePart(record,index,[],cuts),head:imagePart(record,index,[headMask]),cape:imagePart(record,index,[capeMask]),
    upperF:imagePart(record,index,[frontMasks[0]]),lowerF:imagePart(record,index,frontMasks.slice(1)),
    upperR:imagePart(record,index,[rearMasks[0]]),lowerR:imagePart(record,index,[rearMasks[1]]),
    thighs:legMasks.map(m=>imagePart(record,index,[m[0]])),shins:legMasks.map(m=>imagePart(record,index,[m[1]])),
    full:record, index, bat}
  if(!enemy && index>=5) {
    // The prototype costume owns the crown, shoulders and outer cloak. Keep the
    // same face and anatomical limb sockets without showing two outfits at once.
    rig.costume={
      body:imagePart(record,index,[P([.34,.28],[.68,.28],[.71,.69],[.34,.71])],cuts),
      head:imagePart(record,index,[P([.42,.14],[.66,.14],[.70,.32],[.40,.34],[.35,.25])]),
      upperF:imagePart(record,index,[limb(front[0],front[1],.058)]),
      upperR:imagePart(record,index,[limb(rear[0],rear[1],.052)]),
      lowerF:imagePart(record,index,[limb(front[1],front[2],.050)]),
      lowerR:imagePart(record,index,[limb(rear[1],rear[2],.045)]),
      thighs:hips.map((hip,i)=>imagePart(record,index,[limb(hip,knees[i],.075)])),
      shins:knees.map((knee,i)=>imagePart(record,index,[limb(knee,feet[i],.080)])),
    }
  }
  if(bat){
    rig.leftWing=imagePart(record,index,[P([0,0],[.49,0],[.47,1],[0,1])])
    rig.rightWing=imagePart(record,index,[P([.60,0],[1,0],[1,1],[.61,1])])
    rig.body=imagePart(record,index,[P([.37,.25],[.70,.25],[.70,1],[.37,1])])
  }
  cache.set(key,rig);return rig
}
function point(v,w,h){return [v[0]*w,v[1]*h]}
function rotated(v,angle){return [v[0]*Math.cos(angle)-v[1]*Math.sin(angle),v[0]*Math.sin(angle)+v[1]*Math.cos(angle)]}
function add(a,b){return [a[0]+b[0],a[1]+b[1]]}
/** Angles remain continuous at display refresh rate, independently of the 30Hz rules clock. */
export function jointPose(pose={},gesture='thrust') {
  const walk=pose.state==='walk', reduced=pose.reduced
  const flinch=reduced?0:(pose.flinch || 0)
  const gait=reduced?0:(pose.gait ?? 0), breath=reduced?0:(pose.breath ?? 0)
  const contact=pose.contact || 0, back=pose.backWeight || 0
  const bow=['draw','snap','crouch'].includes(gesture), casting=['cast','trace','rise','orbit','offer','pour','shake','standard'].includes(gesture)
  const heavy=['slam','cleave','sweep','bash'].includes(gesture)
  const strength=reduced?.08:1
  const joints = {
    frontShoulder:(walk?gait*.25:breath*.025)+(heavy?-1.05*back+.70*contact:casting?-.52*back-.70*contact:-.27*back+.14*contact)*strength,
    frontElbow:(walk?-.14-Math.max(0,-gait)*.16:-.04)+(bow?-1.20*back+.2*contact:casting?-.7*back-.12*contact:-.95*back+.30*contact)*strength,
    rearShoulder:(walk?-gait*.29:breath*.02)+(bow?-.55*back-.25*contact:casting?-.25*back-.65*contact:.30*back-.14*contact)*strength,
    rearElbow:(bow?-1.1*back+.3*contact:casting?-.6*contact:0)*strength,
    hips:[gait*.54,-gait*.54],knees:[Math.max(0,-gait)*.77,Math.max(0,gait)*.77],
    lean:(walk?.035:0)+(pose.bend || 0)*.006+flinch*.13,
    drop:walk?-Math.abs(gait)*1.0:breath*.22,
    head:breath*.013-(pose.bend || 0)*.002+flinch*.08,
    cloth:(walk?gait*.10:breath*.035)-contact*.09,
    weapon:(heavy?-1.4*back+.9*contact:bow?-.12*back:casting?-.3*back-.23*contact:-.5*back+.17*contact)*strength,
    bowDraw:bow?back:0,
  }
  if(pose.state==='salute' && !reduced) {
    const pulse=Math.min(1,Math.max(0,Number.isFinite(pose.salute)?pose.salute:0))
    // One raised-arm envelope supplied by the external presentation clock.
    // This cannot change walking, combat contact, the planted foot or hit bounds.
    joints.frontShoulder=-1.35*pulse
    joints.rearShoulder=1.45*pulse
    joints.frontElbow=-.45*pulse
    joints.rearElbow=.60*pulse
    joints.weapon-=.28*pulse
    joints.drop-=Math.min(2,Math.max(0,Number.isFinite(pose.saluteLift)?pose.saluteLift:0))
  }
  return joints
}
function drawPart(c,image,pivot,w,h) {c.drawImage(image,-pivot[0],-pivot[1],w,h)}
function chain(c,rig,nodes,images,angles,w,h) {
  const [root,mid,end]=nodes.map(p=>point(p,w,h)), first=angles[0], second=angles[1]
  c.save();c.translate(...root);c.rotate(first);drawPart(c,images[0],root,w,h)
  c.translate(mid[0]-root[0],mid[1]-root[1]);c.rotate(second);drawPart(c,images[1],mid,w,h);c.restore()
  return add(add(root,rotated([mid[0]-root[0],mid[1]-root[1]],first)),rotated([end[0]-mid[0],end[1]-mid[1]],first+second))
}
function raster(c,record,index,x,y,w,h) {const b=record.bounds[index];c.drawImage(record.image,b.x,b.y,b.width,b.height,x,y,w,h)}
function equipment(c,arms,id,wrist,bodyHeight,angle=0,size=1) {
  const definition=UNIFORM_WEAPONS[id];if(!definition)return
  const [frame,gx,gy,fraction]=definition,b=arms.bounds[frame],h=bodyHeight*fraction*size,w=h*b.width/b.height
  c.save();c.translate(...wrist);c.rotate(angle);raster(c,arms,frame,-w*gx,-h*gy,w,h);c.restore()
}
function drawHorse(c,record,pose) {
  const b=record.bounds[7],w=126,h=84,legY=.65
  const source=record.image, gait=pose?.gait || 0
  c.save();c.translate(-61,-82)
  // Torso and head stay above four separately hinged lower legs.
  c.drawImage(source,b.x,b.y,b.width,b.height*legY,0,0,w,h*legY)
  for(let i=0;i<4;i++){
    const left=[.10,.29,.64,.79][i],span=i%2?-.4:.4,phase=gait*(i%2?-1:1)
    c.save();c.translate(w*(left+.07),h*legY);c.rotate(phase*span)
    c.drawImage(source,b.x+b.width*left,b.y+b.height*legY,b.width*.15,b.height*(1-legY),-w*.07,0,w*.15,h*(1-legY));c.restore()
  }
  c.restore()
}
export function drawArticulatedUniform(c,records,frame,x,y,width,height,options={}) {
  const clothes=records.get('regalia'),arms=records.get('armory');if(!clothes?.ready || !arms?.ready)return false
  const grade=frame.column,role=UNIFORM_ROLES[frame.row],kit=UNIFORM_KITS[role];if(!kit)return false
  const parts=records.get(HIGH_TIER_ATLAS),candidate=highTierVisualForFrame(frame)
  const look=highTierArtReady(parts,candidate)?candidate:null,modules=look?highTierFusionModules(frame):[]
  const rig=assembleRig(clothes,grade),pose=options.pose || {},gesture=pose.gesture || look?.gesture || (kit.hand==='bow'?'draw':['staff','flame'].includes(kit.hand)?'cast':'thrust')
  const costume=look?rig.costume:null
  const j=jointPose(pose,gesture),mounted=kit.horse,bodyHeight=mounted?90:112
  const w=bodyHeight*rig.width/rig.height,h=bodyHeight,scale=Math.min(width/126,height/(mounted?145:132))
  const secondary=look?modules.find(module=>module.layer==='rear-hand')?.job:(frame.fusionJobs || []).slice(1).find(job=>UNIFORM_KITS[uniformRoleForJob(job)])
  const extra=secondary && UNIFORM_KITS[uniformRoleForJob(secondary)]
  const extraGesture=extra && (extra.hand==='bow' || extra.hand==='crossbow'?'draw':['staff','flame'].includes(extra.hand)?'cast':extra.hand==='shield'?'bash':'thrust')
  const sub=extra?jointPose(pose,extraGesture):null
  const origin=[w*.48,h]
  c.save();c.imageSmoothingEnabled=false;c.translate(x+width*.47,y+height);c.scale(options.flip?-scale:scale,scale)
  if(mounted)drawHorse(c,clothes,pose)
  c.translate(-origin[0],-h-(mounted?46:0)+j.drop)
  const hipY=h*.69
  c.translate(w*.5,hipY);c.rotate(j.lean);c.translate(-w*.5,-hipY)
  // Trailing cloth, rear limbs, torso, head, then the forward working arm.
  const capePivot=[w*.29,h*.33]
  c.save();c.translate(...capePivot);c.rotate(j.cloth)
  if(look)drawHighTierPart(c,parts,look,'back',[w*.40-capePivot[0],h*.30-capePivot[1]],h)
  else drawPart(c,rig.cape,capePivot,w,h)
  c.restore()
  if(look)for(const module of modules.filter(module=>module.layer==='back'))
    drawHighTierFusionModule(c,records,module,[w*module.anchor[0],h*module.anchor[1]],h,module.angle+j.cloth)
  if(!mounted)for(const i of [1,0])chain(c,rig,[rig.hips[i],rig.knees[i],rig.feet[i]],[costume?.thighs[i] || rig.thighs[i],costume?.shins[i] || rig.shins[i]],[j.hips[i],j.knees[i]],w,h)
  else for(const i of [0,1])chain(c,rig,[rig.hips[i],rig.knees[i],rig.feet[i]],[rig.thighs[i],rig.shins[i]],[i?.12:-.18,.35],w,h)
  const rear=chain(c,rig,rig.rear,[costume?.upperR || rig.upperR,costume?.lowerR || rig.lowerR],[j.rearShoulder+(sub?.frontShoulder || 0)*.7,j.rearElbow+(sub?.frontElbow || 0)*.6],w,h)
  c.drawImage(costume?.body || rig.body,0,0,w,h)
  if(look) {
    drawHighTierPart(c,parts,look,'armor',[w*.53,h*.33],h)
    for(const module of modules.filter(module=>module.layer==='body'))
      drawHighTierFusionModule(c,records,module,[w*module.anchor[0],h*module.anchor[1]],h,module.angle)
  }
  const neck=[w*.53,h*.29];c.save();c.translate(...neck);c.rotate(j.head);drawPart(c,costume?.head || rig.head,neck,w,h)
  if(look)drawHighTierPart(c,parts,look,'head',[w*look.head.anchor[0]-neck[0],h*look.head.anchor[1]-neck[1]],h)
  c.restore()
  if(look) {
    for(const module of modules.filter(module=>module.layer==='rear-hand'))
      drawHighTierFusionModule(c,records,module,rear,h,module.angle+(sub?.weapon || 0)*.65)
  } else if(extra || kit.off)equipment(c,arms,extra?.hand || kit.off,rear,h,sub?sub.weapon*.65:-j.weapon*.60,extra?.hand==='shield'?.72:.65)
  const wrist=chain(c,rig,rig.front,[costume?.upperF || rig.upperF,costume?.lowerF || rig.lowerF],[j.frontShoulder,j.frontElbow],w,h)
  if(look)drawHighTierPart(c,parts,look,'hand',wrist,h,j.weapon)
  else equipment(c,arms,kit.hand,wrist,h,j.weapon,kit.size)
  if(kit.hand==='bow' && j.bowDraw>.1){
    c.strokeStyle='#f8e9be';c.lineWidth=.8;c.beginPath();c.moveTo(wrist[0],wrist[1]-h*.34);c.lineTo(wrist[0]-j.bowDraw*15,wrist[1]);c.lineTo(wrist[0],wrist[1]+h*.30);c.stroke()
  }
  if(!look && frame.fusionJobs?.length>2){
    // Extra inheritances are visible as small heraldic equipment, never replacing the primary silhouette.
    frame.fusionJobs.slice(2,5).forEach((job,i)=>equipment(c,arms,UNIFORM_KITS[uniformRoleForJob(job)]?.hand,[w*.30-i*3,h*.44+i*7],h, -.32-i*.22,.27))
  }
  c.restore();return true
}
export function drawArticulatedEnemy(c,record,frame,x,y,width,height,options={}) {
  if(!record?.ready)return false
  const rig=assembleRig(record,frame.frame,frame.atlas==='enemies'?true:'card'),pose=options.pose || {},j=jointPose(pose,pose.gesture || 'cleave')
  const h=height,w=h*rig.width/rig.height,scale=Math.min(1,width/w)
  c.save();c.imageSmoothingEnabled=false;c.translate(x+width/2,y+height);c.scale(options.flip?-scale:scale,scale);c.translate(-w/2,-h+j.drop)
  if(rig.bat){
    const flap=pose.reduced?0:Math.sin((pose.clock || 0)*14+(pose.phase || 0))
    for(const [part,pivot,sign] of [[rig.leftWing,[.46,.48],-1],[rig.rightWing,[.64,.48],1]]){
      const p=point(pivot,w,h);c.save();c.translate(...p);c.rotate(sign*flap*.38);c.scale(1,.80+Math.abs(flap)*.20);drawPart(c,part,p,w,h);c.restore()
    }
    c.drawImage(rig.body,0,-Math.abs(flap),w,h)
  }else{
    const hip=[w*.50,h*.69];c.translate(...hip);c.rotate(j.lean);c.translate(-hip[0],-hip[1])
    const cape=[w*.29,h*.32];c.save();c.translate(...cape);c.rotate(j.cloth);drawPart(c,rig.cape,cape,w,h);c.restore()
    for(const i of [1,0])chain(c,rig,[rig.hips[i],rig.knees[i],rig.feet[i]],[rig.thighs[i],rig.shins[i]],[j.hips[i],j.knees[i]],w,h)
    chain(c,rig,rig.rear,[rig.upperR,rig.lowerR],[j.rearShoulder,j.rearElbow],w,h)
    c.drawImage(rig.body,0,0,w,h)
    const neck=[w*.53,h*.27];c.save();c.translate(...neck);c.rotate(j.head);drawPart(c,rig.head,neck,w,h);c.restore()
    chain(c,rig,rig.front,[rig.upperF,rig.lowerF],[j.frontShoulder,j.frontElbow+j.weapon*.38],w,h)
  }
  c.restore();return true
}
