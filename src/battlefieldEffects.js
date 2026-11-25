import { LURE_REVEAL, LURE_TRAVEL } from './performers.js'
import { rect, glyph, disk, snap, diamond, line, cross, outline } from './pixelDrawing.js'
import { SPADE } from './battlefieldScenery.js'
import { wagonPosition } from './convoy.js'
import { PERFORMANCES } from './performance.js'
import { restingPose } from './choreography.js'
import { performanceOf } from './performance.js'
import { paintMissile } from './choreography.js'
import { ENEMY_CATALOG } from './enemyCatalog.js'
import { drawCardSprite } from './spriteAtlas.js'

export function drawLure(c, lure, now, yMap, reduced) {
  const age = Math.max(0,now-lure.at)
  const approach = Math.min(1,age/LURE_REVEAL)
  const retreat = Math.max(0,Math.min(1,(age-LURE_REVEAL)/LURE_TRAVEL))
  const along = approach - retreat*retreat*(3-2*retreat)
  const x = lure.toX + (lure.fromX-lure.toX)*along
  const ground = yMap(lure.toY + (lure.fromY-lure.toY)*along)
  const y = ground-36-(reduced ? 0 : Math.sin(approach*Math.PI)*17)
  c.save()
  c.strokeStyle='#e2bc6e'; c.lineWidth=1.5
  c.beginPath(); c.moveTo(lure.toX-10,yMap(lure.toY)-7); c.quadraticCurveTo((lure.toX+x)/2,ground+8,x,y); c.stroke()
  c.translate(Math.round(x),Math.round(y)); c.rotate(reduced ? 0 : Math.sin(age*9)*.22)
  rect(c,-10,-13,20,26,'#352321'); rect(c,-8,-11,16,22,'#edd8a4')
  glyph(c,-4,-6,SPADE,'#352524',1); disk(c,6,13,3,'#e6b657')
  c.restore()
}

function drawWagonFallback(c, wagon, seconds, pos, yMap, reduced) {
  const x = snap(pos.x), y = yMap(pos.y), heavy = wagon.id === 'payroll'
  const bounce = reduced ? 0 : Math.floor(seconds * 4) % 2 * 2
  c.save()
  c.translate(x, y)
  const dark = '#32232c', wood = '#9b6947', trim = '#ebc583'
  diamond(c, -6, 1, 50, 6, '#362b40')
  // The mule, traces and spoke wheels face the direction of travel.
  for (const [leg, stride] of [[-43,bounce],[-38,2-bounce],[-23,2-bounce],[-18,bounce]]) {
    line(c, leg, -9, leg - stride * 2, -2, dark, 4)
  }
  rect(c,-48,-20,33,13,'#67474b'); rect(c,-45,-20,24,7,'#af876e')
  rect(c,-49,-29,9,17,'#996e60'); rect(c,-54,-27,12,8,'#c69a76')
  rect(c,-48,-34,4,9,dark); rect(c,-43,-33,3,7,wood); rect(c,-51,-26,2,2,dark)
  line(c,-38,-19,-30,-8,trim,2); line(c,-34,-14,5,-11,'#c29466',2)
  const width = heavy ? 46 : 34
  rect(c, -8, -19+bounce, width, 13, dark); rect(c,-6,-18+bounce,width-4,9,wood)
  for (const crate of (heavy ? [0,15,8] : [1,12])) {
    const top = heavy && crate === 8 ? -40 : -30
    rect(c,crate,top+bounce,15,13,dark); rect(c,crate+2,top+2+bounce,11,9,heavy?'#bc8646':'#a77a52')
    rect(c,crate+6,top+2+bounce,3,10,trim)
  }
  rect(c,-8,-19+bounce,width,3,trim)
  for (const wheel of [-2,width-16]) {
    diamond(c,wheel,-5,7,7,dark); diamond(c,wheel,-5,4,4,wood); rect(c,wheel-1,-6,3,3,trim)
  }
  line(c,width-12,-20,width-12,-46,'#e0b782')
  rect(c,width-11,-46,15,9,heavy?'#a74a65':'#6c7492'); rect(c,width-8,-43,5,3,trim)
  c.restore()
}

