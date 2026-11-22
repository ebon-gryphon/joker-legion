import { fixtureCompany } from './armyFixtures.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { CARD_CATALOG } from './cardCatalog.js'
import { ENEMY_CATALOG } from './enemyCatalog.js'
import { FUSIONS } from './forge.js'
import { PERFORMANCES, performanceOf } from './performance.js'
import { actionPose } from './choreography.js'
import { MATERIALS, voiceDuration } from './combatAudio.js'
import { addUnit, beginBattle, createGame, forgeUnit, restoreGame, snapshotGame, tick } from './engine.js'

test('every identity has an authored gesture and sound phrase, including all enemy and fusion skills', () => {
  const actors=[...CARD_CATALOG.map(u=>performanceOf(u)),
    ...Object.keys(ENEMY_CATALOG).map(type=>performanceOf({side:'enemy',type})),
    ...FUSIONS.map(u=>performanceOf({fusion:u.id},'skill'))]
  assert.equal(new Set(actors.map(p=>p.id)).size,CARD_CATALOG.length+Object.keys(ENEMY_CATALOG).length+FUSIONS.length)
  const poses=new Set(), sounds=new Set()
  for(const p of Object.values(PERFORMANCES)){
    assert.ok(MATERIALS[p.material]); assert.ok(voiceDuration(p,'attack')>0)
    const wind=actionPose(p,p.windup*.8), hit=actionPose(p,p.windup+p.release*.2)
    assert.ok(wind.preparing);assert.equal(hit.preparing,false)
    assert.ok([wind.x,wind.y,wind.bend,hit.x,hit.y,hit.bend].every(Number.isFinite))
    assert.equal(actionPose(p,p.windup+p.release),null)
    const reduced=actionPose(p,p.windup*.8,'attack',true)
    assert.ok(Math.abs(reduced.x)<=Math.abs(wind.x)*.13)
    poses.add(JSON.stringify([p.gesture,p.mark,p.windup,p.release,p.reach,p.lift]))
    sounds.add(JSON.stringify([p.material,p.pitch,p.notes]))
  }
  assert.equal(poses.size,Object.keys(PERFORMANCES).length)
  assert.equal(sounds.size,Object.keys(PERFORMANCES).length)
})
test('the attack cue stream follows actual actions without consuming RNG, and restored poses do not replay sounds', () => {
  const game=createGame({seed:'动作实战'})
  for(const type of ['knight','healer','ranger']) addUnit(game,type,'ally',2)
  beginBattle(game)
  const control=restoreGame(snapshotGame(game)), events=[]
  for(let i=0;i<70;i++){tick(game,.2,e=>events.push(e));tick(control,.2)}
  assert.deepEqual(snapshotGame(game),snapshotGame(control))
  assert.ok(events.some(e=>e.profile.startsWith('enemy-')))
  assert.ok(events.some(e=>e.kind==='heal' && e.profile.startsWith('hearts-')))
  assert.ok(events.some(e=>e.profile.startsWith('clubs-')))
  const saved=restoreGame(snapshotGame(game)), replay=[]
  tick(saved,.00001,e=>replay.push(e));assert.equal(replay.length,0)
})
test('each charged fusion signals its own performance only after the skill resolves',()=>{
  for(const recipe of FUSIONS){
    const game=createGame({seed:614,doctrine:'scarlet'})
    for (const type of recipe.types) fixtureCompany(game,type)
    const [leader,donor]=recipe.types.map(type=>game.allies.find(u=>u.level===2 && u.type===type))
    assert.ok(forgeUnit(game,leader.id,donor.id,recipe.id))
    game.schedule=[{at:0,type:'brute'}]; beginBattle(game);tick(game,.04)
    for(const u of game.allies){u.x=300;u.y=240;u.cooldown=5;u.hp=1}
    leader.hp=leader.maxHp;leader.cooldown=0;leader.skillCharge=2
    for(const e of game.enemies){e.x=310;e.y=240;e.cooldown=5;e.hp=e.maxHp=2000}
    const cues=[];tick(game,.05,e=>cues.push(e))
    assert.equal(cues.filter(e=>e.kind==='skill').length,1)
    assert.equal(leader.motion.profile,'fusion-'+recipe.id)
    assert.equal(cues.find(e=>e.kind==='skill').actor,leader.id)
  }
})
test('clock tolls and the two boss bombardments cue their actual release',()=>{
  for(const [type,kind,id,hp] of [['bellkeeper','toll','enemy-toll',100],['boss','bombard','enemy-bombard',100],['boss','bombard','enemy-fury',45]]){
    const g=createGame();fixtureCompany(g,'knight');g.schedule=[{at:0,type}]; beginBattle(g);tick(g,.04)
    const enemy=g.enemies[0];enemy.hp=hp;enemy.maxHp=100;enemy.cooldown=5
    if(type==='bellkeeper')enemy.bellTimer=.02
    else g.bossTelegraph={x:400,y:240,remaining:.02,duration:3,radius:132,name:id==='enemy-fury'?'破阵轰击':'猩红轰击'}
    const cues=[];tick(g,.05,e=>cues.push(e))
    assert.deepEqual(cues.filter(e=>e.kind===kind).map(e=>e.profile),[id])
  }
})

