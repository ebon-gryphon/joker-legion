import {quarry,recordEnemy,advanceRite} from './enemyBehavior.js'
import {endlessScale} from './endless.js'
import { CAMP_AREA } from './formation.js'
import { distance, clamp, effect, owns, trigger, log } from './gameState.js'
import { damageUnit, healUnit, nearest } from './combatHealth.js'
import { performanceOf, bombardmentOf } from './performance.js'
import { veteranLevel, LESSONS } from './training.js'
import { isBackline, BELL_INTERVAL, BELL_SUMMON } from './tactics.js'
import { FUSION_BY_ID } from './forge.js'
import { LURE_REVEAL, LURE_TRAVEL } from './performers.js'
import { FEINT } from './battlePlans.js'
import { isBoss, bossSkill, BOSS_SKILLS } from './bossRules.js'
import { professionJobs, inheritedProfessionJobs } from './professionFusion.js'
import { recordGateDamage } from './combatStats.js'
import { addUnit } from './campArmy.js'
import { losePlayerLife, recordBellEvent } from './playerLife.js'
import { applyBuildPassiveAttack } from './buildPassives.js'

function moveUnit(unit, target, dt, direction) {
  if (target) {
    const dx = target.x - unit.x, dy = target.y - unit.y
    const dist = distance(unit, target) || 1
    const step = Math.min(unit.speed * dt, Math.max(0, dist - unit.range * 0.84))
    unit.x += dx / dist * step
    unit.y += dy / dist * step
  } else {
    unit.x += unit.speed * dt * direction
    if (direction === 1) unit.x = Math.min(835, unit.x)
  }
  unit.y = clamp(unit.y, CAMP_AREA.top, CAMP_AREA.bottom)
}

function formationDamage(game, target, amount, area, delay = 0, source = null) {
  const fraction = area && game.formation === 'spread' ? .6 :
    !area && game.formation === 'guard' && target.type === 'knight' ? .8 : 1
  const remaining = target.hp + (target.shield || 0)
  game.tacticsReport.prevented += Math.min(remaining, amount) - Math.min(remaining, amount * fraction)
  damageUnit(game, target, amount * fraction, delay, source)
}

function perform(game, unit, kind, target, onAction, profile = performanceOf(unit, kind)) {
  if (!profile) return
  const direction = Math.sign((target?.x ?? unit.x) - unit.x) || (unit.side === 'enemy' ? -1 : 1)
  // A special can coincide with its triggering basic attack on this simulation step.
  const previous = unit.motion
  if (previous && previous.at === game.time && ['toll','bombard','skill'].includes(previous.kind)) return
  unit.motion = { profile: profile.id, kind, at: game.time, direction }
  onAction?.({ actor: unit.id, profile: profile.id, kind, x: unit.x })
}

function anticipate(unit, kind, target, until = unit.cooldown) {
  if (!target || until <= 0) return
  const profile = performanceOf(unit,kind)
  if (profile && until <= profile.windup) {
    unit.aim = { profile: profile.id, kind, until, direction: Math.sign(target.x-unit.x) || (unit.side === 'enemy' ? -1 : 1) }
  }
}

function launchMissile(game, unit, target, kind = 'attack', color = unit.color) {
  const flight = Math.max(.07, Math.min(.24, distance(unit, target) / 800))
  effect(game, 'projectile', target.x, target.y - 20, '', color, {
    profile: performanceOf(unit, kind)?.id, kind, sourceType: unit.type,
    fromX: unit.x, fromY: unit.y - 23, targetX: target.x, targetY: target.y - 20,
    life: flight, maxLife: flight,
  })
  return flight
}

