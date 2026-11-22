import { QUALITY_OUTFITS, UNIFORM_ROLES } from './outfits.js'

// Artwork-local grips, measured inside each trimmed sprite. A point on the handle
// meets the corresponding hand so wide capes and narrow tunics share one armory.
export const UNIFORM_GRIPS = [
  [.91,.33,.09,.59], [.90,.34,.09,.60], [.91,.37,.13,.63], [.93,.37,.29,.63],
  [.93,.39,.36,.63], [.93,.41,.37,.63], [.91,.40,.36,.64],
]
export const UNIFORM_WEAPONS = {
  saber:[0,.15,.84,.55], spear:[1,.37,.58,.93], staff:[2,.54,.58,.94],
  bow:[3,.76,.50,.77], shield:[4,.46,.38,.54], flame:[5,.51,.58,.91],
  crossbow:[6,.31,.72,.41], rapier:[7,.15,.83,.69],
}
export const UNIFORM_KITS = {
  high:{hand:'saber'}, pair:{hand:'staff'}, twoPair:{hand:'spear'}, three:{hand:'bow'},
  straight:{hand:'spear',horse:true}, flush:{hand:'flame'}, fullHouse:{hand:'shield'},
  four:{hand:'saber',off:'saber',size:.60}, straightFlush:{hand:'crossbow',horse:true},
  five:{hand:'rapier'}, flushHouse:{hand:'staff',off:'shield'}, flushFive:{hand:'rapier',size:1.24,off:'shield'},
  paladin:{hand:'saber',off:'shield'}, warden:{hand:'crossbow',off:'shield'},
  starblade:{hand:'rapier',off:'flame'}, bard:{hand:'bow',off:'staff'},
  priest:{hand:'flame',off:'staff'}, frostbow:{hand:'bow',off:'rapier'}, footCrossbow:{hand:'crossbow'},
}

export function assembleUniforms(clothes,arms) {
  const cellW=174, cellH=152
  const sheet=document.createElement('canvas')
  sheet.width=cellW*QUALITY_OUTFITS.length
  sheet.height=cellH*UNIFORM_ROLES.length
  const c=sheet.getContext('2d')
  c.imageSmoothingEnabled=false
  function sprite(record,index,x,y,w,h) {
    const s=record.bounds[index]
    c.drawImage(record.image,s.x,s.y,s.width,s.height,Math.round(x),Math.round(y),Math.round(w),Math.round(h))
  }
  function equip(id,x,y,bodyHeight,size=1,reverse=false) {
    const [index,gx,gy,fraction]=UNIFORM_WEAPONS[id], s=arms.bounds[index]
    const h=bodyHeight*fraction*size, w=h*s.width/s.height
    c.save();c.translate(Math.round(x),Math.round(y))
    if (reverse) c.scale(-1,1)
    sprite(arms,index,-w*gx,-h*gy,w,h)
    c.restore()
  }
  for (const [row,role] of UNIFORM_ROLES.entries()) for (const [grade,grip] of UNIFORM_GRIPS.entries()) {
    const kit=UNIFORM_KITS[role], body=clothes.bounds[grade]
    const h=kit.horse ? 89 : 106, w=h*body.width/body.height
    const x=(kit.horse ? 72 : 77)-w*.53, y=kit.horse ? 15 : 143-h
    c.save();c.translate(grade*cellW,row*cellH)
    const hx=x+w*grip[0], hy=y+h*grip[1]
    if (kit.horse) {
      sprite(clothes,7,17,59,130,86)
      // Seat the hips in the saddle, then put the near boot in the stirrup.
      c.drawImage(clothes.image,body.x,body.y,body.width,Math.round(body.height*.73),Math.round(x),y,Math.round(w),Math.round(h*.73))
      c.drawImage(clothes.image,body.x+Math.round(body.width*.49),body.y+Math.round(body.height*.68),
        Math.round(body.width*.34),Math.round(body.height*.32),Math.round(x+w*.48),y+Math.round(h*.68),Math.round(w*.35),Math.round(h*.29))
    } else sprite(clothes,grade,x,y,w,h)
    if (kit.off) equip(kit.off,x+w*grip[2],y+h*grip[3],h,kit.off==='shield'?.80:.60,kit.off!=='shield')
    equip(kit.hand,hx,hy,h,kit.size)
    if (kit.hand!=='shield') {
      // Repaint the lower fingers in front of the handle.
      const px=grip[0]-.046, py=grip[1]+.006
      c.drawImage(clothes.image,body.x+body.width*px,body.y+body.height*py,body.width*.07,body.height*.021,
        Math.round(x+w*px),Math.round(y+h*py),Math.max(2,Math.round(w*.07)),Math.max(2,Math.round(h*.021)))
    }
    c.restore()
  }
  return sheet
}
