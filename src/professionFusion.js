import { JOBS } from './jobs.js'

// The twelve recruit contracts. A printed face remains the soldier's identity.
export const FUSION_PROFESSIONS = [
  {id:'blade', pattern:'high', type:'knight'},
  {id:'priest', pattern:'pair', type:'healer'},
  {id:'pike', pattern:'twoPair', type:'knight'},
  {id:'archer', pattern:'three', type:'ranger'},
  {id:'cavalry', pattern:'straight', type:'knight'},
  {id:'fire', pattern:'flush', type:'mage'},
  {id:'shield', pattern:'fullHouse', type:'knight'},
  {id:'assassin', pattern:'four', type:'ranger'},
  {id:'outrider', pattern:'straightFlush', type:'ranger'},
  {id:'duelist', pattern:'five', type:'knight'},
  {id:'ward', pattern:'flushHouse', type:'healer'},
  {id:'sovereign', pattern:'flushFive', type:'knight'},
].map(profession => ({...profession, name:JOBS[profession.id].name}))

const defaults = {knight:'blade', healer:'priest', ranger:'archer', mage:'fire'}
const patterns = Object.fromEntries(FUSION_PROFESSIONS.map(job => [job.pattern,job.id]))
export const professionId = unit => unit?.jobId || patterns[unit?.pattern] || defaults[unit?.type]
export function professionJobs(unit) {
  return [...new Set([professionId(unit), ...(unit?.fusionJobs || [])].filter(id => Object.hasOwn(JOBS,id)))]
}
export const inheritedProfessionJobs = unit => professionJobs(unit).slice(1)
export const combinedProfessionJobs = (leader, donor) => [...new Set([...professionJobs(leader), ...professionJobs(donor)])]
export const professionName = unit => JOBS[professionId(unit)]?.name || unit?.name || '士兵'
export const fusionProfessionNames = unit => professionJobs(unit).map(id => JOBS[id].name)
export const PROFESSION_COMBINATIONS = FUSION_PROFESSIONS.flatMap((left,index) =>
  FUSION_PROFESSIONS.slice(index+1).map(right => ({id:left.id+'+'+right.id, jobs:[left.id,right.id], name:left.name+'＋'+right.name})))

export function validFusionJobs(unit) {
  if (unit.fusionJobs === undefined) return true
  const jobs=unit.fusionJobs
  return Array.isArray(jobs) && jobs.length>=2 && jobs.length<=Object.keys(JOBS).length &&
    jobs[0]===professionId(unit) && new Set(jobs).size===jobs.length && jobs.every(id=>Object.hasOwn(JOBS,id))
}
