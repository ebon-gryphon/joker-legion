<script setup>
import KeyMark from './KeyMark.vue'
import { provide, ref, computed, onMounted, onBeforeUnmount, watch, nextTick, toRaw } from 'vue'
import * as rules from './engine.js'
import { createBattlefield } from './battlefield.js'
import { createAudio } from './audio.js'
import PixelSprite from './PixelSprite.vue'
import DraggedSoldier from './DraggedSoldier.vue'
import RelicArt from './RelicArt.vue'
import JokerTable from './JokerTable.vue'
import ScoreToggle from './ScoreToggle.vue'
import ScoreBreakdown from './ScoreBreakdown.vue'
import ScoreSequence from './ScoreSequence.vue'
import RecruitReveal from './RecruitReveal.vue'
import HighTierReveal from './HighTierReveal.vue'
import BattlePayoffs from './BattlePayoffs.vue'
import {createPresentationController} from './presentationEvents.js'
import {createPresentationScene} from './presentationScene.js'
import './presentation.css'
import PerformerGuide from './PerformerGuide.vue'
import { performerOf } from './performers.js'
import { getSpriteFrame, pixelAssetUrl } from './spriteAtlas.js'
import ArmyCodex from './ArmyCodex.vue'
import SuitMark from './SuitMark.vue'
import { ORDER_BOOK } from './orders.js'
import { GRADES, QUALITIES } from './quality.js'
import SquadBench from './SquadBench.vue'
import SoldierSheet from './SoldierSheet.vue'
import { inCampArea } from './formation.js'
import HandCards from './HandCards.vue'
import FieldManual from './FieldManual.vue'
import { loadExpedition, saveExpedition, storageKey } from './expeditionStorage.js'
import { championProgress } from './training.js'
import CampRoster from './CampRoster.vue'
import BattlePlan from './BattlePlan.vue'
import FieldMarket from './FieldMarket.vue'
import {shopActionAvailability} from './fieldShop.js'
import WarCollege from './WarCollege.vue'
import HandBook from './HandBook.vue'
import CardPress from './CardPress.vue'
import { PAY_WAGONS, plannedWagon, activeWagon } from './convoy.js'
import { REGIMENTS, describeBonus } from './orders.js'
import EnemyPortrait from './EnemyPortrait.vue'
import { DIFFICULTIES, FORMATION_BY_ID, nextChime, scoutWave, tollDamage } from './tactics.js'
import { FUSION_BY_ID, FUSION_COST, workshopPairs, mergeWarning } from './forge.js'
import { fusionProfessionNames } from './professionFusion.js'
import MergeWarning from './MergeWarning.vue'
import WaveReport from './WaveReport.vue'
import EconomySummary from './EconomySummary.vue'
import FeintTable from './FeintTable.vue'
import { dailySeed, dailyRecordKey, betterDailyRun, validDailyRecord } from './daily.js'
import { CARD_CATALOG, getCardDesign } from './cardCatalog.js'
import TutorialCoach from './TutorialCoach.vue'
import { initOnboarding, updateOnboarding, skipOnboarding, featureVisible, onboardingView } from './onboarding.js'
import { initializeCombatStats, combatSummary } from './combatStats.js'
import { loadCombatHistory, saveCombatHistory, exportCombatHistory } from './combatHistory.js'
import { displayName, secondaryIdentity } from './soldierIdentity.js'
import './experience.css'
import './economy-ui.css'

