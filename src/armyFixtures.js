// Pre-existing troops for isolated combat, forge and save-game tests.
import { addUnit, setFormation } from './engine.js'
import { REGIMENTS } from './orders.js'

export function fixtureCompany(game, type) {
  const role = REGIMENTS[type]
  const support = {knight:'healer',healer:'knight',ranger:'healer',mage:'ranger'}[type]
  const ranks = ['Q','8','5','3','7','10','4','J']
  if (!game.allies.length) game.orderTarget = type
  for (let i = 0; i < 2 + game.wave; i++) {
    addUnit(game, type, 'ally', i === 0 ? 2 : 1, { identity: { suit: role.suit, rank: ranks[i] } })
  }
  addUnit(game, support, 'ally', 1, { identity: { suit: REGIMENTS[support].suit, rank: '6' } })
  const original = game.formation
  setFormation(game, original === 'guard' ? 'hunt' : 'guard')
  setFormation(game, original)
  return true
}
