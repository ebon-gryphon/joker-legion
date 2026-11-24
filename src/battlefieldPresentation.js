/** Transient view state only. Every clock and accepted recipient comes from the caller. */
const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,value))
const active=p=>!!p && !p.skip && !p.reducedMotion
const elapsed=(phase,p)=>Number.isFinite(phase?.elapsedMs)?phase.elapsedMs:Number.isFinite(p?.elapsedMs)?p.elapsedMs:0
const includes=(ids,id)=>Array.isArray(ids) && ids.includes(id)
const colorFor=grade=>grade>=6?'#efbbec':grade>=5?'#a5e3df':'#f2ce88'
export const PRESENTATION_DURATIONS=Object.freeze({reveal:420,order:440,cheer:1000,shortCheer:420,cue:180})
function livePhase(phase,p,duration) {
  if(!phase || phase.active===false)return null
  const ms=elapsed(phase,p)
  return ms>=0 && ms<duration ? {ms,progress:clamp(ms/duration)} : null
}
function salute(unit,pulse) {
  const healer=unit.type==='healer',ranged=['ranger','mage'].includes(unit.type)
  return {state:'salute',kind:'salute',gesture:healer?'rise':ranged?'offer':'standard',
    contact:pulse*(healer?1.10:ranged?.95:1.06),backWeight:0,
    x:0,y:0,bend:0,crouch:0,step:0,gait:0,breath:0,reduced:false}
}
/** Samples a real unit without changing its model, action, coordinates, or hit geometry. */
export function sampleUnitPresentation(unit,presentation) {
  if(!unit || unit.side!=='ally' || unit.hp<=0 || !active(presentation))return null
  const settlementActive=presentation.active!==false
  if(settlementActive && includes(presentation.pendingUnitIds,unit.id))return {pending:true,reveal:0,order:0,cheer:0,flash:0,confetti:0,pose:null,color:'#bdb1bd'}
  const result={pending:false,reveal:0,order:0,cheer:0,flash:0,confetti:0,pose:null,color:'#d8c9b1'}
  const reveal=presentation.reveal,r=settlementActive?livePhase(reveal,presentation,PRESENTATION_DURATIONS.reveal):null
  if(r && reveal.placement==='field' && reveal.unitId===unit.id && reveal.grade>=4 && unit.grade>=4){
    result.reveal=Math.sin(r.progress*Math.PI);result.color=colorFor(unit.grade)
  }
  const order=presentation.order,o=settlementActive?livePhase(order,presentation,PRESENTATION_DURATIONS.order):null
  if(o && includes(order.unitIds,unit.id))result.order=Math.sin(o.progress*Math.PI)
  const cheer=presentation.cheer,full=cheer?.full!==false,duration=full?PRESENTATION_DURATIONS.cheer:PRESENTATION_DURATIONS.shortCheer
  const c=settlementActive?livePhase(cheer,presentation,duration):null
  if(c && cheer.grade>4 && includes(cheer.unitIds,unit.id)){
    const index=Math.max(0,cheer.unitIds.indexOf(unit.id)),delay=100+Math.min(4,index)*50
    if(c.ms>=delay){
      const phase=clamp((c.ms-delay)/(duration-delay)),pulse=Math.sin(phase*Math.PI)
      result.cheer=pulse;result.confetti=full?6:3;result.pose=salute(unit,pulse);result.color=colorFor(cheer.grade)
    }
  }
  for(const cue of presentation.cues || []){
    if(cue.actual!==true || cue.unitId!==unit.id || !['attack','heal','guard'].includes(cue.kind))continue
    const sample=livePhase(cue,presentation,PRESENTATION_DURATIONS.cue)
    if(!sample)continue
    const strength=1-sample.progress
    if(strength>result.flash){result.flash=strength;result.cue=cue.kind}
  }
  return result.reveal || result.order || result.cheer || result.flash ? result : null
}
/** Hide only the legacy recruitment effects belonging to this pending/revealed recruit. */
export function filterPresentationEffects(effects,units,presentation) {
  // Replacing an old overlapping quality burst is independent of playing or skipping new decoration.
  const suppressed=(units || []).filter(unit=>includes(presentation?.suppressedUnitIds,unit.id))
  const running=active(presentation) && presentation.active!==false
  const pending=running?(units || []).filter(unit=>includes(presentation.pendingUnitIds,unit.id)):[]
  const revealing=running && livePhase(presentation.reveal,presentation,PRESENTATION_DURATIONS.reveal)?(units || []).filter(unit=>presentation.reveal?.placement==='field' && presentation.reveal.unitId===unit.id):[]
  const effectIds=presentation?.suppressedEffectIds || []
  if(!pending.length && !revealing.length && !suppressed.length && !effectIds.length)return effects
  const near=(effect,unit,dy)=>Math.abs(effect.x-unit.x)<1 && Math.abs(effect.y-(unit.y+dy))<1
  return effects.filter(effect=>{
    if(effect.type==='burst' && includes(effectIds,effect.id) && /传说|神话|棱彩|精良|稀有|卓越/.test(String(effect.text || '')))return false
    if(effect.type==='summon' && pending.some(unit=>near(effect,unit,0)))return false
    return !(effect.type==='burst' && /传说|神话|棱彩|精良|稀有|卓越/.test(String(effect.text || '')) &&
      [...pending,...revealing,...suppressed].some(unit=>near(effect,unit,-20) || near(effect,unit,-22)))
  })
}
function ring(c,x,y,radius,color,alpha=1) {
  c.globalAlpha=alpha;c.strokeStyle=color;c.lineWidth=1.5
  c.beginPath();c.ellipse(x,y,radius,radius*.23,0,0,Math.PI*2);c.stroke()
}
function pip(c,suit,x,y,size,color) {
  c.fillStyle=color
  if(suit==='♦'){c.beginPath();c.moveTo(x,y-size);c.lineTo(x+size,y);c.lineTo(x,y+size);c.lineTo(x-size,y);c.closePath();c.fill();return}
  const d=Math.max(1,Math.round(size*.65))
  if(suit==='♥'){c.fillRect(x-d,y-d,d*2,d);c.fillRect(x-size,y-size,size,size);c.fillRect(x,y-size,size,size);c.fillRect(x-d/2,y,d,d)}
  else if(suit==='♣'){c.fillRect(x-d/2,y-size,d,d);c.fillRect(x-size,y-d/2,d,d);c.fillRect(x,y-d/2,d,d);c.fillRect(x-d/2,y,d,d)}
  else{c.fillRect(x-d/2,y-size,d,d*2);c.fillRect(x-size,y-d/2,size*2,d);c.fillRect(x-d/2,y+d/2,d,d)}
}
/** All marks live at the feet or below the shoulders; names are painted later. */
export function paintUnitPresentation(c,unit,state,x,foot,width,height,{layer='under'}={}) {
  if(!state || state.pending)return
  c.save()
  if(layer==='under'){
    if(state.reveal)ring(c,x,foot+1,17+state.reveal*10,state.color,state.reveal*.75)
    if(state.order){
      ring(c,x,foot+2,15+state.order*8,'#d9c39b',state.order*.7)
      c.globalAlpha=state.order*.8;c.fillStyle='#efd4a0';c.fillRect(x-2,foot-2,4,4)
    }
    if(state.cheer)ring(c,x,foot+1,20,state.color,state.cheer*.38)
  }else{
    if(state.reveal){
      c.globalAlpha=state.reveal*.65;c.fillStyle=state.color
      for(const sign of [-1,1]){c.fillRect(Math.round(x+sign*width*.35),Math.round(foot-height*.48),1,Math.round(height*.27));c.fillRect(Math.round(x+sign*width*.30),Math.round(foot-height*.32),2,2)}
    }
    if(state.cheer && state.confetti){
      const paths=[[-1,-.2],[-.65,-.75],[-.15,-1],[.35,-.82],[.8,-.5],[1,-.05]]
      c.globalAlpha=state.cheer*.75
      for(let i=0;i<state.confetti;i++){
        const [dx,dy]=paths[i],spread=9+state.cheer*14
        pip(c,unit.suit,Math.round(x+dx*spread),Math.round(foot-6+dy*spread),i%2?2:1.5,i%2?state.color:'#f4dec1')
      }
    }
    if(state.flash){
      const tint=state.cue==='heal'?'#b9e1bb':state.cue==='guard'?'#a9d4ec':'#f3d59f'
      ring(c,x,foot+1,15+state.flash*4,tint,state.flash*.8)
      c.globalAlpha=state.flash;c.strokeStyle=tint;c.lineWidth=1.5
      if(state.cue==='heal'){c.beginPath();c.moveTo(x,foot-11);c.lineTo(x,foot-3);c.moveTo(x-4,foot-7);c.lineTo(x+4,foot-7);c.stroke()}
      else if(state.cue==='guard'){c.beginPath();c.moveTo(x-4,foot-12);c.lineTo(x+4,foot-12);c.lineTo(x+3,foot-6);c.lineTo(x,foot-3);c.lineTo(x-3,foot-6);c.closePath();c.stroke()}
      else{c.beginPath();c.moveTo(x-3,foot-4);c.lineTo(x+4,foot-11);c.stroke()}
    }
  }
  c.restore()
}
