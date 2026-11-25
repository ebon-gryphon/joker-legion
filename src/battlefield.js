import {paintHostileSignals} from './hostileSignals.js'
import { W, H, rect, hash, line, diamond } from './pixelDrawing.js'
import { backdrop, banner, gate } from './battlefieldScenery.js'
import { loadFactionAtlases, pixelAssetUrl } from './spriteAtlas.js'
import { HOSTILE } from './tactics.js'
import { enemyPixels } from './enemyArt.js'
import { getCardDesign } from './cardCatalog.js'
import { DETACHMENTS } from './recruitment.js'
import { CAMP_AREA, fitFormation, inCampArea } from './formation.js'
import { STEP } from './campaignRules.js'
import { activeWagon, wagonPosition } from './convoy.js'
import { drawEffect, drawWagon, telegraph, drawLure } from './battlefieldEffects.js'
import { filterPresentationEffects, sampleUnitPresentation } from './battlefieldPresentation.js'
import { drawUnit } from './battlefieldUnits.js'

// Interpolates simulation snapshots and paints the 1000 × 360 battlefield.
export function createBattlefield(canvas) {
  const display = canvas.getContext('2d', { alpha: false })
  if (!display) return { render() {}, resize() {}, destroy() {} }
  const labels = []
  let savedField, closingArmy = []
  const scene = document.createElement('canvas'), background = document.createElement('canvas')
  scene.width = W; scene.height = H; background.width = W / 2; background.height = H / 2
  const c = scene.getContext('2d'), bg = background.getContext('2d')
  c.imageSmoothingEnabled = bg.imageSmoothingEnabled = false; bg.scale(.5, .5); backdrop(bg)
  const atlasSubscription = loadFactionAtlases(), enemyArt = new Map(), previous = new Map()
  let cameraX = W / 2, cameraPhase, viewScale = 1, viewLeft = 0, viewTop = 0
  let laneStart=192, laneScale=1, formationKey='', formationView=null
  const campAreas = []
  const campNames = []
  let sampledGame, sampledAt = -1, sampledWave = 0, previousEffects = []
  function captureStep(game) {
    if (game.phase !== 'battle') return
    sampledGame = game
    sampledWave = game.wave
    sampledAt = game.time
    previousEffects = game.effects.slice()
    previous.clear()
    for (const team of [game.allies, game.enemies]) {
      for (const unit of team) previous.set(unit.id, { x: unit.x, y: unit.y })
    }
  }
  function campPoint(clientX, clientY) {
    const rect = canvas.getBoundingClientRect()
    return {x:(clientX-rect.left-viewLeft)/viewScale, y:192+((clientY-rect.top-viewTop)/viewScale-laneStart)/laneScale}
  }
  function dragGrip(id,clientX,clientY) {
    const area=campAreas.find(a=>a.id===id)
    if (!area) return {width:60,height:64,x:.5,y:.55}
    const rect=canvas.getBoundingClientRect()
    const w=(area.right-area.left)*viewScale, h=(area.bottom-area.top)*viewScale
    const limit=n=>Math.max(.05,Math.min(.95,n))
    return {width:w*1.08,height:h*1.08,
      x:limit((clientX-rect.left-viewLeft-area.left*viewScale)/w),
      y:limit((clientY-rect.top-viewTop-area.top*viewScale)/h)}
  }
  function pickUnit(clientX, clientY, side, excludeId) {
    const rect = canvas.getBoundingClientRect()
    const x=(clientX-rect.left-viewLeft)/viewScale, y=(clientY-rect.top-viewTop)/viewScale
    if (side==='ally' && !excludeId) {
      const name=campNames.findLast(box=>Math.abs(clientX-rect.left-box.x)<=box.half && clientY-rect.top>=box.y-box.size && clientY-rect.top<=box.y+2)
      if (name) return name.id
    }
    // Later-painted soldiers stand in front of overlapping silhouettes.
    return campAreas.findLast(area=>area.side===side && area.id!==excludeId && x>=area.left && x<=area.right && y>=area.top && y<=area.bottom)?.id
  }
  const backdropImage = new Image()
  const wagonArt = new Image()
  wagonArt.src = pixelAssetUrl('convoy')
  let bitmapBackdrop = false
  for (const type of Object.keys(HOSTILE)) {
    const image = enemyPixels(type); enemyArt.set(type, image)
    const flash = document.createElement('canvas'); flash.width = image.width; flash.height = image.height
    const fc = flash.getContext('2d'); fc.drawImage(image, 0, 0); fc.globalCompositeOperation = 'source-in'; fc.fillStyle = '#fff1d2'; fc.fillRect(0, 0, flash.width, flash.height); enemyArt.set(`${type}-flash`, flash)
  }
  let width = W, height = H, dpr = 1, disposed = false, lastTime = 0, artTime = 0
  backdropImage.onload = () => {
    if (disposed) return
    const s = Math.max(background.width / backdropImage.naturalWidth, background.height / backdropImage.naturalHeight)
    const dw = Math.round(backdropImage.naturalWidth * s), dh = Math.round(backdropImage.naturalHeight * s)
    bg.save(); bg.setTransform(1, 0, 0, 1, 0, 0); bg.imageSmoothingEnabled = false
    bg.drawImage(backdropImage, Math.round((background.width - dw) / 2), Math.round((background.height - dh) / 2), dw, dh)
    bg.restore(); bitmapBackdrop = true
  }
  backdropImage.onerror = () => { /* The cached original pixel stage is complete on its own. */ }
  backdropImage.src = pixelAssetUrl('battlefield')
  // Browser zoom changes DPR; touch zoom changes the visual viewport independently.
  function displayDensity() {
    return Math.min(4,(window.devicePixelRatio || 1) * (window.visualViewport?.scale || 1))
  }
  function resize() {
    if (disposed) return
    const bounds = canvas.getBoundingClientRect(); width = Math.max(1, bounds.width || W); height = Math.max(1, bounds.height || H); dpr = displayDensity()
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr); display.imageSmoothingEnabled = false
  }
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null
  observer?.observe(canvas); resize()
  function render(game, options = {}) {
    if (disposed || !game) return
    if (Math.abs(dpr-displayDensity()) > .01) resize()
    labels.length = 0
    if (game.lastField !== savedField) {
      savedField = game.lastField
      closingArmy = (savedField || []).map(u=>{
        const design = getCardDesign(u.appearanceId)
        return {...u, side:'ally', type:design.type, color:design.color, jobId:DETACHMENTS[u.pattern]?.job || design.jobId, rank:design.rank, suit:design.suit, hp:1, maxHp:1}
      })
    }
    const allies = game.phase === 'shop' ? closingArmy : game.allies
    const now = options.time ?? performance.now() / 1000, dt = Math.min(.1, Math.max(0, now - lastTime)); lastTime = now
    const paused = !!options.paused, reduced = !!options.reducedMotion; if (!paused && !reduced) artTime += dt
    const layoutKey=game.phase==='ready'?JSON.stringify([width,height,options.panelBounds?.left,options.panelBounds?.top,(options.reservedRects || []).map(r=>[r.left,r.top,r.right ?? r.left+r.width,r.bottom ?? r.top+r.height])]):''
    if(layoutKey && layoutKey!==formationKey){formationView=fitFormation(width,height,options.panelBounds,options.reservedRects || []);formationKey=layoutKey}
    const framing=game.phase==='ready'?formationView:null
    const t = artTime, cropSky = !framing && width / height > W / H
    const allyFront = allies.length ? Math.max(...allies.map(u => u.x)) : 140
    const enemyFront = game.enemies.length ? Math.min(...game.enemies.map(u => u.x)) : allyFront + 160
    // Include both approaching fronts on a narrow screen, then close in on contact.
    const span = game.phase === 'battle' ? Math.max(410, Math.abs(enemyFront - allyFront) + 230) : 410
    const scale = framing?.scale ?? Math.max(width / W, Math.min(height / H, width / span))
    const offsetY = framing?.top ?? (cropSky ? height - H * scale : (height - H * scale) / 2), cameraTop = cropSky ? Math.max(0, -offsetY / scale) : 0
    // A shallow viewport compresses lane depth so soldiers' heads stay visible.
    const yScale = framing?.depth ?? (cropSky ? Math.min(1, Math.max(.25, (326 - Math.max(192,cameraTop+60))/134)) : 1)
    const yStart = framing ? CAMP_AREA.top+(192-CAMP_AREA.top)*yScale : cropSky ? Math.max(192,cameraTop+60) : 192
    const yMap = value => yStart + (value - 192) * yScale
    const sceneHeight = framing ? Math.max(H, Math.ceil(yMap(CAMP_AREA.bottom)+12)) : H
    if (scene.height!==sceneHeight) scene.height=sceneHeight
    c.setTransform(1, 0, 0, 1, 0, 0); c.imageSmoothingEnabled = false
    if (framing) c.clearRect(0,0,W,sceneHeight)
    else c.drawImage(background, 0, 0, W, H)
    c.save()
    if (!bitmapBackdrop && !framing) {
      banner(c, 130, 70, true, t); banner(c, 836, 70, false, t + 1)
      gate(c, true, t, game.baseHp, game.maxBaseHp); gate(c, false, t)
    }
    const presentation=options.presentation?{...options.presentation,reducedMotion:reduced || options.presentation.reducedMotion}:null
    const units = [...allies, ...(game.enemies || [])].filter(unit => unit.hp > 0 && !unit.dead)
    const hasStep = game.phase==='battle' && sampledGame===game && sampledWave===game.wave && Math.abs(game.time-sampledAt-STEP)<1e-6
    const lag = hasStep ? Math.max(0, STEP-game.accumulator) : 0
    const alpha = 1-lag/STEP
    const visualTime = game.time-lag
    let stageEffects = game.phase === 'shop' ? [] : game.effects || []
    if (lag && previousEffects.length) {
      const tails = previousEffects.filter(fx => fx.life <= 0 && fx.life + lag > 0)
      if (tails.length) stageEffects = stageEffects.concat(tails)
    }
    stageEffects=filterPresentationEffects(stageEffects,[...units,...(game.reserves || [])],presentation)
    const pendingDamage = new Map()
    for (const fx of stageEffects) {
      if (fx.target && fx.amount && fx.life + lag > fx.maxLife) {
        pendingDamage.set(fx.target,(pendingDamage.get(fx.target) || 0) + fx.amount)
      }
    }
    const wagon = activeWagon(game)
    const wagonPoint = wagon && wagonPosition(wagon, game.waveTime-lag)
    const halfView = width/(2*scale)
    if (framing) cameraX=(width*.5-framing.left)/scale
    else if (halfView < W/2) {
      const focus=game.phase==='battle' ? (allyFront+enemyFront)/2 : allyFront
      const target=Math.max(halfView,Math.min(W-halfView,focus + (game.phase==='shop' && width>=1000 ? halfView*.55 : 0)))
      if(cameraPhase!==game.phase || reduced || game.phase!=='battle') cameraX=target
      else if(!paused) cameraX+=(target-cameraX)*(1-Math.exp(-5*dt))
      cameraX=Math.max(halfView,Math.min(W-halfView,cameraX))
    } else cameraX=W/2
    cameraPhase=game.phase
    laneStart=yStart; laneScale=yScale
    campAreas.length=0; campNames.length=0
    if (framing) {
      const {left,right}=CAMP_AREA, top=yMap(CAMP_AREA.top), bottom=yMap(CAMP_AREA.bottom)
      c.save()
      c.fillStyle=options.dragPoint ? '#b1965328' : '#b196530b'
      c.fillRect(left,top,right-left,bottom-top)
      c.strokeStyle=options.dragPoint ? '#f2ce85' : '#a38a6d'
      c.setLineDash([6,6]); c.strokeRect(left+.5,top+.5,right-left-1,bottom-top-1)
      c.restore()
      if (options.dragPoint && inCampArea(options.dragPoint.x,options.dragPoint.y)) {
        diamond(c,options.dragPoint.x,yMap(options.dragPoint.y),13,4,'#ffe2a0')
      }
      for (const [x,title] of [[left+32,'后排'],[right-32,'前排']]) labels.push({text:title,x,y:bottom-5,size:12,color:'#e1c49a'})
    }
    for (const effect of stageEffects) if (['summon', 'burst', 'telegraph', 'death'].includes(effect.type)) drawEffect(c, effect, t, yMap, reduced, lag, labels)
    if (wagon) drawWagon(c, wagonArt, wagon, game.waveTime-lag, wagonPoint, yMap, reduced)
    paintHostileSignals(c,game,yMap,labels)
    telegraph(c, game.bossTelegraph, t, yMap, labels); units.sort((a, b) => a.y - b.y || a.x - b.x)
    for (const unit of units) {
      if (framing && unit.id===options.liftedUnit) continue
      const old = hasStep && previous.get(unit.id)
      const sample = {
        x: old ? old.x + (unit.x-old.x)*alpha : unit.x,
        y: old ? old.y + (unit.y-old.y)*alpha : unit.y,
        walking: old && Math.abs(old.x-unit.x)+Math.abs(old.y-unit.y)>.3,
        scouted: unit.side === 'ally' && game.feint?.result === 'active' && unit.type === game.feint.target,
        pendingDamage: pendingDamage.get(unit.id) || 0,
      }
      const bounds=drawUnit(c,unit,sample,t,lag,yMap,enemyArt,cameraTop,game.phase==='ready',options.orderTarget,visualTime,reduced,game.bossTelegraph,options.selectedUnit,options.targetSide,labels,sampleUnitPresentation(unit,presentation))
      if (unit.lure) drawLure(c,unit.lure,visualTime,yMap,reduced)
      if(bounds) campAreas.push(bounds)
    }
    for (const effect of stageEffects) if (!['summon', 'burst', 'telegraph', 'death'].includes(effect.type)) drawEffect(c, effect, t, yMap, reduced, lag, labels)
    if (!reduced) for (let i = 0; i < 16; i++) if (Math.floor(t * 2 + i) % 4 === 0) rect(c, (hash(`dust-x-${i}`) * W + t * (i % 2 ? 2 : -2) + W) % W, 140 + hash(`dust-y-${i}`) * 190, 2, 2, i % 3 ? '#796579' : '#b89b70')
    if (!framing) for (const [x, sign] of [[12, 1], [988, -1]]) { line(c, x, 344, x + sign * 30, 344, '#b2946a'); line(c, x, 344, x, 326, '#b2946a'); diamond(c, x + sign * 6, 338, 3, 3, '#b2946a') }
    c.restore(); display.setTransform(dpr, 0, 0, dpr, 0, 0); display.imageSmoothingEnabled = false; display.fillStyle = '#151321'; display.fillRect(0, 0, width, height)
    viewLeft=Math.round(width/2-cameraX*scale); viewTop=Math.round(offsetY); viewScale=scale
    const drawWidth = Math.round(W * scale)
    if (framing) {
      // Project the courtyard and the soldiers independently so dragging uses the whole floor
      // while a portrait screen keeps the same pixel proportions for each character.
      const horizon=Math.max(1,Math.min(height-1,Math.round(viewTop+CAMP_AREA.top*scale)))
      const sky=Math.round(background.height*.53), artWidth=Math.max(width,Math.min(height*W/H,width*1.6))
      display.drawImage(background,0,0,background.width,sky,0,0,artWidth,horizon)
      display.drawImage(background,0,sky,background.width,background.height-sky,0,horizon,artWidth,height-horizon)
      display.drawImage(scene,viewLeft,viewTop,drawWidth,Math.round(sceneHeight*scale))
    } else if (viewTop > 0) {
      // Extend sky and foreground in portrait while keeping the actors and hitboxes at the same scale.
      const sky = 68, ground = H-4
      const skyEdge = Math.round(viewTop + sky * scale), groundEdge = Math.round(viewTop + ground * scale)
      display.drawImage(scene,0,0,W,sky,viewLeft,0,drawWidth,skyEdge)
      display.drawImage(scene,0,sky,W,ground-sky,viewLeft,skyEdge,drawWidth,groundEdge-skyEdge)
      display.drawImage(scene,0,ground,W,H-ground,viewLeft,groundEdge,drawWidth,height-groundEdge)
    } else display.drawImage(scene, viewLeft, viewTop, drawWidth, Math.round(H * scale))
    // Keep sprite pixels on the world canvas and rasterize text at the actual display resolution.
    display.save()
    display.textAlign='center'; display.lineJoin='round'; display.strokeStyle='#191420'
    const nameBoxes = []
    for (const label of labels) {
      const size = Math.max(label.size, Math.min(label.size*1.55, label.size*scale))
      display.font = '700 ' + size + 'px system-ui, "PingFang SC", "Microsoft YaHei", sans-serif'
      display.lineWidth=Math.max(2.5,size*.22); display.globalAlpha=label.alpha ?? 1
      const anchorX=viewLeft + label.x*scale, anchorY=viewTop + label.y*scale
      let x=anchorX,y=anchorY
      if (label.unit) {
        if (x < -10 || x > width+10) continue
        const half=display.measureText(label.text).width/2+3
        const safe=framing?.viewport || {left:0,top:0,right:width,bottom:height}
        const minX=safe.left+half,maxX=safe.right-half
        x=minX>maxX?(safe.left+safe.right)/2:Math.min(maxX,Math.max(minX,x))
        const minY=safe.top+size+2,maxY=safe.bottom-3
        y=Math.min(maxY,Math.max(minY,y))
        const collides=yy=>nameBoxes.some(b=>Math.abs(x-b.x)<half+b.half && Math.abs(yy-b.y)<size+2)
        if(collides(y)){
          const step=size+3
          for(let row=1;row<12;row++){const above=y-row*step,below=y+row*step
            if(above>=minY && !collides(above)){y=above;break}
            if(below<=maxY && !collides(below)){y=below;break}
          }
        }
        nameBoxes.push({x,y,half})
        if (framing) campNames.push({id:label.unit,text:label.text,x,y,half,size})
        if (y<anchorY-3) {
          display.save();display.strokeStyle='#d1bb91';display.lineWidth=1
          display.beginPath();display.moveTo(x+half-2,y+1);display.lineTo(anchorX,anchorY+3);display.stroke();display.restore()
        }
      }
      display.strokeText(label.text,x,y); display.fillStyle=label.color; display.fillText(label.text,x,y)
    }
    display.restore()
  }
  return { render, resize, deploymentGeometry:()=>({scale:viewScale,left:viewLeft,top:viewTop,laneStart,laneScale,viewport:formationView?.viewport,units:campAreas.map(r=>({...r})),names:campNames.map(r=>({...r}))}), campPoint, pickUnit, dragGrip, captureStep, destroy() { disposed = true; observer?.disconnect(); atlasSubscription.dispose(); backdropImage.onload = null; backdropImage.onerror = null; previous.clear() } }
}
