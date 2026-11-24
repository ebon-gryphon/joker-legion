/** Artwork-only overlays for four prototype professions. No gameplay imports or state. */
import { UNIFORM_ROLES, uniformRoleForJob } from './outfits.js'
import { UNIFORM_KITS, UNIFORM_WEAPONS } from './uniformArt.js'

export const HIGH_TIER_ATLAS = 'high-tier-parts'
export const HIGH_TIER_PARTS = Object.freeze(['head', 'back', 'hand', 'armor'])

// Eight rows, four isolated transparent parts in each row. All sizes are relative
// to the existing 112px articulated body; its joints, feet and container stay fixed.
export const HIGH_TIER_PROTOTYPES = Object.freeze([
  Object.freeze({job:'sovereign', role:'flushFive', row:0, gesture:'standard',
    head:{height:.30, maxWidth:.55, grip:[.5,.82],anchor:[.53,.15]}, back:{height:.88, maxWidth:1.02, grip:[.5,.12]},
    hand:{height:.98, maxWidth:.66, grip:[.48,.53]}, armor:{height:.42, maxWidth:.78, grip:[.5,.13]}}),
  Object.freeze({job:'priest', role:'pair', row:2, gesture:'cast',
    head:{height:.38, maxWidth:.48, grip:[.5,.84],anchor:[.53,.29]}, back:{height:.85, maxWidth:.90, grip:[.5,.15]},
    hand:{height:1.00, maxWidth:.68, grip:[.52,.53]}, armor:{height:.45, maxWidth:.68, grip:[.5,.10]}}),
  Object.freeze({job:'shield', role:'fullHouse', row:4, gesture:'bash',
    head:{height:.34, maxWidth:.54, grip:[.5,.83],anchor:[.53,.29]}, back:{height:.76, maxWidth:.92, grip:[.5,.14]},
    hand:{height:.77, maxWidth:.67, grip:[.48,.40]}, armor:{height:.44, maxWidth:.91, grip:[.5,.13]}}),
  Object.freeze({job:'archer', role:'three', row:6, gesture:'draw',
    head:{height:.30, maxWidth:.49, grip:[.5,.80],anchor:[.53,.29]}, back:{height:.78, maxWidth:.83, grip:[.5,.16]},
    hand:{height:1.00, maxWidth:.78, grip:[.75,.50]}, armor:{height:.37, maxWidth:.65, grip:[.5,.11]}}),
])

const roleVisuals = new Map(HIGH_TIER_PROTOTYPES.map(look => [look.role, look]))
const canonicalJob = job => HIGH_TIER_PROTOTYPES.find(look => look.role===uniformRoleForJob(job))?.job || job

/** A shared mapping is used by battlefield poses and static canvas portraits. */
export function highTierVisualForFrame(frame) {
  if(frame?.atlas!=='uniforms' || ![5,6].includes(frame.column))return null
  const look=roleVisuals.get(UNIFORM_ROLES[frame.row]);if(!look)return null
  const row=look.row+frame.column-5
  return {...look, grade:frame.column, atlas:HIGH_TIER_ATLAS, atlasRow:row,
    frames:Object.fromEntries(HIGH_TIER_PARTS.map((part,column)=>[part,row*4+column]))}
}

export const HIGH_TIER_FUSION_PRIORITY = Object.freeze([
  'sovereign','priest','shield','archer','ward','fire','pike','cavalry','outrider','duelist','assassin','blade',
])

// A secondary profession has a recognizable carried object of its own. Back
// insignia and quivers do not compete with the primary hand or the wearer's face.
export const HIGH_TIER_FUSION_KITS = Object.freeze({
  sovereign:{part:'head',family:'regal',layer:'back',anchor:[.20,.40],height:.25,maxWidth:.30,grip:[.5,.55],angle:-.18},
  priest:{part:'back',family:'ritual',layer:'back',anchor:[.16,.39],height:.50,maxWidth:.40,grip:[.5,.16],angle:-.13},
  shield:{part:'hand',family:'shield',layer:'body',anchor:[.18,.49],height:.43,maxWidth:.37,grip:[.5,.35],angle:-.14},
  archer:{part:'back',family:'quiver',layer:'back',anchor:[.05,.43],height:.51,maxWidth:.37,grip:[.5,.18],angle:-.24},
  ward:{weapon:'shield',family:'ward',layer:'body',anchor:[.22,.61],height:.30,maxWidth:.28,angle:.20},
  fire:{weapon:'flame',family:'flame',layer:'rear-hand',height:.32,maxWidth:.29,angle:-.20},
  pike:{weapon:'spear',family:'polearm',layer:'back',anchor:[.08,.62],height:.46,maxWidth:.26,angle:-.24},
  cavalry:{weapon:'spear',family:'polearm',layer:'back',anchor:[.08,.62],height:.46,maxWidth:.26,angle:-.24},
  outrider:{weapon:'crossbow',family:'crossbow',layer:'body',anchor:[.28,.70],height:.29,maxWidth:.32,angle:.23},
  duelist:{weapon:'rapier',family:'blade',layer:'body',anchor:[.30,.72],height:.37,maxWidth:.25,angle:.40},
  assassin:{weapon:'saber',family:'paired-blades',layer:'body',anchor:[.27,.71],height:.31,maxWidth:.24,angle:.40,copies:2},
  blade:{weapon:'saber',family:'blade',layer:'body',anchor:[.27,.72],height:.35,maxWidth:.25,angle:.34},
})

