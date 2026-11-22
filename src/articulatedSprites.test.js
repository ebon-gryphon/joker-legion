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
