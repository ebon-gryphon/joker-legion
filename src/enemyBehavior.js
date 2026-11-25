import {isBoss} from './bossRules.js'
import {distance,effect} from './gameState.js'

export const ENEMY_RULES=Object.freeze({aura:120,guard:.25,hunt:.25,brood:.35,interval:4.5,windup:1.5,heal:.08})
export const specialEnemy=type=>['banner','hunter','splitter','brood','cantor'].includes(type)
export function recordEnemy(game,kind,unit,details={}) {
  const ledger=game.combatLedger
  if(!ledger || ledger.ended)return
  ledger.enemyEvents??=[]
  ledger.enemyEvents.push({kind,at:game.waveTime,actor:unit.id,type:unit.type,...details})
}
export function protector(game,unit) {
  if(unit.side!=='enemy' || isBoss(unit.type))return null
  return game.enemies.find(flag=>flag.type==='banner' && flag!==unit && flag.hp>0 && distance(flag,unit)<=ENEMY_RULES.aura) || null
}
const priority=['healer','ranger','mage','knight']
export function quarry(allies,hunter={x:960,y:250}) {
  return allies.filter(u=>u.hp>0).sort((a,b)=>priority.indexOf(a.type)-priority.indexOf(b.type) || distance(a,hunter)-distance(b,hunter))[0]
}
export function healingTargets(game,caster) {
  return game.enemies.filter(u=>u!==caster && u.hp>0 && u.hp<u.maxHp)
    .sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp).slice(0,2)
}
export function advanceRite(game,caster,dt) {
  caster.riteTimer-=dt
  if(caster.riteTimer>0)return false
  if(!caster.chanting) {
    caster.chanting=true
    caster.riteTimer=ENEMY_RULES.windup
    recordEnemy(game,'windup',caster)
    return true
  }
  caster.chanting=false
  caster.riteTimer=ENEMY_RULES.interval-ENEMY_RULES.windup
  const targets=healingTargets(game,caster)
  for(const target of targets) {
    const healed=Math.min(target.maxHp-target.hp,target.maxHp*ENEMY_RULES.heal)
    target.hp+=healed
    recordEnemy(game,'heal',caster,{target:target.id,name:target.name,amount:healed})
    effect(game,'heal',target.x,target.y-38,'+'+Number(healed.toFixed(1)),caster.color)
  }
  if(!targets.length){
    recordEnemy(game,'no-target',caster,{amount:0})
    effect(game,'burst',caster.x,caster.y-35,'无伤员 · 0',caster.color)
  }
  return false
}
export const behaviorLabels={guard:'护旗减伤',hunt:'刺客追击',bonus:'追击增伤',split:'分裂生成',windup:'祭司蓄力',heal:'祭司回复','no-target':'无伤员 · 回复0',interrupt:'蓄力中断',kill:'击杀',hit:'受伤',strike:'攻击命中'}
