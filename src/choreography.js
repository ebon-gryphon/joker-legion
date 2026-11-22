// Body, hand and follow-through share one clock in the field and the archive.
// Each row describes the wind-up and release in forward reach, lift and upper-body lean.
const strokes = {
  cleave:   [[-.30,.64,-.40], [ .62,-.14,.46]],
  thrust:   [[-.42,-.12,-.18],[ .91,.03,.23]],
  sweep:    [[-.45,.15,-.48], [ .52,.18,.58]],
  slam:     [[-.12,.98,-.25], [ .32,-.25,.38]],
  bash:     [[-.32,-.34,-.21],[ .78,-.25,.13]],
  standard: [[-.16,.28,-.40], [ .26,.64,.48]],
  rise:     [[-.12,-.32,-.16],[ .13,1.0,.18]],
  offer:    [[-.11,-.18,-.27],[ .32,.56,.34]],
  cast:     [[-.38,.16,-.4],  [ .49,.18,.52]],
  shake:    [[-.18,.30,.32],  [ .24,.34,-.42]],
  pour:     [[-.18,.51,-.38], [ .35,.02,.66]],
  trace:    [[-.28,.18,.22],  [ .36,.4,-.41]],
  draw:     [[-.35,-.20,-.58],[ .19,.11,.44]],
  snap:     [[ .16,-.10,.28], [-.42,.15,-.23]],
  signal:   [[-.25,-.14,-.32],[ .44,.72,.44]],
  crouch:   [[-.31,-.86,-.26],[ .51,-.37,.31]],
  orbit:    [[-.27,.31,-.38], [ .28,.77,.41]],
  dive:     [[-.35,1.15,-.26],[1.02,-.46,.63]],
}
const glyphs = {
  blade:['     ##','    ###','   ### ','  ###  ',' ###   ',' # #   ','#   #  '],
  point:['      #','    ###','    ## ','   #   ','  #    ',' #     ','#      '],
  hammer:['  #### ',' ######',' ######','   ##  ','  ##   ',' ##    ','##     '],
  fang:['      #','    ###','   ### ','  ###  ',' ##    ','##     '],
  shield:[' ##### ','#######','## # ##','#######',' ##### ','  ###  ','   #   '],
  cross:['  ##  ','  ##  ','######','######','  ##  ','  ##  '],
  feather:['     ##','   ####','  ## ##',' ### # ',' ####  ',' ##    ','#      '],
  banner:['#      ','###### ','# #####','# #### ','#   ###','#      '],
  flame:['   #   ','  ## # ',' ### # ','### ###','#######',' ##### ','  ###  '],
  ribbon:['##   ##',' ## ## ','  ###  ',' ## ## ','##   ##'],
  bell:['   #   ','  ###  ',' ##### ',' ##### ','#######','   #   '],
  drop:['   #   ','   #   ','  ###  ',' ##### ','#######',' ##### '],
  ring:['  ###  ',' #   # ','#     #','#     #',' #   # ','  ###  '],
  leaf:['     ##','   ####','  ## ##',' # ### ',' ####  ',' ##    '],
  page:[' ##### ','##   ##','## ## #','##    #','###### ',' #     '],
  sun:[' #   # ','   #   ',' ##### ','#######',' ##### ','   #   ',' #   # '],
  arrow:['     # ','      #','#######','      #','     # '],
  bolt:['    ## ','   ##  ','  ###  ',' ##### ','   ##  ','  ##   '],
  wing:['#     #','##   ##','### ###',' ##### ','  # #  '],
  pair:['    # #','   ## #','  ## # ',' ## #  ','## #   '],
  antler:['#  #  #','## # ##',' # # # ','  ###  ','   #   '],
  star:['   #   ','   #   ','  ###  ','#######','  ###  ','   #   ','   #   '],
  shard:['   #   ','  ###  ',' ##### ','#######',' ##### ','  ###  ','   #   '],
  dust:['#   #  ','  #   #',' #  #  ','   #  #',' #   # '],
  moon:['   ### ','  ##   ',' ##    ',' ##    ','  ##  #','   ### '],
  mirror:['  ###  ',' #   # ','#  #  #',' #   # ','  ###  ','   #   '],
  orbit:['   ### ',' ###  #','# # # #','#  ### ',' ###   '],
}
function stamp(c, mark, x, y, size, color) {
  c.fillStyle = color
  const rows = glyphs[mark]
  for (let j=0;j<rows.length;j++) for (let i=0;i<rows[j].length;i++) {
    if (rows[j][i] === '#') c.fillRect(Math.round(x+(i-3)*size),Math.round(y+(j-3)*size),size,size)
  }
}
// Side of the equipment in the unflipped portrait. Most characters carry it
// on the forward side; these shields, centred grips and paired weapons differ.
const gripSide = {'spades-2':-1,'spades-3':-1,'spades-9':0,'spades-K':0,'hearts-8':-1,
  'hearts-10':0,'clubs-6':0,'diamonds-9':0,'enemy-bat':0}
