// All arrangements share a 32-bar form in 6/8, so a change of scene can join mid-phrase.
export const SCORE_LEVELS = Object.freeze({ title: .34, camp: .23, battle: .16 })
const LOOP_SECONDS = 48

export function createMusic(context) {
  const buffers = new Map()
  const bus = context.createGain()
  bus.gain.value = 0
  bus.connect(context.destination)
  let wanted = null, active = null, epoch = null, disposed = false

  function bufferFor(scene) {
    if (!buffers.has(scene)) {
      const url = window.__LEGION_ASSETS__?.['music-' + scene] ||
        (import.meta.env?.BASE_URL || './') + 'music/' + scene + '.mp3'
      const pending = fetch(url)
        .then(response => {
          if (!response.ok) throw new Error('无法读取配乐 ' + scene)
          return response.arrayBuffer()
        })
        .then(bytes => context.decodeAudioData(bytes))
        .catch(error => { buffers.delete(scene); throw error })
      buffers.set(scene, pending)
    }
    return buffers.get(scene)
  }

  function retire(seconds) {
    if (!active) return
    const { source, gain, began, fade } = active
    const now = context.currentTime
    // A quick second change may interrupt the first fade-in.
    gain.gain.cancelScheduledValues(now)
    gain.gain.setValueAtTime(Math.min(1, Math.max(0, (now-began)/fade)), now)
    gain.gain.linearRampToValueAtTime(0, now + seconds)
    source.stop(now + seconds + .01)
    active = null
  }

  function select(scene, subdued) {
    if (disposed) return
    const level = scene ? SCORE_LEVELS[scene] * (subdued ? .38 : 1) : 0
    bus.gain.setTargetAtTime(level, context.currentTime, scene ? .11 : .012)
    if (wanted === scene) return
    wanted = scene
    if (!scene) { retire(.06); return }
    if (active?.scene === scene) return
    bufferFor(scene).then(buffer => {
      if (disposed || wanted !== scene || active?.scene === scene) return
      const now = context.currentTime
      const fade = active ? 1.0 : .24
      retire(fade)
      const source = context.createBufferSource(), gain = context.createGain()
      source.buffer = buffer
      source.loop = true
      source.loopEnd = Math.min(LOOP_SECONDS, buffer.duration)
      source.connect(gain); gain.connect(bus)
      source.onended = () => { source.disconnect(); gain.disconnect() }
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(1, now + fade)
      epoch ??= now
      source.start(now, (now - epoch) % source.loopEnd)
      active = { scene, source, gain, began: now, fade }
    }).catch(() => {
      // Missing or unsupported music must never interrupt the game or its effects.
      if (wanted === scene) { wanted = null; retire(.2) }
    })
  }

  return {
    select,
    destroy() { disposed = true; wanted = null; retire(.01); bus.disconnect(); buffers.clear() },
  }
}
