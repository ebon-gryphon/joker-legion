<script setup>
import {LEGACY_NODES,terminalPhase} from './legacyRules.js'
import KeyMark from './KeyMark.vue'
import { computed, nextTick, onMounted, ref } from 'vue'
import { PERFORMERS, performerOf } from './performers.js'
import { pixelAssetUrl } from './spriteAtlas.js'
import { DIFFICULTIES } from './tactics.js'
import {initialLifeMax} from './playerLife.js'
import PixelSprite from './PixelSprite.vue'
import DealKey from './DealKey.vue'
import TitleCourt from './TitleCourt.vue'
import ScoreToggle from './ScoreToggle.vue'

const props = defineProps({ balance:Number,mode:String,best:Object,doctrine:String, difficulty:String, seed:String, levels:Object, saved:Object, dailyBest:Object })
const emit = defineEmits(['mode','choose','difficulty','seed','start','daily','resume','guide','legacy','settings'])
const selected = computed(() => performerOf(props.doctrine))
const selecting = ref(false)
const table = ref(null)
const cover = pixelAssetUrl('title-command')
const guides = [['book','牌型图鉴'],['allies','军团图鉴'],['enemies','敌军图鉴']]

function pickActor(actor, event) {
  event.currentTarget.focus({preventScroll:true})
  emit('choose',actor.doctrine)
}

const savedPrimary=()=>props.saved && !terminalPhase(props.saved.phase)?'.deal-resume':'.cover-start'
async function showDaily() {
  await showSelection(true)
  const record=table.value?.querySelector('.daily-record')
  if(record)record.open=true
  table.value?.querySelector('.daily-deal')?.focus()
}
async function showSelection(open) {
  selecting.value = open
  await nextTick()
  table.value?.closest('.deal-scrim')?.scrollTo(0,0)
  const target = table.value?.querySelector(open ? '.joker-portrait.picked' : savedPrimary())
  target?.focus({preventScroll:true})
}
onMounted(() => table.value?.querySelector(savedPrimary())?.focus({preventScroll:true}))
</script>

