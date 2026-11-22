import { WAVES } from './campaignRules.js'

export function validDailyRecord(value) {
  return !!value && [value.waves,value.gate,value.kills].every(n => Number.isSafeInteger(n) && n >= 0) && value.waves <= WAVES.length
}

// An expedition's date is part of its seed, so a resumed run keeps its original deal.
export function dailySeed(date = new Date()) {
  const day = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date)
  return 'daily-' + day
}

export function dailyRecordKey(seed, doctrine, difficulty) {
  return /^daily-\d{4}-\d{2}-\d{2}$/.test(seed) ? [seed, doctrine, difficulty].join('/') : null
}

export function betterDailyRun(a, b) {
  if (!b) return true
  if (a.waves !== b.waves) return a.waves > b.waves
  if (a.gate !== b.gate) return a.gate > b.gate
  return a.kills > b.kills
}
