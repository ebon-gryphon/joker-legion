// Original, short synthesized Foley. Each material has a pitched body, an
// inharmonic or harmonic overtone, and a filtered noise transient.
function material(label, wave, sweep, overtone, ring, decay, noiseHz, noiseTime, noiseLevel) {
  return {label,wave,sweep,overtone,ring,decay,noiseHz,noiseTime,noiseLevel}
}
export const MATERIALS = {
  steel: material('重钢低鸣','triangle',.68,3.23,.55,.27,2350,.055,.70),
  shaft: material('木杆破风','triangle',.44,2.04,.19,.08,1700,.095,.92),
  edge: material('薄刃擦响','sine',.52,4.17,.50,.18,4200,.09,.85),
  anvil: material('钝铁砸击','triangle',.47,2.73,.72,.23,960,.068,.90),
  chop: material('斧口劈响','sawtooth',.36,1.48,.23,.095,1250,.10,.8),
  plate: material('盾面铿鸣','triangle',.82,2.69,.65,.23,3100,.036,.75),
  cloth: material('织物抖展','sine',.63,2,.1,.06,2600,.14,1.25),
  ember: material('火芯爆裂','sawtooth',.34,2.5,.17,.18,2200,.13,.86),
  wick: material('烛芯轻噼','sine',1.22,2,.35,.20,5100,.025,.39),
  glass: material('玻璃轻碰','sine',.995,3.7,.64,.24,5400,.018,.30),
  bell: material('铜铃颤音','sine',.997,2.71,.71,.41,2900,.016,.29),
  wood: material('木杖顿地','triangle',.65,1.58,.26,.085,860,.038,.75),
  goblet: material('杯沿吟鸣','sine',1.005,2.35,.56,.34,3500,.025,.23),
  flute: material('短笛气音','sine',1.12,2,.31,.21,1900,.12,.45),
  paper: material('翻页沙响','triangle',.88,2.18,.10,.09,4100,.14,1.0),
  organ: material('低音和声','sine',.97,1.5,.75,.37,940,.078,.28),
  greatbow: material('重弓弦颤','triangle',.52,2.02,.47,.23,1060,.058,.77),
  bow: material('弓弦弹响','triangle',.59,2.94,.4,.13,2300,.05,.69),
  latch: material('弩机咔嗒','square',.3,1.57,.18,.044,3500,.032,1.15),
  whistle: material('箭羽哨音','sine',.55,2,.17,.23,2900,.10,.77),
  ratchet: material('齿轮连扣','square',.55,2.19,.24,.057,2100,.04,.95),
  crystal: material('晶簇共鸣','sine',1.015,2.82,.79,.31,4500,.021,.29),
  sand: material('星砂簌响','triangle',.9,2.26,.14,.13,5800,.19,1.15),
  gear: material('星盘齿鸣','triangle',.92,3.17,.48,.16,2750,.055,.73),
  wing: material('振翅尖啸','sine',.42,1.77,.16,.13,3700,.14,.9),
  gong: material('大钟余震','sine',.94,2.42,.93,.60,1150,.069,.53),
  thunder: material('轰鸣碎石','sawtooth',.27,1.41,.49,.37,540,.29,1.18),
  harp: material('木弦拨奏','triangle',.98,2.03,.47,.33,2100,.03,.28),
}
const noiseCache = new WeakMap()
function noiseBuffer(ctx) {
  if (!noiseCache.has(ctx)) {
    const buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*.4),ctx.sampleRate)
    const data=buffer.getChannelData(0)
    let seed=1847
    for (let i=0;i<data.length;i++) { seed=(Math.imul(seed,1664525)+1013904223)>>>0; data[i]=seed/2147483648-1 }
    noiseCache.set(ctx,buffer)
  }
  return noiseCache.get(ctx)
}
function envelope(ctx, output, start, duration, peak, attack) {
  const gain=ctx.createGain()
  gain.gain.setValueAtTime(.00001,start)
  gain.gain.exponentialRampToValueAtTime(peak,start+attack)
  gain.gain.exponentialRampToValueAtTime(.00001,start+duration)
  gain.connect(output)
  return gain
}
function partial(ctx, output, time, frequency, wave, sweep, duration, peak, attack) {
  const osc=ctx.createOscillator(), gain=envelope(ctx,output,time,duration,peak,attack)
  osc.type=wave; osc.frequency.setValueAtTime(frequency,time)
  osc.frequency.exponentialRampToValueAtTime(Math.max(24,frequency*sweep),time+duration)
  osc.connect(gain);osc.start(time);osc.stop(time+duration+.008)
  osc.onended=()=>{osc.disconnect();gain.disconnect()}
}
export function voiceDuration(p,kind) {
  const spacing=noteSpacing(p,kind)
  return (p.notes.length-1)*spacing+Math.max(MATERIALS[p.material].decay*(kind==='heal'?1.16:1),MATERIALS[p.material].noiseTime)+.03
}
function noteSpacing(p,kind) {
  if (kind==='heal' || kind==='skill') return Math.min(.102,p.release/(p.notes.length+1))
  return ['snap','shake'].includes(p.gesture) ? .073 : Math.min(.05,p.release/(p.notes.length+2))
}
export function soundCharacter(ctx,output,p,kind,pan,volume) {
  const spec=MATERIALS[p.material], start=ctx.currentTime+.008
  const bus=ctx.createGain(), position=ctx.createStereoPanner?.()
  bus.gain.value=volume
  if(position){position.pan.value=Math.max(-.7,Math.min(.7,pan));bus.connect(position);position.connect(output)}
  else bus.connect(output)
  const healing=kind==='heal', spacing=noteSpacing(p,kind)
  for (const [i,note] of p.notes.entries()) {
    const time=start+i*spacing, freq=p.pitch*(healing?1.33:1)*2**(note/12)
    const duration=spec.decay*(healing?1.16:1), level=(i===0?1:.68)/(1+i*.1)
    partial(ctx,bus,time,freq,healing?'sine':spec.wave,spec.sweep,duration,.15*level,healing?.014:.004)
    partial(ctx,bus,time,freq*spec.overtone,'sine',1,duration*.82,.075*spec.ring*level,.003)
    if (!i || ['latch','ratchet','cloth','sand'].includes(p.material)) {
      const noise=ctx.createBufferSource(), filter=ctx.createBiquadFilter()
      noise.buffer=noiseBuffer(ctx);filter.type='bandpass';filter.frequency.value=spec.noiseHz;filter.Q.value=.82
      const gain=envelope(ctx,bus,time,spec.noiseTime,.23*spec.noiseLevel*level*(healing?.52:1),.003)
      noise.connect(filter);filter.connect(gain);noise.start(time,i*.033);noise.stop(time+spec.noiseTime)
      noise.onended=()=>{noise.disconnect();filter.disconnect();gain.disconnect()}
    }
  }
  // A silent source marks the end on the audio clock, including if the context is suspended.
  const done=ctx.createBufferSource()
  done.buffer=ctx.createBuffer(1,1,ctx.sampleRate);done.connect(bus)
  const end=start+voiceDuration(p,kind)
  done.start(end,0,1/ctx.sampleRate)
  const handle={ end, stop() { bus.disconnect();position?.disconnect() } }
  done.onended=()=>{done.disconnect();handle.stop()}
  return handle
}
