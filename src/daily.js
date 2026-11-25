import { WAVES } from './campaignRules.js'

export function validDailyRecord(value,mode=value?.mode || 'standard') {
  return !!value && [value.waves,value.gate,value.kills].every(n => Number.isSafeInteger(n) && n >= 0) && ['standard','endless'].includes(mode) && (value.mode ?? 'standard')===mode && (value.reached===undefined || Number.isSafeInteger(value.reached) && value.reached>=value.waves && value.reached<=value.waves+1) && (mode==='endless'||(value.reached ?? value.waves)<=WAVES.length)
}

// An expedition's date is part of its seed, so a resumed run keeps its original deal.
export function dailySeed(date = new Date()) {
  const day = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date)
  return 'daily-' + day
}

export function dailyRecordKey(seed, doctrine, difficulty, mode='standard') {
  return /^daily-\d{4}-\d{2}-\d{2}$/.test(seed) ? [seed, doctrine, difficulty,...(mode==='endless'?['endless']:[])].join('/') : null
}

export function betterDailyRun(a, b) {
  if (!b) return true
  if(a.mode==='endless' && a.reached!==b.reached)return (a.reached ?? a.waves)>(b.reached ?? b.waves)
  if (a.waves !== b.waves) return a.waves > b.waves
  if (a.gate !== b.gate) return a.gate > b.gate
  return a.kills > b.kills
}
