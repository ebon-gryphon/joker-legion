import { snapshotGame, restoreGame } from './gameSave.js'

export const storageKey = 'joker.legion.demo.v1'

export function loadExpedition(storage,mode='standard',{includeResult=false}={}) {
  const raw = storage.getItem(mode==='endless'?storageKey+'.endless':storageKey)
  if (!raw) return null
  let data
  try { data = JSON.parse(raw) } catch { return null }
  const run = restoreGame(data)
  if (!run || run.mode!==mode) return null
  if (['retired','lost','won'].includes(run.phase) && !(includeResult && run.runId)) return null
  if (data.handSelection !== 'manual') run.selected = []
  return run
}

export function saveExpedition(storage, game) {
  storage.setItem(game.mode==='endless'?storageKey+'.endless':storageKey, JSON.stringify({ ...snapshotGame(game), handSelection:'manual' }))
}
