import {BUILD_PASSIVE_BY_ID} from './buildPassives.js'
/** Display only the acquired unique passives and the recorded trigger counts. */
export function buildPassiveRows(state){
 return [...new Set(state?.ids || [])].filter(id=>BUILD_PASSIVE_BY_ID[id]).map(id=>({...BUILD_PASSIVE_BY_ID[id],
  count:Number.isSafeInteger(state.counts?.[id]) && state.counts[id]>=0?state.counts[id]:null}))
}
