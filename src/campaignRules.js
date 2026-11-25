export const SUITS = {
  '♠': { label: '黑桃', name: '铁卫', type: 'knight', color: '#9fb8e4', icon: '♠' },
  '♥': { label: '红心', name: '牧师', type: 'healer', color: '#ed8e98', icon: '♥' },
  '♣': { label: '梅花', name: '游侠', type: 'ranger', color: '#dfae69', icon: '♣' },
  '♦': { label: '方片', name: '术士', type: 'mage', color: '#bca2ed', icon: '♦' },
}

export const JOKERS = [
  { id: 'iron-banner', name: '铁壁旗手', subtitle: '对子流', description: '含对子的牌型为本手领队或集训接收者增加 24 护盾，并为场上铁卫恢复 18 生命。', price: 7, rarity: '普通', icon: '⚑', color: '#91b8e8' },
  { id: 'red-echo', name: '红心回响', subtitle: '治疗流', description: '每张计分红心为最虚弱友军恢复 16 生命；每波首次至少两张计分红心的成功出牌，玩家生命恢复 1。满生命也消耗本波机会。', price: 7, rarity: '普通', icon: '♡', color: '#ef778b' },
  { id: 'third-act', name: '第三幕', subtitle: '回响流', description: '每第 3 次出牌，本手领队升 1 星，最高三星。', price: 8, rarity: '稀有', icon: 'Ⅲ', color: '#be9fee' },
  { id: 'blood-pact', name: '谢幕献礼', subtitle: '牺牲流', description: '友军阵亡时，最近的友军恢复 10 生命并获得 12 护盾。', price: 7, rarity: '普通', icon: '✧', color: '#ef778b' },
  { id: 'crossfire', name: '双生箭', subtitle: '远程流', description: '游侠每第 3 次攻击，对另一个敌人追加一箭，造成 80% 攻击伤害。', price: 8, rarity: '稀有', icon: '↟', color: '#80d9b0' },
  { id: 'diamond-bank', name: '贪婪镀金', subtitle: '经济流', description: '每次出牌，每张计分方片获得 1 金币（每手最多 3）；术士生命提高 20%。', price: 7, rarity: '普通', icon: '◇', color: '#d9ad6a' },
  { id: 'heart-engine', name: '荆棘圣杯', subtitle: '治疗流', description: '每累计恢复 70 点友军生命，对所有敌人造成 15 点伤害。治疗能成为武器。', price: 9, rarity: '稀有', icon: '♜', color: '#ef778b' },
  { id: 'last-laugh', name: '最后的笑声', subtitle: '牺牲流', description: '友军阵亡时，对周围敌人造成 24 点伤害，可触发连续爆炸。', price: 8, rarity: '稀有', icon: '☽', color: '#be9fee' },
  { id: 'royal-command', name: '皇家密令', subtitle: '人头流', description: '一手打出至少 3 张 J、Q、K，本手领队以三星应召。', price: 10, rarity: '传说', icon: '♛', color: '#d9ad6a' },
  { id: 'flush-crown', name: '同花王冠', subtitle: '同花流', description: '五张同花成功出牌时，战令效果提高 25%；每波首次满足条件，玩家生命恢复 1。满生命也消耗本波机会。', price: 10, rarity: '传说', icon: '♚', color: '#d9ad6a' },
  {id:'score-chalk', name:'记分粉笔', description:'每层使每手筹码 +2，再计算倍率。', price:5, color:'#f0dea1', rarity:'可叠加', stackable:true},
  {id:'pair-ink', name:'孪生墨水', description:'含对子结构的牌型，每层筹码 +3。', price:5, color:'#bdabef', rarity:'可叠加', stackable:true},
  {id:'red-thread', name:'红线线轴', description:'每张计分红心或方片，每层多给 1 筹码。', price:4, color:'#eb8997', rarity:'可叠加', stackable:true},
  {id:'drill-badge', name:'教官肩章', description:'每次主动吞噬，每层给接收者额外 1 经验。', price:5, color:'#e7bb75', rarity:'可叠加', stackable:true},
  {id:'ward-pin', name:'护阵别针', description:'每波开战，全体上阵士兵每层获得 3 护盾。', price:4, color:'#9cbede', rarity:'可叠加', stackable:true},
  {id:'gate-rivet', name:'生命铆钉', description:'每次守住一波，每层恢复 1 点玩家生命，不超过当前上限。', price:4, color:'#a1c8ad', rarity:'可叠加', stackable:true},
  {id:'field-pay', name:'分红筹码', description:'每次领到波末军饷，每层额外获得 1 金币。', price:4, color:'#e9c382', rarity:'可叠加', stackable:true},
  {id:'score-ticket', name:'金边演出票', description:'下次成功出牌自动使用一张，筹码 +10。每手只用一张。', price:3, color:'#f5ce7f', rarity:'消耗品', stackable:true, consumable:true},
  {id:'training-whistle', name:'训练哨', description:'下次主动吞噬自动消耗一枚，额外获得 3 经验。升品质时保留。', price:3, color:'#9cd7ca', rarity:'消耗品', stackable:true, consumable:true},
  {id:'black-wax',name:'黑蜡印',description:'每张计分黑桃或梅花，每层多给 1 筹码。',price:4,color:'#a5b7e3',rarity:'可叠加',stackable:true},
  {id:'straight-compass',name:'行军罗盘',description:'顺子与同花顺每层多给 4 筹码。',price:5,color:'#d8ba79',rarity:'可叠加',stackable:true},
  {id:'court-seal',name:'宫廷火漆',description:'每张计分 J、Q、K，每层多给 2 筹码。',price:5,color:'#df94a8',rarity:'可叠加',stackable:true},
  {id:'war-drum',name:'踏阵鼓',description:'每波开战，全军本波行动间隔每层缩短 1.5%。',price:6,color:'#df9678',rarity:'可叠加',stackable:true},
  {id:'healer-brooch',name:'慈愈胸针',description:'每层提高 2% 的友军治疗量。',price:5,color:'#a8ddc4',rarity:'可叠加',stackable:true},
  {id:'boss-hunter',name:'弑王箭簇',description:'对两位首领造成的伤害，每层提高 3%。',price:6,color:'#c4a8ec',rarity:'可叠加',stackable:true},
  {id:'iron-rivets',name:'衬甲铁片',description:'友军每次受伤每层少受 1 点，最多减少本次伤害的 30%。',price:5,color:'#a3bdcf',rarity:'可叠加',stackable:true},
  {id:'supply-satchel',name:'斥候挎包',description:'从下一波起，每层增加 1 次免费换牌。',price:6,color:'#b8c997',rarity:'可叠加',stackable:true},
  {id:'oath-standard',name:'合誓军旗',description:'每波开战，融合过不同职业的士兵获得自身生命上限 8% 的护盾。',price:9,color:'#bba6ed',rarity:'独有'},
  {id:'midnight-lantern',name:'迟暮提灯',description:'每波开战，敌军第一次普通行动延后 0.8 秒。首领蓄力不受影响。',price:8,color:'#e6c58b',rarity:'独有'},
  {id:'revenge-flag',name:'不落战旗',description:'每名正式友军倒下时，存活队友本波攻击与治疗各增加 2。',price:9,color:'#e78b99',rarity:'独有'},
  {id:'blade-oil',name:'磨刃油',description:'下次成功出牌自动使用一瓶，领队或集训接收者永久攻击与治疗各增加 3。',price:4,color:'#edb37f',rarity:'消耗品',stackable:true,consumable:true},
  {id:'ward-flask',name:'护阵药剂',description:'下次开战自动使用一瓶，全体上阵士兵获得 18 护盾。',price:4,color:'#94cfe3',rarity:'消耗品',stackable:true,consumable:true},
  {id:'silver-pass',name:'银边通行证',description:'下次加购出牌自动使用一张，少付 2 金币。',price:1,color:'#c4d8ea',rarity:'消耗品',stackable:true,consumable:true},
  {id:'redraw-voucher',name:'换牌券',description:'免费次数用完后，下一次换牌自动使用一张，免付 2 金币。',price:1,color:'#e1cba4',rarity:'消耗品',stackable:true,consumable:true},
]