const { createGame, previewHand, selectCard, discard, deploy, tick, buyJoker, sellJoker, rerollShop, nextWave, chooseReward } = rules
const doctrines = rules.DOCTRINES
const jokerDefinitions = rules.JOKERS
const waves = rules.WAVES
const suitOrder = ['♠', '♥', '♣', '♦']
const typeNames = { knight: '铁卫', tank: '铁卫', ranger: '游侠', healer: '牧师', mage: '术士', arcanist: '术士' }
const relicOrder = ['iron-banner', 'red-echo', 'third-act', 'blood-pact', 'crossfire', 'diamond-bank', 'heart-engine', 'last-laugh', 'royal-command', 'flush-crown']
const relicFrame = joker => Math.max(0, relicOrder.indexOf(joker?.id))
const cardDesign = card => getCardDesign(card) || CARD_CATALOG[0]
const codex = ref(false), codexSuit = ref('♠'), codexMember = ref(CARD_CATALOG[0])
function openCodex(card) {
  if (card) { codexMember.value = cardDesign(card); codexSuit.value = codexMember.value.suit }
  codex.value = true; audio.unlock()
}
function jokerInfo(item) { return typeof item === 'object' ? { ...jokerDefinitions.find(j => j.id === item.id), ...item } : jokerDefinitions.find(j => j.id === item) || { id: item, name: item, description: '' } }
const newSeed = () => Math.floor(Math.random() * 900000) + 100000
const game = ref(createGame({ seed: newSeed(), doctrine: doctrines[0].id }))
const onboarding = computed(()=>onboardingView(game.value))
const feature = key => featureVisible(game.value,key)
const combatHistory = ref([]), historySelection = ref(''), historyAvailable = ref(true)
let historySavedReport
try { combatHistory.value=loadCombatHistory(localStorage) } catch { historyAvailable.value=false }
const currentCombat = computed(()=>combatSummary(game.value))
const selectedCombat = computed(()=>historySelection.value ? combatHistory.value.find(record=>record.waveId===historySelection.value) : currentCombat.value)
function recordCombatHistory() {
  const summary=game.value.lastCombatReport
  if (!summary?.ended || summary===historySavedReport) return
  try { combatHistory.value=saveCombatHistory(localStorage,summary);historyAvailable.value=true;historySavedReport=summary }
  catch { historyAvailable.value=false }
}
function downloadCombatHistory() {
  recordCombatHistory()
  const records=[...combatHistory.value]
  const current=game.value.lastCombatReport
  if (current?.ended && !records.some(record=>record.waveId===current.waveId)) records.push(current)
  const blob=new Blob([exportCombatHistory(records)],{type:'application/json;charset=utf-8'})
  const url=URL.createObjectURL(blob), link=document.createElement('a')
  const date=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date())
  link.href=url;link.download='joker-legion-battles-'+date+'.json'
  document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)
}
function skipTutorial(scope) { if(skipOnboarding(game.value,scope)) save() }
function openTutorialTarget(target) {
  if (target==='trick') { if(trickBlock.value) openGuide('performer'); else if(!trickArmed.value) armTrick();return }
  setDesk(target)
  if (target==='orders' && onboarding.value?.stepId==='w1-shield') orderDetails.value=true
}
const briefing = ref(false), pokerPanel = ref(null)
const desk = ref('field'), deskBody = ref(null), scenePanel = ref(null), fieldMember = ref(null)
const inspectedSoldier = computed(()=>game.value.allies.find(unit=>unit.id===fieldMember.value))
let soldierReturnDesk = 'field'
let panelTrigger
const controlArt = Object.fromEntries(['stamps','ink','ticket','banner','tab'].map(material => [
  '--control-' + material, 'url("' + pixelAssetUrl('control-' + material) + '")',
]))
const orderDetails = ref(false)
const rarityReceipt=ref(null)
// Visual receipts are deliberately outside the saved game. Reloading never replays a settlement.
const scoreReceipt=ref(null)
const deployReceipt=ref(null),fusionReceipt=ref(null),scoreSequenceRef=ref(null)
const presentationEnabled=ref(true),presentationPaused=ref(false),presentationSpeed=ref(1),presentationConsumedIds=ref([]),presentationEvents=ref([])
const lastCombatCue=computed(()=>presentationEvents.value.filter(event=>event.actual).at(-1))
const performanceFeed=createPresentationController(),presentationScene=createPresentationScene()
const sceneWave=()=>String(game.value.seed)+'/'+game.value.battleId+'/'+game.value.wave
let fusionPresentationId=null
let battlefieldCues=[]
let presentationSuppressedUnits=[]
let presentationSuppressedEffects=[]
function suppressQualityEffects(before) {
  const old=new Set((before.effects || []).map(effect=>effect.id))
  const ids=game.value.effects.filter(effect=>!old.has(effect.id) && effect.type==='burst' && /传说|神话|棱彩|精良|稀有|卓越/.test(String(effect.text || ''))).map(effect=>effect.id)
  presentationSuppressedEffects=[...new Set([...presentationSuppressedEffects,...ids])]
}
const presentationSounds=new Set()
function resetPresentation({fresh=false}={}) {
  scoreReceipt.value=null;deployReceipt.value=null;fusionReceipt.value=null;fusionPresentationId=null
  presentationPaused.value=false;presentationConsumedIds.value=[];presentationEvents.value=[]
  if(fresh)presentationScene.reset();else presentationScene.skip()
  performanceFeed.reset(toRaw(game.value))
  battlefieldCues=[]
  presentationSuppressedUnits=[]
  presentationSuppressedEffects=[]
  presentationSounds.clear()
  const boundary=game.value.logs.findIndex(row=>row.text===waves[game.value.wave-1]?.name+'即将来袭 · 可整编驻军或继续征兵')
  const recent=boundary>=0?game.value.logs.slice(0,boundary):game.value.logs
  const past=(game.value.combatLedger?.orders || []).some(order=>(order.recruitment?.grade || 0)>4) || recent.some(row=>/融合为(神话|棱彩)/.test(row.text))
  presentationScene.prime(sceneWave(),past)
}
function acceptPresentation(before) {
  const facts=performanceFeed.onDeploy(before,toRaw(game.value))
  scoreReceipt.value=game.value.lastDeploy?.scoreTrace || null
  suppressQualityEffects(before)
  const unit=facts && [...game.value.allies,...game.value.reserves].find(member=>member.id===facts.recruitment.unitId)
  deployReceipt.value=facts?{...facts,actualUnit:unit?JSON.parse(JSON.stringify(toRaw(unit))):null,changedCardIds:before.hand.filter(card=>card.baseFace && before.selected.includes(card.id)).map(card=>card.id)}:null
  if(facts?.recruitment.status==='fielded')presentationSuppressedUnits=[...new Set([...presentationSuppressedUnits,facts.recruitment.unitId])]
  if(facts)presentationScene.accept({...facts,id:scoreReceipt.value.id},{waveKey:sceneWave(),army:liveAllies.value.map(unit=>unit.id)})
  presentationPaused.value=false;fusionReceipt.value=null;fusionPresentationId=null
  presentationEvents.value=performanceFeed.getEvents()
}
function presentationStep({id,step,done}) {
  if(done || id!==scoreReceipt.value?.id || !presentationEnabled.value || reducedMotion.value)return
  const key=id+'/'+step.id
  if(presentationSounds.has(key))return
  presentationSounds.add(key)
  presentationScene.stage(id,step.id)
  if(step.id==='quality' && game.value.lastDeploy.captainGrade>=4)audio.presentationCue?.('reveal',{grade:game.value.lastDeploy.captainGrade})
  if(step.id==='muster' && game.value.lastDeploy.captainGrade>4)audio.presentationCue?.('cheer',{grade:game.value.lastDeploy.captainGrade,full:presentationScene.get().cheer?.full})
  if(step.id==='order')audio.presentationCue?.('order')
}
function presentationComplete({id,reason}) {
  if(!presentationConsumedIds.value.includes(id))presentationConsumedIds.value=[...presentationConsumedIds.value,id].slice(-100)
  presentationScene.complete(id,reason)
  if(reason!=='finished')audio.quietPresentation?.()
}
function skipPresentation() {scoreSequenceRef.value?.finish('skipped');presentationScene.skip();battlefieldCues=[];fusionReceipt.value=null;fusionPresentationId=null;audio.quietPresentation?.()}
function togglePresentation() {
  presentationEnabled.value=!presentationEnabled.value
  performanceFeed.setEnabled(presentationEnabled.value);presentationScene.setEnabled(presentationEnabled.value)
  if(!presentationEnabled.value){skipPresentation();battlefieldCues=[];presentationEvents.value=[]}
}
let receiptTimer
const campTabs = [['orders','出牌征兵'],['feint','亮假旗'],['forge','升星融合'],['brief','阵型军议'],['press','牌匠改印']]
const shopTabs = [['brief','下波军情'],['report','本波战报']]
const trickArmed = ref(false), palmId = ref(null)
const hero = computed(() => performerOf(game.value.doctrine))
const palmTarget = computed(() => game.value.hand.find(card => card.id === palmId.value))
const fieldSide = computed(() => ({ mirror:'ally', escape:'ally', bell:'enemy' })[hero.value.id])
const trickTargets = computed(() => fieldSide.value === 'enemy' ? liveEnemies.value : liveAllies.value)
const secondaryTypes = computed(() => Object.keys(REGIMENTS).filter(type => roleCounts.value[type] && type !== (preview.value.target || game.value.orderTarget)))
const echoDescription = computed(() => preview.value.bonus ? describeBonus(rules.echoOrderBonus(preview.value.bonus)) : '')
const trickBlock = computed(() => {
  const g = game.value, id = hero.value.id
  if (g.trickUsed) {
    const kept = g.hand.find(card => card.id === g.keptCardId)
    return kept ? '袖中 ' + kept.suit + kept.rank + ' · 下波起手取回' : '本波已用'
  }
  if (id === 'sleeve') return g.phase === 'shop' ? '' : g.wave === waves.length ? '终幕无下波留牌' : '战后商店可藏一张手牌'
  if (id === 'ghost' || id === 'voice') {
    if (!rules.inCamp(g)) return '战前可用'
    if (!ordersOpen.value) return '出牌次数已用完'
    if (id === 'voice' && !g.paidHandsLeft && g.energy < 2) return '军令不足'
    return ''
  }
  if (g.phase !== 'battle') return '交战后可用'
  if (id === 'mirror' && g.allies.length >= rules.FIELD_LIMIT) return '兵位已满'
  if (!liveAllies.value.length) return '等待友军'
  return trickTargets.value.length ? '' : '等待敌军入场'
})
function cancelTrick() { trickArmed.value = false; palmId.value = null }
function armTrick() {
  if (trickArmed.value) { cancelTrick(); return }
  if (trickBlock.value) return
  if (['ghost','voice'].includes(hero.value.id)) setDesk('orders')
  else setDesk('field')
  trickArmed.value = true
  if (hero.value.id === 'ghost') palmId.value = game.value.selected.at(-1) || null
}
function playTrick(id, step) {
  const before=hero.value.id==='voice'?rules.snapshotGame(toRaw(game.value)):null
  if (!trickArmed.value || !rules.useTrick(game.value,id,step)) return
  updateOnboarding(game.value,'trick')
  cancelTrick()
  if (hero.value.id === 'voice') { acceptPresentation(before); showRarity() }
  audio.play(hero.value.id)
  if (hero.value.id!=='voice' || !scoreReceipt.value) note(game.value.logs[0].text)
  save()
}
function openGuide(id) {
  if (id === 'allies') openCodex()
  else if (id === 'book' || id === 'performer') pokerPanel.value = id
  else briefing.value = 'guide'
}
const postBattleDesk = computed(() => game.value.rewardChosen ? 'market' : game.value.victorySeen ? 'supply' : 'victory')
const finalSettlement=computed(()=>game.value.phase==='shop' && game.value.finalWaveCleared?(game.value.rewardChosen?'finish':'claim'):'')
function openSupplies() {
  if (game.value.phase !== 'shop' || game.value.rewardChosen) return
  game.value.victorySeen = true
  setDesk('supply')
  save()
}
const deskStamps = { orders:'cards', feint:'trick', forge:'forge', brief:'enemies', press:'press', watch:'time', supply:'order', market:'coin', college:'book', report:'order' }
const battleTabs = [['watch','战况']]
const deskTabs = computed(()=>(game.value.phase==='ready' ? campTabs : game.value.phase==='shop' ? shopTabs : battleTabs).filter(([id])=>feature(id)))
const deskName = computed(() => [...campTabs, ...shopTabs, ...battleTabs, ['soldier','士兵详情'],['supply','选择补给'],['victory','守城战报'],['market','小丑商店']].find(([id]) => id === desk.value)?.[1] || '随军手册')
function setDesk(id, trigger) {
  if (!feature(id)) { note('该功能会在后续引导开放，也可随时结束引导开放全部。');return }
  if (game.value.phase === 'shop' && (id === 'field' || ['victory','supply','market'].includes(id))) id = postBattleDesk.value
  if (id === 'orders' && !rules.inCamp(game.value)) return
  if(desk.value==='forge' && id!=='forge' && fusionReceipt.value)skipPresentation()
  cancelTrick()
  cancelFieldDrag()
  if (id!=='soldier') fieldMember.value=null
  if (desk.value === 'field' && id !== 'field') panelTrigger = trigger || document.activeElement
  desk.value=id
  nextTick(() => {
    if (desk.value !== id) return
    if (id === 'field') {
      if (panelTrigger?.isConnected && panelTrigger.getClientRects().length) panelTrigger.focus({preventScroll:true})
      panelTrigger = null
    } else {
      if (deskBody.value) deskBody.value.scrollTop=0
      scenePanel.value?.focus({preventScroll:true})
    }
  })
}
async function toggleOrderDetails() {
  orderDetails.value = !orderDetails.value
  if (orderDetails.value) {
    await nextTick()
    deskBody.value?.querySelector('#order-details')?.scrollIntoView({block:'nearest'})
  }
}
function enterPhase() {
  orderDetails.value=false
  setDesk(game.value.phase === 'ready' ? 'orders' : game.value.phase === 'shop' ? postBattleDesk.value : 'field')
}
const intro = ref(true), help = ref(false), confirmRestart = ref(false), inspectedJoker = ref(null)
const promotionPending = ref(null)
const quickPromotionWarning = computed(()=>promotionPending.value && mergeWarning(game.value,promotionPending.value.leaderId,promotionPending.value.donorId,'promote'))
const pickedDifficulty = ref('standard')
const pickedSeed = ref('')
const pickedDoctrine = ref(doctrines[0].id), manualPaused = ref(false), hidden = ref(document.hidden)
const guideHero = computed(() => intro.value ? performerOf(pickedDoctrine.value) : hero.value)
const guidePartner = computed(() => {
  const doctrine = doctrines.find(choice => choice.id === guideHero.value.doctrine)
  return jokerDefinitions.find(joker => joker.id === doctrine.joker)
})
const sound = ref(true), speed = ref(1), sortMode = ref('suit'), toast = ref(null)
const musicEnabled = ref(true), interacted = ref(false)
const musicActive = computed(() => musicEnabled.value && interacted.value)
const savedGame = ref(null), storageAvailable = ref(true), reducedMotion = ref(matchMedia('(prefers-reduced-motion: reduce)').matches)
const canvas = ref(null), modalEl = ref(null), introEl = ref(null)
let frame, renderer, lastTime = 0, toastTimer, saveClock = 0, lastFocus
const audio = createAudio()
provide('legionAudio',{audio,sound,toggleSound,reducedMotion,musicActive,toggleMusic})
const dealDay = ref(dailySeed()), requestedSeed = ref(null), dailyRecords = ref({})
const selectedDailyBest = computed(() => dailyRecords.value[dailyRecordKey(dealDay.value,pickedDoctrine.value,pickedDifficulty.value)])
const runRecordKey = computed(() => dailyRecordKey(game.value.seed,game.value.doctrine,game.value.difficulty))
const runBest = computed(() => dailyRecords.value[runRecordKey.value])
try {
  const entries = JSON.parse(localStorage.getItem(storageKey + '.daily') || '{}')
  dailyRecords.value = Object.fromEntries(Object.entries(entries).filter(([,v]) => validDailyRecord(v)))
} catch { /* A damaged scorecard does not affect the expedition save. */ }
function recordDaily() {
  if (!runRecordKey.value) return
  const g = game.value
  const score = { waves:g.stats.wavesCleared, gate:Math.ceil(g.baseHp), kills:g.stats.kills }
  if (!betterDailyRun(score,runBest.value)) return
  dailyRecords.value[runRecordKey.value] = score
  try { localStorage.setItem(storageKey + '.daily',JSON.stringify(dailyRecords.value)) } catch { storageAvailable.value=false }
}
try {
  sound.value = localStorage.getItem(`${storageKey}.sound`) !== 'off'
  const preference = localStorage.getItem(`${storageKey}.music`)
  musicEnabled.value = preference === null ? sound.value : preference !== 'off'
  savedGame.value = loadExpedition(localStorage)
} catch { storageAvailable.value = false }
audio.setEnabled(sound.value)
const inPlay = computed(() => ['ready', 'battle'].includes(game.value.phase))
const hasModal = computed(() => intro.value || pokerPanel.value || briefing.value || codex.value || help.value || confirmRestart.value || !!promotionPending.value || !!inspectedJoker.value || ['won', 'lost'].includes(game.value.phase))
const paused = computed(() => manualPaused.value || (desk.value !== 'field' && desk.value !== 'watch') || trickArmed.value || hidden.value || hasModal.value || game.value.phase !== 'battle')
const musicScene = computed(() => {
  if (!musicActive.value || hidden.value) return null
  if (intro.value) return 'title'
  if (game.value.phase === 'battle') return 'battle'
  if (game.value.phase === 'ready' || game.value.phase === 'shop') return 'camp'
  return null
})
const quietMusic = computed(() => Boolean(briefing.value || pokerPanel.value || codex.value || help.value ||
  (musicScene.value === 'battle' && paused.value)))
