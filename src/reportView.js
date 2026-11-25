import {ORDER_BOOK} from './orders.js'

export function reportLeaders(combat) {
  const orders= new Set(combat?.orders?.map(order=>order.key))
  const hand=Object.keys(ORDER_BOOK).reverse().find(key=>orders.has(key))
  let soldier=null
  let contribution=0
  for (const unit of combat?.units || []) {
    const amount=unit.damage+unit.healed
    if (amount>contribution) {contribution=amount;soldier=unit}
  }
  return {hand:ORDER_BOOK[hand]?.name,soldier}
}