const clamp = value => Math.min(1,Math.max(0,value))
export function actionPose(profile, seconds, kind='attack', reduced=false) {
  if (!profile || !Number.isFinite(seconds) || seconds < 0 || seconds >= profile.windup+profile.release) return null
  const preparing = seconds < profile.windup
  const t = clamp(preparing ? seconds/profile.windup : (seconds-profile.windup)/profile.release)
  const [back, front] = strokes[profile.gesture]
  const heavy = ['slam','cleave','bash'].includes(profile.gesture)
  const bow = ['draw','snap','crouch'].includes(profile.gesture)
  // Reserve the last part of anticipation for acceleration. At simulation
  // contact the pose has already reached its target, then holds for a beat.
  const turn = heavy ? .66 : bow ? .83 : .72
  const smooth = value => value * value * (3 - 2 * value)
  const gather = smooth(clamp(t / turn))
  const swing = smooth(clamp((t - turn) / (1 - turn)))
  const hold = heavy ? .18 : bow ? .12 : .09
  const settle = smooth(clamp((t - hold) / (1 - hold)))
  const backWeight = preparing ? gather * (1 - swing) : 0
  const contact = preparing ? swing : 1 - settle
  const after = preparing ? 0 : Math.sin(clamp((t-hold)/(1-hold))*Math.PI) * (1-t)
  const axis = i => back[i]*backWeight + front[i]*contact
  const weight = reduced ? .12 : 1
  const gentle = kind === 'heal'
  const lean = axis(2) * (gentle ? .62 : 1)
  const pull = bow ? -backWeight*.7 + contact*.25 : -backWeight*.26 + contact*.55
  const air = profile.gesture==='dive' || profile.gesture==='rise'
  const advanceFrame = heavy ? .77 : bow ? .75 : .72
  const frame = preparing
    ? (t<.12 ? 0 : t<.30 ? 1 : t<.51 ? 2 : t<advanceFrame ? 3 : 4)
    : (t<hold ? 5 : t<.36 ? 6 : t<.58 ? 7 : t<.77 ? 8 : t<.95 ? 9 : 0)
  return { state:'action', gesture:profile.gesture, preparing, t, kind, contact, backWeight, frame, profile:profile.id,
    armX:pull*profile.reach*weight, armY:-(axis(1)+.3*backWeight)*profile.lift*.72*weight,
    grip:gripSide[profile.id] ?? 1, reach:profile.reach, lift:profile.lift,
    x:(axis(0)*(gentle?.4:.66) + after*.10)*profile.reach*weight,
    y:air ? -axis(1)*(2+profile.lift)*weight : 0,
    bend:lean*profile.reach*.66*weight, crouch:(axis(1)*1.6-backWeight*.7)*weight,
    step:(heavy?contact*2.1:bow?backWeight*.7:0)*weight, reduced }
}
export function restingPose(profile, time, phase, hit = 0, reduced = false) {
  const breath = reduced ? 0 : Math.sin(time * 2.4 + phase)
  const flinch = Math.min(1,Math.max(0,hit/.2))
  return { state:flinch?'hit':'idle', gesture:profile.gesture, clock:time, phase, reduced,
    breath, gait:0, x:0, y:0, crouch:0,
    bend:-flinch*5, step:0, contact:0, backWeight:0, flinch }
}
export function walkingPose(profile, time, phase, reduced = false) {
  const heavy = ['bash','slam','cleave'].includes(profile.gesture)
  const cycle = time * (heavy ? 7.5 : 10.5) + phase
  const gait = reduced ? 0 : Math.sin(cycle)
  return { state:'walk', gesture:profile.gesture, clock:time, phase, reduced,
    cycle,gait,breath:0,x:0,y:0,bend:0,crouch:0,step:gait*2.5 }
}
const arcs = new Set(['cleave','sweep','slam','standard','trace'])
const rings = new Set(['offer','rise','orbit','shake','pour'])
// A weapon trace is anchored to the actor's hand, in local right-facing coordinates.
export function paintGesture(c, profile, pose, x, foot, height, direction=1) {
  if (!pose) return
  c.save()
  c.translate(x,foot); c.scale(direction*height/52,height/52)
  const {t, preparing, reduced} = pose
  const color = pose.kind==='heal'?'#ffc5bd':profile.ink
  if (reduced) {
    if (!preparing && t<.6) stamp(c,profile.mark,13,-32,1,color)
    c.restore();return
  }
  const reach = profile.reach
  const anchorY = -27-profile.lift*.45
  // Use short, solid edges for steel. Magical equipment keeps its own motif.
  const arc = arcs.has(profile.gesture) && pose.kind !== 'heal'
  const charged = rings.has(profile.gesture) || pose.kind === 'heal' || ['cast','trace'].includes(profile.gesture)
  const physicalBow = ['draw','snap','crouch'].includes(profile.gesture)
  if (preparing && pose.backWeight > .4 && charged) {
    const r = 9 - 6 * pose.backWeight, cx = 10 + pose.bend * .35
    for (let i=0;i<3;i++) {
      const angle = i*2.1 + t*1.6
      c.fillStyle=i ? color : '#fff1d0'
      c.fillRect(Math.round(cx+Math.cos(angle)*r),Math.round(anchorY+Math.sin(angle)*r),2,2)
    }
  }
  if (arc && pose.contact > .06 && (preparing || t < .42)) {
    const down = profile.gesture==='slam' || profile.gesture==='cleave'
    const u = preparing ? pose.contact*.82 : .82 + Math.min(1,t/.32)*.18
    const span = 12+reach*.8, tail = preparing ? .22*u : .34*(1-t/.44)
    const point = (v, radius) => {
      const a = (down?-2.18:-1.28) + v*(down?2.95:2.54)
      return [Math.round(5+Math.cos(a)*radius),Math.round(anchorY+Math.sin(a)*radius*(down?.95:.52))]
    }
    c.globalAlpha = preparing ? .7 : Math.max(0,1-t/.44)
    for (let k=0;k<8;k++) {
      const a = u-tail+tail*k/8, b = u-tail+tail*(k+1)/8
      const outer = span+1, inner = outer-(1+3*k/8)
      c.fillStyle=k>5?'#fff1d2':color
      c.beginPath()
      for (const [i,p] of [point(a,inner),point(a,outer),point(b,outer),point(b,inner)].entries()) {
        if(i===0)c.moveTo(...p);else c.lineTo(...p)
      }
      c.fill()
    }
  } else if (!preparing && t<.48 && charged) {
    c.globalAlpha = Math.max(0,1-t/.48)
    const r = 4+t*22
    for(let i=0;i<8;i++) {
      const a=i*Math.PI/4
      c.fillStyle=color;c.fillRect(Math.round(10+Math.cos(a)*r),Math.round(anchorY+Math.sin(a)*r*.6),2,2)
    }
  } else if (!preparing && !physicalBow && (profile.gesture==='thrust' || profile.gesture==='bash') && t<.24) {
    c.globalAlpha=1-t/.24;c.fillStyle=color
    c.fillRect(Math.round(13+reach*.6),anchorY,Math.round(8*(1-t/.24))+2,2)
  }
  if (!preparing && ['slam','bash','dive'].includes(profile.gesture) && t<.57) {
    const u=t/.57
    c.globalAlpha=(1-u)*.8
    for (let i=0;i<5;i++){
      const side=i%2?1:-1, length=5+Math.floor(i/2)*4
      c.fillStyle=i%2?'#c9b49c':'#978092'
      c.fillRect(Math.round(11+side*u*length),Math.round(-2-Math.sin(u*Math.PI)*(3+i)),i<3?3:2,2)
    }
  }
  c.restore()
}
export function paintMissile(c, profile, kind, x, y, tx, ty, progress) {
  const bow=['draw','snap','crouch','signal'].includes(profile.gesture)
  const arc=(bow?9:profile.gesture==='pour'?29:13)*Math.sin(progress*Math.PI)
  const px=x+(tx-x)*progress, py=y+(ty-y)*progress-arc
  c.save()
  c.translate(Math.round(px),Math.round(py))
  if (bow) {
    c.rotate(Math.atan2(ty-y-9*Math.PI*Math.cos(progress*Math.PI),tx-x))
    c.fillStyle=profile.ink; c.fillRect(-10,-1,12,2); c.fillRect(-9,-3,3,6)
    stamp(c,'point',1,0,1,'#fff0cb')
    if ((profile.mark==='pair' || profile.material==='ratchet') && progress>.16) {
      c.fillStyle=profile.ink; c.fillRect(-22,3,10,2); stamp(c,'point',-12,3,1,'#fff0cb')
      if(profile.material==='ratchet' && progress>.33) c.fillRect(-29,6,9,2)
    }
  } else {
    stamp(c,profile.mark,0,0,1.3,kind==='heal'?'#ffb9b5':profile.ink)
    c.fillStyle='#fff0cd';c.fillRect(-1,-1,2,2)
  }
  c.restore()
}
