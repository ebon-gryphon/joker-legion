/** Shared currency rules. Wave income deliberately has no campaign-length limit. */
export const ECONOMY_VERSION = 1
export const CRYSTALS_PER_WAVE = 5
export const ECONOMY_CONFIG = Object.freeze({
  crystalsPerWave:CRYSTALS_PER_WAVE,
  bonusEvery:5,
  bonus:5,
  legacyGrant:5,
  shopReroll:2,
})

export function waveCrystalIncome(wave) {
  if(!Number.isSafeInteger(wave) || wave<1)return 0
  return CRYSTALS_PER_WAVE+(wave%ECONOMY_CONFIG.bonusEvery===0?ECONOMY_CONFIG.bonus:0)
}

/** All positive crystal income, including sales, is separate from gold-earned statistics. */
export function gainCrystals(game,amount) {
  if(!game || !Number.isSafeInteger(amount) || amount<=0)return 0
  const balance=game.crystals ?? 0,earned=game.stats?.crystalsEarned ?? 0
  if(!Number.isSafeInteger(balance) || balance<0 || !Number.isSafeInteger(earned) || earned<0 ||
      !Number.isSafeInteger(balance+amount) || !Number.isSafeInteger(earned+amount))return 0
  game.crystals=balance+amount
  game.stats ||= {}
  game.stats.crystalsEarned=earned+amount
  return amount
}