<template>
  <div ref="table" class="joker-table" :class="{ 'title-screen': !selecting }" @keydown.esc.stop="selecting && showSelection(false)">
    <div v-if="!selecting" class="dealer-cover">
      <img :src="cover" alt="" class="portrait-army" aria-hidden="true"/>
      <img :src="cover" alt="玩家并拢两指按住同图的彩色大王与黑白小王，红线牵动小丑双臂，小丑用金线指挥军团" class="dealer-original"/>
      <h1 id="intro-title" class="cover-title" aria-label="小丑军团 · JOKER LEGION">
        <span class="cover-title-cn">小丑<i aria-hidden="true">♦</i>军团</span>
        <span class="cover-title-en" lang="en">JOKER LEGION</span>
      </h1>
      <div class="cover-menu">
        <div class="cover-play">
          <TitleCourt :secondary="!!saved && !terminalPhase(saved.phase)" @click="showSelection(true)"/>
          <button v-if="saved" class="deal-resume key-ink" :class="{'ui-primary':!terminalPhase(saved.phase)}" @click="emit('resume')">
            <KeyMark name="return"/><span>{{ terminalPhase(saved.phase)?'查看上局结算':'继续远征' }}<small>{{ saved.mode==='endless'?'无尽挑战':'标准远征' }} · {{ performerOf(saved.doctrine).name }} · 第 {{ saved.wave }} 波</small></span>
          </button>
          <div class="cover-alternates">
            <button class="key-link" @click="emit('mode','endless');showSelection(true)">∞ 无尽挑战</button>
            <button class="key-link" @click="showDaily">♧ 每日同局</button>
          </div>
        </div>
        <nav class="table-guides" aria-label="军团与图鉴"><button class="key-index legacy-open" @click="emit('legacy')">军团传承 <span class="cover-wallet" :aria-label="'红水晶余额 '+(balance ?? '读取中')">♦ {{ balance ?? '…' }}</span></button>
          <button class="key-index" v-for="[id,label] in guides" :key="id" @click="emit('guide',id)"><KeyMark :name="id"/>{{ label }}</button>
        </nav>
        <button class="cover-score key-index" @click="emit('settings')">⚙ 设置</button>
      </div>
    </div>

    <section v-else class="casting-stage" :style="{ '--tint':selected.color }">
      <div class="casting-art" aria-hidden="true">
        <img v-for="actor in PERFORMERS" :key="actor.id" :src="pixelAssetUrl(actor.keyArt,'jpg')" alt=""
          :class="{ active:actor===selected }" :data-backdrop-for="actor.id" draggable="false"/>
      </div>
      <header class="casting-header">
        <div class="casting-heading"><button class="cover-back key-link" @click="showSelection(false)"><KeyMark name="return"/>← 返回封面</button><h2 id="intro-title">选你的小丑</h2></div>
        <div class="casting-tools"><button class="key-index legacy-open" @click="emit('legacy')">军团传承 <span class="cover-wallet" :aria-label="'红水晶余额 '+(balance ?? '读取中')">♦ {{ balance ?? '…' }}</span></button><nav class="casting-guides" aria-label="游戏图鉴"><button class="key-index" v-for="[id,label] in guides" :key="id" @click="emit('guide',id)"><KeyMark :name="id"/>{{ label }}</button></nav><ScoreToggle/></div>
      </header>
      <div class="casting-bio" aria-live="polite">
        <h3 class="casting-name">{{ selected.name }} <small>{{ selected.role }}</small></h3>
        <div class="trick-brief">
          <div class="skill-heading"><strong>{{ selected.skill }}</strong><small>{{ selected.timing }} · 每波一次</small></div>
          <p>{{ selected.rule }}</p>
          <button class="build-link key-link" @click="emit('guide','performer')"><KeyMark name="trick"/>故事与打法 ↗</button>
        </div>
      </div>
      <div class="casting-controls">
        <div class="joker-cards" role="group" aria-label="可玩小丑">
          <button class="key-portrait" v-for="actor in PERFORMERS" :key="actor.id" :class="['joker-portrait',{ picked:actor===selected }]"
            :style="{ '--tint':actor.color }" :data-actor="actor.id" :aria-label="'选择'+actor.name+'，'+actor.skill"
            :aria-pressed="actor===selected" @click="pickActor(actor,$event)">
            <span class="avatar-window"><PixelSprite atlas="performer-avatars" :frame="actor.avatarFrame" :columns="3" :rows="2"/></span>
            <b>{{ actor.name }}</b>
          </button>
        </div>
        <div class="deal-options mode-options" aria-label="挑战模式"><b>模式</b><button class="key-ink" v-for="[id,title] in [['standard','标准远征'],['endless','无尽挑战']]" :data-mode="id" :aria-pressed="mode===id" @click="emit('mode',id)"><span v-if="mode===id" aria-hidden="true">✓ </span>{{ title }}</button><small v-if="best">最佳 {{ best.reached || best.waves }} 波</small><button class="key-link" v-if="saved" @click="emit('resume')">{{ terminalPhase(saved.phase)?'查看上局结算':'继续第 '+saved.wave+' 波' }}</button></div>
        <div class="deal-options"><b>难度</b>
          <button class="key-tab" v-for="(mode,id) in DIFFICULTIES" :key="id" :aria-pressed="difficulty===id" @click="emit('difficulty',id)">{{ mode.name }}</button>
          <small>♥ {{ initialLifeMax(difficulty) }} 生命</small>
        </div>
        <details v-if="levels && LEGACY_NODES.some(n=>levels[n.id])" class="deal-legacy"><summary class="key-disclosure">本次开局的军团传承</summary><ul><li v-for="n in LEGACY_NODES.filter(n=>levels[n.id])" :key="n.id">{{ n.name }} · {{ n.effect(n.amount*levels[n.id]) }}</li></ul></details>
        <label class="deal-seed">固定种子 <input class="key-input" aria-label="固定种子" :value="seed" maxlength="64" placeholder="留空随机开局" autocomplete="off" spellcheck="false" @input="emit('seed',$event.target.value)"/><small>每日同局仍使用当天种子</small></label>
        <details class="daily-record"><summary class="key-disclosure">每日同局 · 本机成绩</summary>
          <p v-if="dailyBest">{{ mode==='endless'?'无尽挑战':'标准远征' }} · {{ selected.name }} · 已守住 {{ dailyBest.waves }} 波 · 击退 {{ dailyBest.kills }} 名 · {{ dailyBest.lifeVersion===1?'剩余生命':'旧制防线值' }} {{ dailyBest.gate }}</p>
          <p v-else>今天的{{ selected.name }}尚无此模式与难度的本机成绩。</p>
        </details>
        <div class="deal-actions intro-buttons">
          <DealKey :actor="selected" class="intro-start" @click="emit('start')">以{{ selected.name }}开局</DealKey>
          <button class="daily-deal key-ink" @click="emit('daily')"><KeyMark name="cards"/><span>每日同局<small>{{ dailyBest ? (dailyBest.lifeVersion===1?'本机最佳':'旧制记录')+' · '+dailyBest.waves+' 波 / '+dailyBest.kills+' 击退' : '每日同一开局 · 可重复挑战' }}</small></span></button>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.deal-legacy{font-size:13px;color:#e9c5bb;margin-bottom:8px}.deal-legacy summary{cursor:pointer}.deal-legacy ul{margin:.4em 0;padding-left:1.3em}
.joker-table{width:100%;min-height:100svh;color:#f1dfb4;background:#0d0a0b;font-family:'PingFang SC','Microsoft YaHei',sans-serif}
.joker-table.title-screen {
  display:grid; place-items:center; height:100dvh; background:#140f1a;
}
.dealer-cover {
  /* Anchor the menu to the painted canvas, including on letterboxed displays. */
  position:relative; isolation:isolate; overflow:hidden;
  width:min(100%,calc(100dvh * 1672 / 941)); aspect-ratio:1672 / 941;
  container-type:inline-size;
  --side:clamp(12px,3%,58px);
}
.dealer-original { display:block; width:100%; height:100%; object-fit:contain; }
.portrait-army { display:none; }
.cover-title {
  position:absolute;top:14%;left:2.8%;width:21.6%;margin:0;z-index:1;pointer-events:none;
  color:#f3d3a0;text-align:center;text-shadow:0 1px 2px #120a18,0 2px 8px #120a18;
}
/* The landscape print already carries the Chinese gold lettering. */
.cover-title-cn {position:absolute;width:1px;height:1px;clip-path:inset(50%);overflow:hidden;white-space:nowrap}
.cover-title-en {
  display:flex;align-items:center;justify-content:center;gap:.7em;white-space:nowrap;
  font:600 clamp(11px,1.28cqw,22px)/1.35 'Baskerville','Palatino Linotype','Book Antiqua',Georgia,serif;
  letter-spacing:.24em;text-indent:.24em;
}
.cover-title-en::before,.cover-title-en::after {
  content:'';flex:1;min-width:10px;height:1px;
  background:linear-gradient(90deg,transparent,#c69b69);box-shadow:0 1px #1a1019;
}
.cover-title-en::after {transform:rotate(180deg)}
.cover-menu { position:absolute; inset:0; pointer-events:none; }
.cover-menu button { pointer-events:auto; }
.cover-score { position:absolute; right:max(var(--side),env(safe-area-inset-right)); bottom:max(4%,env(safe-area-inset-bottom)); }
.casting-tools { display:flex; align-items:center; gap:8px; }
.cover-play {
  position:absolute; top:24%; left:max(var(--side),env(safe-area-inset-left));
  display:grid; justify-items:stretch; gap:6px; filter:drop-shadow(0 3px 5px #100b14a6);
}
.cover-menu .table-guides {
  position:absolute; right:max(var(--side),env(safe-area-inset-right)); top:max(4%,env(safe-area-inset-top));
  filter:drop-shadow(0 2px 4px #100b148c);
}
.table-guides,.casting-guides { display: flex; align-items: center; gap: 8px; }
.cover-menu .deal-resume { display:flex; align-items:center; justify-content:center; gap:5px; min-height:44px; font-size:14px; }
.deal-resume span:not(.key-mark) { display:grid; gap:2px; }
.deal-resume small { font-size:11px; font-weight:500; }
.cover-menu .table-guides button { min-height:44px; white-space:nowrap; }
@media (orientation:landscape) and (max-width:760px) {
  .cover-menu .table-guides { top:auto; bottom:max(4%,env(safe-area-inset-bottom)); gap:4px; }
  .cover-score { bottom:auto; top:max(3%,env(safe-area-inset-top)); }
}
@media (orientation:portrait) {
  .cover-score { bottom:auto; top:max(2%,env(safe-area-inset-top)); }
  .dealer-cover { width:100%; height:100%; aspect-ratio:auto; }
  .dealer-original { object-fit:cover; object-position:51% center;transform:translateY(clamp(24px,8vw,40px)); }
  .cover-title {
    top:max(3%,env(safe-area-inset-top));left:max(5%,env(safe-area-inset-left));
    width:min(60%,300px);display:grid;gap:7px;
    color:#ffe0a3;text-shadow:0 1px #a75c33,0 2px 4px #160c13,0 3px 12px #100b18;
  }
  .cover-title-cn {
    position:static;width:auto;height:auto;clip-path:none;overflow:visible;
    font:900 clamp(28px,8.6vw,48px)/1.15 'Songti SC','STSong',serif;letter-spacing:.035em;
  }
  .cover-title-cn i {margin:0 .12em;color:#e74d42;font-size:.62em;font-style:normal;vertical-align:.12em}
  .cover-title-en {font-size:clamp(10px,3.1vw,16px);letter-spacing:.19em;text-indent:.19em;gap:.55em}
  .cover-menu {
    display:grid; align-content:end; justify-items:center; gap:8px;
    padding:0 max(4px,env(safe-area-inset-right)) max(3.5dvh,env(safe-area-inset-bottom),12px) max(4px,env(safe-area-inset-left));
    background:linear-gradient(to top,#170e1dd9, #170e1d78 12%, transparent 31%);
  }
  .cover-play,.cover-menu .table-guides { position:static; }
  .cover-play { width:min(64%,245px); }
  .cover-menu .table-guides { justify-content:center; flex-wrap:wrap; gap:4px; }
}
@media (orientation:portrait) and (min-aspect-ratio:4/5) {
  .dealer-original { object-position:58% center; }
}
/* On tall phones, frame the jester and the cavalry separately from the same print. */
@media (max-aspect-ratio:3/5) {
  .portrait-army { display:block; position:absolute; bottom:0; width:100%; height:134%; object-fit:cover; object-position:78% bottom; }
  .dealer-original {
    position:relative; height:150vw; object-position:51% top;
    mask-image:linear-gradient(to bottom,#000 52%,transparent 74%);
  }
}
.casting-stage{
  position:relative;isolation:isolate;display:grid;grid-template-rows:auto 1fr auto;
  padding:clamp(22px,5svh,60px) clamp(28px,6vw,104px) clamp(24px,6svh,70px);
  min-height:100svh;background:#191416;overflow:hidden;
}
.casting-art{position:absolute;inset:0;z-index:-1;pointer-events:none;background:radial-gradient(ellipse at 78% 38%,color-mix(in srgb,var(--tint) 24%,#181317),#171316 76%)}
.casting-art img{
  position:absolute;inset:0 0 0 auto;height:100%;width:min(68%,80svh);object-fit:cover;object-position:center 12%;
  opacity:0;transition:opacity .36s ease;mask-image:linear-gradient(90deg,transparent 0%,#000 25%,#000 97%,#000d);
}
.casting-art img.active{opacity:.78}
.casting-art:after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,#120e11c9 0%,#181216a8 30%,transparent 66%),linear-gradient(0deg,#151013b0,transparent 27%,transparent 86%,#15101365)}
.casting-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
.casting-heading{display:flex;align-items:center;gap:16px}
.cover-back,.build-link{background:none;color:#dbc6a4;font-size:13px;padding:5px 0}
.casting-heading h2{margin:0;padding-left:16px;border-left:1px solid #9a7861;font:700 18px/1.2 'Songti SC','STSong',serif}
.casting-guides{display:flex;gap:8px}
.casting-bio,.casting-controls{width:min(51%,560px)}
.casting-bio{align-self:end;padding:clamp(36px,7svh,100px) 0 clamp(18px,4svh,48px)}
.casting-name{display:flex;align-items:baseline;gap:14px;margin:0 0 14px;color:#f7e9cc;font:900 clamp(54px,6.4vw,104px)/1.08 'Songti SC','STSong',serif;text-shadow:0 2px 8px #120e11}
.casting-name small{color:var(--tint);font:600 15px/1.4 'PingFang SC','Microsoft YaHei',sans-serif;letter-spacing:.12em}
.trick-brief{padding:5px 0 0 13px;border-left:2px solid var(--tint);text-shadow:0 1px 6px #100c10}
.skill-heading{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}
.skill-heading strong{font:800 22px/1.25 'Songti SC','STSong',serif;color:#ffdfaa}
.skill-heading small,.deal-options small{color:#d3c0b1;font-size:12px}
.trick-brief p{font-size:14px;line-height:1.65;margin:6px 0 1px;color:#f2e4d5;max-width:34em}
.build-link{color:#efd4a8;text-decoration:underline;text-underline-offset:4px}
.joker-cards{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:clamp(4px,.6vw,10px)}
.joker-portrait{display:grid;gap:6px;min-width:0;padding:0;background:none;border:0;text-align:center;color:#cebdac}
.avatar-window{display:block;position:relative;aspect-ratio:1;background:#251b20;border:2px solid #72605a;box-shadow:0 2px 5px #080708b0}
.avatar-window canvas{display:block;width:100%;height:100%;image-rendering:pixelated}
.joker-portrait b{font:700 clamp(12px,1.1vw,17px)/1.4 'Songti SC','STSong',serif}
.joker-portrait:hover .avatar-window{border-color:#d3bd9b}
.joker-portrait:not(.picked):not(:hover) .avatar-window{filter:brightness(.85)}
.joker-portrait.picked{color:#ffe6b7}.joker-portrait.picked .avatar-window{border-color:var(--tint);outline:1px solid #f7da99;outline-offset:1px}
.joker-portrait.picked .avatar-window:after{content:'';position:absolute;bottom:-2px;left:calc(50% - 4px);width:8px;height:5px;background:#ffe2a1;clip-path:polygon(0 100%,50% 0,100% 100%)}
.joker-portrait:focus-visible{outline:2px solid #fff4d7;outline-offset:3px}
.deal-options{display:flex;align-items:center;gap:7px;padding:14px 0;margin-top:14px;border-top:1px solid #806657}
.mode-options button{white-space:nowrap;min-height:36px}.deal-options b{font-size:13px;margin-right:5px}.deal-options button{color:#d7c6b2;border:1px solid #80685a;background:#20181be6;padding:6px 12px;border-radius:2px;font-size:13px}
.deal-options button[aria-pressed=true]{color:#281813;background:#dcc39b;border-color:#efd4a8}.deal-options small{margin-left:auto}
.deal-seed{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 12px;font-size:12px;color:#d7c6b2}.deal-seed input{min-width:0;width:130px;border:1px solid #80685a;border-radius:2px;background:#20181be6;color:#f7e9cc;padding:6px 8px;font:inherit}.deal-seed input:focus-visible{outline:2px solid #efd4a8;outline-offset:2px}.deal-seed small{font-size:10px;color:#b4a191}
.deal-actions.intro-buttons{display:flex;width:100%;align-items:center;justify-content:flex-start}
@media(max-width:760px){
  .table-guides { gap:6px; }
  .casting-stage{padding:16px 5% 18px}.casting-heading{gap:10px}.casting-heading h2{font-size:15px;padding-left:10px}.cover-back{font-size:12px}
  .casting-guides{display:none}.casting-bio,.casting-controls{width:100%;max-width:520px}
  .casting-art img{inset:0 0 auto auto;width:100%;height:min(74svh,150vw);object-fit:cover;object-position:50% 25%;mask-image:linear-gradient(#000 52%,transparent)}
  .casting-art img.active{opacity:.72}
  .casting-art:after{background:linear-gradient(0deg,#171216 0%,#171216ef 28%,#171216a8 47%,transparent 70%),linear-gradient(180deg,#100c10b0,transparent 16%)}
  .casting-bio{padding:clamp(100px,24svh,240px) 0 17px}.casting-name{font-size:clamp(41px,9.8vw,63px);gap:10px;margin-bottom:9px}
  .casting-name small{font-size:13px}.trick-brief{padding:1px 0 0 10px}.skill-heading{gap:8px}.skill-heading strong{font-size:18px}
  .trick-brief p{font-size:13px;line-height:1.55;margin:4px 0 0}.build-link{font-size:12px}
  .joker-portrait b{font-size:13px}.joker-portrait{gap:4px}.avatar-window{border-width:1px}
  .deal-options{margin-top:10px;padding:10px 0}
}
@media(max-width:760px) and (max-height:650px){.casting-bio{padding-top:clamp(60px,16svh,100px)}}
@media(prefers-reduced-motion:no-preference) {
  .casting-controls { animation: deal-portraits 200ms ease-out both; }
  @keyframes deal-portraits { from { opacity: .55; translate: 0 6px; } to { opacity: 1; translate: 0 0; } }
}
@media(prefers-reduced-motion:reduce){.casting-art img{transition:none}}
</style>
