/** Shared nearest-neighbour artwork loader for battlefield units and their portraits. */
import { FUSION_BY_ID } from './forge.js'
import { soldierFrame, QUALITY_OUTFITS, UNIFORM_ROLES } from './outfits.js'
import { assembleUniforms } from './uniformArt.js'
import { CARD_RANKS as RANKS } from './cardCatalog.js'
import { drawArticulatedUniform, drawArticulatedEnemy } from './articulatedSprites.js'
import { enemyFrame } from './enemyCatalog.js'

const SUITS = { '♠': 'spades', '♥': 'hearts', '♣': 'clubs', '♦': 'diamonds' }
const TYPE_ATLAS = { knight: 'spades', tank: 'spades', healer: 'hearts', ranger: 'clubs', mage: 'diamonds', arcanist: 'diamonds' }
const SHEETS = { 'queen-motion':[4,8], regalia: [4,8], armory: [4,8], spades: [7, 13], hearts: [7, 13], clubs: [7, 13], diamonds: [7, 13], fusions: [3, 6], enemies: [4, 8] }
export const isUnitAtlas = name => name === 'uniforms' || Object.hasOwn(SHEETS, name)
const records = new Map(), listeners = new Set()
let motionSheet

export function pixelAssetUrl(name, extension = 'png') {
  const base = import.meta.env?.BASE_URL || './'
  return globalThis.window?.__LEGION_ASSETS__?.[`pixel-${name}`] || `${base}legion-pixel/${name}.${extension}`
}
export function getSpriteFrame(cardOrUnit = {}) {
  if (cardOrUnit.type === 'finalBoss' || cardOrUnit.atlas === 'queen-motion') {
    const frame=cardOrUnit.frame || 0
    return {atlas:'queen-motion',frame,column:frame%4,row:Math.floor(frame/4)}
  }
  if (cardOrUnit.side === 'enemy' || cardOrUnit.atlas === 'enemies') {
    const frame = cardOrUnit.side === 'enemy'
      ? enemyFrame(cardOrUnit.type, cardOrUnit.hp <= cardOrUnit.maxHp / 2)
      : Math.max(0, Math.min(7, cardOrUnit.frame || 0))
    return { atlas: 'enemies', frame, column: frame % 4, row: Math.floor(frame / 4) }
  }
  if (cardOrUnit.atlas === 'uniforms') {
    const frame=cardOrUnit.frame || 0, columns=QUALITY_OUTFITS.length
    return {atlas:'uniforms',frame,column:frame%columns,row:Math.floor(frame/columns),...(cardOrUnit.fusionJobs?.length>1?{fusionJobs:cardOrUnit.fusionJobs}:{})}
  }
  const uniform=soldierFrame(cardOrUnit)
  if (uniform) return {...uniform,...(cardOrUnit.fusionJobs?.length>1?{fusionJobs:cardOrUnit.fusionJobs}:{})}
  const fusion = FUSION_BY_ID[cardOrUnit.fusion]
  if (fusion || cardOrUnit.atlas === 'fusions') {
    const frame = fusion?.frame ?? Math.max(0, Math.min(5, cardOrUnit.frame || 0))
    return { atlas: 'fusions', rank: cardOrUnit.rank, frame, column: frame % 3, row: Math.floor(frame / 3) }
  }
  const explicit = String(cardOrUnit.appearanceId || cardOrUnit.id || '').match(/^(spades|hearts|clubs|diamonds)-(A|[2-9]|10|J|Q|K)$/)
  const atlas = cardOrUnit.atlas || explicit?.[1] || SUITS[cardOrUnit.suit] || TYPE_ATLAS[cardOrUnit.type] || 'spades'
  const rank = cardOrUnit.rank || explicit?.[2] || '2'
  const frame = Math.min(12, Math.max(0, Number.isInteger(cardOrUnit.frame) ? cardOrUnit.frame : RANKS.indexOf(rank)))
  return { atlas, rank, frame, column: frame % 7, row: Math.floor(frame / 7) }
}
function prepareBounds(record) {
  // Trim transparent gutters at draw time; never alter the shared source atlas.
  const source = document.createElement('canvas')
  source.width = record.image.naturalWidth || record.image.width; source.height = record.image.naturalHeight || record.image.height
  // Cell coordinates remain usable if the browser restricts pixel readback.
  const width = source.width / record.columns, height = source.height / record.rows
  record.bounds = Array.from({length:record.frames}, (_,i) => ({
    x:i % record.columns * width, y:Math.floor(i / record.columns) * height, width, height,
  }))
  const ctx = source.getContext('2d', { willReadFrequently: true })
  if (!ctx) return
  ctx.imageSmoothingEnabled = false; ctx.drawImage(record.image, 0, 0)
  try {
    const pixels = ctx.getImageData(0, 0, source.width, source.height).data
    for (let frame = 0; frame < record.frames; frame++) {
      // A few generated sheets contain a faint packing guide on cell borders.
      // Exclude its two source pixels before examining the alpha silhouette.
      const x0 = Math.floor(frame % record.columns * source.width / record.columns) + 2, x1 = Math.floor((frame % record.columns + 1) * source.width / record.columns) - 2
      const y0 = Math.floor(Math.floor(frame / record.columns) * source.height / record.rows) + 2, y1 = Math.floor((Math.floor(frame / record.columns) + 1) * source.height / record.rows) - 2
      let left = x1, right = x0, top = y1, bottom = y0
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        if (pixels[(y * source.width + x) * 4 + 3] < 24) continue
        left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y)
      }
      record.bounds[frame] = right >= left && bottom >= top
        ? { x: Math.max(x0, left - 2), y: Math.max(y0, top - 2), width: Math.min(x1, right + 3) - Math.max(x0, left - 2), height: Math.min(y1, bottom + 3) - Math.max(y0, top - 2) }
        : { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }
    }
  } catch { /* Optional alpha-bound detection must not prevent original drawing. */ }
  ctx.globalCompositeOperation = 'source-in'; ctx.fillStyle = '#fff5dc'
  ctx.fillRect(0, 0, source.width, source.height); record.flashImage = source
}
// The combat sheet uses fixed foot pivots. Never trim or fit individual
// frames to the portrait box: doing so makes a swinging weapon shrink its owner.
const clipRows = { 'spades:0': 0, 'clubs:6': 1, 'enemies:3': 2, 'enemies:0': 3, 'hearts:1': 4, 'diamonds:1': 5 }
function drawCombatClip(ctx, frame, x, y, width, height, options) {
  const row = clipRows[frame.atlas + ':' + frame.frame]
  if (!options.combat || row === undefined || !motionSheet?.complete || !motionSheet.naturalWidth) return false
  const pose = options.pose, animated = pose && Number.isInteger(pose.frame) && !pose.reduced
  const cellW = motionSheet.naturalWidth / 10, cellH = motionSheet.naturalHeight / 6, scale = height / 76
  const col = animated ? pose.frame : 0
  const shift = !animated && !pose?.reduced ? pose : null
  ctx.save()
  ctx.imageSmoothingEnabled = false
  ctx.translate(Math.round(x+width/2),Math.round(y+height))
  ctx.scale(options.flip ? -1 : 1,1)
  if (animated) {
    // The planted foot is the pivot. Weight continues to travel during
    // each held drawing without blending its silhouette with the next one.
    ctx.transform(1,0,-(pose.bend + pose.x)*.003,1 + pose.crouch*.004,0,0)
  } else if (shift) {
    ctx.translate(Math.round((shift.x || 0)*scale),Math.round((shift.y || 0)*scale))
    ctx.transform(1,0,-(shift.bend || 0)/66,1,0,0)
  }
  const left = Math.round(-cellW/2*scale), top = Math.round(-101*scale)
  const stride = shift?.step || 0
  if (!stride) {
    ctx.drawImage(motionSheet, col*cellW,row*cellH,cellW,cellH,
      left,top,Math.round(cellW*scale),Math.round(cellH*scale))
  } else {
    const knee=80, half=cellW/2, lower=cellH-knee
    ctx.scale(scale,scale)
    ctx.drawImage(motionSheet,0,row*cellH,cellW,knee,-half,-101,cellW,knee)
    // Each leg pivots at the knee. One heel lifts as the planted boot rolls back.
    for (const side of [-1,1]) {
      const start=side<0?0:half, lift=Math.max(0,side*stride)
      ctx.save()
      ctx.translate(0,knee-101)
      ctx.transform(1,0,side*stride/18,1-lift/22,0,0)
      ctx.drawImage(motionSheet,start,row*cellH+knee,half,lower,start-half,0,half,lower)
      ctx.restore()
    }
  }
  ctx.restore()
  return true
}

