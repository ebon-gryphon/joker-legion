import {hash} from './pixelDrawing.js'

const clamp=(v,max)=>Math.max(-max,Math.min(max,v))
const isLarge=type=>type==='boss' || type==='finalBoss'
// These shifts are in painted world pixels. Simulation coordinates and input use the original units.
export function enemyPaintOffsets(enemies) {
  const points=enemies.filter(u=>u.hp>0).map(u=>({id:u.id,x:u.x,y:u.y,large:isLarge(u.type),dx:0,dy:0}))
  for(let pass=0;pass<3;pass++){
    const forces=points.map(()=>({x:0,y:0}))
    for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++){
      const a=points[i],b=points[j],dx=a.x+a.dx-b.x-b.dx,dy=a.y+a.dy-b.y-b.dy
      const overlap=1-Math.hypot(dx/48,dy/36)
      if(overlap<=0)continue
      const angle=Math.hypot(dx,dy)<1?hash(a.id+b.id)*Math.PI*2:Math.atan2(dy,dx)
      const x=Math.cos(angle)*overlap*12,y=Math.sin(angle)*overlap*11
      forces[i].x+=x;forces[i].y+=y;forces[j].x-=x;forces[j].y-=y
    }
    points.forEach((p,i)=>{if(!p.large){p.dx=clamp(p.dx+forces[i].x,19);p.dy=clamp(p.dy+forces[i].y,16)}})
  }
  return new Map(points.map(p=>[p.id,{x:Math.round(p.dx),y:Math.round(p.dy)}]))
}

export function readableLabels(labels) {
  // Combine only overlapping landed damage on the same soldier. Unattributed
  // numbers and healing keep their own labels and the existing collision budget.
  const grouped=[], hits=new Map()
  for (const label of labels) {
    if (!label.damageTarget || !Number.isFinite(label.amount)) {grouped.push(label);continue}
    const old=hits.get(label.damageTarget)
    if (old && Math.abs(old.y-label.y)<18) {
      old.amount+=label.amount
      old.text=String(Math.round(old.amount))
      old.alpha=Math.max(old.alpha,label.alpha)
    } else {
      const copy={...label}
      hits.set(label.damageTarget,copy);grouped.push(copy)
    }
  }
  const important=grouped.filter(l=>l.unit || l.priority==='warning')
  const selected=[...important]
  for(const label of grouped.filter(l=>!important.includes(l)).reverse()){
    if(selected.length-important.length>=5)break
    const half=Math.max(14,label.text.length*label.size/2)
    if(!selected.some(l=>Math.abs(l.x-label.x)<half+Math.max(14,l.text.length*l.size/2) && Math.abs(l.y-label.y)<18))selected.push(label)
  }
  return selected.reverse()
}
