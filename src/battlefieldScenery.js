// Unit insignia are shared with the convoy and command portraits.
export const SPADE = ['   x   ', '  xxx  ', ' xxxxx ', 'xxxxxxx', 'xxxxxxx', ' xx xx ', '   x   ', '  xxx  ']
export const CROWN = ['x  x  x', 'xx x xx', 'xxxxxxx', ' xxxxx ', ' xxxxx ', '       ', ' xxxxx ']

// Keep the campfire near the left edge when the viewport crops the panorama.
export function backgroundFrame(width,height,sourceWidth,sourceHeight) {
  const scale=Math.max(width/sourceWidth,height/sourceHeight)
  const w=sourceWidth*scale,h=sourceHeight*scale
  return {x:Math.round((width-w)*.14),y:Math.round((height-h)*.48),w,h}
}
