import {addUnit} from './campArmy.js'
import {protector,specialEnemy,recordEnemy,ENEMY_RULES} from './enemyBehavior.js'
import { effect, owns, trigger, clamp, log, distance, copies } from './gameState.js'
import { restedSoldier } from './standingArmy.js'
import { applyFallenItems } from './itemEffects.js'
import { FIELD_LIMIT, MAX_ENEMIES, OLD_FIELD_LIMIT } from './campaignRules.js'
import { isBoss } from './bossRules.js'
import { recordHealing, recordDamage, recordDeath, recordItemEvent } from './combatStats.js'
import {heartOathMultiplier,recordBuildPassiveEvent} from './buildPassives.js'
import { recordBellEvent } from './playerLife.js'

export function healUnit(game, unit, amount, delay = 0, source = null) {
  if (unit.hp <= 0) return 0
  if (unit.side === 'ally') amount *= 1 + copies(game,'healer-brooch') * .02
  const unboosted=amount,multiplier=heartOathMultiplier(game,source),missing=unit.maxHp-unit.hp
  amount*=multiplier
  const restored = Math.min(unit.maxHp - unit.hp, amount)
  if(multiplier>1)recordBuildPassiveEvent(game,'heart-oath',{effective:restored>Math.min(missing,unboosted),unitId:source.id,targetIds:[unit.id],
    reason:restored>Math.min(missing,unboosted)?'牧师团治疗尝试+'+Number(((multiplier-1)*100).toFixed(4))+'%，额外收益按真实缺血截断。':'本次目标缺血不足，红桃誓约没有额外有效治疗。',
    effects:{healed:Math.max(0,restored),extraHealing:Math.max(0,restored-Math.min(missing,unboosted))}})
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
      let damage=0,shieldDamage=0
      const targetIds=game.enemies.filter(enemy=>enemy.hp>0).map(enemy=>enemy.id)
      for (const enemy of game.enemies) {
        const shield=enemy.shield || 0
        damage+=damageUnit(game, enemy, 15, 0, {system:'heart-engine',label:'荆棘圣杯'})
        shieldDamage+=shield-(enemy.shield || 0)
      }
      recordItemEvent(game,{id:'heart-engine',quantity:copies(game,'heart-engine'),triggered:true,effective:damage>0 || shieldDamage>0,
        reason:!targetIds.length?'有效治疗达到70，但当前没有存活敌军。':damage>0?'有效治疗达到70，按敌军实际生命损失结算伤害。':'本次伤害被敌方护盾吸收。',
        effects:{damage,shieldDamage,targets:targetIds.length}},
        {orderOrdinal:game.phase==='ready'?game.stats.deploys:null,targetIds})
      effect(game, 'burst', 500, 235, '荆棘共鸣', '#ef778b')
    }
  } else game.healedCharge = Math.min(69, game.healedCharge)
  return restored
}

export function damageUnit(game, unit, amount, delay = 0, source = null) {
  if (unit.hp <= 0) return 0
  if (unit.side === 'enemy' && isBoss(unit.type)) amount *= 1 + copies(game,'boss-hunter') * .03
  const flag=protector(game,unit)
  if(flag){
    const hpAndShield=unit.hp+(unit.shield || 0)
    const protectedAmount=amount*(1-ENEMY_RULES.guard)
    const prevented=Math.min(hpAndShield,amount)-Math.min(hpAndShield,protectedAmount)
    recordEnemy(game,'guard',flag,{target:unit.id,name:unit.name,amount:prevented})
    amount=protectedAmount
  }
  const hunted=source?.type==='hunter' && unit.side==='ally' && unit.type!=='knight'
  const armor=unit.side==='ally'?copies(game,'iron-rivets'):0
  const afterArmor=value=>value-Math.min(value*.3,armor)
  const baseHit=afterArmor(amount)
  amount=afterArmor(hunted?amount*(1+ENEMY_RULES.hunt):amount)
  const blocked = Math.min(unit.shield || 0, amount)
  unit.shield = Math.max(0, (unit.shield || 0) - blocked)
  const ward = unit.royalWard && amount > blocked && unit.hp - amount + blocked <= unit.maxHp*.3
  const rescue = unit.side === 'ally' && unit.lifeline && amount - blocked >= unit.hp
  const dealt = Math.min(rescue || ward ? Math.max(0,unit.hp-1) : unit.hp, amount - blocked)
  if(hunted){
    const effectiveCap=unit.hp-(ward || rescue?1:0)+(unit.shield || 0)+blocked
    recordEnemy(game,'bonus',source,{target:unit.id,name:unit.name,amount:Math.max(0,dealt+blocked-Math.min(effectiveCap,baseHit))})
  }
  unit.hp = Math.max(0, unit.hp - dealt)
  if(specialEnemy(unit.type)){
    recordEnemy(game,'hit',unit,{amount:dealt,source:source?.id || source?.system || 'system'})
    if(unit.hp===0)unit.killedInCombat=true
  }
  if(unit.side==='ally' && (source?.type==='splitter' || source?.type==='brood')){
    recordEnemy(game,'strike',source,{target:unit.id,name:unit.name,amount:dealt,absorbed:blocked,parent:source.parentId,killed:unit.hp<=0})
  }
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
          if(unit.killedInCombat && !unit.breached){
            recordEnemy(game,'kill',unit,{parent:unit.parentId})
            if(unit.type==='cantor' && unit.chanting)recordEnemy(game,'interrupt',unit)
            if(unit.type==='splitter'){
              const children=[]
              for(const offset of [-1,1]){
                const child=addUnit(game,'brood','enemy',unit.level)
                if(!child)break
                child.parentId=unit.id
                child.x=clamp(unit.x+offset*8,57,1000);child.y=clamp(unit.y+offset*6,150,350)
                child.hp=child.maxHp=Math.max(1,Math.round(unit.maxHp*ENEMY_RULES.brood))
                child.atk=Math.max(1,Math.round(unit.atk*ENEMY_RULES.brood))
                children.push(child.id);game.waveSpawned++
              }
              recordEnemy(game,'split',unit,{children,amount:children.length})
              effect(game,'burst',unit.x,unit.y-18,'分裂 ×'+children.length,unit.color)
            }
          }
          if(unit.summonedBy==='bellkeeper' && !unit.breached && !unit.timedOut)recordBellEvent(game,'bell-kill',unit)
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
