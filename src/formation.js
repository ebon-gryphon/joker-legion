// Coordinates refer to a soldier's feet on the friendly half of the battlefield.
export const CAMP_AREA = Object.freeze({ left:26, right:500, top:150, bottom:350 })
export function inCampArea(x, y) {
  return Number.isFinite(x) && Number.isFinite(y) && x >= CAMP_AREA.left && x <= CAMP_AREA.right &&
    y >= CAMP_AREA.top && y <= CAMP_AREA.bottom
}

export function campSlots(formation) {
  const front = formation === 'spread' ? 315 : 295, back = formation === 'hunt' ? 157 : 125
  const top = formation === 'spread' ? 192 : 208, bottom = formation === 'spread' ? 319 : 294
  return [{x:front,y:top},{x:front+13,y:bottom},{x:back,y:top+5},{x:back+10,y:bottom+6},{x:(front+back)/2,y:(top+bottom)/2}]
}

const overlaps = (a,b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
const contains = (a,b) => a.left <= b.left && a.right >= b.right && a.top <= b.top && a.bottom >= b.bottom
const area = r => Math.max(0,r.right-r.left)*Math.max(0,r.bottom-r.top)
function rectangle(raw,pad=0) {
  if(!raw || !Number.isFinite(raw.left) || !Number.isFinite(raw.top))return null
  const right=raw.right ?? raw.left+raw.width, bottom=raw.bottom ?? raw.top+raw.height
  if(!Number.isFinite(right) || !Number.isFinite(bottom) || right<=raw.left || bottom<=raw.top)return null
  return {left:raw.left-pad,top:raw.top-pad,right:right+pad,bottom:bottom+pad}
}
/** A CSS-pixel safe region. Keep the whole drag floor, bodies and names out of live HUD rectangles. */
export function computeDeploymentViewport(width,height,panel,reservedRects=[]) {
  const stacked=panel && panel.left < width*.32
  const base={left:8,top:reservedRects.length?8:height<470?65:Math.min(118,height*.17),
    right:stacked || (!panel && height>width)?width-8:Math.min(width-8,width*.56,panel ? panel.left-8 : width),
    bottom:stacked?panel.top-8:height-8}
  base.right=Math.max(base.left+1,base.right);base.bottom=Math.max(base.top+1,base.bottom)
  const obstacles=reservedRects.map(r=>rectangle(r,8)).filter(r=>r && overlaps(base,r))
  let free=[base]
  for(const obstacle of obstacles){
    const next=[]
    for(const r of free){
      if(!overlaps(r,obstacle)){next.push(r);continue}
      for(const piece of [
        {...r,right:Math.min(r.right,obstacle.left)}, {...r,left:Math.max(r.left,obstacle.right)},
        {...r,bottom:Math.min(r.bottom,obstacle.top)}, {...r,top:Math.max(r.top,obstacle.bottom)},
      ])if(area(piece)>0)next.push(piece)
    }
    free=next.filter((r,i)=>!next.some((other,j)=>j!==i && contains(other,r) && (area(other)>area(r) || j<i)))
  }
  // A full-width shallow gap can fit fewer legible actors than a slightly narrower tall gap.
  const score=r=>Math.min((r.right-r.left)/562,Math.max(0,(r.bottom-r.top-28))/230)
  const candidates=free.filter(r=>r.right-r.left>=70 && r.bottom-r.top>=80)
  const pool=candidates.length?candidates:free
  pool.sort((a,b)=>score(b)-score(a) || area(b)-area(a) || a.top-b.top || a.left-b.left)
  return pool[0] || {left:base.left,top:base.top,right:base.left+1,bottom:base.top+1}
}

export function fitFormation(width,height,panel,reservedRects=[]) {
  const viewport=computeDeploymentViewport(width,height,panel,reservedRects)
  const availableWidth=viewport.right-viewport.left, availableHeight=viewport.bottom-viewport.top
  const labelSpace=Math.min(28,availableHeight*.15), headroom=90
  // Scale stays fixed as soldiers move; the lane map alone stretches to fill remaining depth.
  const scale=Math.max(.05,Math.min(availableWidth/562,(availableHeight-labelSpace)/(headroom+145)))
  const depth=Math.max(.01,(availableHeight-labelSpace-headroom*scale)/((CAMP_AREA.bottom-CAMP_AREA.top)*scale))
  const left=viewport.left+(availableWidth-562*scale)/2-(CAMP_AREA.left-44)*scale
  const top=viewport.top+labelSpace-(CAMP_AREA.top-headroom)*scale
  return {scale,depth,left,top,viewport}
}
