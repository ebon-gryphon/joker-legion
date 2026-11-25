import assert from 'node:assert/strict'
import {writeFile} from 'node:fs/promises'
import {runBuildStrategy,BUILD_ROUTES} from './verify-builds.mjs'
import {snapshotGame} from '../src/engine.js'
import {PROFILE_DATABASE} from '../src/legacyStorage.js'

export async function checkLegacyBrowser({folder,run,send,click,button,boot,state,wait,shot,results}){
  const profile=()=>run(`new Promise((resolve,reject)=>{
    const r=indexedDB.open(${JSON.stringify(PROFILE_DATABASE)},1)
    r.onsuccess=()=>{const db=r.result,q=db.transaction('profiles').objectStore('profiles').get('local');
      q.onsuccess=()=>{db.close();resolve(q.result)};q.onerror=()=>reject(q.error)}
    r.onerror=()=>reject(r.error)
  })`)
  await wait('!!document.querySelector(".legacy-result strong")')
  const before=await profile()
  await button('.result-modal','再开一局')
  await click('.legacy-open')
  await wait('document.querySelectorAll("[data-legacy-node]").length===6')
  await click('[data-legacy-node=treasury]')
  await wait('document.querySelector("[data-legacy-node=treasury]")?.dataset.level==="1"')
  const bought=await profile()
  assert.equal(bought.balance,before.balance-3)
  assert.equal(bought.lifetimeEarned,before.lifetimeEarned)
  await shot('legacy-purchase')

  await send('Page.reload',{ignoreCache:true})
  await wait('!!document.querySelector(".cover-start")')
  await click('.legacy-open')
  await wait('document.querySelector("[data-legacy-node=treasury]")?.dataset.level==="1"')
  assert.deepEqual(await profile(),bought)
  await button('.legacy-modal','返回')
  await click('.cover-start')
  await run('(()=>{const i=document.querySelector(".deal-seed input");i.value="4";i.dispatchEvent(new Event("input",{bubbles:true}))})()')
  await click('.intro-start')
  await wait('!document.querySelector(".joker-table") && !!document.querySelector(".scene-shell")')
  const initial=await state('({runId:g.runId,mode:g.mode,seed:g.seed,levels:g.inheritance.levels,gold:g.gold,crystals:g.crystals,energy:g.energy,hand:g.hand,rng:g.rng})')
  assert.equal(initial.seed,'4')
  assert.equal(initial.mode,'standard')
  assert.equal(initial.gold,11);assert.equal(initial.crystals,0);assert.equal(initial.energy,16)
  assert.ok(initial.runId && !before.settledRuns.some(s=>s.runId===initial.runId))
  assert.deepEqual(initial.levels,bought.levels)
  // Use the real purchased opening and its identity to play this same expedition up to the final fight.
  let opening,finalBattle
  const route=runBuildStrategy({...BUILD_ROUTES[0],runId:initial.runId,legacyLevels:initial.levels},{
    fixtures:false,onBattleStart:g=>{if(g.wave===12)finalBattle=snapshotGame(g)},onStart:g=>{opening=snapshotGame(g)}
  })
  assert.deepEqual(opening.hand,initial.hand);assert.equal(opening.rng,initial.rng)
  assert.equal(route.result.phase,'won')
  await writeFile(new URL('legacy-final.json',folder),JSON.stringify(finalBattle))
  await boot('legacy-final')
  await click('.field-controls [aria-label*="倍速"]')
  await button('.field-controls','继续')
  await wait('!!document.querySelector(".legacy-result strong")')
  const credited=await profile(),receipt=credited.settledRuns.find(r=>r.runId===initial.runId)
  assert.equal(receipt.bosses,2);assert.equal(receipt.award.total,12)
  assert.equal(credited.balance,bought.balance+receipt.award.total)
  assert.equal(credited.settledRuns.length,bought.settledRuns.length+1)
  await shot('legacy-settlement')
  await send('Page.reload',{ignoreCache:true})
  await wait('!!document.querySelector(".legacy-result strong")')
  assert.equal(await state('g.runId'),initial.runId);assert.deepEqual(await profile(),credited)
  await button('.result-modal','再开一局')
  await click('.deal-resume')
  await wait('!!document.querySelector(".legacy-result strong")')
  assert.deepEqual(await profile(),credited)
  // Resume the same persisted battle again, independently of the already rendered terminal receipt.
  await button('.result-modal','再开一局');await boot('legacy-final')
  await button('.field-controls','继续')
  await wait('!!document.querySelector(".legacy-result strong")')
  assert.deepEqual(await profile(),credited)
  // Two live cover screens quote the same next level. Only one transaction may buy it.
  await button('.result-modal','再开一局')
  await click('.legacy-open')
  await wait('document.querySelector("[data-legacy-node=treasury]")?.dataset.level==="1"')
  await run('window.otherLegacyTab=window.open(location.href,"legacy-concurrent");true')
  await wait('!!window.otherLegacyTab?.document.querySelector(".legacy-open")')
  await run('window.otherLegacyTab.document.querySelector(".legacy-open").click()')
  await wait('window.otherLegacyTab.document.querySelector("[data-legacy-node=treasury]")?.dataset.level==="1"')
  await run('(()=>{const sel="[data-legacy-node=treasury]";document.querySelector(sel).click();window.otherLegacyTab.document.querySelector(sel).click()})()')
  await wait('document.querySelector("[data-legacy-node=treasury]")?.dataset.level==="2" && window.otherLegacyTab.document.querySelector("[data-legacy-node=treasury]")?.dataset.level==="2"')
  const concurrent=await profile()
  assert.equal(concurrent.balance,credited.balance-6);assert.equal(concurrent.levels.treasury,2)
  assert.equal(concurrent.settledRuns.length,credited.settledRuns.length)
  await run('window.otherLegacyTab.close()')
  // Verify that a damaged profile is refused without overwriting it or the saved commander.
  const writeProfile=value=>run(`new Promise((resolve,reject)=>{
    const r=indexedDB.open(${JSON.stringify(PROFILE_DATABASE)},1)
    r.onsuccess=()=>{const db=r.result,tx=db.transaction('profiles','readwrite')
      tx.objectStore('profiles').put(${JSON.stringify(value)},'local')
      tx.oncomplete=()=>{db.close();resolve(true)};tx.onabort=()=>reject(tx.error)}
    r.onerror=()=>reject(r.error)})`)
  const damaged={...concurrent,balance:concurrent.balance+1}
  const rawRun=await run('localStorage.getItem("joker.legion.demo.v1")')
  try{
    await writeProfile(damaged)
    await button('.legacy-modal','返回');await click('.legacy-open')
    await wait('document.querySelector(".legacy-modal [role=alert]")?.innerText.includes("已保留原档")')
    assert.deepEqual(await profile(),damaged)
    assert.equal(await run('localStorage.getItem("joker.legion.demo.v1")'),rawRun)
    assert.equal(await run('document.querySelectorAll("[data-legacy-node]:not(:disabled)").length'),0)
  }finally{await writeProfile(concurrent)}
  await button('.legacy-modal','重读档案')
  await wait('!document.querySelector(".legacy-modal [role=alert]")')
  results.push({case:'inheritance-damaged-profile',refused:true,untouchedExpedition:true})
  results.push({case:'inheritance-concurrent-purchase',balanceBefore:credited.balance,balanceAfter:concurrent.balance,level:2})
  results.push({case:'inheritance-purchase-refresh-settle-recover',before:before.balance,afterPurchase:bought.balance,
    openingGold:initial.gold,runId:initial.runId,receipt,afterRecovery:credited.balance,ledgerEntries:credited.settledRuns.length})
}