function applyLessons(game,unit,healing) {
  if (!unit.lessons?.length) return
  const report = game.waveReport[unit.type]
  for (const type of unit.lessons) {
    if (professionJobs(unit).includes(type)) continue
    const lesson = LESSONS[type]
    if (lesson.opening ? unit.attacks !== 1 : unit.attacks % 3 !== 0) continue
    if (type === 'knight' || type === 'shield') unit.shield += Math.ceil(unit.maxHp * .04)
    else if (['healer','priest','ward'].includes(type)) {
      const friend = game.allies.filter(a => a.hp > 0 && (type==='ward' || a.hp < a.maxHp)).sort((a,b) => a.hp/a.maxHp-b.hp/b.maxHp)[0]
      if (!friend) continue
      if (type === 'ward') friend.shield += 6 + Math.round(unit.atk*.10)
      else report.healed += healUnit(game,friend,6 + Math.round(unit.atk*.15), 0, unit)
    } else {
      const range = lesson.reach || Math.max(170,unit.range + 35)
      const foes = game.enemies.filter(e => e.hp > 0 && distance(unit,e) <= range && (!lesson.execute || e.hp < e.maxHp*.5))
        .sort((a,b) => lesson.weakest ? a.hp-b.hp : distance(unit,a)-distance(unit,b))
      const targets = foes.filter(e=>!lesson.line || Math.abs(e.y-foes[0].y)<27).slice(0,lesson.targets || (type==='mage' ? 2 : 1))
      if (!targets.length) continue
      for (const foe of targets) {
        const dealt = damageUnit(game,foe,Math.round(unit.atk*(lesson.power || (type === 'mage' ? .2 : .3))),launchMissile(game,unit,foe), unit)
        if (healing) report.damage += dealt
      }
    }
    effect(game,'burst',unit.x,unit.y-15,LESSONS[type].name,unit.color)
  }
}

