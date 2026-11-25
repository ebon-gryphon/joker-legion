import { isBoss } from './bossRules.js'
// The king uses the original royal atlas; the queen has a separate authored pose sheet.
export const ENEMY_CATALOG = {
  raider: { frame: 0, width: 51, height: 51, role: '近战突进', wave: 1,
    attack: '流寇要走到跟前才能挥斧。一个人威胁有限，成群突破防线时很难收拾。', counter: '先招黑桃铁卫挡住去路，让后排安心输出。' },
  bat: { frame: 1, width: 61, height: 36, role: '快速近战', wave: 2,
    attack: '夜翼是七类敌军中移动最快的，交战也最频繁。前线一旦出现缺口，它们很快就能突破防线。', counter: '在铁卫身后留一队梅花游侠，提早射击靠近的夜翼。' },
  archer: { frame: 2, width: 57, height: 54, role: '后排射击', wave: 2,
    attack: '暗弓手进入射程就停步放箭。前排交战越久，它能射出的箭就越多。', counter: '用猎手阵，让游侠和术士优先攻击射程内的敌方后排。' },
  brute: { frame: 3, width: 71, height: 68, role: '近身溅射', wave: 1,
    attack: '重锤落下时，目标身边最多两名战友也会受伤。碎盾巨兵走得慢，普通敌兵中只有鸣钟使比它更耐打。', counter: '用散兵阵减少溅射，趁巨兵走近前让远程多打几轮。' },
  warlock: { frame: 4, width: 57, height: 58, role: '远程溅射', wave: 4,
    attack: '猩红术士的施法距离比暗弓手更远。法术击中一人，也会波及附近最多两名战友。', counter: '远程兵多时用猎手阵集火。前排容易成片倒下时，散兵阵能减轻溅射。' },
  bellkeeper: { frame: 5, width: 62, height: 61, role: '鸣钟召唤援军', wave: 3,
    attack: '入场即开始蓄力，首次八秒。鸣钟会从右侧召唤一名流寇援军；援军可被击退，也会真实突破或在超时时结算。响过一次或被打断后，隔十六秒再次尝试。', counter: '战前打出对子或更高牌型。最早的一次鸣钟召唤会被自动打断，之后要靠部队击败鸣钟使。' },
  boss: { frame: 6, width: 101, height: 91, role: '中期首领 · 前后排轰击', wave: 6, boss:true,
    attack: '猩红轰击先标记前线，三秒后命中该区域。半血后转为破阵轰击，标记后排并推迟被命中者的下次行动。首领突破或限时未击败会直接结束远征。', counter: '出战前分散站位。散兵阵减少轰击伤害；预留对子给被标记的兵种加盾。第六波击败他后继续第七波。' },
  finalBoss: { atlas:'queen-motion', frame: 0, width: 108, height: 98, role: '最终首领 · 裁决与全军震荡', wave: 12, boss:true,
    attack: '断线裁决标记战力最高者，3.2 秒后打击落点。王庭震荡蓄力四秒后攻击全军，半血后伤害提升 20%。突破或超时会直接失守。', counter: '分散站位并给裁决目标列盾。震荡蓄力时削去首领 8% 最大生命即可打断；未打断时带盾者额外减伤 50%，散兵阵也能减伤。' },
}
export const KING_ENRAGED_FRAME = 7
export function enemyFrame(type, enraged = false) {
  if(type==='finalBoss')return 0
  return isBoss(type) && enraged ? KING_ENRAGED_FRAME : ENEMY_CATALOG[type]?.frame ?? 0
}