export const DOCTRINES = [
  { id: 'iron', name: '铁壁先锋', subtitle: '对子 · 前排 · 守护', description: '高牌招刀兵守前排，对子招牧师、给领队加盾。', color: '#91b8e8', joker: 'iron-banner', icon: '♠' },
  { id: 'scarlet', name: '血色回响', subtitle: '红心 · 治疗 · 反击', description: '用红心救回残血友军。构筑治疗连锁，把持久战变成反击。', color: '#ef778b', joker: 'red-echo', icon: '♥' },
  { id: 'arcane', name: '镜牌回响', subtitle: '连打 · 复制 · 爆发', description: '每第三手获得一次强化召唤。规划顺序，让关键牌型登场。', color: '#be9fee', joker: 'third-act', icon: '♦' },
  { id: 'sleeve', name: '袖底藏牌', subtitle: '留牌 · 经济', description: '留下关键牌，为下一波凑牌型。', color: '#92bcc4', joker: 'diamond-bank', icon: '♦' },
  { id: 'voice', name: '木偶复令', subtitle: '双队 · 协同', description: '一次战令同时强化两个兵种。', color: '#df9c93', joker: 'crossfire', icon: '♣' },
  { id: 'escape', name: '活扣救援', subtitle: '救援 · 治疗', description: '把濒死的友军拉回后排，给牧师争取时间。', color: '#aaca9a', joker: 'heart-engine', icon: '♥' },
]