function professionAction(game, unit, target, healing, flight) {
  applyLessons(game,unit,healing)
  if (unit.grade >= 5 && unit.attacks === 1) {
    const shield = Math.ceil(unit.maxHp * (unit.grade === 5 ? .15 : .20))
    for (const ally of game.allies) if (ally.hp > 0) ally.shield += shield
    effect(game,'burst',unit.x,unit.y-18,unit.grade === 5 ? '神话号令' : '棱彩号令',unit.color)
  }
  if (unit.legendGuard) {
    delete unit.legendGuard
    const shield=Math.ceil(unit.maxHp*.12)
    for (const ally of game.allies) if (ally.hp>0) ally.shield+=shield
    effect(game,'burst',unit.x,unit.y-12,'传说号令','#ffcd75')
  }
  const jobs = professionJobs(unit), third = unit.attacks % 3 === 0
  const enemies = game.enemies.filter(e => e.hp > 0)
  if (unit.royalStars > 0 && enemies.length) {
    unit.royalStars--
    const foes = enemies.slice().sort((a,b)=>b.hp-a.hp)
    for (const foe of [foes[0],foes[1] || foes[0]]) {
      const dealt = damageUnit(game,foe,unit.atk*.7,launchMissile(game,unit,foe,'attack','#cca2ff'), unit)
      if (healing) game.waveReport[unit.type].damage += dealt
    }
  }
  const healJobs = ['priest','medic','bell','thorn','ward']
  let friend = healing ? target : null
  if (!healing && jobs.some(id => healJobs.includes(id))) {
    friend = game.allies.filter(a=>a.hp>0 && a.hp<a.maxHp && distance(unit,a)<=Math.max(225,unit.range))
      .sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0]
    if (friend) {
      const boost = jobs.includes('medic') && friend.hp < friend.maxHp*.5 ? 2 : 1
      game.waveReport[unit.type].healed += healUnit(game,friend,unit.heal * boost * (game.formation==='spread'?.8:1),flight, unit)
    }
  }
  let foe = healing ? null : target
  const extraDamageBefore = game.stats.damage
  // A fused healer keeps healing, and its inherited weapon can still strike in reach.
  if (healing && inheritedProfessionJobs(unit).some(id=>!healJobs.includes(id))) {
    foe = nearest(unit,enemies)
    if (foe && distance(unit,foe)<=unit.range+5) damageUnit(game,foe,professionDirect(unit,foe),launchMissile(game,unit,foe), unit)
    else foe = null
  }
  for (const id of jobs) {
    if (id === 'banner' && third) {
      for (const ally of game.allies) ally.shield += Math.ceil(unit.maxHp * .055)
      effect(game,'burst',unit.x,unit.y,'军旗','#ecc87c')
    }
    if (friend) {
      if (id === 'ward') friend.shield += Math.ceil(unit.heal * .4)
      if (id === 'bell') {
        const other = game.allies.filter(u => u !== friend && u.hp > 0 && u.hp < u.maxHp).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0]
        if (other) game.waveReport[unit.type].healed += healUnit(game,other,unit.heal*.5,flight, unit)
      }
      if (id === 'thorn') {
        const victim = nearest(unit,enemies)
        if (victim && distance(unit,victim) <= unit.range+35) {
          const dealt = damageUnit(game,victim,unit.atk,flight, unit)
        }
      }
    }
    if (foe) {
      if (id === 'shield' && third) unit.shield += Math.ceil(unit.maxHp * .13)
      if ((id === 'hammer' && third) || (id === 'frost' && unit.attacks % 2 === 0)) foe.cooldown = Math.max(foe.cooldown,.95)
      if (third && ['crossbow','outrider','mirror'].includes(id) && foe.hp > 0) damageUnit(game,foe,unit.atk,flight+.12, unit)
      if (id === 'oracle' && third && enemies.length) {
        const victim = enemies.reduce((best,e)=>e.hp>best.hp?e:best)
        damageUnit(game,victim,unit.atk,launchMissile(game,unit,victim,'attack','#d3a5ff'), unit)
      }
      if (['pike','blade','alchemist'].includes(id) || (id === 'fire' && third)) {
        const nearby = enemies.filter(e => e !== foe && (id === 'pike' ?
          Math.abs(e.y-foe.y)<27 && e.x >= foe.x-5 && e.x-foe.x<95 : distance(e,foe)<78))
          .sort((a,b)=>distance(a,foe)-distance(b,foe)).slice(0,id === 'fire' ? 3 : 1)
        for (const e of nearby) damageUnit(game,e,unit.atk*.8,flight, unit)
      }
    }
  }
  if (healing) game.waveReport[unit.type].damage += game.stats.damage - extraDamageBefore
  // A trained champion can sustain a solo offensive, even on a healing turn.
  if (third && unit.id === game.champion?.unitId && veteranLevel(unit.trainingXp) >= 4) {
    const foes = enemies.filter(e => e.hp>0 && distance(unit,e)<Math.max(140,unit.range+20)).slice(0,4)
    for (const e of foes) {
      const dealt = damageUnit(game,e,unit.atk*.85,flight, unit)
      if (healing) game.waveReport[unit.type].damage += dealt
    }
    if (foes.length) {
      healUnit(game,unit,unit.maxHp*.08, 0, unit)
      effect(game,'burst',unit.x,unit.y,'将威','#ffd888')
    }
  }
}

function professionDirect(unit, target) {
  const jobs = professionJobs(unit)
  let direct = unit.atk
  if (unit.attacks === 1) {
    if (jobs.includes('cavalry') || jobs.includes('assassin')) direct *= 3
    else if (jobs.includes('archer')) direct *= 2
  }
  if (jobs.includes('axeman') && (target.shield > 0 || target.type === 'brute' || isBoss(target.type))) direct *= 1.5
  if (jobs.includes('duelist') && unit.attacks % 3 === 0) direct *= 2
  if (jobs.includes('sovereign') && target.hp < target.maxHp*.5) direct *= 1.6
  return direct
}

