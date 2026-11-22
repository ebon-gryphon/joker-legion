import { QUALITIES } from './quality.js'

export const QUALITY_OUTFITS = [
  {name:'灰布', detail:'短罩衣与旧革腰带，布帽贴肩。'},
  {name:'青铃', detail:'双角青帽，翡翠短披肩扣一枚铜铃。'},
  {name:'蓝翎', detail:'白翎斜帽、靛蓝绣带与银肩甲。'},
  {name:'紫绶', detail:'紫绒双尖帽，银菱纹长披风。'},
  {name:'金冕', detail:'金冠配猩红王氅，白鼬领压住金胸甲。'},
  {name:'月相', detail:'弯月银冠、叠羽肩甲与月白长礼衣。'},
  {name:'虹晶', detail:'多棱晶冠与折光肩铠，金丝连起七彩衣摆。'},
]

// The repeated rank records the scored face, independently of the soldier's uniform.
export const REPEATED_FACES = {
  pair:{copies:2,suit:'♥'}, three:{copies:3,suit:'♣'},
  fullHouse:{copies:3,suit:'♠'}, flushHouse:{copies:3,suit:'♥'},
}

// This order also indexes the assembled sprite sheet.
export const UNIFORM_ROLES = [
  'high','pair','twoPair','three','straight','flush','fullHouse','four',
  'straightFlush','five','flushHouse','flushFive',
  'paladin','warden','starblade','bard','priest','frostbow','footCrossbow',
]
const jobRoles = {
  blade:'high', axeman:'high', duelist:'five', pike:'twoPair', hammer:'fullHouse',
  cavalry:'straight', shield:'fullHouse', banner:'flushFive', sovereign:'flushFive',
  priest:'pair', medic:'pair', bell:'pair', thorn:'flushHouse', ward:'flushHouse',
  archer:'three', scout:'three', sniper:'three', crossbow:'footCrossbow', outrider:'straightFlush',
  assassin:'four', fire:'flush', oracle:'flush', mirror:'flush', frost:'flush', alchemist:'flush',
}
export const uniformRoleForJob = job => jobRoles[job] || 'high'
const defaultRoles = {knight:'high', healer:'pair', ranger:'three', mage:'flush'}

export function outfitFrame(role,grade = 0) {
  const row = UNIFORM_ROLES.indexOf(role)
  if (row < 0 || !QUALITIES[grade]) return null
  return {atlas:'uniforms', frame:row * QUALITIES.length + grade, row, column:grade}
}

export function soldierFrame(unit) {
  if (!unit.pattern && unit.side !== 'ally' && !(unit.fusion && unit.grade != null)) return null
  return outfitFrame(unit.fusion || unit.pattern || jobRoles[unit.jobId] || defaultRoles[unit.type],unit.grade ?? 0)
}
