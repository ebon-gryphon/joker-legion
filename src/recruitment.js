// The pattern fixes the profession of a single recruit.
import { CARD_CATALOG, getCardDesign } from './cardCatalog.js'
import { rankOf } from './orders.js'
import { JOBS } from './jobs.js'
import { QUALITY_OUTFITS, REPEATED_FACES } from './outfits.js'

function detachment(job, regiment) {
  const members = CARD_CATALOG.filter(card => card.jobId === job && (!regiment || card.type===regiment))
  return {job, name:JOBS[job].name, count:1, members}
}
export const DETACHMENTS = {
  high:detachment('blade'), pair:detachment('priest'),
  twoPair:detachment('pike'), three:detachment('archer'),
  straight:detachment('cavalry'), flush:detachment('fire','mage'),
  fullHouse:detachment('shield'), four:detachment('assassin'),
  straightFlush:detachment('outrider'), five:detachment('duelist'),
  flushHouse:detachment('ward'), flushFive:detachment('sovereign'),
}
// Keep the scoring rank for card identity, score breakdowns and old saves.
export function repeatedRank(key, scoring) {
  const rule = REPEATED_FACES[key]
  if (!rule) return null
  const counts = new Map()
  for (const {rank} of scoring) counts.set(rank,(counts.get(rank) || 0)+1)
  return [...counts].find(([,count]) => count === rule.copies)?.[0] || null
}
export function recruitName(key,grade = 0) {
  const role = {pair:'牧师', three:'弓手', flushHouse:'守护师'}[key] || DETACHMENTS[key].name
  return QUALITY_OUTFITS[grade].name + role
}
export function recruitLook(key, rank, grade = 0) {
  const rule = REPEATED_FACES[key], {members} = DETACHMENTS[key]
  const design = rule && rank ? getCardDesign(rule.suit,rank) : members[Math.min(grade,members.length-1)]
  return {design, name:recruitName(key,grade)}
}
export const musterBonus = scoring => scoring.reduce((total,card) => total + rankOf(card),0)
export const jobOf = unit => JOBS[unit.jobId] || getCardDesign(unit).profession
export const LEADER_ODDS = [
  {rare:8, epic:0, legend:1}, {rare:15, epic:0, legend:2},
  {rare:0, epic:18, legend:4}, {rare:0, epic:0, legend:12}, {rare:0, epic:0, legend:0},
]
export function revealGrade(floor, roll) {
  if (floor >= 4) return floor
  const {rare,epic,legend}=LEADER_ODDS[floor]
  if (roll < legend) return 4
  if (roll < legend+epic) return 3
  if (roll < legend+epic+rare) return 2
  return floor
}
export function oddsText(floor) {
  if (floor>=4) return floor === 4 ? '必出传说' : '继承主将品质'
  const odds=LEADER_ODDS[floor]
  return ['传说 '+odds.legend+'%',odds.rare && '稀有 '+odds.rare+'%',odds.epic && '卓越 '+odds.epic+'%'].filter(Boolean).join(' · ')
}
