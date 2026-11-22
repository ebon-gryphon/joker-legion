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

export function fitFormation(width, height, panel) {
  const stacked = panel && panel.left < width * .32
  const right = stacked || (!panel && height > width) ? width : Math.min(width * .56, panel?.left ?? width)
  const top = height < 470 ? 65 : Math.min(118, height * .17)
  const bottom = stacked ? panel.top - 4 : height - (height < 470 ? 42 : 64)
  // Keep the camera fixed while units move. Leave room for heads, names and corner hit areas.
  const scale = Math.max(.32, Math.min((right-12)/530, (bottom-top)/230))
  const depth = Math.max(.3,(bottom-top-86*scale)/((CAMP_AREA.bottom-CAMP_AREA.top)*scale))
  return {scale, depth, left:(right-526*scale)/2, top:top-(CAMP_AREA.top-82)*scale}
}
