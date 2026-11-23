/** Read-only timing for an already accepted score trace. Nothing here awards a score. */
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v))
const weights={base:1,card:.65,item:.85,multiply:1.25,outcome:.85,order:.85,relic:.9,hand:1.1,final:2}
const highHands=new Set(['fullHouse','four','straightFlush','five','flushHouse','flushFive'])
const unique=values=>[...new Set(values)]
function cinematicWeight(step){
  if(step.id==='quality')return 1.6
  if(step.id==='muster')return 2
  return {base:1.1,card:.45,item:.75,multiply:1.2,order:1.7,relic:.7,hand:1.1,final:2}[step.kind] || .85
}
function timedSteps(source,start,duration,weight){
  const total=source.reduce((sum,step)=>sum+weight(step),0)
  let at=start
  return source.map((step,index)=>{
    const from=at;at=index===source.length-1?duration:at+(duration-start)*weight(step)/total
    return Object.freeze({...step,start:from,end:at})
  })
}
export function buildScoreSequence(trace,{cinematic=false}={}) {
  if(!trace?.id || !Array.isArray(trace.steps) || !trace.steps.length || !Number.isFinite(trace.finalScore))return null
  let source=trace.steps.filter(step=>Object.hasOwn(weights,step.kind))
  if(!source.length)return null
  if(cinematic){
    source=[{kind:'hand',id:'hand-established',label:trace.hand?.name+'成立'},...source]
    const multiply=source.findIndex(step=>step.kind==='multiply')
    if(multiply>=0)source.splice(multiply+1,0,{kind:'final',id:'final-score',label:'本手 '+trace.finalScore+' 分',chips:trace.chipsBeforeMult,mult:trace.mult,total:trace.finalScore})
  }
  const cards=source.filter(s=>s.kind==='card').length,items=source.filter(s=>s.kind==='item').length,relics=source.filter(s=>s.kind==='relic').length
  const enhanced=items>=3 || (trace.quality?.rolled ?? trace.quality?.floor ?? 0)>=4
  const legacyDuration=clamp(420+cards*36+items*65+relics*30+(enhanced?100:0),560,enhanced?1200:780)
  const selectedCount=(trace.selectedCards || trace.scoringCards || []).length
  const introDuration=selectedCount?Math.min(140,60+selectedCount*16):0
  const publicEnhanced=items>=3 || (trace.quality?.floor || 0)>=4 || highHands.has(trace.hand?.key)
  const cinematicEnhanced=cinematic && (publicEnhanced || (trace.quality?.rolled || 0)>=4)
  let duration=legacyDuration,steps
  const qualityIndex=source.findIndex(step=>step.id==='quality')
  if(cinematic){
    if(cinematicEnhanced)duration=clamp(1800+cards*30+items*65,1800,2400)
    if(qualityIndex>=0){
      // Prefix timing and progress use only public card/item facts, even if a later relic differs.
      const revealAt=publicEnhanced?clamp(700+cards*60+items*80,800,1300):clamp(330+cards*16+items*25,360,Math.min(520,duration-160))
      const prefix=source.slice(0,qualityIndex),final=prefix.at(-1)
      const finalHold=publicEnhanced?240:Math.min(140,(revealAt-introDuration)*.4)
      const earlier=final?.kind==='final'?timedSteps(prefix.slice(0,-1),introDuration,revealAt-finalHold,cinematicWeight):timedSteps(prefix,introDuration,revealAt,cinematicWeight)
      steps=[...earlier,...(final?.kind==='final'?[Object.freeze({...final,start:revealAt-finalHold,end:revealAt})]:[]),
        ...timedSteps(source.slice(qualityIndex),revealAt,duration,cinematicWeight)]
    }else steps=timedSteps(source,introDuration,duration,cinematicWeight)
  }else steps=timedSteps(source,introDuration,duration,step=>weights[step.kind])
  return Object.freeze({id:trace.id,trace,duration,introDuration,enhanced,cinematic:!!cinematic,extended:cinematicEnhanced,
    publicEnhanced,steps:Object.freeze(steps)})
}
function presentationProgress(sequence,at){
  const reveal=sequence.cinematic && sequence.steps.find(step=>step.id==='quality')
  if(!reveal)return at/sequence.duration
  const boundary=sequence.publicEnhanced?.6:.65
  return at<reveal.start?at/Math.max(1,reveal.start)*boundary:
    boundary+(at-reveal.start)/Math.max(1,sequence.duration-reveal.start)*(1-boundary)
}
function focusOf(step,progress){
  if(step.kind==='selection')return 'selection'
  if(step.kind==='hand')return 'hand'
  if(step.kind==='final')return 'final-score'
  if(step.id==='quality')return 'quality'
  if(step.id==='muster')return 'muster'
  if(step.kind==='multiply')return progress<.45?'multiplier':'final-score'
  if(step.kind==='order')return 'order'
  if(step.kind==='base' || step.kind==='card')return 'cards'
  return 'items'
}
export function sequenceStateAt(sequence,elapsed=0) {
  if(!sequence)return null
  const at=clamp(Number.isFinite(elapsed)?elapsed:0,0,sequence.duration)
  const selected=sequence.trace.selectedCards || sequence.trace.scoringCards || []
  if(at<sequence.introDuration)return {index:-1,step:{kind:'selection',id:'selected-cards',label:'确认选中牌 · 只按最高牌型计分'},focus:'selection',done:false,chips:0,mult:sequence.trace.mult,score:null,displayScore:null,
    qualityVisible:false,musterVisible:false,orderVisible:false,revealedGrade:null,progress:presentationProgress(sequence,at),stepProgress:at/sequence.introDuration,litCardIds:selected.slice(0,Math.min(selected.length,1+Math.floor(at/sequence.introDuration*selected.length))).map(card=>card.id),countedCardIds:[]}
  const done=at>=sequence.duration
  const index=done?sequence.steps.length-1:Math.max(0,sequence.steps.findIndex(step=>at<step.end))
  const step=sequence.steps[index]
  const stepProgress=clamp((at-step.start)/Math.max(1,step.end-step.start),0,1)
  let chips=0,multiplied=false
  for(let i=0;i<=index;i++){
    const row=sequence.steps[i]
    if(Number.isFinite(row.chips))chips=row.chips
    if(row.kind==='multiply')multiplied=true
  }
  const shown=sequence.steps.slice(0,index+1)
  const qualityVisible=done || shown.some(step=>step.id==='quality')
  const focus=done?'complete':sequence.cinematic && step.kind==='multiply'?'multiplier':focusOf(step,stepProgress)
  return {index,step,focus,done,chips,mult:sequence.trace.mult,score:multiplied?sequence.trace.finalScore:null,
    displayScore:multiplied && (done || step.kind!=='multiply' || !sequence.cinematic && stepProgress>=.45)?sequence.trace.finalScore:null,
    qualityVisible,musterVisible:done || shown.some(step=>step.id==='muster'),orderVisible:done || shown.some(step=>step.kind==='order'),
    revealedGrade:qualityVisible?(sequence.trace.quality?.rolled ?? sequence.trace.quality?.floor ?? 0):null,
    litCardIds:selected.map(card=>card.id),countedCardIds:shown.filter(step=>step.kind==='card').map(step=>step.id),
    progress:presentationProgress(sequence,at),stepProgress}
}
export function createScorePlayback(trace,{cinematic=false,consumedIds=[]}={}) {
  const sequence=buildScoreSequence(trace,{cinematic}),consumed=unique(consumedIds)
  if(!sequence)return null
  const done=consumed.includes(sequence.id)
  return {sequence,elapsed:done?sequence.duration:0,done,consumedIds:consumed}
}
export function advanceScorePlayback(playback,deltaMs,{speed=1,skip=false,reason='skipped',paused=false,enabled=true,reducedMotion=false}={}) {
  if(!playback || playback.done)return {playback,complete:[]}
  const immediate=skip || !enabled || reducedMotion
  if(paused && !immediate)return {playback,complete:[]}
  const factor=speed===2?2:1
  const elapsed=immediate?playback.sequence.duration:Math.min(playback.sequence.duration,playback.elapsed+Math.max(0,Number.isFinite(deltaMs)?deltaMs:0)*factor)
  const done=elapsed>=playback.sequence.duration
  const next={...playback,elapsed,done,consumedIds:done?unique([...(playback.consumedIds || []),playback.sequence.id]):playback.consumedIds || []}
  return {playback:next,complete:done?[{id:playback.sequence.id,reason:!enabled?'disabled':reducedMotion?'reduced-motion':skip?reason:'finished'}]:[]}
}
export function replaceScorePlayback(playback,trace,{cinematic=false,consumedIds=[]}={}) {
  const consumed=unique([...(playback?.consumedIds || []),...consumedIds])
  if(trace?.id && playback?.sequence.id===trace.id){
    if(!playback.done && consumed.includes(trace.id))return {playback:{...playback,elapsed:playback.sequence.duration,done:true,consumedIds:consumed},complete:[]}
    return {playback,complete:[]}
  }
  const finished=playback&&!playback.done?[{id:playback.sequence.id,reason:'replaced'}]:[]
  if(playback)consumed.push(playback.sequence.id)
  return {playback:createScorePlayback(trace,{cinematic,consumedIds:unique(consumed)}),complete:finished}
}
