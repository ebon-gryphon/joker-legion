import {protector,healingTargets,ENEMY_RULES} from './enemyBehavior.js'

export function paintHostileSignals(ctx,game,yMap,labels,offsets) {
  if(game.phase!=='battle')return
  ctx.save()
  for(const unit of game.enemies){
    if(unit.hp<=0)continue
    const x=unit.x+(offsets.get(unit.id)?.x || 0),y=yMap(unit.y)+(offsets.get(unit.id)?.y || 0)
    if(unit.type==='banner'){
      ctx.beginPath()
      ctx.ellipse(unit.x,yMap(unit.y),ENEMY_RULES.aura,Math.abs(yMap(unit.y+ENEMY_RULES.aura)-yMap(unit.y)),0,0,2*Math.PI)
      ctx.fillStyle='#58c7c40a';ctx.fill()
      ctx.strokeStyle='#63bfbd75';ctx.setLineDash([4,5]);ctx.stroke()
    }
    if(protector(game,unit)){
      ctx.fillStyle='#a1e4d5';ctx.fillRect(x-4,y+2,8,2);ctx.fillRect(x-2,y+4,4,2)
    }
    let targets=[]
    if(unit.type==='hunter') targets=game.allies.filter(a=>a.id===unit.quarryId && a.hp>0)
    if(unit.chanting) targets=healingTargets(game,unit)
    ctx.strokeStyle=unit.chanting?'#a1f2c9':'#e5a2d3';ctx.setLineDash([3,4])
    for(const target of targets){
      ctx.beginPath();ctx.moveTo(x,y-22);ctx.lineTo(target.x+(offsets.get(target.id)?.x || 0),yMap(target.y)+(offsets.get(target.id)?.y || 0)-16);ctx.stroke()
    }
  }
  const events=game.combatLedger?.enemyEvents || []
  for(let i=events.length-1;i>=0 && events[i].at>=game.waveTime-.65;i--){
    const e=events[i]
    if(e.kind!=='guard' || e.amount<=0)continue
    const target=game.enemies.find(unit=>unit.id===e.target && unit.hp>0)
    if(!target)continue
    labels.push({text:'护旗挡下 '+Number(e.amount.toFixed(1)),x:target.x+(offsets.get(target.id)?.x || 0),y:yMap(target.y)+(offsets.get(target.id)?.y || 0)-64,size:10,color:'#a1e4d5'})
    break
  }
  ctx.restore()
}

// Paint above the crowd. The four notches and the cross remain legible without motion or text.
export function paintRites(ctx,game,yMap,offsets) {
  if(game.phase!=='battle')return
  for(const unit of game.enemies){
    if(!unit.chanting || unit.hp<=0)continue
    const x=Math.round(unit.x+(offsets.get(unit.id)?.x || 0))-21
    const y=Math.round(yMap(unit.y)+(offsets.get(unit.id)?.y || 0))-82
    ctx.fillStyle='#101b24';ctx.fillRect(x-1,y-1,44,9)
    ctx.fillStyle='#c9f5de';ctx.fillRect(x,y,42,7)
    ctx.fillStyle='#254a48';ctx.fillRect(x+1,y+1,40,5)
    ctx.fillStyle='#97f3b9';ctx.fillRect(x+1,y+1,Math.round(40*(1-unit.riteTimer/ENEMY_RULES.windup)),5)
    for(let tick=1;tick<4;tick++){ctx.fillStyle='#172f37';ctx.fillRect(x+tick*10,y+1,1,5)}
    ctx.fillStyle='#101b24';ctx.fillRect(x-10,y-1,9,9)
    ctx.fillStyle='#c5ffe0';ctx.fillRect(x-7,y,3,7);ctx.fillRect(x-9,y+2,7,3)
  }
}
