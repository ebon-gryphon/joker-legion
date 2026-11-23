import { effect, owns, trigger, clamp, log, distance, copies } from './gameState.js'
import { restedSoldier } from './standingArmy.js'
import { applyFallenItems } from './itemEffects.js'
import { FIELD_LIMIT, MAX_ENEMIES, OLD_FIELD_LIMIT } from './campaignRules.js'
import { isBoss } from './bossRules.js'
import { recordHealing, recordDamage, recordDeath } from './combatStats.js'

export function healUnit(game, unit, amount, delay = 0, source = null) {
  if (unit.hp <= 0) return 0
  if (unit.side === 'ally') amount *= 1 + copies(game,'healer-brooch') * .02
  const restored = Math.min(unit.maxHp - unit.hp, amount)
  if (restored <= 0) return 0
  unit.hp += restored
  recordHealing(game,unit,restored,source)
  game.stats.healed += restored
  game.healedCharge += restored
  effect(game, 'heal', unit.x, unit.y - 38, `+${Math.round(restored)}`, '#80d9b0', { life: .9+delay, maxLife: .9 })
  if (owns(game, 'heart-engine')) {
    let budget = 4
    while (game.healedCharge >= 70 && budget-- > 0) {
      game.healedCharge -= 70
      trigger(game, 'heart-engine', '治疗共鸣 · 全场 15 伤害')
      for (const enemy of game.enemies) damageUnit(game, enemy, 15, 0, {system:'heart-engine',label:'荆棘圣杯'})
      effect(game, 'burst', 500, 235, '荆棘共鸣', '#ef778b')
    }
  } else game.healedCharge = Math.min(69, game.healedCharge)
  return restored
}

export function damageUnit(game, unit, amount, delay = 0, source = null) {
  if (unit.hp <= 0) return 0
  if (unit.side === 'enemy' && isBoss(unit.type)) amount *= 1 + copies(game,'boss-hunter') * .03
  if (unit.side === 'ally') amount -= Math.min(amount * .3,copies(game,'iron-rivets'))
  const blocked = Math.min(unit.shield || 0, amount)
  unit.shield = Math.max(0, (unit.shield || 0) - blocked)
  const ward = unit.royalWard && amount > blocked && unit.hp - amount + blocked <= unit.maxHp*.3
  const rescue = unit.side === 'ally' && unit.lifeline && amount - blocked >= unit.hp
  const dealt = Math.min(rescue || ward ? Math.max(0,unit.hp-1) : unit.hp, amount - blocked)
  unit.hp = Math.max(0, unit.hp - dealt)
  recordDamage(game,unit,dealt,blocked,source)
  unit.hitTimer = .2 + delay
  unit.impactAt = game.time + delay
  if (unit.side === 'enemy') game.stats.damage += dealt
  if (dealt > 0) effect(game, 'damage', unit.x, unit.y - 33, `${Math.round(dealt)}`, unit.side === 'enemy' ? '#e5c995' : '#ef778b', { life:.65+delay, maxLife:.65, target:unit.id, amount:dealt })
  if (ward) {
    delete unit.royalWard
    healUnit(game,unit,Math.ceil(unit.maxHp*.3),delay,{system:'royal-ward',label:'赤誓回生'})
    effect(game,'burst',unit.x,unit.y,'赤誓回生','#f5a4ad')
  } else if (rescue) {
    delete unit.lifeline
    const fromX = unit.x
    const rear = game.allies.reduce((x, ally) => ally.hp > 0 ? Math.min(x,ally.x) : x, fromX)
    unit.x = clamp(Math.min(fromX-100,rear-28),60,950)
    unit.hp = 1
    unit.motion = unit.aim = null
    unit.cooldown = Math.max(.45,unit.cooldown)
    effect(game,'lifeline',fromX,unit.y,'脱身','#c9dea0',{ toX:unit.x, life:.62, maxLife:.62 })
    log(game,'活扣拉回' + unit.name + ' · 保住 1 点生命','good')
  }
  return dealt
}

export function nearest(unit, units) {
  let best = null, bestDistance = Infinity
  for (const candidate of units) {
    if (candidate.hp <= 0) continue
    const value = distance(unit, candidate)
    if (value < bestDistance) { bestDistance = value; best = candidate }
  }
  return best
}

export function settleDeaths(game) {
  // Each corpse is processed once. Secondary explosions enqueue damage, never recurse.
  let budget = FIELD_LIMIT + MAX_ENEMIES + OLD_FIELD_LIMIT
  let found = true
  while (found && budget-- > 0) {
    found = false
    for (const side of ['allies', 'enemies']) {
      const dead = game[side].filter(unit => unit.hp <= 0)
      if (!dead.length) continue
      found = true
      game[side] = game[side].filter(unit => unit.hp > 0)
      for (const unit of dead) {
        recordDeath(game,unit)
        const delay = Math.max(0, (unit.impactAt || 0) - game.time)
        effect(game, 'death', unit.x, unit.y, '', unit.color, {
          life: .24 + delay, maxLife: .24,
          fallen: unit.breached ? null : { side:unit.side, type:unit.type, suit:unit.suit, rank:unit.rank,
            pattern:unit.pattern, jobId:unit.jobId, grade:unit.grade, fusion:unit.fusion, hp:unit.hp, maxHp:unit.maxHp, level:unit.level },
        })
        if (side === 'enemies') {
          if (!unit.breached) { game.waveKills++; game.stats.kills++ }
          if (isBoss(unit.type)) {
            game.bossTelegraph = null
            if (!unit.breached) log(game, unit.name + '倒下了。清理残余敌军！', 'epic')
          }
        } else {
          if (unit.echoUntil != null) continue
          game.casualties.push(restedSoldier(unit))
          game.stats.lost++
          applyFallenItems(game)
          if (owns(game, 'blood-pact')) {
            const ally = nearest(unit, game.allies)
            if (ally) {
              trigger(game, 'blood-pact', '生命 +10 · 护盾 +12')
              healUnit(game, ally, 10, 0, {system:'blood-pact',label:'谢幕献礼'})
              ally.shield += 12
            }
          }
          if (owns(game, 'last-laugh')) {
            const targets = game.enemies.filter(enemy => distance(unit, enemy) <= 125)
            if (targets.length) {
              trigger(game, 'last-laugh', `谢幕爆炸 · 命中 ${targets.length} 人`)
              for (const enemy of targets) damageUnit(game, enemy, 24, 0, {system:'last-laugh',label:'最后的笑声'})
              effect(game, 'burst', unit.x, unit.y, '谢幕', '#be9fee')
            }
          }
        }
      }
    }
  }
}
