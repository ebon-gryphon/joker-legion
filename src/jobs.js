// One face determines one profession. The suit still determines its regiment's orders.
function job(name, skill, text, stats = {}) {
  return Object.freeze({name, skill, text, ...stats})
}
export const JOBS = Object.freeze({
  blade: job('刀兵','横扫','挥刀同时劈中身旁另一名敌人。',{atk:1.12}),
  axeman: job('战斧兵','破盾斧','斧击对持盾、巨兵和首领造成额外五成伤害。',{hp:1.12,atk:1.15}),
  duelist: job('剑客','连斩','每第三剑造成双倍伤害。',{period:.82}),
  pike: job('枪兵','贯阵','长枪穿过目标，刺中同一路径上的第二人。',{range:85}),
  hammer: job('锤卫','震击','每第三锤延后敌人的下一次攻击。',{hp:1.23}),
  cavalry: job('重骑兵','破阵冲锋','快速接敌，第一枪造成三倍伤害。',{speed:1.68, hp:1.15,range:55,mounted:true}),
  shield: job('盾卫','举盾','每第三次攻击为自己补充护盾。',{hp:1.44,atk:.92}),
  banner: job('掌旗主将','军旗','每三次攻击或治疗，为全队赋盾。',{hp:1.18}),
  sovereign: job('御前君主','王剑','斩击血量低于一半的目标时，伤害提高六成。',{atk:1.24}),
  fire: job('焰术师','引燃','每第三次攻击在目标附近引爆一圈火焰。'),
  priest: job('随军牧师','祈愈','擅长持续治疗，施术间隔更短。',{period:.82}),
  medic: job('战地医师','急救','对生命不足一半的伤员治疗量翻倍。',{speed:1.2}),
  bell: job('祝祷师','余音','治疗时，另一名伤员也获得一半治疗量。'),
  thorn: job('荆棘祭司','血契','每次治疗对附近一名敌人造成等同自身攻击的伤害。'),
  ward: job('圣盾祭司','护佑','每次治疗都给受术者附加护盾。',{hp:1.15}),
  scout: job('斥候','游射','轻装快射，移动与攻击速度更高。',{speed:1.42,period:.78}),
  archer: job('长弓手','远射','从更远距离开火，开弓第一箭伤害翻倍。',{range:275}),
  outrider: job('弩骑兵','奔射','马上疾行，每第三箭追加一支弩矢。',{speed:1.5,range:170,mounted:true}),
  assassin: job('刺客','摘首','绕开前排追击后排，首次刺击造成三倍伤害。',{range:45,speed:1.95,atk:1.35,hp:1.35}),
  crossbow: job('连弩手','连发','每第三箭追加一道弩击。',{period:.81}),
  sniper: job('神射手','点杀','优先瞄准射程内生命最少的敌人。',{range:290,atk:1.2,period:1.18}),
  frost: job('霜术师','迟滞','每两次攻击延后目标的下一次普通行动。'),
  oracle: job('占星师','星落','每第三次攻击追击全场生命最高的敌人。',{range:210}),
  mirror: job('幻刃师','镜刃','每第三击复制本次攻击，再命中同一目标。',{period:.93}),
  alchemist: job('炼金术士','溅射','攻击时药瓶碎裂，对附近另一名敌人造成额外伤害。'),
})
const faces = {
  '♠':'duelist pike blade hammer pike axeman shield cavalry duelist shield banner cavalry sovereign',
  '♥':'fire priest medic bell medic priest thorn ward bell priest banner ward bell',
  '♣':'sniper scout archer outrider scout crossbow archer assassin sniper crossbow banner outrider sniper',
  '♦':'oracle fire frost frost alchemist fire oracle mirror mirror oracle banner oracle fire',
}
export const FACE_JOBS = Object.fromEntries(Object.entries(faces).map(([suit, ids])=>[suit,ids.split(' ')]))


export const ROYAL_MARCHES = {
  '♠':{name:'玄甲铁壁',text:'全军获得双倍亲征护盾'},
  '♥':{name:'赤誓回生',text:'各人首次受击落至三成生命时，恢复三成生命'},
  '♣':{name:'逐日疾行',text:'全军普通行动间隔缩短两成'},
  '♦':{name:'群星随驾',text:'主将接下来三次行动各引落两颗追星'},
}