watch([musicScene, quietMusic], ([scene, quiet]) => audio.setScore(scene, quiet), { immediate:true, flush:'sync' })
const chosenDoctrine = computed(() => doctrines.find(d => d.id === game.value.doctrine) || doctrines.find(d => d.id === game.value.doctrine?.id) || doctrines[0])
const waveInfo = computed(() => waves[game.value.wave - 1] || {})
const secondsLeft = computed(() => Math.max(0, Math.ceil(waveInfo.value.duration - game.value.waveTime - 1e-8)))
const timeoutMessage = computed(() => game.value.waveTimeout ? rules.describeWaveTimeout(game.value.waveTimeout) : '')
const feintHint = computed(() => {
  const g = game.value, plan = g.feint
  if (!plan?.target) return ''
  if (plan.result === 'fooled') return '敌军中计 · 收回 ' + rules.FEINT.payout + ' 金币'
  if (plan.result === 'missed') return '诈阵落空 · 诱饵金 −' + rules.FEINT.stake
  if (g.waveTime < rules.FEINT.opens) return '敌将盯上' + REGIMENTS[plan.target].name + ' · ' + Math.ceil(rules.FEINT.opens-g.waveTime) + ' 秒后开始追击'
  return '敌军追击' + REGIMENTS[plan.target].name + ' · ' + Math.max(0,Math.ceil(rules.FEINT.reveal - g.waveTime)) + ' 秒后揭晓诈阵'
})
function chooseFlag(type) {
  if (rules.setFeintFlag(game.value, type)) { audio.play('select'); save() }
}
const scoutSchedule = computed(() => game.value.phase === 'shop' ? rules.waveSchedule(game.value.seed, game.value.wave + 1, game.value.difficulty) : game.value.schedule)
const scout = computed(() => scoutWave(scoutSchedule.value))
const scoutWaveInfo = computed(() => waves[game.value.wave - (game.value.phase === 'shop' ? 0 : 1)])
const formation = computed(() => FORMATION_BY_ID[game.value.formation])
const chime = computed(() => game.value.phase === 'battle' ? nextChime(game.value) : null)
const fieldDrag=ref(null)
let feedTimer
function cancelFieldDrag() {
  clearTimeout(feedTimer)
  fieldDrag.value=null
}
function closeDesk() { setDesk(desk.value==='soldier' ? soldierReturnDesk : 'field') }
function showSoldier(id) {
  if (!id || game.value.phase!=='ready') return
  if (desk.value!=='soldier') soldierReturnDesk=desk.value
  fieldMember.value=id
  setDesk('soldier')
}
function chooseChampion(id) {
  if (!rules.designateChampion(game.value,id)) return
  audio.play('combo')
  note('已立为主将并锁定 · 跨波保留培养进度')
  save()
}
function lockSoldier(id) {
  if (!rules.toggleSoldierLock(game.value,id)) return
  audio.play('select');save()
}
function trainSoldier(donor,target) {
  const result=rules.drillPreview(game.value,donor,target)
  if(result && rules.drill(game.value,donor,target)) { audio.play(result.kind==='ascend' ? 'fusion' : 'buy');note(result.text);save() }
}
function fieldDown(e) {
  if(!e.isPrimary || e.button!==0 || hasModal.value) return
  if(game.value.phase!=='ready' || trickArmed.value) return
  const id=renderer.pickUnit(e.clientX,e.clientY,'ally')
  if(!id) { if(desk.value==='soldier') closeDesk(); return }
  fieldDrag.value={id,grip:renderer.dragGrip(id,e.clientX,e.clientY),touch:e.pointerType==='touch',pointer:e.pointerId,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moving:false,target:null,feed:false,point:null}
  e.currentTarget.setPointerCapture(e.pointerId)
}
function fieldMove(e) {
  const d=fieldDrag.value
  if(!d || d.pointer!==e.pointerId || (!d.moving && Math.hypot(e.clientX-d.startX,e.clientY-d.startY)<6)) return
  d.moving=true;d.x=e.clientX;d.y=e.clientY
  const overField=document.elementFromPoint(d.x,d.y)===canvas.value
  d.point=overField ? renderer.campPoint(d.x,d.y) : null
  const target=overField && feature('training') && !draggedFace.value?.locked ? renderer.pickUnit(d.x,d.y,'ally',d.id) : null
  if (d.target===target) return
  clearTimeout(feedTimer);d.target=target;d.feed=false
  if (target && rules.drillPreview(game.value,d.id,target)?.kind==='ascend') { d.feed=true; return }
  if (target) feedTimer=setTimeout(()=>{ if(fieldDrag.value===d) d.feed=true },450)
}
const draggedFace=computed(()=>game.value.allies.find(u=>u.id===fieldDrag.value?.id))
const dragHint=computed(()=>{
  const d=fieldDrag.value
  if (!d) return ''
  if (d.feed) {
    const plan = rules.drillPreview(game.value,d.id,d.target)
    return plan?.kind==='ascend' ? '松手融合 · '+QUALITIES[plan.grade].name : plan ? '松手传授 · +'+plan.xp+'经验' : ''
  }
  if (d.target) return '停留可传授'
  return d.point && inCampArea(d.point.x,d.point.y) ? '' : '移入我方布阵区'
})
function fieldUp(e) {
  if (!e.isPrimary || e.button!==0) return
  const d=fieldDrag.value
  if (!d) {
    if (!hasModal.value && trickArmed.value && fieldSide.value) {
      const id=renderer?.pickUnit?.(e.clientX,e.clientY,fieldSide.value)
      if (id) playTrick(id)
    }
    return
  }
  if (d.pointer!==e.pointerId) return
  cancelFieldDrag()
  if (hasModal.value || game.value.phase!=='ready' || document.elementFromPoint(e.clientX,e.clientY)!==canvas.value) return
  if (!d.moving) { showSoldier(d.id); return }
  const target=renderer.pickUnit(e.clientX,e.clientY,'ally',d.id)
  if (feature('training') && target && ((d.feed && d.target===target) || rules.drillPreview(game.value,d.id,target)?.kind==='ascend')) {
    trainSoldier(d.id,target)
    if (fieldMember.value===d.id) showSoldier(target)
    return
  }
  const point=renderer.campPoint(e.clientX,e.clientY)
  if (rules.moveInCamp(game.value,d.id,point.x,point.y)) { updateOnboarding(game.value,'move',{id:d.id});save() }
}
function changeFormation(id) {
  const previous=game.value.formation
  if (rules.setFormation(game.value, id)) { updateOnboarding(game.value,'formation',{previous});audio.play('select');save() }
}
const preview = computed(() => previewHand(game.value, game.value.selected))
const wagon = computed(() => activeWagon(game.value))
const takenWagon = computed(() => PAY_WAGONS.find(item => item.id === game.value.convoyTaken))
const wagonHint = computed(() => {
  const g = game.value
  if (g.wave > 2 || !['ready','battle'].includes(g.phase)) return ''
  if (takenWagon.value) return takenWagon.value.name + '已截获 · +' + takenWagon.value.gold + ' 金'
  const plan = plannedWagon(g)
  if (g.phase === 'ready') return plan ? '已布置截' + plan.name + ' · 赏金 ' + plan.gold + ' 金' : '截车看战前单手最高分 · 40 分得 3 金，100 分得 7 金'
  if (plan && g.waveTime < plan.opens) return plan.name + '将在 ' + Math.ceil(plan.opens - g.waveTime) + ' 秒后抵达'
  return wagon.value ? wagon.value.name + '过境 · 战前牌分未达门槛' : g.waveTime >= 15 ? '饷车已驶离' : '饷车正在路上'
})
const selectedCount = computed(() => game.value.selected.length)
const ownJokers = computed(() => game.value.jokers.map(jokerInfo))
const shopJokers = computed(() => (game.value.shop || []).map(jokerInfo))
const rankValue = rank => ({ A: 14, K: 13, Q: 12, J: 11 }[rank] || Number(rank))
const sortedHand = computed(() => game.value.hand.map(card => rules.playedFace(game.value,card)).sort((a, b) => sortMode.value === 'suit' ? suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit) || rankValue(b.rank) - rankValue(a.rank) : rankValue(b.rank) - rankValue(a.rank) || suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit)))
const liveAllies = computed(() => game.value.allies.filter(u => u.hp > 0 && !u.dead))
const liveEnemies = computed(() => game.value.enemies.filter(u => u.hp > 0 && !u.dead))
const recentLogs = computed(() => game.value.logs.slice(0, 5))
const veteran = computed(() => {
  if (!['won', 'lost'].includes(game.value.phase)) return null
  return rules.vanguard(game.value).find(unit => unit.fusion || unit.fusionJobs?.length > 1)
})
const report = computed(() => Object.entries(game.value.waveReport).map(([type, entry]) => ({
  type, label: typeNames[type], damage: Math.round(entry.damage), healed: Math.round(entry.healed),
})).filter(row => row.damage || row.healed).sort((a, b) => b.damage - a.damage))
function appoint(id, branch) {
  if (rules.commission(game.value, id, branch)) { audio.play('combo'); save() }
}
const ordersOpen = computed(() => rules.canSelectHand(game.value))
const canDeploy = computed(() => ordersOpen.value && preview.value.canDeploy)
const handPrice = computed(() => rules.extraHandPrice(game.value))
function purchaseHand(event) {
  if (event.detail > 1 || !rules.buyExtraHand(game.value,handPrice.value)) return
  audio.play('buy')
  note('已加购一手 · 下一手免军令')
  save()
}
const redrawFee = computed(() => rules.redrawPrice(game.value))
const canDiscard = computed(() => ordersOpen.value && selectedCount.value > 0 &&
  (game.value.discards > 0 || (game.value.phase === 'ready' && game.value.gold >= redrawFee.value)))
