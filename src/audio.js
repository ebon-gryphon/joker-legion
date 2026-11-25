// Small original Web Audio cues. No network dependency; unlocked by a gesture.
import { soundCharacter } from './combatAudio.js'
import { PERFORMANCES } from './performance.js'
import { createMusic } from './music.js'
// Short presentation accents are independent of ordinary combat voices.
export function presentationPhrase(kind,{grade=0,full=true}={}) {
  if(kind==='reveal' && grade>=4)return [[784,.12,0,'triangle',.021],[1175,.18,.055,'sine',.018]]
  if(kind==='cheer' && grade>4){
    const pitches=grade>=6?[392,587,784,988]:[330,494,659]
    return pitches.slice(0,full?pitches.length:2).map((note,i)=>[note,full?.28:.16,i*(full?.065:.045),'triangle',full?.021:.018])
  }
  if(kind==='order')return [[440,.07,0,'triangle',.016],[660,.09,.045,'sine',.013]]
  if(kind==='first-action')return [[880,.055,0,'sine',.010]]
  return []
}
export function createAudio() {
  let context, master, output, preview, enabled = true, volume=1
  let music, score = null, subdued = false
  const playing = new Set(), recent = new Map(), presentationVoices = new Set()
  function quietBattle() {
    for (const voice of playing) voice.stop()
    playing.clear(); recent.clear()
  }
  function stopPreview() { preview?.stop(); preview = null }
  function unlock() {
    if (!enabled && !score) return
    try {
      if (!context) {
        context = new (window.AudioContext || window.webkitAudioContext)()
        output=context.createGain(); output.gain.value=volume; output.connect(context.destination)
        master = context.createGain(); master.gain.value = enabled ? .76 : 0; master.connect(output)
        music = createMusic(context,output)
        music.select(score, subdued)
      }
      if (context.state === 'suspended' || context.state === 'interrupted') context.resume().catch(() => {})
    } catch {}
  }
  function tone(frequency, duration, at = 0, kind = 'sine', volume = .035) {
    if (!context || !enabled) return
    const oscillator = context.createOscillator(), gain = context.createGain()
    oscillator.type = kind
    oscillator.frequency.setValueAtTime(frequency, context.currentTime + at)
    gain.gain.setValueAtTime(0, context.currentTime + at)
    gain.gain.linearRampToValueAtTime(volume, context.currentTime + at + .008)
    gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + at + duration)
    oscillator.connect(gain); gain.connect(master)
    oscillator.start(context.currentTime + at); oscillator.stop(context.currentTime + at + duration + .03)
  }
  function quietPresentation() {
    for(const voice of presentationVoices){
      try {voice.gain.gain.cancelScheduledValues(context.currentTime);voice.gain.gain.setValueAtTime(.0001,context.currentTime);voice.oscillator.stop(context.currentTime+.012)}catch{}
    }
    presentationVoices.clear()
  }
  function presentationCue(kind,options={}) {
    const phrase=presentationPhrase(kind,options)
    if(!enabled || !phrase.length)return false
    unlock();if(!context || !master)return false
    for(const [frequency,duration,at,wave,volume] of phrase){
      const oscillator=context.createOscillator(),gain=context.createGain(),voice={oscillator,gain}
      oscillator.type=wave;oscillator.frequency.setValueAtTime(frequency,context.currentTime+at)
      gain.gain.setValueAtTime(0,context.currentTime+at);gain.gain.linearRampToValueAtTime(volume,context.currentTime+at+.008)
      gain.gain.exponentialRampToValueAtTime(.0001,context.currentTime+at+duration)
      oscillator.connect(gain);gain.connect(master);presentationVoices.add(voice)
      oscillator.onended=()=>{presentationVoices.delete(voice);oscillator.disconnect?.();gain.disconnect?.()}
      oscillator.start(context.currentTime+at);oscillator.stop(context.currentTime+at+duration+.03)
    }
    return true
  }
  return {
    unlock,
    setVolume(value) { volume=Math.max(0,Math.min(1,value)); if(output)output.gain.setTargetAtTime(volume,context.currentTime,.02) },
    setScore(scene, quiet) {
      score = scene; subdued = quiet
      music?.select(scene, quiet)
    },
    setEnabled(value) {
      enabled = value
      if (master) master.gain.value = enabled ? .76 : 0
      if (!enabled) { quietBattle(); stopPreview(); quietPresentation() }
    },
    quietBattle, stopPreview, presentationCue, quietPresentation,
    previewAction(profile, kind) {
      if (!enabled || !profile) return
      unlock(); stopPreview()
      if (master) preview = soundCharacter(context, master, profile, kind, 0, .92)
    },
    battleActions(events) {
      if (!enabled || !master || context.state !== 'running' || !events.length) return
      const now = context.currentTime
      for (const voice of playing) if (voice.end <= now) playing.delete(voice)
      const priority = e => ['toll','bombard','skill'].includes(e.kind) ? 2 : e.kind === 'heal' ? 1 : 0
      const actors = new Set()
      events.sort((a,b) => priority(b)-priority(a) || (recent.get(a.profile) ?? -1)-(recent.get(b.profile) ?? -1))
      for (const e of events) {
        const profile = PERFORMANCES[e.profile], special = priority(e) === 2
        if (!profile || actors.has(e.actor)) continue
        actors.add(e.actor)
        if (now-(recent.get(e.profile) ?? -1)<.085 || playing.size >= (special?9:6)) continue
        playing.add(soundCharacter(context,master,profile,e.kind,(e.x-500)/700,special?.63:.50))
        recent.set(e.profile,now)
      }
    },
    play(kind) {
      if (!enabled) return
      unlock()
      if (kind === 'select') tone(480, .055, 0, 'triangle', .018)
      else if (kind === 'ghost') { tone(1120,.035,0,'triangle',.025); tone(1480,.06,.06,'triangle',.022) }
      else if (kind === 'mirror') { tone(523,.38,0,'sine',.034); tone(529,.44,.07,'sine',.028); tone(784,.28,.16) }
      else if (kind === 'sleeve') { tone(210,.06,0,'sawtooth',.014); tone(150,.09,.065,'triangle',.031) }
      else if (kind === 'voice') { tone(327,.09,0,'triangle',.042); tone(436,.13,.09,'triangle',.04); tone(218,.13,.25,'square',.015) }
      else if (kind === 'escape') { tone(196,.09,0,'triangle',.04); tone(392,.1,.04,'triangle',.032); tone(784,.12,.095,'sine',.026) }
      else if (kind === 'discard') { tone(260, .1); tone(180, .12, .05) }
      else if (kind === 'deploy') { tone(160, .18, 0, 'triangle', .06); tone(320, .2, .06); tone(480, .22, .11) }
      else if (kind === 'combo') [260, 330, 390, 520, 660].forEach((n, i) => tone(n, .35, i * .07, 'triangle', .04))
      else if (kind === 'fusion') {
        tone(147, .25, 0, 'triangle', .055)
        ;[294, 370, 440, 587, 740].forEach((n, i) => tone(n, .4, .08 + i * .065, 'sine', .045))
      }
      else if (kind === 'bell') { tone(392, .45, 0, 'sine', .045); tone(587, .65, .12, 'sine', .025) }
      else if (kind === 'buy') [440, 660, 880].forEach((n, i) => tone(n, .16, i * .055))
      else if (kind === 'win') [294, 370, 440, 587].forEach((n, i) => tone(n, .5, i * .13, 'triangle'))
      else if (kind === 'lose') [220, 196, 147].forEach((n, i) => tone(n, .5, i * .19, 'triangle'))
    },
    destroy() { quietBattle(); stopPreview(); quietPresentation(); music?.destroy(); context?.close().catch(() => {}) },
  }
}
