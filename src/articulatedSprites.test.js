import test from 'node:test'
import assert from 'node:assert/strict'
import { jointPose } from './articulatedSprites.js'
import { actionPose, walkingPose, restingPose } from './choreography.js'
import { performanceOf, bombardmentOf } from './performance.js'
import { getSpriteFrame, queenPoseFrame } from './spriteAtlas.js'

test('a gait alternates load-bearing legs and bends the returning knee independently of the torso', () => {
  const p=performanceOf({side:'enemy',type:'raider'})
  const left=jointPose(walkingPose(p,0,Math.PI/2),p.gesture)
  const right=jointPose(walkingPose(p,0,-Math.PI/2),p.gesture)
  assert.equal(left.hips[0],-left.hips[1]);assert.equal(right.hips[0],-left.hips[0])
  assert.ok(left.knees[1]>0 && left.knees[0]===0)
  assert.ok(right.knees[0]>0 && right.knees[1]===0)
  assert.ok(left.frontShoulder*left.rearShoulder<0)
  const reduced=jointPose(walkingPose(p,1,2,true),p.gesture)
  assert.deepEqual(reduced.hips,[0,-0]);assert.deepEqual(reduced.knees,[0,0])
})

test('profession equipment uses its own action and actions articulate arms rather than stretching the silhouette', () => {
  const jobs={blade:'sweep',pike:'thrust',archer:'draw',fire:'cast',shield:'bash',assassin:'crouch'}
  for(const [jobId,gesture] of Object.entries(jobs)){
    const p=performanceOf({pattern:'high',jobId,suit:'♠',rank:'2'})
    assert.equal(p.gesture,gesture)
    const back=jointPose(actionPose(p,p.windup*.65),gesture)
    const strike=jointPose(actionPose(p,p.windup),gesture)
    assert.notEqual(back.frontShoulder,strike.frontShoulder)
    assert.notEqual(back.frontElbow,strike.frontElbow)
    assert.ok(Object.values(back).flat().every(Number.isFinite))
  }
})

test('composite portrait frames retain profession sources and queen actions select dedicated silhouettes', () => {
  const jobs=['blade','priest','archer']
  const frame=getSpriteFrame({side:'ally',pattern:'high',jobId:'blade',grade:4,fusionJobs:jobs})
  assert.deepEqual(frame.fusionJobs,jobs)
  assert.deepEqual(getSpriteFrame(frame).fusionJobs,jobs)
  assert.equal(getSpriteFrame({side:'enemy',type:'finalBoss'}).atlas,'queen-motion')
  assert.equal(queenPoseFrame({state:'walk',gait:1}),1)
  assert.equal(queenPoseFrame({state:'walk',gait:-1}),2)
  assert.equal(queenPoseFrame({state:'hit'}),6)
  assert.equal(queenPoseFrame({state:'action',profile:'enemy-pulse',backWeight:1}),5)
  for(const name of ['断线裁决','王庭震荡'])assert.ok(bombardmentOf({name}).id.startsWith('enemy-'))
  assert.equal(queenPoseFrame({state:'action',contact:1,reduced:true}),0)
  const idle=restingPose(performanceOf({side:'enemy',type:'brute'}),0,0,0)
  assert.equal(idle.state,'idle')
})

test('a salute raises both actual wrists with mirrored shoulder directions and leaves ordinary poses unchanged',()=>{
  const turn=([x,y],a)=>[x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)]
  const wrist=(nodes,first,second)=>{
    const [root,mid,end]=nodes,upper=turn([mid[0]-root[0],mid[1]-root[1]],first),lower=turn([end[0]-mid[0],end[1]-mid[1]],first+second)
    return [root[0]+upper[0]+lower[0],root[1]+upper[1]+lower[1]]
  }
  const w=75,h=112,front=[[.59*w,.32*h],[.73*w,.39*h],[.91*w,.35*h]],rear=[[.32*w,.35*h],[.22*w,.47*h],[.15*w,.60*h]]
  for(const gesture of ['standard','offer','rise']) {
    const pose=Object.freeze({state:'salute',gesture,salute:1,saluteLift:2,contact:1,gait:0,breath:0})
    const j=jointPose(pose,gesture)
    assert.ok(wrist(front,j.frontShoulder,j.frontElbow)[1]<front[0][1]-12)
    assert.ok(wrist(rear,j.rearShoulder,j.rearElbow)[1]<rear[0][1]-12)
    assert.equal(j.drop,-2);assert.deepEqual(j.hips,[0,-0]);assert.deepEqual(j.knees,[0,0])
    assert.equal(jointPose({...pose,saluteLift:200},gesture).drop,-2)
    const reduced={...pose,reduced:true}
    assert.deepEqual(jointPose(reduced,gesture),jointPose({...reduced,state:'idle'},gesture))
  }
  for(const state of ['idle','walk','hit','action']) {
    const pose={state,breath:.3,gait:.5,contact:.7,backWeight:.2,bend:2,flinch:.4}
    assert.deepEqual(jointPose({...pose,salute:1,saluteLift:2},'draw'),jointPose(pose,'draw'))
  }
})
