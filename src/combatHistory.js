import { validCombatRecord } from './combatStats.js'

export const combatHistoryKey='joker.legion.combat-history.v1'
export const COMBAT_HISTORY_LIMIT=1000
export const COMBAT_HISTORY_BYTES=3*1024*1024
function bounded(records) {
  const kept=records.slice(-COMBAT_HISTORY_LIMIT)
  while(kept.length && new TextEncoder().encode(JSON.stringify(kept)).length>COMBAT_HISTORY_BYTES) kept.shift()
  return kept
}
export function loadCombatHistory(storage) {
  try {
    const parsed=JSON.parse(storage.getItem(combatHistoryKey) || '[]')
    if(!Array.isArray(parsed)) return []
    const distinct=new Map()
    for(const record of parsed) if(validCombatRecord(record)) distinct.set(record.waveId,record)
    return bounded([...distinct.values()])
  } catch {return []}
}
export function saveCombatHistory(storage,summary) {
  if(!validCombatRecord(summary)) return loadCombatHistory(storage)
  if(new TextEncoder().encode(JSON.stringify([summary])).length>COMBAT_HISTORY_BYTES)
    throw new RangeError('本波战报超过本地历史容量，请先导出已有记录。')
  const records=loadCombatHistory(storage).filter(r=>r.waveId!==summary.waveId)
  records.push(summary)
  const kept=bounded(records)
  storage.setItem(combatHistoryKey,JSON.stringify(kept))
  return kept
}
export function exportCombatHistory(records) {
  return JSON.stringify({schema:'joker-legion-combat-history',version:1,records:records.filter(record=>validCombatRecord(record))},null,2)
}
