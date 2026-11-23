// Session-only visuals. No game object, clock, random source or storage is ever written here.
export function createPresentationScene({enabled=true}={}) {
  let current=null,view={active:false},on=enabled
  const used=new Set(),fullWaves=new Set()
  const clear=()=>{view={active:false}}
  function reveal() {
    if(!on || !current)return
    const {facts,waveKey,army}=current,r=facts.recruitment
    view.pendingUnitIds=[]
    if(r.grade>=4)view.reveal={active:true,elapsedMs:0,unitId:r.unitId || r.recruitId,grade:r.grade,placement:r.status==='reserve'?'reserve':'field'}
    if(r.grade>4 && ['fielded','reserve'].includes(r.status)) {
      const full=!fullWaves.has(waveKey);fullWaves.add(waveKey)
      view.cheer={active:true,elapsedMs:0,grade:r.grade,full,unitIds:army.filter(id=>id!==(r.unitId || r.recruitId))}
    }
    view.active=!!view.reveal || !!view.cheer || !!view.order
  }
  return {
    accept(facts,{waveKey,army=[],immediate=false}={}) {
      if(!facts?.id || !facts.recruitment || used.has(facts.id))return false
      used.add(facts.id);clear();current={facts,waveKey,army:[...army],stages:new Set()}
      const r=facts.recruitment
      if(on)view={active:true,pendingUnitIds:r.status==='fielded'?[r.unitId || r.recruitId].filter(Boolean):[]}
      if(immediate)reveal()
      return true
    },
    stage(id,kind) {
      if(!on || !current || current.facts.id!==id)return
      if(current.stages.has(kind))return
      current.stages.add(kind)
      if(kind==='muster' && !view.reveal && !view.cheer)reveal()
      if(kind==='order') {
        const rows=current.facts.orderRecipients || []
        view.order={active:true,elapsedMs:0,unitIds:rows.map(row=>row.unitId || row.id)};view.active=true
      }
    },
    advance(ms,{speed=1,paused=false,reducedMotion=false}={}) {
      if(!on || reducedMotion){clear();return}
      if(paused)return
      for(const key of ['reveal','order','cheer']) {
        const item=view[key];if(!item?.active)continue
        item.elapsedMs+=Math.max(0,ms)*(speed===2?2:1)
        if(item.elapsedMs>=(key==='cheer'?(item.full?1000:420):key==='order'?440:420))delete view[key]
      }
      view.active=!!view.pendingUnitIds?.length || !!view.reveal || !!view.order || !!view.cheer
    },
    complete(id,reason) {if(current?.facts.id!==id)return;view.pendingUnitIds=[];if(reason!=='finished')clear()},
    skip(){clear()},
    setEnabled(value){on=!!value;if(!on)clear()},
    prime(waveKey,alreadySeen=false){if(alreadySeen)fullWaves.add(waveKey)},
    reset(){current=null;used.clear();fullWaves.clear();clear()},
    get(){return JSON.parse(JSON.stringify({...view,skip:!on}))},
  }
}