export function queenPoseFrame(pose = {}) {
  if(pose.reduced)return 0
  const p=pose.profile || ''
  return pose.state==='hit'?6:pose.state==='walk'?(Math.abs(pose.gait || 0)<.2?0:pose.gait>0?1:2):
    p==='enemy-pulse' && (pose.backWeight>.1 || pose.contact>.05)?5:
    pose.backWeight>.16?3:pose.contact>.18?4:pose.state==='action'?7:0
}
function drawQueenClip(ctx,record,x,y,width,height,options) {
  const frame=queenPoseFrame(options.pose)
  const b=record.bounds[frame], ref=record.bounds[0]
  const cellW=record.image.naturalWidth/4,cellH=record.image.naturalHeight/2
  const scale=height/ref.height, col=frame%4,row=Math.floor(frame/4)
  ctx.save();ctx.imageSmoothingEnabled=false;ctx.translate(x+width/2,y+height)
  if(options.flip)ctx.scale(-1,1)
  ctx.drawImage(record.image,col*cellW,row*cellH,cellW,cellH,-cellW*scale/2,-(b.y-row*cellH+b.height)*scale,cellW*scale,cellH*scale)
  ctx.restore();return true
}

export function loadFactionAtlases(onLoad) {
  if (onLoad) listeners.add(onLoad)
  if (!motionSheet) {
    motionSheet = new Image()
    motionSheet.onload = () => { for (const listener of listeners) listener('combat-motion') }
    motionSheet.src = pixelAssetUrl('combat-motion')
  }
  for (const [name, [columns, frames]] of Object.entries(SHEETS)) {
    if (records.has(name)) continue
    const record = { columns, frames, rows:Math.ceil(frames/columns), image: new Image(), ready: false, error: false, bounds: [] }
    records.set(name, record)
    record.image.onload = () => {
      prepareBounds(record); record.ready = true
      const clothes=records.get('regalia'), arms=records.get('armory')
      if (!records.has('uniforms') && clothes?.ready && arms?.ready) {
        const sheet = {image:assembleUniforms(clothes,arms), columns:QUALITY_OUTFITS.length, rows:UNIFORM_ROLES.length,
          frames:QUALITY_OUTFITS.length*UNIFORM_ROLES.length, bounds:[], ready:true}
        prepareBounds(sheet); records.set('uniforms',sheet)
      }
      for (const listener of listeners) listener(name,record)
    }
    record.image.onerror = () => { record.error = true; for(const listener of listeners)listener(name,record) }
    record.image.src = pixelAssetUrl(name)
  }
  return { records, dispose() { if (onLoad) listeners.delete(onLoad) } }
}
/** Draw an aspect-preserving portrait with feet aligned to the box's bottom. */
export function drawCardSprite(ctx, cardOrUnit, x, y, width, height, options = {}) {
  const frame = getSpriteFrame(cardOrUnit), record = records.get(frame.atlas)
  if (frame.atlas==='uniforms' && drawArticulatedUniform(ctx,records,frame,x,y,width,height,options)) return true
  if (frame.atlas==='queen-motion' && record?.ready) return drawQueenClip(ctx,record,x,y,width,height,options)
  if (frame.atlas==='enemies' && options.combat && drawArticulatedEnemy(ctx,record,frame,x,y,width,height,options)) return true
  if (options.combat && ['spades','hearts','clubs','diamonds','fusions'].includes(frame.atlas) && drawArticulatedEnemy(ctx,record,frame,x,y,width,height,options)) return true
  if (drawCombatClip(ctx, frame, x, y, width, height, options)) return true
  if (!record?.ready) return false
  const cellWidth = (record.image.naturalWidth || record.image.width) / record.columns, cellHeight = (record.image.naturalHeight || record.image.height) / record.rows
  const bounds = record.bounds[frame.frame] || { x: frame.column * cellWidth, y: frame.row * cellHeight, width: cellWidth, height: cellHeight }
  const scale = Math.min(width / bounds.width, height / bounds.height)
  const dw = Math.max(1, Math.round(bounds.width * scale)), dh = Math.max(1, Math.round(bounds.height * scale))
  const dx = Math.round(x + (width - dw) / 2), dy = Math.round(y + height - dh)
  ctx.save(); ctx.imageSmoothingEnabled = false
  if (options.flip) { ctx.translate(Math.round(x * 2 + width), 0); ctx.scale(-1, 1) }
  const pose = options.pose
  function drawLayer(image, offsetX=0, offsetY=0) {
    if (!pose) {
      ctx.drawImage(image, bounds.x,bounds.y,bounds.width,bounds.height,dx+offsetX,dy+offsetY,dw,dh)
      return
    }
    // Keep the silhouette connected. Neighbouring rows share the same
    // boundary, and the toe lift fades in below the knee instead of cutting
    // the boots off and moving them as independent rectangles.
    const size = dh/52, base = dy+dh+offsetY+Math.round(pose.y*size)
    const bodyHeight = dh+Math.round(pose.crouch*size)
    const bands = 12, half = Math.round(dw*.5), srcHalf = Math.round(bounds.width*.5)
    const shift = t => Math.round((pose.x*(1-t*t)+pose.bend*(1-t)**2)*size)
    const toe = (t, side) => Math.round(Math.max(0, (t-.68)/.32) * Math.max(0,side*pose.step)*size)
    for (let i=0;i<bands;i++) {
      const t=i/bands, next=(i+1)/bands
      const sy=Math.round(t*bounds.height), sh=Math.round(next*bounds.height)-sy
      const px=dx+offsetX+shift((t+next)/2), top=base-bodyHeight+Math.round(t*bodyHeight)
      const bottom=base-bodyHeight+Math.round(next*bodyHeight)
      if (sh<=0 || bottom<=top) continue
      if (pose.step && next>.68) {
        const leftY=top-toe(t,1), rightY=top-toe(t,-1)
        ctx.drawImage(image,bounds.x,bounds.y+sy,srcHalf,sh,px,leftY,half,Math.max(1,bottom-toe(next,1)-leftY))
        ctx.drawImage(image,bounds.x+srcHalf,bounds.y+sy,bounds.width-srcHalf,sh,px+half,rightY,dw-half,Math.max(1,bottom-toe(next,-1)-rightY))
      } else {
        // Upper body reaches toward the weapon without vertically tearing
        // its blade, bowstring, face or outer contour.
        const arm = Math.round((pose.armX || 0)*size*Math.sin(t*Math.PI)**2*.44)
        const left = pose.grip<0 ? -arm : pose.grip===0 ? -Math.round(arm/2) : 0
        ctx.drawImage(image,bounds.x,bounds.y+sy,bounds.width,sh,px+left,top,Math.max(1,dw+arm),bottom-top)
      }
    }
  }
  if (options.rim && record.flashImage) {
    ctx.globalAlpha=.50; drawLayer(record.flashImage,-1,-1); drawLayer(record.flashImage,1,0); ctx.globalAlpha=1
  }
  drawLayer(record.image)
  if (options.flash && record.flashImage) {
    ctx.globalAlpha=Math.min(.85,options.flash); drawLayer(record.flashImage)
  }
  ctx.restore(); return true
}
