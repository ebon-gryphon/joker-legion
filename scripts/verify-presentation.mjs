#!/usr/bin/env node
import assert from 'node:assert/strict'
import { mkdir,writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join,resolve } from 'node:path'
import { runBuildStrategy,BUILD_ROUTES,replayBuild } from './verify-builds.mjs'
import { deriveAscendFacts } from '../src/presentationFacts.js'

export function legalQualityFixtures() {
  const run=runBuildStrategy(BUILD_ROUTES[0],{fixtures:false}),fixtures=[]
  replayBuild(run,{onAction:({before,after,action})=>{
    if(action.type!=='forge' || action.params.kind!=='ascend')return
    const facts=deriveAscendFacts(before,after,action.params.leaderId)
    if(!facts || fixtures.some(item=>item.expected.grade===facts.grade))return
    const actions=run.actions.slice(0,action.n-1)
    replayBuild({...run,actions,finalSnapshot:before})
    fixtures.push({version:1,id:facts.grade===5?'mythic':'prismatic',seed:run.seed,doctrine:run.doctrine,difficulty:run.difficulty,
      wave:action.wave,actions,snapshot:before,action,expected:facts})
  }})
  assert.deepEqual(fixtures.map(item=>item.expected.grade),[5,6])
  return fixtures
}
export async function writeQualityFixtures() {
  const root=fileURLToPath(new URL('../',import.meta.url)),directory=join(root,'output/presentation-fixtures')
  await mkdir(directory,{recursive:true})
  const fixtures=legalQualityFixtures()
  for(const fixture of fixtures){const path=join(directory,fixture.id+'-before.json');await writeFile(path,JSON.stringify(fixture,null,2)+'\n');console.log(JSON.stringify({path,wave:fixture.wave,action:fixture.action.n,grade:fixture.expected.grade,source:fixture.expected.source}))}
  return fixtures
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url))await writeQualityFixtures()
