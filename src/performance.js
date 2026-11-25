// Gestures, release timings and sound phrases are authored per combat identity.
// Reach and lift are measured on a 52-pixel actor. Frequencies are in Hz.
import { getCardDesign } from './cardCatalog.js'

const cast = {}
function part(id, name, gesture, mark, material, pitch, notes, windup, release, reach, lift, ink) {
  cast[id] = { id, name, gesture, mark, material, pitch, notes, windup, release, reach, lift, ink }
}
function company(prefix, ink, rows) {
  for (const [rank, ...design] of rows) part(prefix + '-' + rank, ...design, ink)
}

company('spades', '#c4d8f5', [
  ['A','誓锋断岳','cleave','blade','steel',112,[0,-12,7],.31,.42,18,5],
  ['2','圆盾探矛','thrust','point','shaft',240,[0,7],.12,.23,11,1],
  ['3','贴盾反切','sweep','blade','edge',310,[0,-5],.14,.24,8,2],
  ['4','塔前落锤','slam','hammer','anvil',102,[0,-9],.28,.35,8,8],
  ['5','长枪贯线','thrust','point','shaft',163,[7,0,-7],.23,.28,19,2],
  ['6','旋肩斧劈','cleave','fang','chop',132,[4,-8],.22,.36,13,6],
  ['7','十字盾击','bash','cross','plate',225,[0,5,12],.18,.32,11,2],
  ['8','挑戟回锋','sweep','feather','edge',200,[0,9,-3],.19,.32,15,5],
  ['9','霜刃拔斩','cleave','shard','edge',365,[12,0,-5],.26,.28,20,2],
  ['10','塔盾震地','bash','shield','anvil',82,[0,-12],.3,.44,9,1],
  ['J','燕尾挥旗','standard','banner','cloth',175,[0,2,7],.24,.43,13,6],
  ['Q','银枪点星','thrust','star','edge',390,[12,7,0],.18,.3,16,4],
  ['K','王剑敕斩','slam','blade','steel',94,[0,7,-12],.34,.47,15,9],
])
company('hearts','#ffadad',[
  ['A','展翼燃灯','rise','flame','ember',333,[0,7,16],.28,.48,12,10],
  ['2','拢烛送光','offer','flame','wick',470,[0,5],.15,.32,6,2],
  ['3','甩卷缠带','cast','ribbon','cloth',298,[5,0,3],.14,.31,13,2],
  ['4','振腕摇铃','shake','bell','bell',618,[0,7,0],.12,.38,6,3],
  ['5','倾瓶洒药','pour','drop','glass',512,[7,3,0],.2,.4,12,2],
  ['6','顿杖祈行','slam','ring','wood',192,[0,7,12],.22,.39,5,6],
  ['7','举杯引棘','offer','leaf','goblet',380,[0,3,10],.25,.44,9,5],
  ['8','旋盾祈护','bash','shield','plate',247,[0,7,14],.17,.3,10,2],
  ['9','白羽垂祝','rise','feather','flute',553,[7,4,0],.23,.47,8,8],
  ['10','翻典诵章','trace','page','paper',327,[0,5,9],.24,.46,9,3],
  ['J','圣旗引礼','standard','cross','cloth',216,[0,7,12],.26,.43,13,7],
  ['Q','双手奉杯','offer','drop','goblet',525,[0,7,12,16],.29,.51,8,7],
  ['K','圣座叩杖','slam','cross','organ',146,[0,7,12],.32,.48,8,8],
])
company('clubs','#f3ce85',[
  ['A','满月逐日','draw','sun','greatbow',139,[0,12,19],.34,.37,16,6],
  ['2','短弓速放','draw','arrow','bow',342,[0,7],.1,.22,8,1],
  ['3','侧步挑弦','draw','feather','bow',286,[5,-2],.18,.28,11,4],
  ['4','压机弹射','snap','bolt','latch',730,[0,-9],.1,.2,7,1],
  ['5','放鹰引箭','signal','wing','flute',674,[0,7,-2],.19,.38,14,7],
  ['6','交臂双发','snap','pair','latch',605,[0,3],.13,.32,12,3],
  ['7','沉肩引弓','draw','arrow','greatbow',207,[0,-5,7],.27,.32,15,2],
  ['8','伏身拔匕','crouch','fang','edge',465,[7,-3,0],.16,.27,15,2],
  ['9','金翎穿风','draw','feather','whistle',818,[0,-5,-12],.31,.3,19,3],
  ['10','轮弩连响','snap','sun','ratchet',361,[0,-2,-5],.23,.39,12,2],
  ['J','鹰旗令射','standard','wing','cloth',262,[0,7,2],.2,.37,14,6],
  ['Q','荒原回弓','sweep','arrow','bow',255,[0,5,12],.23,.36,17,5],
  ['K','鹿角开弦','draw','antler','greatbow',108,[0,7,-12],.34,.43,18,4],
])
company('diamonds','#d5b1ff',[
  ['A','星环裂光','orbit','star','crystal',414,[0,7,14,19],.3,.5,14,10],
  ['2','指尖点晶','cast','shard','glass',733,[0,3],.12,.26,7,2],
  ['3','扬罐散砂','pour','dust','sand',482,[0,7,-5],.17,.35,13,3],
  ['4','晶枝分芒','trace','shard','crystal',548,[0,4,7],.19,.35,10,5],
  ['5','掷瓶燃焰','cast','flame','ember',181,[9,0,-12],.18,.36,14,5],
  ['6','挥笔放符','trace','page','paper',441,[0,9,5],.2,.38,13,4],
  ['7','勾月引潮','sweep','moon','glass',349,[0,7,11],.24,.41,16,6],
  ['8','双镜折光','shake','mirror','crystal',658,[0,1,12],.21,.38,9,5],
  ['9','双晶交汇','orbit','pair','crystal',466,[0,7,0],.22,.42,12,7],
  ['10','星盘定轨','orbit','orbit','gear',205,[0,7,14],.28,.46,11,5],
  ['J','提灯放星','standard','flame','wick',278,[0,4,12],.22,.41,10,7],
  ['Q','暮星加冕','rise','ring','goblet',492,[0,3,10,15],.31,.5,13,9],
  ['K','群星坠印','slam','star','organ',123,[7,0,-12],.34,.5,14,9],
])
company('enemy','#eb929c',[
  ['raider','俯肩劈斧','cleave','fang','chop',155,[0,-7],.16,.28,13,3],
  ['bat','折翼俯扑','dive','wing','wing',880,[5,-12],.12,.27,17,9],
  ['archer','暗羽冷箭','crouch','arrow','bow',173,[0,-7],.23,.3,10,2],
  ['brute','碎盾重砸','slam','hammer','anvil',65,[0,-5,-12],.34,.48,12,9],
  ['warlock','血焰放逐','cast','flame','ember',131,[0,1,-7],.25,.42,13,6],
  ['bellkeeper','铜钟回摆','shake','bell','bell',196,[0,6],.22,.39,9,3],
  ['boss','王刃横扫','sweep','blade','steel',87,[0,-5,-12],.32,.45,19,6],
  ['finalBoss','命剪交错','sweep','pair','edge',166,[0,3,10],.29,.41,20,7],
  ['sever','断线裁决','cleave','pair','edge',138,[0,1,-7,12],.42,.63,24,11],
  ['pulse','王庭震荡','orbit','ring','thunder',84,[0,3,7,15],.46,.74,22,14],
  ['enraged','折冠怒斩','cleave','fang','anvil',73,[0,1,-12],.25,.42,21,8],
  ['toll','援军召唤','slam','bell','gong',98,[0,7,-12],.38,.68,9,8],
  ['bombard','猩红轰击','slam','ring','thunder',70,[0,-5,-12],.36,.64,17,10],
  ['fury','破阵轰击','slam','sun','thunder',59,[0,1,-7,-12],.32,.69,21,12],
])
company('fusion','#ffd797',[
  ['paladin','圣盾祷言','offer','shield','goblet',294,[0,7,12],.24,.55,9,6],
  ['warden','猎王重矢','draw','antler','greatbow',99,[0,-5,12],.3,.47,21,4],
  ['starblade','裂星斩','cleave','star','edge',372,[0,7,-12],.24,.49,20,8],
  ['bard','林间和声','sweep','leaf','harp',392,[0,4,7,12],.23,.58,11,5],
  ['priest','绯晶汲取','orbit','drop','crystal',311,[12,7,3,0],.26,.51,13,8],
  ['frostbow','寒弦双箭','snap','pair','whistle',585,[0,7],.19,.49,16,3],
])
export const PERFORMANCES = Object.freeze(cast)
export function bombardmentOf(mark) {
  return cast[mark.name==='断线裁决'?'enemy-sever':mark.name==='王庭震荡'?'enemy-pulse':mark.name==='破阵轰击'?'enemy-fury':'enemy-bombard']
}
export function performanceOf(unit, kind = 'attack') {
  if (kind === 'skill' && unit.fusion) return cast['fusion-' + unit.fusion]
  if (unit.side === 'enemy') {
    if (kind === 'toll') return cast['enemy-toll']
    if (unit.type==='finalBoss' && kind==='bombard')return cast['enemy-sever']
    if (unit.type==='finalBoss' && kind==='pulse')return cast['enemy-pulse']
    if (kind === 'bombard') return cast[unit.enraged || unit.hp <= unit.maxHp / 2 ? 'enemy-fury' : 'enemy-bombard']
    if (unit.type === 'boss' && (unit.enraged || unit.hp <= unit.maxHp / 2)) return cast['enemy-enraged']
    return cast['enemy-' + unit.type]
  }
  const profession={blade:'spades-3',priest:'hearts-6',pike:'spades-5',archer:'clubs-7',cavalry:'spades-8',fire:'diamonds-5',shield:'spades-10',assassin:'clubs-8',outrider:'clubs-6',duelist:'spades-9',ward:'hearts-8',sovereign:'spades-K'}
  return cast[unit.pattern && profession[unit.jobId] || getCardDesign(unit)?.id]
}
