import test from 'node:test'
import assert from 'node:assert/strict'
import {reportLeaders} from './reportView.js'
import {readableLabels} from './fieldReadability.js'

test('战报摘要读取最高牌型和实际攻疗贡献，接受缺页旧战报',()=>{
  assert.deepEqual(reportLeaders(null),{hand:undefined,soldier:null})
  const priest=Object.freeze({name:'祭司',damage:5,healed:20})
  const fighter=Object.freeze({name:'先锋',damage:24,healed:0})
  const combat=Object.freeze({orders:Object.freeze([{key:'pair',score:100},{key:'four',score:80}]),units:Object.freeze([priest,fighter])})
  assert.deepEqual(reportLeaders(combat),{hand:'四条',soldier:priest})
  assert.equal(reportLeaders({units:[{damage:0,healed:0}]}).soldier,null)
})

test('战场浮字仅合并同一目标的实际伤害，保留预警与原始数值',()=>{
  const hit=Object.freeze({damageTarget:'unit-a',amount:5.4,text:'5',x:40,y:30,alpha:1,size:13})
  const second=Object.freeze({...hit,amount:3.2,text:'3',y:35})
  const other=Object.freeze({...hit,damageTarget:'unit-b',x:165})
  const warning=Object.freeze({priority:'warning',text:'首领蓄力',x:300,y:15,size:14})
  const labels=readableLabels(Object.freeze([hit,second,other,warning]))
  assert.deepEqual(labels.map(row=>row.text).sort(),['5','9','首领蓄力'].sort())
  assert.equal(hit.amount,5.4)
  assert.equal(hit.text,'5')
})
