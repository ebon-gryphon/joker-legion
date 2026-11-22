import { FACE_JOBS, JOBS } from './jobs.js'
export const CARD_RANKS = Object.freeze(['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'])

export const CARD_SUITS = Object.freeze([
  Object.freeze({ suit: '♠', id: 'spades', name: '黑钢王庭', title: '钢铁与誓约', color: '#9fb8e4', type: 'knight', role: '铁卫', asset: 'spades', description: '蓝钢重甲、银色兵刃与王庭纹章。近战军团负责守住前线。' }),
  Object.freeze({ suit: '♥', id: 'hearts', name: '赤誓教团', title: '烛火与圣约', color: '#ed8e98', type: 'healer', role: '牧师', asset: 'hearts', description: '赤红圣袍、象牙白甲与祈祷圣器。治疗军团维持战线。' }),
  Object.freeze({ suit: '♣', id: 'clubs', name: '逐日游骑', title: '长弓与旷野', color: '#dfae69', type: 'ranger', role: '游侠', asset: 'clubs', description: '琥珀披风、褐色皮甲与羽饰弓弩。远程军团压制来敌。' }),
  Object.freeze({ suit: '♦', id: 'diamonds', name: '星烬秘会', title: '群星与秘火', color: '#bca2ed', type: 'mage', role: '术士', asset: 'diamonds', description: '暮紫法袍、金色符文与星晶法器。秘术军团施放范围攻击。' }),
])

// Portrait identity and equipment for each printed face.
const MEMBERS = {
  spades: [
    ['玄铁誓锋', '巨剑王牌', '角饰头盔、金色翼肩与厚重巨剑，在王庭危急时现身。'],
    ['圆盾枪哨', '哨岗新卫', '敞面头盔、长矛与圆盾，守在军团的第一道岗哨。'],
    ['闭盔刀卫', '圆盾刀兵', '闭合钢盔、短刀和圆盾，在队友身前横刀护住阵脚。'],
    ['铁锤重卫', '锤盾守卫', '桶形钢盔、战锤与塔盾，留下沉稳的钢铁脚步。'],
    ['长枪卫士', '枪阵守卫', '尖顶头盔与高挑长枪，把誓言钉在前线。'],
    ['战斧戍卫', '斧盾卫士', '宽刃战斧、单侧肩甲和厚重的短斗篷。沉重的斧头擅长对付盾牌和巨兵。'],
    ['翼盔圣卫', '十字盾卫', '翼饰头盔与十字纹盾牌，站在誓约与前线之间。'],
    ['羽枪禁卫', '王城禁卫', '羽饰头盔与长柄战戟，守护王城内廷。'],
    ['霜发剑豪', '巨剑老兵', '不戴头盔的老兵，肩扛巨剑，白发在风中扬起。'],
    ['玄甲塔卫', '塔盾精锐', '玄色重盔、层叠铠甲与几乎齐身的巨型塔盾。'],
    ['王庭执旗官', '王庭统领', '高举燕尾军旗，佩着军团统领的银色徽章。'],
    ['银冠女王', '王庭女王', '银白长发、王冠与蓝色长披风，手持修长王枪。'],
    ['黑钢君王', '王庭君王', '蓄须君王戴着金冠，身披毛领王袍，握住宽阔王剑。'],
  ],
  hearts: [
    ['焰心圣使', '圣焰王牌', '火焰光环与羽形圣杖，赤誓教团的古老传说。'],
    ['烛火侍者', '持烛学徒', '白色兜帽里藏着稚气，双手护住一盏烛火。'],
    ['绷带医徒', '战地医徒', '红白围巾、药箱与成卷绷带，奔走在军团之间。'],
    ['铜铃修士', '铃杖修士', '短赤袍与铜铃杖，让祈祷伴随清亮铃声。'],
    ['赤纹药师', '圣药调配者', '瓶罐腰带和红纹面罩，怀中抱着一瓶暖色药液。'],
    ['巡礼牧师', '巡礼圣职', '高木杖、旧书与象牙色长袍，见过无数次远征。'],
    ['荆棘执事', '圣杯执事', '手持荆棘环绕的银杯，赤袍镶着细窄金边。'],
    ['圣盾祭司', '护阵祭司', '白金圆盾与赤色兜帽，始终站在战友身旁。'],
    ['白羽主教', '白羽主教', '分叉主教冠、羽饰肩披与精细雕刻的权杖。'],
    ['绯袍贤者', '祈愈贤者', '展开厚重圣典，绯红长袍上缀着象牙白符纹。'],
    ['教团典仪官', '教团统领', '高举十字圣旗，执掌教团行军中的典礼。'],
    ['赤誓圣女', '教团圣女', '细金光环与白色长发，双手托起鎏金圣杯。'],
    ['圣座大祭司', '圣座之主', '三重圣冠与红金权杖，带着沉静而坚决的神情。'],
  ],
  clubs: [
    ['逐日猎王', '日轮王牌', '日轮巨弓、金色长羽与猎王披风，追逐地平线。'],
    ['短弓斥候', '轻装斥候', '简洁皮帽、短弓与轻便箭囊，最先看见来敌。'],
    ['羽帽猎手', '羽帽游侠', '一根斜插的雉羽、旧软帽和褐色长弓。'],
    ['轻弩游骑', '持弩游侠', '皮革半甲与小巧手弩，动作利落而安静。'],
    ['猎鹰巡林者', '猎鹰游侠', '琥珀护肩上停着猎鹰，长披巾随步伐飘动。'],
    ['双弩追猎者', '双弩猎手', '双持短弩，宽腰带上挂满备用弩矢。'],
    ['长弓神射手', '长弓射手', '高于头顶的长弓与束起的长发，目光始终向前。'],
    ['狼裘伏击者', '狼裘刺客', '灰狼裘肩、深褐面巾，猎弓挂在背上，反握的匕首藏在披风下。'],
    ['金羽狙击手', '金羽神射', '金色羽饰与窄长弓身，箭囊缝着逐日纹章。'],
    ['日轮猎卫', '日轮精锐', '太阳形肩甲、重型连弩与琥珀色长披风。'],
    ['游骑统领', '游骑统领', '三尾羽冠与鹰纹军旗，指引整支游骑前进。'],
    ['荒原女王', '游骑女王', '褐金长发、骨饰王冠与弧形长弓，自旷野而来。'],
    ['逐日领主', '游骑之主', '鹿角冠、厚重猎袍与金饰巨弓，注视远方。'],
  ],
  diamonds: [
    ['星烬先知', '星火王牌', '悬浮星环、分裂晶杖与暮紫长袍，仿佛踏着星尘。'],
    ['微光学徒', '晶术学徒', '过大的尖帽与一块小晶石，试着点亮第一缕秘火。'],
    ['星砂术徒', '星砂术徒', '抱着星砂罐，短斗篷上留下零碎金点。'],
    ['晶簇咒师', '晶簇咒师', '手持分叉晶枝，紫晶肩饰清楚勾出轮廓。'],
    ['烛焰炼金士', '秘火炼金士', '铜色护目镜与试剂瓶，腰间挂着小型炼金炉。'],
    ['符页秘使', '符页法师', '展开漂浮符页，金色笔尖在空气里留下字迹。'],
    ['弯月占星师', '弯月术士', '弯月法杖、深紫面纱与缀满星点的宽袖。'],
    ['镜面幻术师', '镜面术士', '银镜面具与双面法器，让身影显得难以捉摸。'],
    ['双晶执法者', '双晶秘卫', '肩头悬着两枚晶体，金紫护甲覆盖长袍。'],
    ['星盘大法师', '星盘法师', '高举黄铜星盘，层叠衣摆织着金色轨道。'],
    ['秘会掌灯官', '秘会统领', '长柄星灯与尖角冠，替秘会照亮前行的道路。'],
    ['暮星女皇', '秘会女皇', '紫晶冠、银白长发与环形权杖，如暮星般安静。'],
    ['群星君主', '秘会之主', '宽大星冠、金纹王袍与巨型菱晶法杖。'],
  ],
}

