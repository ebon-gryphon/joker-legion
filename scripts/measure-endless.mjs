import {runBuildStrategy,BUILD_ROUTES} from './verify-builds.mjs'
import {fullLevels,emptyLevels} from '../src/legacyRules.js'
import {addUnit} from '../src/campArmy.js'
import {mkdir,readFile,writeFile} from 'node:fs/promises'
import {ENEMY_RULES} from '../src/enemyBehavior.js'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'

const root=new URL('../',import.meta.url)
const label=process.argv[2] || 'after'
if(!/^[a-z0-9-]+$/.test(label))throw Error('Invalid measurement label')
const destination=new URL('../output/balance/',import.meta.url)
await mkdir(destination,{recursive:true})
const cases=[...BUILD_ROUTES,{...BUILD_ROUTES[2],seed:8},...[9,7].map(seed=>({...BUILD_ROUTES[1],seed,difficulty:'veteran'}))]
const results=[]
const maximum=process.argv.includes('--max-legacy')
for(const base of cases){
  const waves=[]
  let army,health,opening
  const route=runBuildStrategy({...base,...(maximum || label==='meta-review'?{runId:'measure-'+base.seed,legacyLevels:maximum?fullLevels():emptyLevels()}:{}),mode:'endless',stopWave:60},{fixtures:false,onBattleStart:g=>{
    opening=g.spawnIndex
    army=structuredClone(g.allies.filter(u=>u.echoUntil==null).map(u=>({name:u.name,atk:u.atk,heal:u.heal,maxHp:u.maxHp,period:u.period,
      xp:u.trainingXp,grade:u.grade,stars:u.level,job:u.jobId,training:u.trainingGrowth,order:u.waveBonus,permanent:u.rewardModifiers})))
    // Only this detached probe consumes RNG. Use the same real constructor and rounding as the simulation.
    const probe={...g,enemies:[]}
    health=Object.fromEntries([...new Set([...g.schedule.map(s=>s.type),'splitter','raider'])].map(type=>[type,addUnit(probe,type,'enemy').maxHp]))
  },onBattleEnd:g=>{
    const report=g.lastCombatReport,ev=report.enemyEvents,spawns=g.schedule.slice(0,g.spawnIndex-(g.waveTimeout?.queuedWithdrawn || 0))
    const count=(kind)=>ev.filter(e=>e.kind===kind)
    const sum=(kind)=>count(kind).reduce((s,e)=>s+e.amount,0)
    const spawnedHp=spawns.reduce((s,e)=>s+health[e.type],0)+sum('split')*Math.round(health.splitter*ENEMY_RULES.brood)+report.lifeEvents.filter(e=>e.kind==='bell-summon').length*health.raider
    const loss=report.lifeEvents.filter(e=>e.kind==='loss' || e.failed)
    waves.push({wave:g.wave,boss:g.wave%6===0,scheduled:g.schedule.length,initial:opening,initialHp:g.schedule.slice(0,opening).reduce((s,e)=>s+health[e.type],0),regularSpawned:spawns.length,bellSummons:report.lifeEvents.filter(e=>e.kind==='bell-summon').length,timeout:!!g.waveTimeout,life:g.baseHp,minLife:Math.min(report.lifeStart,...report.lifeEvents.map(e=>e.after)),loss,phase:g.phase,
      seconds:+report.battleDuration.toFixed(2),cleared:g.phase==='shop',casualties:report.units.filter(u=>!u.echo).reduce((s,u)=>s+u.deaths,0),
      attack:army.reduce((s,u)=>s+u.atk,0),heal:army.reduce((s,u)=>s+u.heal,0),maxAtk:Math.max(...army.map(u=>u.atk)),maxHeal:Math.max(...army.map(u=>u.heal)),maxHp:Math.max(...army.map(u=>u.maxHp)),army,
      spawnedHp,effectiveHp:Math.round(spawnedHp+sum('guard')+sum('heal')),guarded:sum('guard'),healed:sum('heal'),
      events:Object.fromEntries(['guard','hunt','bonus','split','windup','heal'].map(k=>[k,count(k).length])),brood:sum('split')})
  }})
  const last=waves.at(-1),end=last.loss.find(e=>e.failed)
  const summary={seed:base.seed,difficulty:route.difficulty,reached:last.wave,firstLoss:waves.find(w=>w.loss.some(e=>e.amount>0))?.wave??null,minLife:Math.min(...waves.map(w=>w.minLife)),cause:end?.source??route.result.phase,
    lastSeconds:last.seconds,lastClearSeconds:waves.findLast(w=>w.cleared && !w.loss.length)?.seconds,peakAttack:Math.max(...waves.map(w=>w.maxAtk)),lastAttack:last.maxAtk}
  console.log(JSON.stringify(summary))
  results.push({summary,waves})
}
const rules=createHash('sha256')
for(const file of ['campArmy','campaign','combatActions','endless','forge','training','waveSchedule']){
  rules.update(await readFile(new URL('src/'+file+'.js',root)))
}
const basedOn=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim()
const header={basedOn,rulesSha256:rules.digest('hex'),strategy:'runBuildStrategy',limit:60,...(maximum?{legacyLevels:fullLevels()}:{})}
await writeFile(new URL(label+'.json',destination),JSON.stringify({...header,cases:results},null,2)+'\n')
// One line per observation makes before/after comparisons independent of the checkout.
const records=[header]
for(const {summary,waves} of results){
  records.push({kind:'run',...summary})
  for(const w of waves)records.push({seed:summary.seed,difficulty:summary.difficulty,...w,
    cleanSeconds:w.cleared && !w.loss.length?w.seconds:null})
}
await writeFile(new URL(label+'.jsonl',destination),records.map(row=>JSON.stringify(row)).join('\n')+'\n')