export const WAVES = [
  { id: 1, name: '荒野来客', title: '第一幕 · 集结', description: '流寇从右侧来袭。打出高牌招刀兵，再用对子招牧师给前排加盾。', boss: false, duration: 43 },
  { id: 2, name: '夜翼之潮', title: '第二幕 · 破风', description: '夜翼移动更快。游侠擅长截住漏过前排的敌人。', boss: false, duration: 43 },
  { id: 3, name: '碎盾先锋', title: '第三幕 · 破阵', description: '巨兵掩护鸣钟使。战前打出对子，可打断首次鸣钟。', boss: false, duration: 43 },
  { id: 4, name: '猩红仪式', title: '第四幕 · 回响', description: '敌方术士从远处施法。保住前排，战前向后排下令。', boss: false, duration: 43 },
  { id: 5, name: '王城禁卫', title: '第五幕 · 决战前夜', description: '禁卫与射手协同推进。安排兵种，保护后排。', boss: false, duration: 43 },
  { id: 6, name: '无冕之王', title: '第六幕 · 折冠之战', description: '中期首领先标记前线轰击，半血后向后排发动破阵震击。分散布阵并留盾保护治疗者，胜后继续远征。', boss: true, bossType:'boss', duration: 60 },
  { id: 7, name: '残旗追猎', title: '第七幕 · 越过王城', description: '王庭残军重新集结，夜翼掩护双路远射。培养老兵并清理鸣钟使。', boss: false, duration: 43 },
  { id: 8, name: '双钟封锁', title: '第八幕 · 破锁', description: '两名鸣钟使受巨兵保护。用猎手阵优先截断援军召唤，再补足前排。', boss: false, duration: 43 },
  { id: 9, name: '血焰长廊', title: '第九幕 · 穿火', description: '术士与射手交叉火力增强。散兵承伤或以猎手抢攻后排。', boss: false, duration: 43 },
  { id: 10, name: '黑铁重围', title: '第十幕 · 突围', description: '重甲敌兵成群推进，双钟计时更紧。融合精英与主将承担持续作战。', boss: false, duration: 43 },
  { id: 11, name: '缀命禁军', title: '第十一幕 · 最后军议', description: '皇后的禁军护住三名鸣钟使。出战前整备护盾和精英，保留主将。', boss: false, duration: 43 },
  { id: 12, name: '缀命皇后', title: '终幕 · 斩断命线', description: '最终首领轮换断线裁决与王庭震荡。分散布阵，给被标记者列盾；震荡蓄力时削去其 8% 最大生命可打断。', boss: true, bossType:'finalBoss', duration: 60 },
]

export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']

export const ALLIED = {
  knight: { name: '铁卫', icon: '♠', color: '#9fb8e4', hp: 92, atk: 10, range: 41, speed: 44, period: 1.16 },
  ranger: { name: '游侠', icon: '♣', color: '#dfae69', hp: 43, atk: 13, range: 205, speed: 40, period: 1.1 },
  healer: { name: '牧师', icon: '♥', color: '#ed8e98', hp: 51, atk: 5, heal: 16, range: 225, speed: 38, period: 1.4 },
  mage: { name: '术士', icon: '♦', color: '#bca2ed', hp: 41, atk: 20, range: 185, speed: 38, period: 1.65 },
}

// Standard recruits start at one star. This scale sets their baseline against a full enemy wave.
export const RECRUIT_STRENGTH = 2.25

export const FIELD_LIMIT = 5

export const HANDS_PER_WAVE = 3

export const MAX_ENEMIES = 40

export const OLD_FIELD_LIMIT = 35

export const STEP = 1 / 30

export const JOKER_BY_ID = Object.fromEntries(JOKERS.map(joker => [joker.id, joker]))

export const PRINTS_PER_WAVE = 4