export const CARD_CATALOG = Object.freeze(CARD_SUITS.flatMap(faction =>
  CARD_RANKS.map((rank, frame) => {
    const [name, title, description] = MEMBERS[faction.id][frame]
    const jobId = FACE_JOBS[faction.suit][frame]
    return Object.freeze({
      id: `${faction.id}-${rank}`, suit: faction.suit, rank, name, title, description,
      jobId, profession: JOBS[jobId], role: faction.role, type: faction.type, faction: faction.name,
      atlas: faction.asset, frame, color: faction.color,
      tier: rank === 'A' ? '王牌' : ['J', 'Q', 'K'].includes(rank) ? '统御' : Number(rank) >= 8 ? '精锐' : Number(rank) >= 5 ? '骨干' : '新兵',
    })
  })
))

const BY_ID = new Map(CARD_CATALOG.map(member => [member.id, member]))
const BY_FACE = new Map(CARD_CATALOG.map(member => [`${member.suit}${member.rank}`, member]))
const BY_TYPE = new Map(CARD_SUITS.map(faction => [faction.type, BY_FACE.get(`${faction.suit}2`)]))

/** Resolve a playing card, summoned unit, canonical ID, or a suit/rank pair. */
export function getCardDesign(cardOrSuit, rank) {
  if (typeof cardOrSuit === 'string') {
    if (rank !== undefined) return BY_FACE.get(`${cardOrSuit}${String(rank).toUpperCase()}`) || null
    return BY_ID.get(cardOrSuit) || BY_FACE.get(cardOrSuit) || null
  }
  if (!cardOrSuit || typeof cardOrSuit !== 'object') return null
  if (typeof cardOrSuit.appearanceId === 'string' && BY_ID.has(cardOrSuit.appearanceId)) return BY_ID.get(cardOrSuit.appearanceId)
  if (typeof cardOrSuit.suit === 'string' && cardOrSuit.rank !== undefined) {
    return BY_FACE.get(`${cardOrSuit.suit}${String(cardOrSuit.rank).toUpperCase()}`) || null
  }
  if (typeof cardOrSuit.id === 'string' && BY_ID.has(cardOrSuit.id)) return BY_ID.get(cardOrSuit.id)
  return BY_TYPE.get(cardOrSuit.type) || null
}