function sendArmy() {
  cancelTrick()
  if (rules.beginBattle(game.value)) { updateOnboarding(game.value,'battle');manualPaused.value = false;audio.play('deploy');save() }
}
const pairs = computed(() => workshopPairs(game.value))
const availableRecipes = computed(() => pairs.value.profession.length)
const workshopHint = computed(() => pairs.value.ascend.length ? '可升品质 · 免费融合' : availableRecipes.value ? (game.value.gold < FUSION_COST ? '材料齐 · 需 ' + FUSION_COST + ' 金币' : availableRecipes.value + ' 种职业可融合') : pairs.value.promote.length ? '有士兵可升星' : '查看升星与融合配方')
function forge(leader, donor, kind) {
  const before=rules.snapshotGame(toRaw(game.value))
  if (!rules.forgeUnit(game.value, leader, donor, kind)) return false
  const facts=performanceFeed.onAscend(before,toRaw(game.value),leader)
  if(facts) {
    clearTimeout(toastTimer);toast.value=null
    suppressQualityEffects(before)
    presentationSuppressedUnits=[...new Set([...presentationSuppressedUnits,leader])]
    fusionPresentationId='ascend/'+sceneWave()+'/'+game.value.fusions
    const unit=[...game.value.allies,...game.value.reserves].find(member=>member.id===leader)
    fusionReceipt.value={actualUnit:unit?JSON.parse(JSON.stringify(toRaw(unit))):null,recruitment:{...facts,status:facts.placement==='reserve'?'reserve':'fielded',reason:facts.placement==='reserve'?'融合升品完成，仍在候补席，未增加上阵人数。':'融合升品完成，主兵保留身份并在原兵位。'}}
    presentationScene.accept({id:fusionPresentationId,recruitment:{...fusionReceipt.value.recruitment,unitId:leader}},{waveKey:sceneWave(),army:facts.armyUnitIds,immediate:true})
    if(!presentationEnabled.value || reducedMotion.value)presentationScene.skip()
    else {audio.presentationCue?.('reveal',{grade:facts.grade});audio.presentationCue?.('cheer',{grade:facts.grade,full:presentationScene.get().cheer?.full})}
  }
  audio.play(kind === 'promote' ? 'combo' : 'fusion')
  save()
  return true
}
function target(type) {
  if (rules.setOrderTarget(game.value, type)) { audio.play('select'); save() }
}
function applyPrint(source, targets) {
  if (!rules.printCards(game.value, source, targets)) return false
  audio.play('buy')
  save()
  return true
}
function train(key) {
  if (rules.trainOrder(game.value, key)) { audio.play('combo'); note('牌谱已升至 Lv.' + game.value.handLevels[key]); save() }
}
const roleCounts = computed(() => {
  const counts = { knight: 0, healer: 0, ranger: 0, mage: 0 }
  for (const unit of [...liveAllies.value, ...preview.value.recruits]) counts[unit.type]++
  return counts
})
function receiptPortrait(deal) {
  return getSpriteFrame({appearanceId:deal.leadFace,pattern:deal.key,grade:deal.captainGrade ?? deal.grade})
}
const lastLead = computed(() => getCardDesign(game.value.lastDeploy?.leadFace))
const recruitGroups = computed(() => {
  const groups = new Map()
  for (const recruit of preview.value.recruits) {
    const key = recruit.appearanceId + '-' + recruit.level
    if (groups.has(key)) groups.get(key).count++
    else groups.set(key, { key, name:displayName(recruit), detail:secondaryIdentity(recruit), portrait:getSpriteFrame(recruit), level: recruit.level, count: 1 })
  }
  return [...groups.values()]
})
const deployLabel = computed(() => {
  if (!ordersOpen.value) return '出牌次数已用完'
  if (!selectedCount.value) return '选牌征兵'
  if (preview.value.reason) return preview.value.reason
  if (preview.value.waiting) return '打出' + preview.value.name + ' · 传说候补'
  if (!preview.value.actualUnits) return '打出' + preview.value.name + ' · 转训／候补'
  return '打出' + preview.value.name + ' · ' + preview.value.actualUnits + '人'
})
const phaseLabel = computed(() => ({ ready:'战前准备', shop:'战后商店', won:'远征胜利', lost:'城门失守' }[game.value.phase] || (paused.value?'战术暂停':'交战中')))
const regiments = computed(()=>Object.entries(REGIMENTS).map(([type,role])=>{
  const members=liveAllies.value.filter(unit=>unit.type===type)
  const hp=members.reduce((n,u)=>n+u.hp,0), max=members.reduce((n,u)=>n+u.maxHp,0)
  return {type,name:role.name,leader:members[0] && getSpriteFrame(members[0]),count:members.length,health:max?Math.ceil(100*hp/max):0}
}))
const rewardStatus = choice => rules.rewardAvailability(game.value,choice.id)
const rewardDirection={army:'部队强化',poker:'扑克改造',resource:'资源补给'}
function rewardDescription(choice) {
  const status=rewardStatus(choice)
  if (!status.available && !game.value.rewardChosen) return status.reason
  return choice.description || choice.desc
}
const saleStatus=computed(()=>inspectedJoker.value?shopActionAvailability(game.value,'sell',inspectedJoker.value.id):null)
function note(text, tone = 'info') {
  toast.value = { text, tone }; clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = null }, 3000)
}
function save() {
  if (intro.value) return
  updateOnboarding(game.value,'state')
  try { saveExpedition(localStorage,game.value); storageAvailable.value = true } catch { storageAvailable.value = false }
  recordCombatHistory()
}
function showRunSelection() {
  if (!intro.value) {
    cancelTrick(); save(); dealDay.value = dailySeed()
    resetPresentation()
    savedGame.value = ['won', 'lost'].includes(game.value.phase) ? null : game.value
    pickedDoctrine.value = game.value.doctrine
    pickedDifficulty.value = game.value.difficulty
    intro.value = true
  }
}
function requestStart(daily = false) {
  dealDay.value = dailySeed()
  requestedSeed.value = daily ? dealDay.value : pickedSeed.value.trim() || newSeed()
  if (savedGame.value) confirmRestart.value = true
  else startRun()
}
function startRun(seed = requestedSeed.value ?? newSeed(), doctrine = pickedDoctrine.value, difficulty = pickedDifficulty.value) {
  requestedSeed.value = null
  game.value = createGame({ seed, doctrine, difficulty })
  resetPresentation({fresh:true})
  initializeCombatStats(game.value,{runId:globalThis.crypto?.randomUUID?.() || 'run-'+Date.now()+'-'+newSeed()})
  initOnboarding(game.value,{enabled:true})
  historySelection.value=''
  enterPhase(); briefing.value = false; manualPaused.value = false; intro.value = false; confirmRestart.value = false; promotionPending.value=null
  audio.play('deploy'); save()
  nextTick(() => window.scrollTo({ top: 0, behavior: 'instant' }))
}
function resumeRun() {
  if (!savedGame.value) return
  game.value = savedGame.value; enterPhase(); pickedDifficulty.value = game.value.difficulty; intro.value = false; manualPaused.value = game.value.phase === 'battle'; audio.unlock()
  resetPresentation()
  recordCombatHistory()
  if (!game.value.selected.length) note(game.value.phase === 'battle' ? '战斗已恢复，点击继续即可推进。' : game.value.phase === 'shop' ? '已返回战后商店。' : '已恢复本波备战进度。')
}
function chooseCard(id) {
  if (trickArmed.value && hero.value.id === 'ghost') { palmId.value = id; return }
  if (!ordersOpen.value || intro.value || !selectCard(game.value,id)) return
  // The selected hand now supplies its own feedback; keep its formula clear of an older notice.
  clearTimeout(toastTimer);toast.value=null
  audio.play('select')
  save()
}
function showRarity() {
  const deal=game.value.lastDeploy
  clearTimeout(receiptTimer)
  rarityReceipt.value=null
  if (deal.captainGrade>deal.grade || deal.captainGrade===4) {
    if (!scoreReceipt.value) {
      audio.play('combo')
      rarityReceipt.value=deal
      receiptTimer=setTimeout(()=>{rarityReceipt.value=null},2200)
    }
  }
}
function doDeploy() {
  if (!canDeploy.value || trickArmed.value) return
  const name = preview.value.name
  const before=rules.snapshotGame(toRaw(game.value))
  if (deploy(game.value) !== false) {
    acceptPresentation(before)
    updateOnboarding(game.value,'deploy')
    audio.play(['高牌', '对子'].includes(name) ? 'deploy' : 'combo')
    if (!scoreReceipt.value) note(name+' · '+game.value.lastDeploy.score+' 分 · '+game.value.lastDeploy.profession+' '+game.value.lastDeploy.count+' 人入阵')
    showRarity();save()
  }
}
function doDiscard() {
  if (canDiscard.value && discard(game.value)) { audio.play('discard'); save() }
}
function suggest() {
  if (!ordersOpen.value || trickArmed.value) return
  const ids = rules.recommendHand(toRaw(game.value))
  if (!ids) { note('当前军令不足'); return }
  game.value.selected = ids
  audio.play('select')
  save()
}
const quickPair = computed(() => pairs.value.promote[0])
function quickPromote() {
  const pair = quickPair.value
  if (!pair) return
  const warning=mergeWarning(game.value,pair.leader.id,pair.donor.id,'promote')
  if (!warning) return
  if (warning.requiresConfirmation) {
    promotionPending.value={leaderId:pair.leader.id,donorId:pair.donor.id,fingerprint:warning.fingerprint,changed:false}
    return
  }
  commitQuickPromotion(pair.leader.id,pair.donor.id)
}
function commitQuickPromotion(leaderId,donorId) {
  const unit=game.value.allies.find(u=>u.id===leaderId)
  if (unit && forge(leaderId,donorId,'promote')) {
    promotionPending.value=null
    note(displayName(unit)+'升至'+unit.level+'星 · 腾出 1 个兵位')
  }
}
function confirmQuickPromotion() {
  const pending=promotionPending.value,warning=quickPromotionWarning.value
  if (!pending || !warning) return
  if (pending.fingerprint!==warning.fingerprint) {
    promotionPending.value={...pending,fingerprint:warning.fingerprint,changed:true}
    return
  }
  commitQuickPromotion(pending.leaderId,pending.donorId)
}
function purchase(joker) {
  const before=game.value.crystals
  if (buyJoker(game.value, joker.id) !== false) { audio.play('buy'); note(joker.name + ' 已购入 · −' + (before-game.value.crystals) + ' 蓝水晶'); save() }
}
function sell(joker) {
  const before=game.value.crystals
  if (sellJoker(game.value, joker.id) !== false) { audio.play('buy'); note('已出售' + joker.name + ' · +' + (game.value.crystals-before) + ' 蓝水晶'); inspectedJoker.value = null; save() }
}
function reroll() {const before=game.value.crystals;if (rerollShop(game.value) !== false) { audio.play('discard'); note('货架已补货 · −'+(before-game.value.crystals)+' 蓝水晶'); save() } }
function reward(choice) {
  if (!rewardStatus(choice).available) { note(rewardStatus(choice).reason);return }
  if (chooseReward(game.value, choice.id) !== false) {
    audio.play('buy'); save(); setDesk('market'); note('已领取' + choice.name)
  }
}
function advance() {
  if (nextWave(game.value) !== false) { updateOnboarding(game.value,'nextWave');historySelection.value='';manualPaused.value = false;audio.play('deploy');save() }
}
function togglePause() {
  if (trickArmed.value) { cancelTrick(); return }
  if (game.value.phase !== 'battle') return
  if (desk.value !== 'field') { setDesk('field'); manualPaused.value=false }
  else manualPaused.value = !manualPaused.value
  if (manualPaused.value) save()
}
function toggleSound() { sound.value = !sound.value; audio.setEnabled(sound.value); if (sound.value) audio.unlock(); try { localStorage.setItem(`${storageKey}.sound`, sound.value ? 'on' : 'off') } catch {} }
function activateAudio(event) {
  if (event.target.closest?.('[data-music-switch]')) return
  interacted.value = true
  audio.unlock()
}
function toggleMusic() {
  const turnOn = !musicActive.value
  musicEnabled.value = turnOn
  interacted.value = true
  if (turnOn) audio.unlock()
  try { localStorage.setItem(`${storageKey}.music`, turnOn ? 'on' : 'off') } catch {}
}
function showHelp() { audio.unlock(); help.value = true }
function keydown(event) {
  if (event.code === 'Escape') {
    if (fieldDrag.value) { cancelFieldDrag(); return }
    if (pokerPanel.value) pokerPanel.value = null
    else if (briefing.value) briefing.value = false
    else if (codex.value) codex.value = false
    else if (help.value) help.value = false
    else if (inspectedJoker.value) inspectedJoker.value = null
    else if (promotionPending.value) promotionPending.value = null
    else if (confirmRestart.value) confirmRestart.value = false
    else if (trickArmed.value) cancelTrick()
    else if (!intro.value && desk.value !== 'field') closeDesk()
    return
  }
  if (hasModal.value || /INPUT|TEXTAREA|SELECT/.test(event.target?.tagName) || event.ctrlKey || event.metaKey || event.altKey) return
  if (trickArmed.value) return
  if (event.code === 'Space' && !['BUTTON','SUMMARY'].includes(event.target?.tagName)) {
    event.preventDefault(); togglePause(); return
  }
  if (!ordersOpen.value || !['field','orders','watch'].includes(desk.value)) return
  if (desk.value !== 'orders' && (event.code==='KeyH' || /^Digit[1-8]$/.test(event.code))) setDesk('orders')
  if (desk.value !== 'orders') return
  if (event.code === 'Enter' && !['BUTTON','SUMMARY'].includes(event.target?.tagName)) { event.preventDefault(); doDeploy() }
  else if (event.code === 'KeyD') doDiscard()
  else if (event.code === 'KeyH') suggest()
  else if (/^Digit[1-8]$/.test(event.code)) { const card = sortedHand.value[Number(event.code.slice(-1)) - 1]; if (card) chooseCard(card.id) }
}
function visibility() { hidden.value = document.hidden; if (!hidden.value) dealDay.value = dailySeed(); if (hidden.value) { manualPaused.value = game.value.phase === 'battle'; save() } }
watch(() => game.value.phase, (phase, previous) => {
  if(phase==='ready' && previous!=='ready')resetPresentation()
  else if(phase!=='ready'){presentationScene.skip();fusionReceipt.value=null;fusionPresentationId=null}
  scoreReceipt.value=null
  if (phase!=='ready') promotionPending.value=null
  updateOnboarding(game.value,'phase')
  if (['shop','won','lost'].includes(phase)) {recordCombatHistory();historySelection.value=''}
  enterPhase()
  clearTimeout(receiptTimer);rarityReceipt.value=null
  clearTimeout(toastTimer); toast.value = null
  if (phase === 'won' || phase === 'lost') recordDaily()
  if (phase === 'shop' || phase === 'won') audio.play('win')
  if (phase === 'lost') audio.play('lose')
  if (previous === 'battle') save()
})
watch(paused, value => { if (value) audio.quietBattle() })
watch(() => chime.value?.id, id => { if (id && !hidden.value && !hasModal.value) audio.play('bell') })
const modalIdentity = computed(() => pokerPanel.value || (briefing.value ? 'brief' : codex.value ? 'codex' : help.value ? 'help' : promotionPending.value ? 'promotion' : confirmRestart.value ? 'restart' : inspectedJoker.value ? `joker-${inspectedJoker.value.id}` : intro.value ? 'intro' : ['won', 'lost'].includes(game.value.phase) ? game.value.phase : null))
watch(modalIdentity, async (open, previous) => {
  if (open) {
    const menuTrigger = open === 'intro' && previous === 'performer' ? introEl.value?.querySelector('.build-link') : null
    const returnToMenu = open === 'intro' && previous && (menuTrigger || introEl.value?.contains(lastFocus))
    if (!returnToMenu) lastFocus = document.activeElement
    await nextTick()
    const dialog = open === 'intro' ? introEl.value : modalEl.value
    const target = returnToMenu ? menuTrigger || lastFocus : dialog?.querySelector('button:not([disabled])')
    target?.focus()
  }
  else lastFocus?.focus?.()
})
function trapFocus(event) {
  if (event.key !== 'Tab') return
  const items = [...event.currentTarget.querySelectorAll('button:not([disabled]), a[href], input, select, summary, [tabindex="0"]')]
    .filter(item => item.getClientRects().length)
  const first = items[0], last = items.at(-1)
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
}
function deploymentObstacles() {
  if (game.value.phase!=='ready' || !canvas.value) return []
  const stage=canvas.value.closest('.field-stage'), origin=canvas.value.getBoundingClientRect()
  if (!stage) return []
  const selectors=['.field-head','.battle-topline','.scene-tools','.trick-bar','.scene-action','.tutorial-field-dock','.camp-notification-slot','.wagon-aside','.field-pick-hint','.convoy-call','.boss-warning','.bell-alert','.rarity-receipt']
  if (['orders','soldier'].includes(desk.value) || (desk.value==='forge' && fusionReceipt.value)) selectors.push('.scene-panel')
  return [...stage.querySelectorAll(selectors.join(','))].flatMap(node=>{
    if (!node.getClientRects().length) return []
    const r=node.getBoundingClientRect()
    if (!r.width || !r.height) return []
    return [{left:r.left-origin.left,top:r.top-origin.top,right:r.right-origin.left,bottom:r.bottom-origin.top}]
  })
}
onMounted(() => {
  renderer = createBattlefield(canvas.value)
  const captureStep = () => renderer.captureStep?.(toRaw(game.value))
  function animate(now) {
    const delta = Math.min(.1, (now - (lastTime || now)) / 1000); lastTime = now
    if (!paused.value || (game.value.phase === 'ready' && !hasModal.value && !hidden.value)) {
      const events = []
      tick(game.value, delta * speed.value, event => events.push(event), captureStep)
      if (events.length && !hidden.value) audio.battleActions(events)
    }
    const fresh=performanceFeed.sample(toRaw(game.value))
    if(fresh.length){
      presentationEvents.value=performanceFeed.getEvents()
      for(const event of fresh)if(event.actual){
        for(const unitId of event.unitIds || [])battlefieldCues.push({unitId,kind:event.kind,elapsedMs:0,actual:true})
        if(presentationEnabled.value && !reducedMotion.value && !hidden.value)audio.presentationCue?.('first-action')
      }
    }
    const visualPaused=presentationPaused.value || hidden.value || intro.value || hasModal.value || (game.value.phase==='battle' && paused.value)
    presentationScene.advance(delta*1000,{speed:presentationSpeed.value,paused:visualPaused,reducedMotion:reducedMotion.value})
    if(!visualPaused)battlefieldCues=battlefieldCues.map(cue=>({...cue,elapsedMs:cue.elapsedMs+delta*1000*presentationSpeed.value})).filter(cue=>cue.elapsedMs<650).slice(-6)
    const presentation={...presentationScene.get(),suppressedUnitIds:presentationSuppressedUnits,suppressedEffectIds:presentationSuppressedEffects,cues:presentationEnabled.value && !reducedMotion.value?battlefieldCues:[]}
    if (!intro.value) renderer.render(toRaw(game.value), { reservedRects:deploymentObstacles(),panelBounds:['orders','soldier'].includes(desk.value) ? scenePanel.value?.getBoundingClientRect() : null, liftedUnit:fieldDrag.value?.moving ? fieldDrag.value.id : null, dragPoint:fieldDrag.value?.point, targetSide:trickArmed.value ? fieldSide.value : null, selectedUnit:fieldDrag.value?.target || fieldMember.value, time: now / 1000, paused: paused.value, reducedMotion: reducedMotion.value,
      presentation,orderTarget: desk.value === 'orders' && selectedCount.value && ordersOpen.value ? preview.value.target : null })
    saveClock += delta
    if (saveClock >= 3) { saveClock = 0; save() }
    frame = requestAnimationFrame(animate)
  }
  frame = requestAnimationFrame(animate)
  addEventListener('keydown', keydown); addEventListener('visibilitychange', visibility); addEventListener('pagehide', save)
})
onBeforeUnmount(() => {
  cancelFieldDrag()
  clearTimeout(receiptTimer);save(); cancelAnimationFrame(frame); clearTimeout(toastTimer); renderer?.destroy(); audio.destroy()
  removeEventListener('keydown', keydown); removeEventListener('visibilitychange', visibility); removeEventListener('pagehide', save)
})
</script>

