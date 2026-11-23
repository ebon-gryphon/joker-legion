/** Read-only timing for an already accepted score trace. Nothing here awards a score. */
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v))
const weights={base:1,card:.65,item:.85,multiply:1.25,outcome:.85,order:.85,relic:.9}
export function buildScoreSequence(trace) {
  if(!trace?.id || !Array.isArray(trace.steps) || !trace.steps.length || !Number.isFinite(trace.finalScore))return null
  const source=trace.steps.filter(step=>Object.hasOwn(weights,step.kind))
  if(!source.length)return null
  const cards=source.filter(s=>s.kind==='card').length,items=source.filter(s=>s.kind==='item').length,relics=source.filter(s=>s.kind==='relic').length
  const enhanced=items>=3 || (trace.quality?.rolled ?? trace.quality?.floor ?? 0)>=4
  const duration=clamp(420+cards*36+items*65+relics*30+(enhanced?100:0),560,enhanced?1200:780)
  const totalWeight=source.reduce((sum,step)=>sum+weights[step.kind],0)
  const selectedCount=(trace.selectedCards || trace.scoringCards || []).length
  const introDuration=selectedCount?Math.min(140,60+selectedCount*16):0
  let at=introDuration
  const steps=source.map((step,index)=>{
    const start=at;at=index===source.length-1?duration:at+(duration-introDuration)*weights[step.kind]/totalWeight
    return Object.freeze({...step,start,end:at})
  })
  return Object.freeze({id:trace.id,trace,duration,introDuration,enhanced,steps:Object.freeze(steps)})
}
export function sequenceStateAt(sequence,elapsed=0) {
  if(!sequence)return null
  const at=clamp(Number.isFinite(elapsed)?elapsed:0,0,sequence.duration)
  const selected=sequence.trace.selectedCards || sequence.trace.scoringCards || []
  if(at<sequence.introDuration)return {index:-1,step:{kind:'selection',id:'selected-cards',label:'确认选中牌 · 只按最高牌型计分'},done:false,chips:0,mult:sequence.trace.mult,score:null,
    qualityVisible:false,musterVisible:false,progress:at/sequence.duration,stepProgress:at/sequence.introDuration,litCardIds:selected.slice(0,Math.min(selected.length,1+Math.floor(at/sequence.introDuration*selected.length))).map(card=>card.id),countedCardIds:[]}
  const done=at>=sequence.duration
  const index=done?sequence.steps.length-1:Math.max(0,sequence.steps.findIndex(step=>at<step.end))
  const step=sequence.steps[index]
  let chips=0,multiplied=false
  for(let i=0;i<=index;i++){
    const row=sequence.steps[i]
    if(Number.isFinite(row.chips))chips=row.chips
    // Keep chips labelled as chips. The final score only appears at the real multiplication step.
    if(row.kind==='multiply')multiplied=true
  }
  return {index,step,done,chips,mult:sequence.trace.mult,score:multiplied?sequence.trace.finalScore:null,
    qualityVisible:done || sequence.steps.slice(0,index+1).some(step=>step.id==='quality'),musterVisible:done || sequence.steps.slice(0,index+1).some(step=>step.id==='muster'),
    litCardIds:selected.map(card=>card.id),countedCardIds:sequence.steps.slice(0,index+1).filter(step=>step.kind==='card').map(step=>step.id),
    progress:at/sequence.duration,stepProgress:clamp((at-step.start)/Math.max(1,step.end-step.start),0,1)}
}
export function createScorePlayback(trace) {
  const sequence=buildScoreSequence(trace)
  return sequence?{sequence,elapsed:0,done:false}:null
}
export function advanceScorePlayback(playback,deltaMs,{speed=1,skip=false,reason='skipped'}={}) {
  if(!playback || playback.done)return {playback,complete:[]}
  const factor=speed===2?2:1
  const elapsed=skip?playback.sequence.duration:Math.min(playback.sequence.duration,playback.elapsed+Math.max(0,Number.isFinite(deltaMs)?deltaMs:0)*factor)
  const done=elapsed>=playback.sequence.duration
  const next={...playback,elapsed,done}
  return {playback:next,complete:done?[{id:playback.sequence.id,reason:skip?reason:'finished'}]:[]}
}
export function replaceScorePlayback(playback,trace) {
  if(trace?.id && playback?.sequence.id===trace.id)return {playback,complete:[]}
  return {playback:createScorePlayback(trace),complete:playback&&!playback.done?[{id:playback.sequence.id,reason:'replaced'}]:[]}
}