/** Read the saved profession list without sorting it in place or replacing its leader. */
export function highTierFusionModules(frame) {
  const main=highTierVisualForFrame(frame);if(!main)return []
  const seen=new Set([main.job]), candidates=[]
  for(const job of (frame.fusionJobs || []).slice(1)) {
    const canonical=canonicalJob(job)
    if(seen.has(canonical))continue
    seen.add(canonical)
    const role=uniformRoleForJob(job),kit=UNIFORM_KITS[role]
    if(!kit)continue
    const prototype=HIGH_TIER_PROTOTYPES.find(look=>look.job===canonical)
    const module=HIGH_TIER_FUSION_KITS[canonical] || {family:kit.hand,layer:'body',anchor:[.28,.70],height:.29,maxWidth:.27,angle:.25}
    const weapon=module.weapon || kit.hand,source=UNIFORM_WEAPONS[weapon]
    const part=module.part || 'hand'
    candidates.push({...module,job,canonical,role,weapon,
      gesture:kit.hand==='bow' || kit.hand==='crossbow'?'draw':['staff','flame'].includes(kit.hand)?'cast':kit.hand==='shield'?'bash':'thrust',
      atlas:prototype?HIGH_TIER_ATLAS:'armory',
      frame:prototype?(prototype.row+main.grade-5)*4+HIGH_TIER_PARTS.indexOf(part):source[0],
      grip:module.grip || (prototype?prototype[part].grip:source.slice(1,3))})
  }
  return candidates.sort((a,b)=>{
    const left=HIGH_TIER_FUSION_PRIORITY.indexOf(a.canonical),right=HIGH_TIER_FUSION_PRIORITY.indexOf(b.canonical)
    return (left<0?99:left)-(right<0?99:right)
  }).filter((module,index,all)=>all.findIndex(other=>other.family===module.family)===index)
    .slice(0,2).map((module,index)=>({...module,slot:index,anchor:module.anchor?.map((value,axis)=>value+(index===1?(axis===0?.15:.10):0))}))
}

export function highTierArtReady(record,look) {
  return Boolean(look && record?.ready && !record.error && HIGH_TIER_PARTS.every(part=>{
    const bounds=record.bounds?.[look.frames[part]]
    return bounds?.width>0 && bounds?.height>0
  }))
}

function rasterAt(c,record,frame,anchor,bodyHeight,definition,angle=0) {
  const source=record?.bounds?.[frame];if(!record?.ready || !source)return false
  let height=bodyHeight*definition.height,width=height*source.width/source.height
  const limit=bodyHeight*(definition.maxWidth || 1)
  if(width>limit){height*=limit/width;width=limit}
  const [gx,gy]=definition.grip
  c.save();c.translate(...anchor);c.rotate(angle)
  c.drawImage(record.image,source.x,source.y,source.width,source.height,-width*gx,-height*gy,width,height)
  c.restore();return true
}

/** The caller supplies the same moving socket as the ordinary rig. */
export function drawHighTierPart(c,record,look,part,anchor,bodyHeight,angle=0) {
  if(!look?.[part])return false
  return rasterAt(c,record,look.frames[part],anchor,bodyHeight,look[part],angle)
}

/** Secondary parts stay below the shoulders and behind the primary working arm. */
export function drawHighTierFusionModule(c,records,module,anchor,bodyHeight,angle=0) {
  let painted=false
  for(let i=0;i<(module.copies || 1);i++) {
    const position=[anchor[0]+i*bodyHeight*.065,anchor[1]+i*bodyHeight*.025]
    painted=rasterAt(c,records.get(module.atlas),module.frame,position,bodyHeight,module,angle+(i?-.75:0)) || painted
  }
  return painted
}