export function drawWagon(c, art, wagon, seconds, pos, yMap, reduced) {
  if (!art.complete || !art.naturalWidth) {
    drawWagonFallback(c, wagon, seconds, pos, yMap, reduced)
    return
  }
  const heavy = wagon.id === 'payroll'
  const distance = wagonPosition(wagon, wagon.opens).x - pos.x
  const horseWidth = heavy ? 76 : 66, horseHeight = heavy ? 63 : 55
  const cartWidth = heavy ? 156 : 118, cartHeight = heavy ? 63 : 43
  const horseX = -Math.round((horseWidth + cartWidth - 15) / 2)
  const cartX = horseX + horseWidth - 15
  const wheelRadius = heavy ? 15.5 : 15
  const wheel = reduced ? 0 : Math.floor(distance * 24 / (Math.PI * wheelRadius)) % 8
  const stride = distance / (heavy ? 26 : 24)
  const footfall = reduced ? 0 : Math.floor(stride * 4) % 4
  const sway = reduced ? 0 : Math.round(Math.sin(stride * 2 * Math.PI))
  const cartSourceWidth = heavy ? 312 : 236
  const cartSourceHeight = heavy ? 125 : 85
  const cellBottom = heavy ? 504 : 336
  c.save()
  c.translate(Math.round(pos.x), Math.round(yMap(pos.y)))
  c.fillStyle = '#161322a8'
  for (const [center, radius] of [[horseX + horseWidth / 2, horseWidth * .42], [cartX + cartWidth * .60, cartWidth * .38]]) {
    c.beginPath(); c.ellipse(center, 0, radius, 3.5, 0, 0, 2 * Math.PI); c.fill()
  }
  c.drawImage(art, wheel*320, cellBottom-cartSourceHeight, cartSourceWidth, cartSourceHeight,
    cartX, -cartHeight, cartWidth, cartHeight)
  c.drawImage(art, footfall*320, 42, 151, 126,
    horseX, -horseHeight+sway, horseWidth, horseHeight)
  // The trace runs from the visible breastcollar to the forward shaft.
  const collarX = horseX + Math.round(horseWidth*.31), collarY = -Math.round(horseHeight*.47)+sway
  const shaftX = cartX+Math.round(cartWidth*.14), shaftY = heavy ? -20 : -14
  const belt = (color, width, offset) => {
    c.strokeStyle=color; c.lineWidth=width
    c.beginPath(); c.moveTo(collarX,collarY+offset)
    c.quadraticCurveTo(collarX+horseWidth*.40,shaftY+2+offset,shaftX,shaftY+offset); c.stroke()
  }
  belt('#372638', 3, 0); belt('#c69a68', 1, -1)
  c.restore()
}

export function drawEffect(c, effect, time, yMap, reduced, lag, labels) {
  const type = effect.type || 'damage', life = Math.max(0, (effect.life ?? .5) + lag), duration = effect.maxLife || effect.duration || .9, progress = Math.max(0, Math.min(1, 1 - life / duration))
  const x = snap(effect.x ?? effect.targetX ?? 500), y = snap(yMap(effect.y ?? effect.targetY ?? 250)), color = effect.color || (type === 'heal' ? '#e89aab' : '#e1bb80')
  if (life > duration && !(type==='death' && effect.fallen)) return
  c.save()
  if (type === 'projectile') {
    const fx = effect.fromX ?? x, fy = yMap(effect.fromY ?? effect.y ?? 250), tx = effect.targetX ?? x, ty = yMap(effect.targetY ?? effect.y ?? 250)
    const px = snap(fx + (tx - fx) * progress), py = snap(fy + (ty - fy) * progress - Math.sin(progress * Math.PI) * 8)
    if (PERFORMANCES[effect.profile]) {
      paintMissile(c,PERFORMANCES[effect.profile],effect.kind,fx,fy,tx,ty,progress)
    } else if (effect.sourceType === 'archer') {
      const angle = Math.atan2(ty - fy, tx - fx)
      c.translate(px, py); c.rotate(angle)
      c.fillStyle = '#c6a487'; c.fillRect(-10, -1, 12, 2)
      c.fillStyle = '#dacdc1'; c.fillRect(0, -2, 3, 4)
      c.fillStyle = '#d58184'; c.fillRect(-11, -2, 4, 4)
    } else if (effect.sourceType === 'warlock') {
      diamond(c, px, py, 6, 5, '#f17eaf'); rect(c, px - 2, py - 2, 4, 4, '#ffe0cc')
      rect(c, px + 5, py - 4, 3, 3, '#a84d8f')
    } else if (effect.sourceType === 'bellkeeper') {
      diamond(c, px, py, 4, 5, '#e4ad73')
      line(c, px + 4, py - 6, px + 7, py - 2, '#e4ad73'); line(c, px + 7, py, px + 4, py + 4, '#e4ad73')
    } else {
      line(c, px - (tx - fx) * .045, py - (ty - fy) * .045, px, py, color); rect(c, px - 2, py - 2, 4, 4, '#f8e6bd'); rect(c, px - 4, py, 2, 2, color)
    }
  } else if (type === 'lifeline') {
    const end = effect.toX, start = reduced ? x : snap(x+(end-x)*progress)
    const mid = snap((start+end)/2), knot = y-20
    c.globalAlpha = Math.min(1,life*3)
    line(c,start,knot,mid,knot+5,'#b38255')
    line(c,mid,knot+5,end,knot,'#e9ba76')
    diamond(c,end,knot,5,3,'#f1d59e')
  } else if (type === 'summon') {
    c.globalAlpha = Math.min(.8, life * 1.4); diamond(c, x, y + 2, 17 + progress * 9, 5 + progress * 3, color)
    for (let i = 0; i < 4; i++) { rect(c, x - 11 + i * 7, y - 12 - progress * 42 - i * 5, 2, 6, color); if (i % 2) cross(c, x - 14 + i * 9, y - 8 - progress * 32 - i * 5, 2, '#f0d8b4') }
  } else if (type==='death' && effect.fallen) {
    // Authoritative death has already been recorded; only the painted fade is shortened.
    const fade=progress/.7
    if(fade>=1){c.restore();return}
    const unit=effect.fallen, hostile=unit.side==='enemy', art=ENEMY_CATALOG[unit.type]
    const h=art?.height ?? (unit.fusion ? 65 : 49+(unit.level-1)*3), w=art?.width ?? (unit.fusion ? 60 : 50)
    const sink=reduced ? 0 : progress*progress
    c.translate(x+(hostile?1:-1)*Math.round(sink*7),y+Math.round(sink*3))
    c.transform(1,0,(hostile?-1:1)*sink*.22,1-sink*.23,0,0)
    c.globalAlpha=1-fade*fade
    drawCardSprite(c,unit,-w/2,-h,w,h,{combat:true,flip:hostile,pose:restingPose(performanceOf(unit) || {gesture:'thrust'},time,0,(1-progress)*.2,reduced)})
  } else if (type === 'burst' || type === 'death') {
    c.globalAlpha = Math.min(1, life * 2); const spread = (type === 'burst' ? 42 : 25) * progress
    if (type === 'burst') diamond(c, x, y, 20 + spread, 7 + spread * .3, color)
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; rect(c, x + Math.cos(a) * spread, y - 14 + Math.sin(a) * spread * .65, progress > .65 ? 2 : 4, progress > .65 ? 2 : 4, i % 2 ? color : '#ecceb3') }
  } else if (type === 'heal') { c.globalAlpha = Math.min(1, life * 3); cross(c, x + 7, y - 10 - progress * 22, 4, '#f0adbd') }
  else if (type === 'telegraph') { c.globalAlpha = .3; diamond(c, x, y, effect.radius || 62, 24, '#d6758a') }
  if (effect.text && type !== 'projectile') {
    const large = type === 'burst' && String(effect.text).length > 3, yy = y - (large ? 30 : 24) - progress * 22
    labels.push({text:effect.text,x,y:yy,size:large ? 16 : 13,color,alpha:Math.min(1,life*3)})
  }
  c.restore()
}