<template>
  <div class="legion-shell field-shell scene-shell" :style="controlArt" :data-phase="game.phase" :data-desk="desk" @click.capture="activateAudio">
    <main class="command-room" :inert="hasModal">
      <section class="field-stage battlefield-frame" aria-label="游戏画面">
        <canvas ref="canvas" class="battle-canvas" @pointerdown="fieldDown" @pointermove="fieldMove" @pointerup="fieldUp" @pointercancel="cancelFieldDrag" @lostpointercapture="cancelFieldDrag" style="touch-action:none" role="img" :aria-label="`第${game.wave}波战场，我方${liveAllies.length}名士兵，敌方${liveEnemies.length}名士兵，城门耐久${Math.ceil(game.baseHp)}`"></canvas>
        <aside v-if="rarityReceipt" :key="rarityReceipt.id" class="rarity-receipt" aria-live="polite" :style="{'--summon-ink':QUALITIES[rarityReceipt.captainGrade].color}">
          <PixelSprite v-if="getCardDesign(rarityReceipt.leadFace)" v-bind="receiptPortrait(rarityReceipt)"/>
          <span><small>{{ rarityReceipt.captainGrade>rarityReceipt.grade?'领队升格':'高分征召' }}</small><b>{{ QUALITIES[rarityReceipt.captainGrade].name }} · {{ rarityReceipt.profession }}</b><small>{{ rarityReceipt.count ? (rarityReceipt.captainGrade===4?'首次行动为全军披盾':'已入阵') : rarityReceipt.waiting ? '已到候补席 · 可在工坊上阵或融合' : '编入集训 · +'+rarityReceipt.trainingXp+'经验' }}</small></span>
        </aside>
        <div class="field-shade" aria-hidden="true"></div>
        <DraggedSoldier v-if="fieldDrag?.moving && draggedFace" :unit="draggedFace" :drag="fieldDrag" :hint="dragHint"/>
        <header class="field-head">
          <div class="field-title"><span class="wave-index">第 <b>{{ game.wave }}</b> / {{ waves.length }} 波</span><h1>{{ waveInfo.name }}</h1><span class="field-phase" :class="{live:game.phase==='battle' && !paused}">{{ phaseLabel }}</span></div>
          <div class="hud-relics" role="group" aria-label="随军搭档" v-if="ownJokers.length">
            <button v-for="joker in ownJokers" :key="joker.id" type="button" class="key-chit" :title="joker.name+(joker.quantity>1?' ×'+joker.quantity:'')" :aria-label="'查看'+joker.name+(joker.quantity>1?' ×'+joker.quantity:'')" @click="inspectedJoker=joker">
              <RelicArt :item="joker" :frame="relicFrame(joker)"/><b v-if="joker.quantity>1" class="relic-count">{{ joker.quantity }}</b>
            </button>
          </div>
          <div class="resource-strip">
            <div class="base-resource"><span class="resource-icon">♜</span><div><div class="resource-label">城门耐久 <strong>{{ Math.ceil(game.baseHp) }}<small> / {{ game.maxBaseHp }}</small></strong></div><div class="resource-track base-track"><i :style="{ width: `${game.baseHp / game.maxBaseHp * 100}%` }"></i></div></div></div>
            <div v-if="game.phase !== 'shop'" class="energy-resource"><span class="resource-icon">✦</span><div><div class="resource-label">本波军令 <strong>{{ Math.floor(game.energy) }}<small> / {{ game.maxEnergy }}</small></strong></div><div class="resource-track energy-track"><i :style="{ width: `${game.energy / game.maxEnergy * 100}%` }"></i></div></div><span class="regen-label">每波补满</span></div>
            <div class="gold-resource currency-resource" data-currency="gold" :aria-label="'金币余额 '+game.gold" title="金币用于改印、加购出牌、研习与职业融合"><span>◈</span><small>金币</small><strong>{{ game.gold }}</strong></div>
            <div class="crystal-resource currency-resource" data-currency="crystals" :aria-label="'蓝水晶余额 '+(game.crystals ?? 0)" title="蓝水晶用于商店购买、出售与刷新"><span>◆</span><small>蓝水晶</small><strong>{{ game.crystals ?? 0 }}</strong></div>
          </div>
          <div v-if="game.phase==='battle'" class="field-controls">
            <button class="key-tab" :aria-pressed="speed===2" @click="speed=speed===1?2:1" :aria-label="'当前'+speed+'倍速，点击切换'">{{ speed }}×</button>
            <button class="key-tab" :aria-pressed="paused" @click="togglePause"><KeyMark name="time"/>{{ paused?'▶ 继续':'Ⅱ 暂停' }}</button>
          </div>
          <button class="scene-menu-key key-ink" aria-label="随军手册与设置" :aria-pressed="desk==='menu'" @click="setDesk(desk==='menu'?'field':'menu',$event.currentTarget)"><KeyMark name="book"/><span>手册</span></button>
        </header>
            <div v-if="inPlay" class="battle-topline">
              <span class="army-tag ally-tag"><i></i>我军 <b>{{ liveAllies.length }}/{{ rules.FIELD_LIMIT }}</b></span>
              <span v-if="game.phase==='ready'" class="army-tag hand-budget">余 <b>{{ game.handsLeft }}/{{ rules.HANDS_PER_WAVE + game.handsBought }}</b> 手</span>
              <div class="battle-timer" role="timer" :class="{ urgent: game.phase === 'battle' && secondsLeft <= 10 }">
                <small>{{ game.phase === 'ready' ? '限时' : '剩余' }}</small> <b>{{ secondsLeft }}</b> <small>秒</small>
              </div>
              <span class="army-tag enemy-tag">来敌 <b>{{ game.phase==='ready'?scout.total:liveEnemies.length }}</b><i></i></span>
              <button v-if="game.phase==='battle' && lastCombatCue && !game.bossTelegraph && !chime" class="payoff-button key-tab" :title="lastCombatCue.label+'。'+lastCombatCue.reason" @click="setDesk('watch')">{{ lastCombatCue.label }} ↗</button>
            </div>
            <aside v-if="wagonHint && (desk==='field' || desk==='watch')" class="wagon-aside" aria-label="马车情报"><KeyMark name="coin"/>{{ wagonHint }}</aside>
            <div v-if="game.phase==='ready'" class="camp-notification-slot"><Transition name="toast"><div v-if="toast" class="toast-note" :class="toast.tone" role="status"><span>✦</span>{{ toast.text }}</div></Transition></div>
            <Transition v-else name="toast"><div v-if="toast" class="toast-note" :class="toast.tone" role="status"><span>✦</span>{{ toast.text }}</div></Transition>
            <small v-if="desk==='field' && game.phase==='ready' && liveAllies.length && !toast" class="field-pick-hint">点兵查看 · 拖动布阵<template v-if="feature('training')"> · 停在友军身上传授</template></small>
            <small v-if="desk==='field' && game.phase==='battle' && game.champion?.unitId" class="field-pick-hint">♛ {{ game.champion.pattern ? ORDER_BOOK[game.champion.pattern].name : game.champion.slot }} · {{ game.champion.xp }}经验 {{ game.royalMarch?'· 已亲征':'' }}</small>
            <div v-if="game.bossTelegraph && game.phase === 'battle'" class="boss-warning" role="status"><span>⚠</span>{{ game.bossTelegraph.text || game.bossTelegraph.name }} · {{ Math.max(0,game.bossTelegraph.remaining).toFixed(1) }} 秒</div>
        <section v-if="feature('trick') && (inPlay || (game.phase==='shop' && desk==='market' && hero.id==='sleeve'))" class="trick-bar" aria-label="专属戏法" :data-hero="hero.id">
          <button class="performer-id key-chit" :aria-label="'查看'+hero.name+'的故事与打法'" @click="openGuide('performer')"><img :src="pixelAssetUrl(hero.art,'jpg')" alt=""/><span class="trick-id"><small>{{ hero.name }} · 每波一次</small><b>{{ hero.skill }} ↗</b></span></button>
          <div v-if="trickArmed && hero.id==='ghost' && palmTarget" class="palm-steps">
            <b>{{ palmTarget.suit }}{{ palmTarget.rank }}</b>
            <button class="key-ink" v-for="step in [-1,1]" :key="step" :disabled="!rules.shiftedRank(palmTarget.rank,step)"
              @click="playTrick(palmTarget.id,step)"><KeyMark name="cards"/>{{ step>0?'＋':'−' }}1 <span v-if="rules.shiftedRank(palmTarget.rank,step)">→ {{ rules.shiftedRank(palmTarget.rank,step) }}</span></button>
          </div>
          <div v-else-if="trickArmed && hero.id==='sleeve'" class="trick-controls">
            <select class="key-select" aria-label="要带入下一波的牌" v-model="palmId"><option :value="null" disabled>选要藏的手牌</option>
              <option v-for="card in sortedHand" :key="card.id" :value="card.id">{{ card.suit }}{{ card.rank }} · {{ cardDesign(card).name }}</option>
            </select><button class="key-ink" :disabled="!palmTarget" @click="playTrick(palmId)"><KeyMark name="trick"/>收入袖底</button>
          </div>
          <div v-else-if="trickArmed && hero.id==='voice'" class="trick-controls">
            <select class="key-select" aria-label="复令的副队" v-model="palmId"><option :value="null" disabled>选复令副队</option>
              <option v-for="type in secondaryTypes" :key="type" :value="type">{{ REGIMENTS[type].name }} ×{{ roleCounts[type] }}</option>
            </select>
            <button class="key-ink" :disabled="!canDeploy || !secondaryTypes.includes(palmId)" @click="playTrick(palmId)"><KeyMark name="trick"/>复令出牌</button>
            <small aria-live="polite">{{ canDeploy ? (secondaryTypes.length ? '副队每人' + echoDescription : '再集结一个兵种即可复令') : preview.reason }}</small>
          </div>
          <label v-else-if="trickArmed && fieldSide" class="unit-picker">
            <span>{{ hero.cue }}</span><select class="key-select" aria-label="从名册选目标" @change="playTrick($event.target.value)">
              <option value="">从名册选择…</option><option v-for="(u,i) in trickTargets" :key="u.id" :value="u.id">{{ u.suit }}{{ u.rank }} {{ displayName(u) }} · {{ Math.ceil(u.hp) }} 生命 · {{ i+1 }}</option>
            </select>
          </label>
          <span v-else class="trick-hint">{{ trickArmed ? '点下方要改点的手牌' : trickBlock || hero.cue }}</span>
          <button class="trick-toggle key-tab" :aria-pressed="trickArmed" :disabled="!!trickBlock && !trickArmed" @click="armTrick"><KeyMark name="trick"/>{{ trickArmed?'取消':game.trickUsed?'已用':'用戏法' }}</button>
        </section>
        <div v-if="chime && desk==='field'" class="bell-alert"><EnemyPortrait type="bellkeeper"/><div><strong>鸣钟使 · {{ Math.ceil(chime.bellTimer) }} 秒后钟击</strong>
            <small>城门将损失 {{ tollDamage(game.wave) }} 耐久 · {{ game.bellReady ? '战前已备令，将自动打断' : '本波未备止钟令' }}</small></div>
          </div>
          
        <div v-if="onboarding && desk==='field'" class="tutorial-field-dock"><TutorialCoach :game="game" @skip-step="skipTutorial('step')" @skip-all="skipTutorial('all')" @open="openTutorialTarget"/></div>
        <nav v-show="desk==='field'" class="scene-tools" aria-label="战场操作">
          <button v-for="[id,label] in deskTabs" :key="id" class="key-tab" :data-tool="id"
            :title="id==='forge'?workshopHint:undefined" @click="setDesk(id,$event.currentTarget)">
            <KeyMark :name="deskStamps[id]"/><b>{{ label }}</b><i v-if="id==='forge' && (pairs.promote.length || pairs.ascend.length || availableRecipes)" aria-label="可整编"></i>
          </button>
        </nav>
        <div class="scene-action">
          <small v-if="game.phase==='battle' && feintHint && desk==='field'" class="feint-call">{{ feintHint }}</small>
          <button v-if="game.phase==='ready' && !liveAllies.length && desk!=='orders'" class="field-advance key-command" @click="setDesk('orders',$event.currentTarget)"><KeyMark name="cards"/>打开手牌 ↗</button>
          <button v-else-if="game.phase==='ready'" class="field-advance key-command" :disabled="!liveAllies.length" @click="sendArmy"><KeyMark name="allies"/>全军出战 ↗</button>
          <button v-else-if="game.phase==='shop' && desk==='market'" class="field-advance key-command" :disabled="!game.rewardChosen" @click="advance"><KeyMark name="allies"/>{{ game.wave>=waves.length?'完成远征':'迎战第 '+(game.wave+1)+' 波' }} ↗</button>
        </div>
        <section v-if="desk!=='field'" ref="scenePanel" class="scene-panel" role="region" tabindex="-1" :aria-label="deskName">
          <button v-if="game.phase!=='shop' || desk!==postBattleDesk" class="scene-close key-close" aria-label="收起面板" title="返回（Esc）" @click="closeDesk"><KeyMark name="close"/></button>
        <div ref="deskBody" class="desk-body" :key="game.wave" :data-section="desk">
          <TutorialCoach v-if="onboarding && ['orders','brief','supply','market'].includes(desk)" :game="game" @skip-step="skipTutorial('step')" @skip-all="skipTutorial('all')" @open="openTutorialTarget"/>
          <section v-if="desk==='victory'" class="wave-victory" role="status">
            <span class="victory-wave">第 {{ game.wave }} 波 · {{ waveInfo.name }}</span>
            <h2>{{ game.waveTimeout?.count || game.waveKills < game.schedule.length ? '险守城门' : '守城成功' }}</h2>
            <p>{{ timeoutMessage || ('击退 ' + game.waveKills + ' 名敌军') }} · 城门耐久 {{ Math.ceil(game.baseHp) }}</p>
            <p>归营 {{ game.allies.length }} 名<template v-if="game.finalWaveCleared"> · 终幕已守住，领取补给后完成远征</template></p>
            <WaveReport expanded :combat="currentCombat" :live-events="presentationEvents" :report="report" :uses="game.fusionUses" :tactics="game.tacticsReport" :formation="formation.name" :final-settlement="finalSettlement"/>
            <button class="key-command" @click="openSupplies">选择补给 ↗</button>
          </section>
          <SoldierSheet v-else-if="desk==='soldier' && inspectedSoldier" :advanced="feature('champion')" :unit="inspectedSoldier" :champion="game.champion" @lock="lockSoldier" @champion="chooseChampion"/>
          <FeintTable v-else-if="desk==='feint'" :game="game" @choose="chooseFlag"/>
          <section v-else-if="desk === 'orders'" class="hand-section">
          <div class="order-cards">
          <div class="hand-heading"><h2>出牌征兵</h2>
            <span class="hand-budget">余 {{ game.handsLeft }} 手 · 兵位 {{ liveAllies.length }}/{{ rules.FIELD_LIMIT }}<small v-if="game.paidHandsLeft"> · {{ game.paidHandsLeft }} 手免军令</small></span>
            <button v-if="feature('advanced') || game.handsLeft===0" class="buy-hand key-tab" :disabled="game.gold < handPrice" :title="game.gold < handPrice ? '还差 ' + (handPrice - game.gold) + ' 金币' : '增加本波一次出牌，下一手免军令'" @click="purchaseHand"><KeyMark name="coin"/>加一手 · {{ handPrice }} 金</button>
            <button class="hand-options key-tab" :aria-expanded="orderDetails" aria-controls="order-details" @click="toggleOrderDetails">{{ orderDetails?'收起详情':feature('forge')?'整编与战令':'战令详情' }}</button>
          </div>
          <button v-if="feature('forge') && (game.reserves.length || pairs.ascend.length)" class="key-ticket recruit-ascend" @click="setDesk('forge')"><KeyMark name="forge"/>{{ pairs.ascend.length?'可融合升品质':'传说候补' }}<span v-if="game.reserves.length"> · 候补 {{ game.reserves.length }} 名</span> ↗</button>
          <HandCards :cards="sortedHand" :game="game" :preview="preview" :palm-id="palmId" :palming="trickArmed && hero.id==='ghost'"
            :orders-open="ordersOpen" @choose="chooseCard" @inspect="openCodex"/>
          <div class="draft-result" v-if="preview.score" :style="{'--grade-ink':QUALITIES[preview.grade].color}">
            <PixelSprite class="draft-portrait" v-bind="getSpriteFrame(preview.recruits[0] || preview.reserve[0])"/>
            <div class="draft-contract"><strong>{{ displayName(preview.recruits[0] || preview.reserve[0] || preview.look.design) }} · {{ preview.profession }}</strong>
              <span v-if="preview.returning">♛ 主将归队 · {{ championProgress(game.champion) }}</span><span class="muster-strength" :title="preview.strengthDetail">{{ preview.look.name }} · {{ preview.strengthDetail }}</span></div>
          </div>
          <ScoreBreakdown v-if="selectedCount && preview.scoreTrace" :trace="preview.scoreTrace"/>
          <ScoreSequence v-if="scoreReceipt" ref="scoreSequenceRef" v-show="!selectedCount" :trace="scoreReceipt" :receipt="deployReceipt" cinematic :enabled="presentationEnabled" :presentation-paused="presentationPaused" :consumed-ids="presentationConsumedIds" :speed="presentationSpeed" :reduced-motion="reducedMotion" @speed="presentationSpeed=$event" @step="presentationStep" @complete="presentationComplete" @pause="presentationPaused=!presentationPaused"/>
          </div>
          <div class="command-bar"><div class="hand-preview"><span class="preview-sigil">{{ selectedCount ? '✧' : '♧' }}</span><div><strong>{{ selectedCount ? preview.order + ' → ' + REGIMENTS[preview.target].name : '军令 ' + game.energy + ' / ' + game.maxEnergy }}<span v-if="selectedCount" class="cost-tag">{{ preview.prepaid ? '免军令' : '✦ ' + preview.cost }}</span></strong><small>{{ selectedCount ? `受令 ${preview.targetCount} 人 · ${preview.description}` : '可继续组牌，或集结完毕后出战' }}</small></div></div><div class="command-actions"><button class="suggest-button key-tab" aria-label="提示手牌" @click="suggest" :disabled="!ordersOpen || trickArmed || (!game.paidHandsLeft && game.energy<2)" title="选中一手可出的牌（H）"><KeyMark name="cards"/><span>提示</span></button><button class="discard-button key-ink" @click="doDiscard" :disabled="!canDiscard || trickArmed"><KeyMark name="cards"/>换牌<small>{{ game.discards > 0 ? `免费 ${game.discards} 次` : game.phase === 'ready' ? `${redrawFee} 金币` : '次数已尽' }}</small><kbd>D</kbd></button><button class="deploy-button key-command" @click="doDeploy" :disabled="!canDeploy || trickArmed"><KeyMark name="order" class="order-seal"/><span class="order-inscription">{{ deployLabel }}</span></button></div></div>
          <div v-if="orderDetails" id="order-details" class="order-details"><div class="hand-tools">
              <button class="text-button key-link" @click="pokerPanel = 'book'"><KeyMark name="book"/>牌型图鉴</button>
              <button v-if="game.phase === 'ready' && feature('press')" class="text-button key-link" @click="setDesk('press')"><KeyMark name="press"/>牌匠改印</button>
              <button class="text-button sort-button key-link" @click="sortMode = sortMode === 'suit' ? 'rank' : 'suit'"><KeyMark name="cards"/>⇅ 按{{ sortMode === 'suit' ? '花色' : '点数' }}</button></div>
          <div class="wave-plan">

            <template v-if="game.phase==='ready' && feature('forge')">
              <button v-if="quickPair" class="key-ink quick-promote" :title="'预览消耗'+displayName(quickPair.donor)+'，保留'+displayName(quickPair.leader)+'的品质'" @click="quickPromote"><KeyMark name="forge"/>升星预览 · {{ displayName(quickPair.leader) }} → {{ quickPair.leader.level+1 }}★</button>
              <button class="key-tab open-forge" @click="setDesk('forge',$event.currentTarget)"><KeyMark name="forge"/>兵种工坊</button>
            </template>
          </div>
          <SquadBench v-if="game.phase==='ready' && feature('roster')" :game="game" @drill="trainSoldier" @champion="chooseChampion" @lock="lockSoldier"/>
          <div class="order-targets" aria-label="选择受令兵种"><strong>牌型加成给</strong>
            <button class="key-tab" v-for="(role, type) in REGIMENTS" :key="type" :aria-pressed="(preview.target || game.orderTarget) === type"
              :aria-label="'向' + role.name + '下令'" :disabled="!ordersOpen || !roleCounts[type]" @click="target(type)">{{ role.suit }} {{ role.name }} <small>×{{ roleCounts[type] }}</small></button>
          </div>
          <div class="recruit-strip" aria-live="polite">
            <template v-if="selectedCount">
              <strong>将入阵 <b>{{ preview.actualUnits }}</b> 人</strong>
              <span v-for="(group,i) in recruitGroups" :key="group.key" class="recruit-member" :title="group.name">
                <PixelSprite v-bind="group.portrait"/><span><b>{{ group.name }}</b><small>{{ group.detail }} · {{ '★'.repeat(group.level) }}<template v-if="group.count>1"> ×{{ group.count }}</template></small></span>
              </span>
              <small v-if="!preview.actualUnits">{{ preview.waiting ? '传说进入候补席。' : '本手普通新兵转训，传说留在候补席。' }}</small>
            </template>
            <template v-else-if="game.lastDeploy"><strong>{{ game.lastDeploy.name }}已打出</strong><span v-if="lastLead" :key="game.lastDeploy.id" class="recruit-member recruited-lead"><PixelSprite v-bind="receiptPortrait(game.lastDeploy)"/><b>{{ lastLead.name }}</b></span><span>{{ game.lastDeploy.count }} 人入阵 · 场上共 {{ liveAllies.length }} 人</span></template>
            <template v-else><strong>待集结</strong><span>选牌预览兵种、人数与领队升格机会。</span></template>
          </div>
          <div v-if="selectedCount && (preview.combo?.length || preview.overflow || (preview.reason && game.deployCooldown <= 0))" class="synergy-ribbon"><span v-for="combo in preview.combo" :key="combo">✧ {{ combo }}</span><span v-if="preview.waiting">满编传说 · 候补保留</span><span v-else-if="preview.overflow" class="overflow-warning">{{ preview.overflow }} 名增援传授给{{ preview.trainerName }} · +{{ preview.trainingXp }}经验</span><span v-else-if="preview.reason && game.deployCooldown <= 0" class="overflow-warning">{{ preview.reason }}</span></div>
            <p v-if="feature('advanced')" class="grade-guide">每手招一名，牌型决定兵种。品质决定军装，兵种决定武器和坐骑。每张计分牌的点数总和提升新兵生命、攻击和治疗，J／Q／K／A 分别按 11／12／13／14 算。总分决定新兵保底。出牌时揭晓新兵品级，概率见出牌预览。传说领队首次行动为全军披盾。两名传说可免费融合为神话，两名神话可融合为棱彩。满编时招来的传说在工坊候补。<span v-for="g in GRADES" :key="g.min" :style="{color:g.color}">{{ g.min }}分 {{ g.name }}（+{{ g.boost }}%）</span>。加成作用于新兵的初始攻疗与生命。</p>
          </div>
          <div class="hand-footnote"><span v-if="wagonHint" class="desk-wagon"><KeyMark name="coin"/>{{ wagonHint }}</span><span v-else>出牌次数在下一波补满。换牌与升星另算。</span><span>空格 暂停<span class="dot-separator">·</span>Enter 出牌<span class="dot-separator">·</span>H 提示</span></div>
        </section>
          <div v-else-if="desk==='forge'" class="forge-modal embedded-panel"><div v-if="fusionReceipt" class="fusion-reveal"><HighTierReveal :receipt="fusionReceipt" :actual-unit="fusionReceipt.actualUnit" kind="fusion" :controls="false" :enabled="presentationEnabled" :speed="presentationSpeed" :reduced-motion="reducedMotion"/><div class="fusion-reveal-controls"><button class="key-tab" @click="presentationSpeed=presentationSpeed===1?2:1">{{ presentationSpeed }}×</button><button class="key-link" @click="skipPresentation">收起亮相 / 跳过欢呼</button></div></div><CampRoster v-if="!fusionReceipt" :game="game" :pairs="pairs" :apply-merge="forge" @champion="chooseChampion" @lock="lockSoldier" @field-reserve="id=>{if(rules.fieldReserve(game,id)){audio.play('deploy');save()}}" @commission="appoint" @close="setDesk('orders')"/></div>
          <div v-else-if="desk==='brief'" class="brief-modal embedded-panel"><BattlePlan embedded :wave="scoutWaveInfo" :intel="scout" :schedule="scoutSchedule" :formation="game.formation" :in-shop="game.phase==='shop'" @choose="changeFormation"/></div>
          <section v-else-if="desk==='press'" class="inline-press"><CardPress :game="game" :apply="applyPrint"/></section>
          <section v-else-if="desk==='supply'" class="supply-section">
            <div class="section-title"><span>{{ game.rewardChosen ? '本波补给已领取' : '先选择一项战后补给' }}</span><small>{{ game.rewards.length }} 选一 · 免费</small></div><p class="reward-flow-hint">{{ game.rewardChosen?'补给已兑现，可以购物或继续远征。':'先免费领取一项，再进入商店。' }}<template v-if="game.finalWaveCleared">终幕已守住，购物后可完成远征。</template></p>
            <EconomySummary :settlement="game.lastSettlement" compact/>
            <div class="reward-grid"><button v-for="choice in game.rewards" :key="choice.id" class="reward-card key-ticket" :data-reward="choice.id"
              :class="{chosen:game.rewardChosen===choice.id,unavailable:!rewardStatus(choice).available && !game.rewardChosen}"
              :disabled="!rewardStatus(choice).available" :aria-describedby="'reward-reason-'+choice.id" @click="reward(choice)">
              <span class="reward-symbol" aria-hidden="true">{{ choice.icon || '✦' }}</span>
              <div><strong>{{ choice.name || choice.title }}</strong><span class="reward-tags"><em v-if="rewardDirection[choice.direction]" class="reward-direction">{{ rewardDirection[choice.direction] }}</em><em v-if="choice.duration" class="reward-duration" :data-duration="choice.durationKey">{{ choice.duration }}</em></span><small :id="'reward-reason-'+choice.id">{{ rewardDescription(choice) }}</small></div>
              <span class="reward-plus">{{ game.rewardChosen===choice.id ? '✓' : !rewardStatus(choice).available ? '不可领取' : '免费领取' }}</span>
            </button></div>
          </section>
          <FieldMarket v-else-if="desk==='market'" :game="game" :offers="shopJokers" :frame-of="relicFrame" @purchase="purchase" @reroll="reroll"/>

          <section v-else-if="desk==='report'">
            <div class="battle-history-tools">
              <label>战报记录<select class="key-select" aria-label="选择本地战报" v-model="historySelection"><option value="">当前波次</option>
                <option v-for="record in combatHistory.slice().reverse()" :key="record.waveId" :value="record.waveId">第 {{ record.wave }} 波 · {{ record.seed }} · {{ record.result==='lost'?'失守':'守住' }}{{ record.partial?' · 部分记录':'' }}</option>
              </select></label>
              <button class="key-ink" @click="downloadCombatHistory" :disabled="!combatHistory.length && !game.lastCombatReport">导出本地战报 JSON</button>
            </div>
            <p class="history-notice">已保存 {{ combatHistory.length }} 波，仅在本机浏览器保存。最多保留 1000 波且不超过 3 MiB，较早记录会自动清理；可导出留存。</p>
            <p v-if="!historyAvailable" class="history-notice" role="status">战报保存失败，当前波数据仍可查看和导出，请检查浏览器存储空间。</p>
            <WaveReport expanded :combat="selectedCombat" :live-events="historySelection?[]:presentationEvents" :report="historySelection ? [] : report" :uses="historySelection ? {} : game.fusionUses" :tactics="game.tacticsReport" :formation="formation.name" :final-settlement="historySelection?'':finalSettlement"/>
          </section>
          <section v-else-if="desk==='menu'" class="scene-menu">
            <h2>随军手册</h2>
            <div class="menu-actions">
              <button class="key-ink" @click="openCodex()"><KeyMark name="allies"/>军团图鉴</button>
              <button class="key-ink" @click="showHelp"><KeyMark name="book"/>玩法指南</button>
              <button class="key-ink" @click="openGuide('performer')"><KeyMark name="trick"/>{{ hero.name }}的故事与打法</button>
              <button class="key-ink" @click="setDesk('report')"><KeyMark name="order"/>战报与本地历史</button>
              <button v-if="onboarding" class="key-link" @click="skipTutorial('all')">结束引导，开放全部功能</button>
              <ScoreToggle/>
              <button class="key-ink" :aria-pressed="sound" @click="toggleSound"><KeyMark name="time"/>音效{{ sound?'开':'关' }}</button>
              <button class="key-ink presentation-switch" :aria-pressed="presentationEnabled" @click="togglePresentation">计分与欢呼演出{{ presentationEnabled?'开':'关' }}</button>
              <button class="key-ink" @click="showRunSelection"><KeyMark name="return"/>返回封面</button>
            </div>
            <WarCollege v-if="feature('college')" :game="game" @train="train" @book="pokerPanel='book'"/>
            <div v-if="game.phase==='shop'" class="menu-actions">
              <button v-for="[id,label] in shopTabs" :key="id" class="key-tab" @click="setDesk(id)">{{ label }}</button>
            </div>
            <small>{{ game.difficulty === 'veteran' ? '险境' : '标准' }} · {{ runRecordKey ? '每日同局 '+game.seed.slice(6) : '种子 '+game.seed }} · {{ storageAvailable?'进度自动保存':'当前无法保存进度' }}</small>
          </section>
          <section v-else-if="desk==='watch'" class="watch-grid">
            <BattlePayoffs :events="presentationEvents"/>
            <div class="field-strength"><h3>在场军团 <small>{{ formation.name }}</small></h3><div class="strength-list">
              <div v-for="role in regiments" :key="role.type" :class="{absent:!role.count}">
                <PixelSprite v-if="role.leader" v-bind="role.leader"/><SuitMark v-else :suit="REGIMENTS[role.type].suit"/>
                <span><b>{{ role.name }} ×{{ role.count }}</b><i :aria-label="'剩余生命 '+role.health+'%'"><em :style="{width:role.health+'%'}"></em></i></span>
              </div></div></div>
            <div class="field-dispatch"><h3>战场记录 <small>击退 {{ game.waveKills }} / {{ game.schedule.length }}</small></h3>
              <p v-for="entry in recentLogs.slice(0,3)" :key="entry.id">{{ entry.text }}</p></div>
          </section>
        </div>
      </section>
      </section>
    </main>

    <div v-if="intro" class="modal-scrim deal-scrim" :inert="modalIdentity!=='intro'" @keydown="trapFocus">
      <section ref="introEl" class="joker-entry" role="dialog" aria-modal="true" aria-labelledby="intro-title">
        <JokerTable :doctrine="pickedDoctrine" :difficulty="pickedDifficulty" :seed="pickedSeed" :saved="savedGame" :daily-best="selectedDailyBest"
          @choose="id => { pickedDoctrine=id; audio.play('select') }" @difficulty="pickedDifficulty=$event" @seed="pickedSeed=$event"
          @guide="openGuide" @resume="resumeRun" @start="requestStart(false)" @daily="requestStart(true)"/>
      </section>
    </div>
    <div v-if="modalIdentity && modalIdentity!=='intro'" class="modal-scrim" @keydown="trapFocus">
      <section v-if="pokerPanel==='performer'" ref="modalEl" class="poker-modal performer-panel" role="dialog" aria-modal="true" aria-labelledby="performer-title">
        <PerformerGuide :actor="guideHero" :partner="guidePartner" @close="pokerPanel=null"/>
      </section>
      <section v-else-if="pokerPanel==='book'" ref="modalEl" class="poker-modal" role="dialog" aria-modal="true" aria-labelledby="handbook-title">
        <HandBook :levels="game.handLevels" :discovered="game.discoveredHands" @close="pokerPanel = null"/>
      </section>
      <section v-else-if="briefing" ref="modalEl" class="brief-modal" role="dialog" aria-modal="true" aria-labelledby="brief-title"><BattlePlan :guide-only="briefing === 'guide'" :wave="scoutWaveInfo" :intel="scout" :schedule="scoutSchedule" :formation="game.formation" :in-shop="game.phase === 'shop'" @choose="changeFormation" @close="briefing = false"/></section>
      <section v-else-if="codex" ref="modalEl" class="codex-modal" role="dialog" aria-modal="true" aria-labelledby="codex-title">
        <ArmyCodex v-model:suit="codexSuit" v-model:member="codexMember" @close="codex=false"/>
      </section>

      <section v-else-if="help" ref="modalEl" class="modal help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title">
        <FieldManual @close="help=false" @book="pokerPanel='book'"/>
      </section>

      <section v-else-if="promotionPending" ref="modalEl" class="modal confirm-modal quick-promotion-confirm" role="dialog" aria-modal="true" aria-labelledby="promotion-title"><h2 id="promotion-title">消耗副兵并升星？</h2><MergeWarning v-if="quickPromotionWarning" :warning="quickPromotionWarning"/><p v-else>材料已不可用，请返回重新选择。</p><p v-if="promotionPending.changed">材料信息已更新，请重新核对后确认。</p><div class="modal-button-row"><button class="secondary-button key-ink" @click="promotionPending=null"><KeyMark name="return"/>保留两名士兵</button><button class="gold-button key-command" :disabled="!quickPromotionWarning" @click="confirmQuickPromotion"><KeyMark name="forge"/>确认消耗并升星</button></div></section>

      <section v-else-if="confirmRestart" ref="modalEl" class="modal confirm-modal" role="dialog" aria-modal="true" aria-labelledby="restart-title"><p class="eyebrow">A NEW PERFORMANCE</p><h2 id="restart-title">开启新的远征？</h2><p>当前军团和本局进度会被新的远征替换。</p><div class="modal-button-row"><button class="secondary-button key-ink" @click="confirmRestart = false"><KeyMark name="return"/>返回选择</button><button class="gold-button key-command" @click="startRun()"><KeyMark name="allies"/>替换存档并启程 ↗</button></div></section>

      <section v-else-if="inspectedJoker" ref="modalEl" class="modal joker-modal" role="dialog" aria-modal="true" aria-labelledby="joker-title"><button class="modal-close key-close" aria-label="关闭小丑详情" @click="inspectedJoker = null"><KeyMark name="close"/></button><RelicArt :item="inspectedJoker" :frame="relicFrame(inspectedJoker)" class="relic-art"/><div><p class="eyebrow">BEHIND THE CURTAIN</p><h2 id="joker-title">{{ inspectedJoker.name }}</h2><p>{{ inspectedJoker.description || inspectedJoker.desc }}</p><small>{{ inspectedJoker.consumable?'自动使用':inspectedJoker.stackable?'同名效果逐层相加':'独有搭档' }} · 持有 {{ inspectedJoker.quantity || 1 }} 件</small><button v-if="game.phase==='shop' && game.rewardChosen" class="key-price" :disabled="!saleStatus?.available" :aria-describedby="!saleStatus?.available?'sale-unavailable':undefined" @click="sell(inspectedJoker)">出售一件 · {{ saleStatus?.price }} 蓝水晶</button><small v-if="game.phase==='shop' && game.rewardChosen && !saleStatus?.available" id="sale-unavailable">{{ saleStatus?.reason }}</small><button class="gold-button key-command" @click="inspectedJoker = null"><KeyMark name="return"/>明白了 ↗</button></div></section>




      <section v-else ref="modalEl" class="modal result-modal" role="dialog" aria-modal="true" aria-labelledby="result-title"><div class="result-emblem">{{ game.phase === 'won' ? '♛' : '♠' }}</div><p class="eyebrow">{{ game.phase === 'won' ? 'THE FINAL CURTAIN' : 'EVERY END IS A NEW HAND' }}</p><h2 id="result-title">{{ game.phase === 'won' ? '今夜，命运听你的。' : '这一幕，暂且落幕。' }}</h2><p>{{ timeoutMessage || (game.phase === 'won' ? (game.campaignLength===6 ? '旧版六波远征已完成，你的胜利记录已保留。' : '十二波敌军尽数退场，无冕之王与缀命皇后已被击败。') : '城门已经失守。带着这局的经验，重新组合你的下一手。') }}</p><WaveReport :combat="currentCombat" :live-events="presentationEvents" :report="report" :uses="game.fusionUses" :tactics="game.tacticsReport" :formation="formation.name"/><p v-if="runBest" class="daily-result">每日同局 · {{ game.seed.slice(6) }}<br/>本机最佳守住 {{ runBest.waves }} 波 · 城门 {{ runBest.gate }} 耐久 · 击退 {{ runBest.kills }} 名</p><div class="result-stats"><div><strong>{{ game.stats.wavesCleared }}<small>/ {{ game.campaignLength || waves.length }}</small></strong><span>突破波次</span></div><div><strong>{{ game.stats.deploys }}</strong><span>出牌指令</span></div><div><strong>{{ game.stats?.kills || 0 }}</strong><span>击退敌军</span></div><div><strong>{{ game.stats?.bestHand || '—' }}</strong><span>最佳牌型</span></div></div><div v-if="game.promotions || game.fusions" class="result-training"><PixelSprite v-if="veteran" v-bind="getSpriteFrame(veteran)"/><div><strong v-if="veteran">幸存精英 · {{ veteran.fusionJobs?.length > 1 ? fusionProfessionNames(veteran).join(' · ') : FUSION_BY_ID[veteran.fusion]?.name }}</strong><small v-if="veteran">{{ veteran.suit }}{{ veteran.rank }} {{ displayName(veteran) }}</small><p>本局升星 {{ game.promotions }} 次 · 融合 {{ game.fusions }} 次</p></div></div><div class="result-jokers"><RelicArt v-for="joker in ownJokers" :key="joker.id" :item="joker" :frame="relicFrame(joker)" /></div><div class="modal-button-row"><button class="secondary-button key-ink" @click="startRun(game.seed, game.doctrine, game.difficulty)"><KeyMark name="cards"/>重试同一开局</button><button class="gold-button key-command" @click="intro = true; savedGame = null"><KeyMark name="trick"/>再开一局 <span>↗</span></button></div><small class="result-seed">{{ hero.name }} · {{ chosenDoctrine.name }} · {{ game.difficulty === 'veteran' ? '险境' : '标准' }} · 种子 {{ game.seed }}</small></section>
    </div>
  </div>
</template>
