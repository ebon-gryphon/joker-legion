import { C, rect, diamond, line, hash, cross, snap, glyph } from './pixelDrawing.js'
import { getSpriteFrame, drawCardSprite } from './spriteAtlas.js'
import { FUSION_BY_ID } from './forge.js'
import { PERFORMANCES, bombardmentOf, performanceOf } from './performance.js'
import { actionPose, walkingPose, restingPose, paintGesture } from './choreography.js'
import { ENEMY_CATALOG } from './enemyCatalog.js'
import { BELL_WINDUP } from './tactics.js'
import { gradeOf } from './quality.js'
import { isBoss } from './bossRules.js'
import { HOSTILE } from './tactics.js'
import { displayName } from './soldierIdentity.js'
import { paintUnitPresentation } from './battlefieldPresentation.js'
import { CROWN } from './battlefieldScenery.js'

const FACTION = { spades: C.steel, hearts: C.red, clubs: C.amber, diamonds: C.violet }

function fallbackAlly(c, type, x, y, color) {
  rect(c, x - 8, y - 32, 16, 23, '#171524'); rect(c, x - 6, y - 30, 12, 19, color); rect(c, x - 6, y - 44, 12, 14, '#d6c4b4'); rect(c, x - 9, y - 46, 18, 7, color)
  rect(c, x - 8, y - 10, 6, 10, '#80728b'); rect(c, x + 3, y - 10, 6, 10, '#80728b')
  if (type === 'knight') { rect(c, x - 14, y - 28, 9, 17, '#c0b292'); rect(c, x + 12, y - 40, 3, 28, '#ddd6b4') }
  else if (type === 'healer' || type === 'mage') { rect(c, x + 12, y - 42, 3, 40, '#c6aa77'); diamond(c, x + 13, y - 43, 5, 6, color) }
  else { line(c, x + 10, y - 34, x + 17, y - 22, '#d2ae7c'); line(c, x + 17, y - 22, x + 10, y - 12, '#d2ae7c') }
}

