import test from 'node:test'
import assert from 'node:assert/strict'
import {LIFE_RULES,initialLifeMax,lifeMaxCap,playerLifeView,losePlayerLife,failPlayerLife,healPlayerLife,expandLifeMax,lifeItemPreview} from './playerLife.js'
import {applyLifeRecruitItems} from './itemEffects.js'
import {createGame} from './campaign.js'
import {JOKER_BY_ID} from './campaignRules.js'

const copy=value=>JSON.parse(JSON.stringify(value))
const own=(game,id)=>game.jokers.push({...JOKER_BY_ID[id],quantity:1,triggers:0,flash:0})
const life=(difficulty='standard')=>({difficulty,baseHp:initialLifeMax(difficulty),maxBaseHp:initialLifeMax(difficulty),
  lifeVersion:1,lifeFailed:false,lifeEvents:[],wave:1,battleId:1,waveTime:0})

test('life rules centralize 12/8 starts, difficulty-specific doubled caps and an explicit zero warning',()=>{
  assert.equal(LIFE_RULES.standard,12);assert.equal(LIFE_RULES.veteran,8)
  assert.equal(lifeMaxCap('standard'),24);assert.equal(lifeMaxCap({difficulty:'veteran'}),16)
  const g=life();g.baseHp=0
  assert.deepEqual(playerLifeView(g),{current:0,max:12,failed:false,atZero:true,warning:'生命为 0，不能再放入任何敌人。'})
})

test('zero life is safe and only the next real ordinary escape fails, with every measured source preserved',()=>{
  const g=life();g.baseHp=1
  const unit={id:'enemy-a',type:'raider',name:'流寇'}
  const zero=losePlayerLife(g,{source:'breach',unit})
  assert.deepEqual([g.baseHp,g.lifeFailed,zero.amount,zero.attempted],[0,false,1,1])
  const failed=losePlayerLife(g,{source:'timeout',unit:{...unit,id:'enemy-b'}})
  assert.deepEqual([g.baseHp,g.lifeFailed,failed.amount,failed.attempted],[0,true,0,1])
  assert.equal(failed.failed,true);assert.equal(failed.sourceId,'enemy-b')
  assert.equal(healPlayerLife(g,1,{source:'red-echo',sourceId:'red-echo'}),0)
  assert.equal(g.baseHp,0);assert.equal(g.lifeEvents.at(-1).blocked,'failed')
  const count=g.lifeEvents.length;assert.equal(losePlayerLife(g,{unit}),null);assert.equal(g.lifeEvents.length,count)
})

test('boss failure is explicit at positive or zero life, and healing plus maximum expansion record actual deltas including zero',()=>{
  for(const current of [12,0]) {
    const g=life();g.baseHp=current
    const failed=failPlayerLife(g,{source:'boss-timeout',unit:{id:'queen',type:'finalBoss'}})
    assert.equal(g.lifeFailed,true);assert.equal(g.baseHp,0);assert.equal(failed.amount,current)
  }
  const g=life('veteran');g.baseHp=7;g.maxBaseHp=15
  assert.equal(expandLifeMax(g,2,{source:'reward-life-max',sourceId:'test',heal:2}),1)
  assert.deepEqual([g.baseHp,g.maxBaseHp],[9,16])
  assert.equal(g.lifeEvents[0].kind,'max');assert.deepEqual([g.lifeEvents[0].maxBefore,g.lifeEvents[0].maxAfter,g.lifeEvents[0].amount],[15,16,1])
  g.baseHp=16;assert.equal(healPlayerLife(g,1,{source:'gate-rivet',sourceId:'gate-rivet'}),0)
  assert.equal(g.lifeEvents.at(-1).amount,0);assert.equal(g.lifeEvents.at(-1).sourceId,'gate-rivet')
})

test('life-item previews are read-only and only scoring hearts or a genuine five-card flush qualify',()=>{
  const g=createGame();own(g,'red-echo');own(g,'flush-crown');g.baseHp=10
  const hand={scoring:[{suit:'♥',rank:'8'},{suit:'♠',rank:'8'}],containsFlush:false}
  const before=copy(g),preview=lifeItemPreview(g,hand)
  assert.equal(preview.redEchoLife.eligible,false);assert.equal(preview.flushCrownLife.eligible,false);assert.deepEqual(g,before)
  assert.equal(lifeItemPreview(g,{scoring:[{suit:'♥'},{suit:'♥'}]}).redEchoLife.restored,1)
  assert.equal(lifeItemPreview(g,{scoring:Array.from({length:4},()=>({suit:'♥'})),containsFlush:true}).flushCrownLife.eligible,false)
})

test('the first qualifying full-life hand spends its per-wave recovery, with honest zero events and no later heal',()=>{
  const g=createGame();own(g,'red-echo');g.baseHp=g.maxBaseHp
  const hand={scoring:[{suit:'♥',rank:'8'},{suit:'♥',rank:'8'}],containsFlush:false}
  const first=applyLifeRecruitItems(g,hand).redEchoLife
  assert.equal(first.consumed,true);assert.equal(first.restored,0);assert.equal(g.lifeItemState.redEchoUsed,true)
  assert.equal(g.lifeEvents.at(-1).amount,0);assert.equal(g.lifeEvents.at(-1).sourceId,'red-echo')
  g.baseHp-=2
  const eventCount=g.lifeEvents.length,second=applyLifeRecruitItems(g,hand).redEchoLife
  assert.equal(second.consumed,false);assert.equal(second.restored,0);assert.equal(g.lifeEvents.length,eventCount)
  assert.equal(g.baseHp,g.maxBaseHp-2)
})

test('red echo and flush crown each recover once in sequence and cannot fabricate two life when only one was missing',()=>{
  const g=createGame();own(g,'red-echo');own(g,'flush-crown');g.baseHp=g.maxBaseHp-1
  const hand={scoring:Array.from({length:5},(_,i)=>({suit:'♥',rank:String(i+2)})),containsFlush:true}
  const result=applyLifeRecruitItems(g,hand)
  assert.deepEqual([result.redEchoLife.restored,result.flushCrownLife.restored],[1,0])
  assert.equal(result.redEchoLife.consumed,true);assert.equal(result.flushCrownLife.consumed,true)
  assert.deepEqual(g.lifeEvents.slice(-2).map(event=>[event.source,event.amount]),[['red-echo',1],['flush-crown',0]])
  g.lifeItemState={redEchoUsed:false,flushCrownUsed:false};g.baseHp-=2
  const next=applyLifeRecruitItems(g,hand)
  assert.deepEqual([next.redEchoLife.restored,next.flushCrownLife.restored],[1,1])
})