function attack(game, unit, target, onAction) {
  perform(game, unit, 'attack', target, onAction)
  const damageBefore = game.stats.damage
  unit.cooldown = unit.period
  unit.attackTimer = 0.22
  unit.attacks++
  const flight = unit.range > 100 ? launchMissile(game, unit, target) : 0
  const jobs = professionJobs(unit)
  let direct = professionDirect(unit,target)
  if (unit.attacks===1 && jobs.some(id=>['cavalry','assassin','archer'].includes(id)))
    effect(game,'burst',target.x,target.y,jobs.includes('assassin')?'摘首':jobs.includes('cavalry')?'冲锋':'远射',unit.color)
  if (unit.side === 'ally' && game.formation === 'hunt' && ['mage', 'ranger'].includes(unit.type) && isBackline(target.type)) {
    const beforeFormation = direct
    direct *= 1.3
    const remaining = target.hp + (target.shield || 0)
    game.tacticsReport.extraDamage += Math.min(remaining, direct) - Math.min(remaining, beforeFormation)
  }
  if (unit.side === 'enemy') formationDamage(game, target, direct, false, flight, unit)
  else damageUnit(game, target, direct, flight, unit)
  if(unit.side==='ally')applyBuildPassiveAttack(game,unit,target,{damageUnit,launchMissile})
  if (unit.side === 'ally' && unit.type === 'mage') {
    const extras = game.enemies.filter(enemy => enemy.id !== target.id && enemy.hp > 0 && distance(enemy, target) < 85).slice(0, 2)
    for (const enemy of extras) damageUnit(game, enemy, unit.atk * 0.55, flight, unit)
    effect(game, 'burst', target.x, target.y, '', '#d9ad6a', { life: .4+flight, maxLife: .4 })
  }
  if (unit.side === 'enemy' && (['brute', 'warlock'].includes(unit.type) || isBoss(unit.type))) {
    const radius = unit.type === 'brute' ? 58 : 92
    const extras = game.allies.filter(ally => ally.id !== target.id && ally.hp > 0 && distance(ally, target) < radius).slice(0, isBoss(unit.type) ? 4 : 2)
    for (const ally of extras) formationDamage(game, ally, unit.atk * 0.5, true, flight, unit)
    if (extras.length) effect(game, 'burst', target.x, target.y, '', unit.color, { life: .4+flight, maxLife: .4 })
  }
  if (unit.side === 'ally' && unit.type === 'ranger' && owns(game, 'crossfire') && unit.attacks % 3 === 0) {
    const other = nearest(unit, game.enemies.filter(enemy => enemy.id !== target.id))
    if (other && distance(unit, other) <= unit.range + 55) {
      trigger(game, 'crossfire', '双生箭 · 追加射击')
      damageUnit(game, other, unit.atk * .8, launchMissile(game, unit, other, 'attack', '#80d9b0'), unit)
    }
  }
  if (unit.side === 'ally') {
    professionAction(game,unit,target,false,flight)
    game.waveReport[unit.type].damage += game.stats.damage - damageBefore
    if (unit.fusion || unit.fusionSkills?.length) activateFusions(game, unit, onAction)
  }
}

function activateFusions(game, unit, onAction) {
  unit.skillCharge = Math.min(3,(unit.skillCharge || 0)+1)
  if (unit.skillCharge < 3) return
  let released = false
  for (const id of new Set([unit.fusion,...(unit.fusionSkills || [])].filter(Boolean))) {
    unit.skillCharge = 3
    activateFusion(game,unit,onAction,id)
    if (unit.skillCharge === 0) released = true
  }
  unit.skillCharge = released ? 0 : 3
}