export function telegraph(c, mark, time, yMap, labels) {
  if (!mark) return
  const pulse=mark.mode==='pulse'
  const x = pulse?500:snap(mark.x || 500), y = snap(yMap(mark.y || 260)), rx = pulse?465:mark.radius || 100, ry = pulse?58:24, remaining = Math.max(0, mark.remaining || 0), duration = mark.duration || 3
  c.save(); c.globalAlpha = .45
  if(pulse){
    c.fillStyle='#70439b';c.fillRect(35,y-ry,930,ry*2)
    c.globalAlpha=.9;for(let i=0;i<5;i++){const xx=120+i*190;line(c,xx-18,y+12,xx-18,y-14,'#dab2ff');line(c,xx-18,y-14,xx,y-3,'#dab2ff');line(c,xx,y-3,xx+18,y-14,'#dab2ff');line(c,xx+18,y-14,xx+18,y+12,'#dab2ff')}
    c.globalAlpha=.45
  }
  for (let dx = -rx; dx < rx; dx += 10) for (let dy = -ry; dy < ry; dy += 8) if (dx * dx / (rx * rx) + dy * dy / (ry * ry) < 1 && (Math.floor(dx / 10) + Math.floor(dy / 8)) % 2 === 0) rect(c, x + dx, y + dy, 8, 6, '#a74264')
  c.globalAlpha = 1; diamond(c, x, y, rx, ry, Math.floor(time * 7) % 2 === 0 ? '#f0a0ae' : '#a54e70'); diamond(c, x, y, rx - 10, ry - 4, '#88425d')
  for (let i = 0; i < 8; i++) { const angle = i * Math.PI / 4; cross(c, x + Math.cos(angle) * rx, y + Math.sin(angle) * ry, 3, '#eaa1b0') }
  const label = `${mark.name || '猩红轰击'} ${remaining.toFixed(1)}s`
  c.font = 'bold 12px "PingFang SC", monospace'; c.textAlign = 'center'; const ww = Math.ceil(c.measureText(label).width / 2) * 2 + 16
  rect(c, x - ww / 2, y - 45, ww, 22, '#2c172b'); outline(c, x - ww / 2, y - 45, ww, 22, '#b36b81'); rect(c, x - ww / 2 + 2, y - 27, (ww - 4) * (1 - remaining / duration), 2, '#efa7b2')
  labels.push({priority:'warning',text:label,x,y:y-30,size:14,color:'#ffd5cf'}); c.restore()
}
