import test from 'node:test'
import assert from 'node:assert/strict'
import { CAMP_AREA, computeDeploymentViewport, fitFormation } from './formation.js'
import { displayName, secondaryIdentity, soldierIdentity } from './soldierIdentity.js'

const intersects=(a,b)=>a.left<b.right && a.right>b.left && a.top<b.bottom && a.bottom>b.top
// Measured HUD shapes from the actual portrait, shallow landscape and tablet layouts.
const cases=[
 {width:390,height:844,panel:{left:8,top:534},rects:[{left:8,top:8,right:382,bottom:86},{left:8,top:84,right:382,bottom:112},{left:8,top:789,right:179,bottom:836},{left:264,top:796,right:382,bottom:836}]},
 {width:360,height:740,panel:{left:8,top:351},rects:[{left:8,top:8,right:352,bottom:86},{left:8,top:84,right:352,bottom:112},{left:8,top:685,right:179,bottom:732},{left:234,top:692,right:352,bottom:732}]},
 {width:844,height:390,panel:{left:442,top:97},rects:[{left:5,top:5,right:839,bottom:47},{left:5,top:41,right:839,bottom:73},{left:5,top:336,right:350,bottom:385},{left:710,top:350,right:839,bottom:385}]},
 {width:768,height:1024,panel:{left:404,top:558},rects:[{left:19,top:19,right:749,bottom:67},{left:19,top:75,right:749,bottom:108},{left:19,top:952,right:370,bottom:1005},{left:577,top:957,right:749,bottom:1005}]},
]
for(const c of cases)for(const open of [true,false])test(`${c.width}×${c.height} ${open?'hand open':'controls visible'} keeps the complete drag floor, maximum-size bodies and names outside HUD`,()=>{
 const controls=open?c.rects:[...c.rects,{left:8,top:c.height<470?72:120,right:c.width-8,bottom:c.height<470?100:188}]
 const view=fitFormation(c.width,c.height,open?c.panel:null,controls),safe=view.viewport
 assert.ok(safe.right-safe.left>180 && safe.bottom-safe.top>130)
 assert.ok(view.scale>.45,'troops remain large enough to select')
 for(const obstacle of controls)assert.equal(intersects(safe,obstacle),false)
 if(open)assert.equal(intersects(safe,{...c.panel,right:c.width,bottom:c.height}),false)
 // The full world-area endpoints include the widest cavalry and highest crowns.
 const x=n=>view.left+n*view.scale
 const y=n=>view.top+(CAMP_AREA.top+(n-CAMP_AREA.top)*view.depth)*view.scale
 const bodies={left:x(CAMP_AREA.left)-39*view.scale,right:x(CAMP_AREA.right)+39*view.scale,
   top:y(CAMP_AREA.top)-90*view.scale,bottom:y(CAMP_AREA.bottom)}
 assert.ok(bodies.left>=safe.left-1e-6 && bodies.right<=safe.right+1e-6)
 assert.ok(bodies.top>=safe.top+18 && bodies.bottom<=safe.bottom+1e-6)
})

test('reserved geometry accepts DOM-style width and height and ignores hidden or invalid rectangles',()=>{
 const raw=[{left:0,top:0,width:390,height:100},{left:10,top:110,width:0,height:30},{left:20,top:30,width:NaN,height:20}]
 const safe=computeDeploymentViewport(390,844,null,raw)
 assert.ok(safe.top>=108)
 assert.ok(Object.values(fitFormation(1366,850,null)).slice(0,4).every(Number.isFinite))
})

test('displayed identity follows the printed face through quality, profession and fusion without mutating saves',()=>{
 const unit={appearanceId:'spades-A',suit:'♠',rank:'A',name:'金冕刀兵',jobId:'blade',grade:4,pattern:'high',fusionJobs:['blade','priest']}
 const before=structuredClone(unit)
 assert.equal(displayName(unit),'玄铁誓锋')
 assert.equal(soldierIdentity(unit).profession,'刀兵')
 assert.equal(secondaryIdentity(unit),'传说 · 刀兵 · ♠A')
 assert.equal(displayName({...unit,grade:6,fusion:'paladin'}),'玄铁誓锋')
 assert.deepEqual(unit,before)
})
