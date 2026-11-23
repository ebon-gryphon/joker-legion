import { getCardDesign } from './cardCatalog.js'
import { JOBS } from './jobs.js'
import { QUALITIES } from './quality.js'
import { FUSION_BY_ID } from './forge.js'

/** Presentation only: saved recruitment names and combat identities remain untouched. */
export function soldierIdentity(unit = {}) {
  unit ||= {}
  const design=getCardDesign(unit)
  return {
    name:design?.name || unit.name || JOBS[unit.jobId]?.name || '士兵',
    profession:FUSION_BY_ID[unit.fusion]?.name || JOBS[unit.jobId]?.name || design?.profession?.name || '',
    quality:QUALITIES[unit.grade ?? 0]?.name || '',
    suit:design?.suit || unit.suit || '',rank:design?.rank || unit.rank || '',
  }
}
export const displayName = unit => soldierIdentity(unit).name
export function secondaryIdentity(unit) {
  const {profession,quality,suit,rank}=soldierIdentity(unit)
  return [quality,profession,suit+rank].filter(Boolean).join(' · ')
}
