import {protector,healingTargets,ENEMY_RULES} from './enemyBehavior.js'

export function paintHostileSignals(ctx,game,yMap,labels) {
  if(game.phase!=='battle')return
  ctx.save()
  for(const unit of game.enemies){
    if(unit.hp<=0)continue
    const x=unit.x,y=yMap(unit.y)
    if(unit.type==='banner'){
      ctx.beginPath()
      ctx.ellipse(x,y,ENEMY_RULES.aura,Math.abs(yMap(unit.y+ENEMY_RULES.aura)-y),0,0,2*Math.PI)
      ctx.fillStyle='#58c7c40a';ctx.fill()
      ctx.strokeStyle='#63bfbd75';ctx.setLineDash([4,5]);ctx.stroke()
    }
    if(protector(game,unit)){
      ctx.fillStyle='#a1e4d5';ctx.fillRect(x-4,y+2,8,2);ctx.fillRect(x-2,y+4,4,2)
    }
    let targets=[]
    if(unit.type==='hunter') targets=game.allies.filter(a=>a.id===unit.quarryId && a.hp>0)
    if(unit.chanting) targets=healingTargets(game,unit)
    if(unit.chanting)labels.push({text:'引魂 '+unit.riteTimer.toFixed(1)+'s',x,y:y-72,size:10,color:'#abf3c4'})
    ctx.strokeStyle=unit.chanting?'#a1f2c9':'#e5a2d3';ctx.setLineDash([3,4])
    for(const target of targets){
      ctx.beginPath();ctx.moveTo(x,y-22);ctx.lineTo(target.x,yMap(target.y)-16);ctx.stroke()
    }
  }
  const events=game.combatLedger?.enemyEvents || []
  for(let i=events.length-1;i>=0 && events[i].at>=game.waveTime-.65;i--){
    const e=events[i]
    if(e.kind!=='guard' || e.amount<=0)continue
    const target=game.enemies.find(unit=>unit.id===e.target && unit.hp>0)
    if(!target)continue
    labels.push({text:'护旗挡下 '+Number(e.amount.toFixed(1)),x:target.x,y:yMap(target.y)-64,size:10,color:'#a1e4d5'})
    break
  }
  ctx.restore()
}
