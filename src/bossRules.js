// Shared identity and telegraph rules keep both royal encounters consistent.
export const BOSS_TYPES = ['boss', 'finalBoss']
export function isBoss(type) { return BOSS_TYPES.includes(type) }

export const BOSS_SKILLS = {
  scarlet: { name:'猩红轰击', mode:'blast', damage:90, radius:116, duration:3,
    counter:'锁定前线落点；散兵阵减伤，护盾可抵挡轰击。' },
  rupture: { name:'破阵轰击', mode:'rupture', damage:120, radius:100, duration:3.4,
    counter:'锁定后排并震退行动；提前给后排列盾，散兵阵减伤。' },
  sever: { name:'断线裁决', mode:'sever', damage:175, radius:84, duration:3.2,
    counter:'锁定战力最高者的落点；分散站位，给目标兵种列盾。' },
  court: { name:'王庭震荡', mode:'pulse', damage:150, radius:900, duration:4,
    counter:'全军冲击；蓄力时打掉首领 8% 最大生命可打断，带盾者额外减伤 50%。' },
}

export function bossSkill(type, enraged, cast = 0) {
  if (type === 'finalBoss') return BOSS_SKILLS[cast % 2 ? 'court' : 'sever']
  return BOSS_SKILLS[enraged ? 'rupture' : 'scarlet']
}
