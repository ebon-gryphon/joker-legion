#!/usr/bin/env node
/** Build a single-file, offline copy of the already-built Legion demo. */
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { tmpdir, homedir } from 'node:os'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { JOKERS } from '../src/campaignRules.js'
import { PERFORMERS } from '../src/performers.js'
import { SCORE_LEVELS } from '../src/music.js'

const root = fileURLToPath(new URL('../', import.meta.url))
const dist = join(root, 'dist')
const entryHtml = join(dist, 'index.html')
const destination = join(root, 'output/legion-demo.html')
const args = process.argv.slice(2)
if (args.some(arg => arg !== '--build')) {
  throw new Error('用法：bun scripts/build-legion-demo.mjs [--build]')
}

const homeBun = join(homedir(), '.bun/bin/bun')
const bun = process.versions.bun ? process.execPath : existsSync(homeBun) ? homeBun : 'bun'

function runBun(argv) {
  const result = spawnSync(bun, argv, { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 })
  if (result.error || result.status !== 0) {
    throw new Error(`Bun 执行失败。请确认已安装 Bun。\n${result.error?.message || result.stderr || result.stdout}`)
  }
  return result
}

function attr(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, 'i'))
  return match?.[2] || ''
}

function builtAsset(url) {
  if (/^(?:https?:)?\/\//i.test(url)) throw new Error(`构建引用了外部文件：${url}`)
  const pathname = decodeURIComponent(url.split(/[?#]/)[0])
  // Vite's /joker/ base does not exist on file://. Resolve its assets from dist/.
  const assets = pathname.match(/(?:^|\/)(assets\/.+)$/)
  const path = assets ? resolve(dist, assets[1]) : resolve(dirname(entryHtml), pathname)
  const fromDist = relative(dist, path)
  if (fromDist.startsWith('..') || isAbsolute(fromDist)) throw new Error(`文件不在 dist 中：${url}`)
  return path
}

function scriptSafe(value) {
  return value.replace(/<\/script/gi, '<\\/script').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
}

async function main() {
  if (args.includes('--build')) runBun(['run', 'build'])
  if (!existsSync(entryHtml)) {
    throw new Error('未找到 dist/index.html。请先运行 bun run build。')
  }
  let html = await readFile(entryHtml, 'utf8')
  const scripts = [...html.matchAll(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi)]
    .map(match => match[0]).filter(tag => attr(tag, 'type') === 'module' && attr(tag, 'src'))
  if (scripts.length !== 1) throw new Error('试玩入口必须只有一个 Vite module 脚本。')
  const entry = builtAsset(attr(scripts[0], 'src'))
  const compiled = await readFile(entry, 'utf8')
  if (!compiled.includes('__LEGION_ASSETS__')) {
    throw new Error('当前构建未包含离线素材入口 __LEGION_ASSETS__。请更新素材 helper 后重新运行 bun run build。')
  }

  const styles = []
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    if (attr(match[0], 'rel').toLowerCase() !== 'stylesheet') continue
    let css = await readFile(builtAsset(attr(match[0], 'href')), 'utf8')
    // System Chinese fonts are deliberately used by the offline copy.
    css = css.replace(/@import\s*(?:url\(\s*(?:"[^"]*"|'[^']*'|[^)]*)\s*\)|"[^"]*"|'[^']*')[^;]*;/gi, '')
    if (/@import\b/i.test(css)) throw new Error('离线样式仍存在未处理的 @import。')
    const external = [...css.matchAll(/url\(\s*(["']?)(.*?)\1\s*\)/gi)]
      .map(match => match[2]).find(url => !url.startsWith('data:') && !url.startsWith('#'))
    if (external) throw new Error(`离线样式仍引用外部素材：${external}`)
    styles.push(css)
  }
  if (!styles.length) throw new Error('没有找到试玩样式文件。')

  // Keep the offline image list in sync with both portrait renderers.
  const imageNames = ['title-command', 'queen-motion', 'regalia', 'armory', 'spades', 'hearts', 'clubs', 'diamonds', 'relics', 'battlefield', 'fusions', 'enemies', 'combat-motion', 'convoy', 'performer-avatars', 'control-stamps', 'control-ink', 'control-ticket', 'control-banner', 'control-tab']
  for (const name of imageNames) {
    if (!existsSync(join(root, 'public/legion-pixel', `${name}.png`))) throw new Error(`缺少像素素材 ${name}.png。`)
  }
  const assets = Object.fromEntries(await Promise.all(imageNames.map(async name => [
    `pixel-${name}`, `data:image/png;base64,${(await readFile(join(root, 'public/legion-pixel', `${name}.png`))).toString('base64')}`,
  ])))

  for (const name of new Set(PERFORMERS.flatMap(actor => [actor.art, actor.keyArt]))) {
    const art = await readFile(join(root,'public/legion-pixel',name + '.jpg'))
    assets['pixel-' + name] = 'data:image/jpeg;base64,' + art.toString('base64')
  }
  for (const scene of Object.keys(SCORE_LEVELS)) {
    const track = await readFile(join(root, 'public/music', scene + '.mp3'))
    assets['music-' + scene] = 'data:audio/mpeg;base64,' + track.toString('base64')
  }
  const temporary = await mkdtemp(join(tmpdir(), 'joker-legion-offline-'))
  let bundle
  try {
    const output = join(temporary, 'legion.iife.js')
    runBun(['build', entry, '--target', 'browser', '--format', 'iife', '--minify', '--outfile', output])
    bundle = await readFile(output, 'utf8')
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }

  html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<link\b[^>]*>/gi, tag => /^(?:modulepreload|stylesheet)$/i.test(attr(tag, 'rel')) ? '' : tag)
  html = html.replace('</head>', `<style>${styles.join('\n')}</style>\n</head>`)
  const assetScript = `window.__LEGION_OFFLINE__=true;window.__LEGION_ASSETS__=${JSON.stringify(assets)};`
  html = html.replace('</body>', `<script>${scriptSafe(assetScript)}</script>\n<script>${scriptSafe(bundle)}</script>\n</body>`)
  await mkdir(dirname(destination), { recursive: true })
  await writeFile(destination, html, 'utf8')
  const size = (Buffer.byteLength(html) / 1024 / 1024).toFixed(1)
  console.log(`离线试玩已生成：${destination}\n${PERFORMERS.length} 位可玩小丑、52 张牌绘、7 套品质军装、12 种征兵牌型、66 对职业融合、12 波双首领、8 类敌军、${JOKERS.length} 种商店物品、战场及三段配乐已内联 · ${size} MiB · 双击 HTML 即可开始，无需联网或启动服务器。`)
}

main().catch(error => {
  console.error(`打包失败：${error.message}`)
  process.exitCode = 1
})