function activateFusion(game, unit, onAction, fusionId) {
  const recipe = FUSION_BY_ID[fusionId]
  const foes = game.enemies.filter(enemy => enemy.hp > 0 && distance(unit, enemy) <= Math.max(200, unit.range + 55))
    .sort((a, b) => distance(unit, a) - distance(unit, b))
  const friends = game.allies.filter(ally => ally.hp > 0).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)
  const wounded = friends.filter(ally => ally.hp < ally.maxHp)
  const report = game.waveReport[unit.type]
  const strike = (enemy, factor) => {
    const flight = launchMissile(game, unit, enemy, 'skill', recipe.color)
    const damage = damageUnit(game, enemy, Math.round(unit.atk * factor), flight, unit)
    report.damage += damage
    return damage
  }
  if (fusionId === 'paladin') {
    const ally = friends[0], shield = 20 + unit.heal
    if (!ally || ally.shield >= shield) return
    ally.shield = shield
    effect(game, 'burst', ally.x, ally.y, '护盾', recipe.color)
  } else if (fusionId === 'bard') {
    if (!wounded.length) return
    for (const ally of wounded.slice(0, 2)) report.healed += healUnit(game, ally, 12 + Math.round(unit.heal * .6), 0, unit)
  } else {
    if (!foes.length) return
    if (fusionId === 'warden') strike(foes.reduce((best, enemy) => enemy.hp > best.hp ? enemy : best), 1.4)
    if (fusionId === 'starblade') {
      for (const enemy of foes.filter(enemy => distance(enemy, foes[0]) <= 100).slice(0, 3)) strike(enemy, .75)
    }
    if (fusionId === 'priest') {
      const damage = strike(foes[0], .9)
      if (wounded.length) report.healed += healUnit(game, wounded[0], 8 + Math.round(damage / 2), 0, unit)
    }
    if (fusionId === 'frostbow') for (const enemy of foes.slice(0, 2)) {
      strike(enemy, .5)
      enemy.cooldown = Math.min(enemy.cooldown + .8, enemy.period + .8)
    }
  }
  const recipient = fusionId === 'paladin' ? friends[0] : fusionId === 'bard' ? wounded[0] : foes[0]
  perform(game, unit, 'skill', recipient, onAction, performanceOf({...unit,fusion:fusionId},'skill'))
  unit.skillCharge = 0
  game.fusionUses[fusionId] = (game.fusionUses[fusionId] || 0) + 1
  effect(game, 'burst', unit.x, unit.y - 22, recipe.skill, recipe.color)
}

