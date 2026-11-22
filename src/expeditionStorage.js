import { snapshotGame, restoreGame } from './gameSave.js'

export const storageKey = 'joker.legion.demo.v1'

export function loadExpedition(storage) {
  const raw = storage.getItem(storageKey)
  if (!raw) return null
  let data
  try { data = JSON.parse(raw) } catch { return null }
  const run = restoreGame(data)
  if (!run || run.phase === 'lost' || run.phase === 'won') return null
  if (data.handSelection !== 'manual') run.selected = []
  return run
}

export function saveExpedition(storage, game) {
  storage.setItem(storageKey, JSON.stringify({ ...snapshotGame(game), handSelection:'manual' }))
}