test('the contact silhouette is reached on the release cue and recovers to the guard pose', () => {
  for (const p of Object.values(PERFORMANCES)) {
    const loading = actionPose(p, p.windup * .68)
    const contact = actionPose(p, p.windup)
    const hold = actionPose(p, p.windup + .015)
    const finish = actionPose(p, p.windup + .99*p.release)
    assert.equal(loading.frame,3)
    assert.equal(contact.frame,5)
    assert.equal(contact.contact,1)
    assert.equal(hold.frame,5)
    assert.equal(finish.frame,0)
  }
})

test('ranged releases delay visible damage and preserve a defeated target until the missile arrives', () => {
  const g=createGame({seed:217})
  fixtureCompany(g,'ranger');g.schedule=[{at:0,type:'raider'},{at:30,type:'raider'}]; beginBattle(g)
  tick(g,.04)
  const archer=g.allies.find(u=>u.type==='ranger'), target=g.enemies[0]
  for(const ally of g.allies) { ally.x=170; ally.y=235; ally.cooldown=6 }
  archer.cooldown=0;target.x=340;target.y=235;target.hp=1
  tick(g,.04)
  const shot=g.effects.find(e=>e.type==='projectile' && e.profile===performanceOf(archer).id)
  const hit=g.effects.find(e=>e.type==='damage'), fallen=g.effects.find(e=>e.fallen)
  assert.ok(shot && shot.maxLife>0 && shot.maxLife<=.24)
  assert.ok(hit.life>hit.maxLife)
  assert.equal(fallen.fallen.type,'raider')
  assert.ok(Math.abs((fallen.life-fallen.maxLife)-shot.life)<.001)
  assert.equal(g.stats.kills,1)
})

test('screen refresh rates preserve the same seeded fight and sample the final fixed step', () => {
  function run(hz, speed) {
    const g=createGame({seed:711})
    for (const type of ['ranger','knight','mage']) fixtureCompany(g,type)
    beginBattle(g)
    let from = 0, steps = 0
    const events = []
    for (let i=0;i<4*hz/speed;i++) {
      tick(g,speed/hz,event=>events.push(event),()=>{from=g.time;steps++})
      if (g.time>0) assert.ok(Math.abs(g.time-from-1/30)<1e-7)
    }
    assert.ok(steps>0)
    assert.ok(g.accumulator<1e-7)
    const saved=snapshotGame(g)
    saved.accumulator=0
    return {saved,events}
  }
  const reference=run(60,1)
  for(const hz of [30,60,120]) for(const speed of [1,2]) assert.deepEqual(run(hz,speed),reference)
})