export function unitStep(game, unit, dt, onAction) {
  if (unit.aim) unit.aim = null
  if (unit.hp <= 0 || game.lifeFailed) return
  if (unit.lure) {
    const grip = unit.lure
    const t = clamp((game.time-grip.at-LURE_REVEAL)/LURE_TRAVEL, 0, 1)
    const ease = t*t*(3-2*t)
    unit.x = grip.fromX + (grip.toX-grip.fromX)*ease
    unit.y = grip.fromY + (grip.toY-grip.fromY)*ease
    if (t >= 1) delete unit.lure
    return
  }
  if (unit.type === 'bellkeeper') {
    unit.bellTimer -= dt
    if (unit.bellTimer <= 0) {
      const level=game.wave>=8?3:game.wave>=4?2:1
      const summoned=addUnit(game,BELL_SUMMON.type,'enemy',level)
      if(summoned) {
        summoned.x=BELL_SUMMON.x;summoned.y=unit.y
        summoned.summonedBy='bellkeeper';summoned.bellSourceId=unit.id
        game.waveSpawned++
        recordBellEvent(game,'bell-summon',summoned,{count:1})
        effect(game,'summon',summoned.x,summoned.y,'援军',summoned.color)
        log(game,`${unit.name}召来流寇援军 · 右侧一名真实敌军入场`,'danger')
      } else {
        recordBellEvent(game,'bell-blocked',unit,{count:0,reason:'enemy-capacity'})
        log(game,`${unit.name}鸣钟，但敌军阵位已满，未能召入援军`,'normal')
      }
      perform(game, unit, 'toll', { x:BELL_SUMMON.x }, onAction)
      game.tacticsReport.tolls++
      unit.bellTimer = BELL_INTERVAL
    }
  }
  unit.cooldown = Math.max(0, unit.cooldown - dt)
  unit.attackTimer = Math.max(0, unit.attackTimer - dt)
  unit.hitTimer = Math.max(0, unit.hitTimer - dt)
  const enemies = unit.side === 'ally' ? game.enemies : game.allies
  let enemy = nearest(unit, enemies)
  if (unit.side === 'enemy' && !isBoss(unit.type) && game.feint?.result === 'active' &&
      game.waveTime >= FEINT.opens && game.waveTime < FEINT.closes) {
    enemy = nearest(unit, enemies.filter(ally => ally.type === game.feint.target)) || enemy
  }
  if (unit.side === 'ally' && game.formation === 'hunt' && ['ranger', 'mage'].includes(unit.type)) {
    const exposed = enemies.filter(target => target.hp > 0 && isBackline(target.type) && distance(unit, target) <= unit.range + 5)
    enemy = nearest(unit, exposed.filter(target => target.type === 'bellkeeper')) || nearest(unit, exposed) || enemy
  }
  if (professionJobs(unit).includes('assassin')) enemy = nearest(unit,enemies.filter(e=>e.hp>0 && isBackline(e.type))) || enemy
  if (professionJobs(unit).includes('sniper')) enemy = enemies.filter(e=>e.hp>0 && distance(unit,e)<=unit.range+5).sort((a,b)=>a.hp-b.hp)[0] || enemy
  if(unit.type==='hunter') {
    enemy=quarry(game.allies,unit)
    if((enemy?.id || null)!==unit.quarryId){
      unit.quarryId=enemy?.id || null
      if(enemy)recordEnemy(game,'hunt',unit,{target:enemy.id,name:enemy.name})
    }
  }
  if(unit.side==='ally' && ['mage','ranger'].includes(unit.type)){
    enemy=nearest(unit,enemies.filter(e=>e.type==='banner' && e.hp>0 && distance(unit,e)<=unit.range+5)) || enemy
  }
  if(unit.type==='cantor'){
    if(advanceRite(game,unit,dt))perform(game,unit,'heal',unit,onAction)
    if(unit.chanting && unit.x>56)return
  }
  let healingTarget
  if (unit.side === 'ally' && unit.type === 'healer') {
    const hurt = game.allies.filter(ally => ally.hp > 0 && ally.hp < ally.maxHp - 2 && distance(unit, ally) < unit.range).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]
    healingTarget = hurt
    if (hurt && unit.cooldown <= 0) {
      perform(game, unit, 'heal', hurt, onAction)
      unit.cooldown = unit.period
      unit.attackTimer = 0.3
      const flight = launchMissile(game, unit, hurt, 'heal', '#ef778b')
      unit.attacks++
      const emergency = professionJobs(unit).includes('medic') && hurt.hp < hurt.maxHp*.5 ? 2 : 1
      game.waveReport.healer.healed += healUnit(game, hurt, unit.heal * emergency * (game.formation === 'spread' ? .8 : 1), flight, unit)
      professionAction(game,unit,hurt,true,flight)
      if (unit.fusion || unit.fusionSkills?.length) activateFusions(game, unit, onAction)
      return
    }
  }
  if (enemy && distance(unit, enemy) <= unit.range + 5) {
    if (unit.cooldown <= 0) attack(game, unit, enemy, onAction)
    else if (!healingTarget) anticipate(unit, 'attack', enemy)
  } else {
    if (enemy && unit.speed > 0 && !healingTarget) {
      const approach = (distance(unit, enemy) - unit.range - 5) / unit.speed
      anticipate(unit, 'attack', enemy, Math.max(unit.cooldown, approach))
    }
    moveUnit(unit, enemy, dt, unit.side === 'ally' ? 1 : -1)
  }
  if (healingTarget) anticipate(unit, 'heal', healingTarget)
  if (unit.side === 'enemy' && unit.x <= 56) {
    const escaped=losePlayerLife(game,{source:isBoss(unit.type)?'boss-breach':'breach',unit,boss:isBoss(unit.type)})
    if(escaped) {
      recordGateDamage(game,escaped.amount,'breach')
      effect(game,'damage',65,180,escaped.failed?'生命挑战失败':'生命 −'+escaped.amount,'#ef778b')
      log(game,escaped.failed?`${unit.name}突破防线 · ${isBoss(unit.type)?'首领突破':'0 生命时再次漏敌'}，本局失败`:
        `${unit.name}突破防线 · 生命 −${escaped.amount}，剩余 ${escaped.after}`,'danger')
      if(unit.summonedBy==='bellkeeper')recordBellEvent(game,'bell-breach',unit,{lifeLost:escaped.amount,failed:escaped.failed})
    }
    unit.hp = 0
    unit.breached = true
  }
}