export function drawUnit(c, unit, sample, time, lag, yMap, enemyArt, cameraTop, inCamp, orderTarget, gameTime, reduced, mark, selectedUnit, targetSide, labels, presentation = null) {
  const enemy = unit.side === 'enemy', boss = isBoss(unit.type), frame = getSpriteFrame(unit), faction = FUSION_BY_ID[unit.fusion]?.color || FACTION[frame.atlas] || unit.color || C.steel
  const walk = sample.walking, walkingFrame = Math.floor(time * 7 + hash(unit.id) * 8) % 4
  const flying = unit.type === 'bat'
  const bob = flying ? -6 + (walkingFrame % 2 ? -2 : 0) : walk && walkingFrame % 2 ? -2 : 0
  const motion = unit.motion, aim = unit.aim
  let profile = PERFORMANCES[motion?.profile], direction = enemy ? -1 : 1
  let pose = profile && actionPose(profile,gameTime-motion.at+profile.windup,motion.kind,reduced)
  if (pose) direction = motion.direction
  else if (aim && PERFORMANCES[aim.profile]) {
    profile = PERFORMANCES[aim.profile]; direction = aim.direction
    pose = actionPose(profile,profile.windup-(aim.until ?? unit.cooldown)-lag,aim.kind,reduced)
  }
  const special = boss && mark ? bombardmentOf(mark) : unit.type==='bellkeeper' ? PERFORMANCES['enemy-toll'] : null
  const remaining = (boss ? mark?.remaining : unit.bellTimer) + lag
  if (special && remaining>0 && remaining<=special.windup) {
    profile=special; direction=-1
    pose=actionPose(profile,profile.windup-remaining,boss?'bombard':'toll',reduced)
  }
  const stance = !pose && performanceOf(unit)
  const phase = hash(unit.id)*6
  const normalBody = pose || (stance && (walk && !flying ? walkingPose(stance,time,phase,reduced) : restingPose(stance,time,phase,unit.hitTimer,reduced)))
  const body=(!pose && presentation?.pose) || normalBody
  const artworkUnit=presentation?.pending?{...unit,grade:0}:unit
  const hitAge = gameTime - unit.impactAt
  const hit = Number.isFinite(hitAge) && hitAge >= 0 && hitAge < .18
  const recoil = hit && !reduced ? Math.sin(Math.PI*hitAge/.18)*(1-hitAge/.18)*(boss || unit.type==='brute' ? 3 : 6) : 0
  const x = Math.round(sample.x + (enemy ? 1 : -1)*recoil)
  const royal = ['A', 'J', 'Q', 'K'].includes(unit.rank), hostile = ENEMY_CATALOG[unit.type]
  const mounted = !unit.fusion && ['cavalry','outrider'].includes(unit.jobId)
  const height = hostile?.height ?? (unit.fusion || mounted ? 65 : 49 + Math.min(2, (unit.level || 1) - 1) * 3 + (unit.grade >= 4 ? 3 : 0))
  const width = hostile?.width ?? (mounted ? 78 : unit.fusion ? 64 : 54)
  const ground = yMap(sample.y)
  const y = Math.round(boss ? Math.max(ground, cameraTop + height + 26) : ground)
  rect(c, x - width * .3, y - 1, width * .6, 4, '#12131f'); rect(c, x - width * .4, y - 2, width * .8, 2, '#161420')
  paintUnitPresentation(c,unit,presentation,x,y,width,height)
  if (unit.grade >= 5 && !presentation?.pending) {
    diamond(c,x,y+1,24,7,gradeOf(unit).color)
    cross(c,x+15,y-height+5,3,gradeOf(unit).color)
  }
  if (unit.fusion) diamond(c, x, y, 20, 6, faction)
  const selectable = targetSide === unit.side || (inCamp && !enemy)
  const bounds = selectable ? { id:unit.id, side:unit.side, left:x-width/2, right:x+width/2, top:y-height, bottom:y+3 } : null
  if (targetSide === unit.side) diamond(c,x,y,22,6,enemy ? '#f2a39a' : '#d6c2fc')
  if (unit.echoUntil != null) {
    diamond(c,x,y,19,5,'#be92ea')
    cross(c,x+12,y-height*.8,3,'#ddc4ff')
  }
  if (!enemy && (unit.type === orderTarget || unit.id === selectedUnit)) diamond(c, x, y + 1, 23, 7, '#ffe2a0')
  if (sample.scouted) {
    const mast = x - width * .4
    line(c,mast,y-height-12,mast,y-height+5,'#efd3a1')
    rect(c,mast+1,y-height-12,10,5,'#aa444a')
    rect(c,mast+1,y-height-7,6,2,'#db7665')
  }
  if (unit.shield > 0 && !enemy && unit.type === 'healer') {
    // Keep the ward at the feet, clear of the healer's staff and sleeve.
    diamond(c,x,y+1,Math.round(width*.33),4,hit ? '#efffff' : '#86bac0')
  } else if (unit.shield > 0) {
    const edge = x + direction * width * .42, mid = y - height * .42
    const tint = hit ? '#fff1c7' : '#c9b48b'
    line(c, edge - direction * 4, mid - 11, edge, mid - 6, tint)
    line(c, edge, mid - 5, edge, mid + 3, tint)
    line(c, edge, mid + 4, edge - direction * 5, mid + 9, tint)
  }
  c.save()
  if (unit.echoUntil != null) c.globalAlpha = .63
  const wingLift = 0
  const drawn = drawCardSprite(c,artworkUnit,x-width/2+wingLift,y+(body ? 0 : bob)-height-wingLift,
    width-2*wingLift,height+wingLift,{combat:true,pose:body?{...body,clock:time,phase,flinch:hit && !reduced?1-hitAge/.18:0}:body,flip:direction<0,flash:hit && !reduced && hitAge<.05 ? .28 : 0})
  if (!drawn && enemy) {
    const sprite = enemyArt.get(unit.type) || enemyArt.get('raider')
    c.translate(x, y + bob); c.scale(-1, 1); c.drawImage(sprite, -width / 2, -height, width, height)
    if (hit && !reduced && hitAge<.05) { c.globalAlpha = .25; c.drawImage(enemyArt.get(`${unit.type}-flash`) || enemyArt.get('raider-flash'), -width / 2, -height, width, height) }
  } else if (!drawn) fallbackAlly(c, unit.type, x, y + bob, faction)
  if(drawn && presentation && !presentation.pending && (presentation.reveal || presentation.flash)){
    c.save();c.globalCompositeOperation='screen';c.globalAlpha=Math.max(presentation.reveal*.20,presentation.flash*.12)
    drawCardSprite(c,artworkUnit,x-width/2,y-height,width,height,{combat:true,pose:body?{...body,clock:time,phase}:body,flip:direction<0})
    c.restore()
  }
  c.restore()
  paintUnitPresentation(c,unit,presentation,x,y,width,height,{layer:'over'})
  if (unit.lifeline) {
    const knotX = x - width * .32, knotY = y - height * .54
    diamond(c,knotX-3,knotY,4,3,'#e8bf75')
    diamond(c,knotX+3,knotY,4,3,'#ffe5a7')
    line(c,knotX,knotY+1,knotX-5,knotY+10,'#c29058')
  }
  if (pose) paintGesture(c,profile,pose,x,y,height,direction)
  const ratio = Math.max(0, Math.min(1, (unit.hp + sample.pendingDamage) / Math.max(1, unit.maxHp || unit.hp || 1))), barWidth = boss ? 66 : enemy && unit.type === 'brute' ? 32 : 26
  if (!inCamp && ratio === 1 && !boss && unit.type !== 'bellkeeper' && !unit.command && !unit.crowned && !unit.fusion && !unit.standard) return bounds
  const barY = Math.max(cameraTop + 6, y - height - (flying ? 15 : enemy ? 8 : 14))
  rect(c, x - barWidth / 2 - 2, barY - 2, barWidth + 4, boss ? 9 : 7, '#0e0e19'); rect(c, x - barWidth / 2, barY, barWidth, boss ? 5 : 3, '#3f293b')
  if (ratio > 0) rect(c, x - barWidth / 2, barY, Math.max(2, Math.floor(barWidth * ratio / 2) * 2), boss ? 5 : 3, enemy ? '#d4778c' : faction)
  if (unit.type === 'bellkeeper' && unit.bellTimer <= BELL_WINDUP) {
    rect(c, x - barWidth / 2, barY + 5, barWidth, 3, '#503c35')
    const charged = Math.max(0, 1 - unit.bellTimer / BELL_WINDUP)
    if (charged > 0) rect(c, x - barWidth / 2, barY + 5, barWidth * charged, 3, '#ffca7f')
  }
  c.textAlign = 'center'
  if (!enemy) {
    const label = presentation?.pending?'正在集结':displayName(unit)
    if (unit.locked) {
      const lockX=snap(x+barWidth/2+4)
      rect(c,lockX+1,barY-5,5,4,'#f3c977');rect(c,lockX+2,barY-4,3,3,'#322734')
      rect(c,lockX,barY-2,7,6,'#f5d38b');rect(c,lockX+3,barY,1,3,'#413140')
    }
    labels.push({unit:unit.id,text:label,x,y:barY-4,size:12,color:presentation?.pending?'#cfc3cb':unit.grade ? gradeOf(unit).color : (royal || unit.standard ? '#ffdc96' : '#f6f0e6')})
  }
  if (unit.fusion) {
    for (let i = 0; i < 3; i++) rect(c, x - 8 + i * 6, barY + 5, 4, 2, i < unit.skillCharge ? faction : '#585064')
  }
  if (unit.crowned || unit.command || unit.standard) glyph(c, x - 7, snap(barY - 27), CROWN, unit.crowned || unit.standard ? '#ffdf91' : '#c6bedf', 2)
  else if (boss) labels.push({text:HOSTILE[unit.type]?.name || '首领',x,y:barY-6,size:14,color:'#ffd4ce'})
  return bounds

}