export function breachDamage(type, gateHp) {
  return isBoss(type) ? gateHp : Math.min(gateHp,1)
}

export function bossStep(game, dt, onAction) {
  const boss = game.enemies.find(unit => isBoss(unit.type) && unit.hp > 0)
  if (!boss) return
  if (game.bossTelegraph) {
    const mark = game.bossTelegraph
    // A concentrated offensive can stop the global shockwave during its warning.
    if (mark.mode === 'pulse' && mark.startHp - boss.hp >= boss.maxHp * .08) {
      game.bossTelegraph = null
      game.bossTimer = 5.5
      log(game, '王庭震荡被打断 · 已削去首领 8% 最大生命', 'good')
      effect(game,'burst',boss.x,boss.y,'命线断裂','#c89cff')
      return
    }
    mark.remaining -= dt
    if (mark.remaining <= 0) {
      perform(game, boss, 'bombard', mark, onAction, bombardmentOf(mark))
      const targets = game.allies.filter(unit => unit.hp > 0 && (mark.mode === 'pulse' || distance(unit, mark) <= mark.radius))
      const skill = Object.values(BOSS_SKILLS).find(skill => skill.name === mark.name) || BOSS_SKILLS.scarlet
      const strength = boss.type === 'finalBoss' && boss.hp <= boss.maxHp / 2 ? 1.2 : 1
      for (const unit of targets) {
        const ward = mark.mode === 'pulse' && unit.shield > 0 ? .5 : 1
        formationDamage(game, unit, skill.damage * endlessScale(game) * strength * ward, true, 0, boss)
        if (mark.mode === 'rupture' && unit.hp > 0) unit.cooldown += 1.2
      }
      effect(game, 'burst', mark.x, mark.y, mark.name, boss.color)
      log(game, `${mark.name}落下 · ${targets.length} 名友军受击`, 'danger')
      game.bossTelegraph = null
      game.bossTimer = boss.type === 'finalBoss' ? boss.hp <= boss.maxHp / 2 ? 4.5 : 6 : boss.hp <= boss.maxHp / 2 ? 6 : 8.5
    }
  } else {
    game.bossTimer -= dt
    if (game.bossTimer <= 0) {
      const enraged = boss.hp <= boss.maxHp / 2
      const skill = bossSkill(boss.type, enraged, boss.bossCasts || 0)
      const allies = game.allies.filter(unit => unit.hp > 0)
      const mark = skill.mode === 'sever' ? allies.reduce((best,unit) =>
        !best || unit.atk + unit.heal > best.atk + best.heal ? unit : best, null) : allies.reduce((best, unit) =>
        !best || (enraged ? unit.x < best.x : unit.x > best.x) ? unit : best, null)
      if (mark) {
        game.bossTelegraph = {name:skill.name, mode:skill.mode, x:mark.x, y:mark.y,
          radius:skill.radius, remaining:skill.duration, duration:skill.duration,
          ...(skill.mode === 'pulse' ? {startHp:boss.hp} : {}), text:skill.name + ' · ' + skill.counter}
        boss.bossCasts = (boss.bossCasts || 0) + 1
        log(game, `${boss.name}蓄力${skill.name} · ${skill.duration} 秒 · ${skill.counter}`, 'danger')
      } else game.bossTimer = 3
    }
  }
}
