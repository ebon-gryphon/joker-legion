import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises'
import {existsSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'

export async function withBrowser(folder, inspect) {
  const chrome=process.env.LEGION_CHROME_BINARY || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync)
  const profile=await mkdtemp(join(tmpdir(),'legion-endless-'))
  const browser=spawn(chrome,['--headless=new','--no-first-run','--disable-gpu','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'})
  const pause=ms=>new Promise(r=>setTimeout(r,ms))
  const errors=[]
  let ws
  try {
    let port
    for(let i=0;i<100 && !port;i++){try{port=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]}catch{await pause(80)}}
    const list=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json()
    ws=new WebSocket(list.find(p=>p.type==='page').webSocketDebuggerUrl)
    await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j})
    let serial=0;const pending=new Map()
    ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.id){const [r,j]=pending.get(m.id);pending.delete(m.id);m.error?j(Error(m.error.message)):r(m.result)}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text)
      else if(m.method==='Runtime.consoleAPICalled' && m.params.type==='error')errors.push(m.params.args.map(arg=>arg.description ?? arg.value).join(' '))}
    const send=(method,params={})=>new Promise((r,j)=>{pending.set(++serial,[r,j]);ws.send(JSON.stringify({id:serial,method,params}))})
    async function run(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);return r.result.value}
    async function wait(expression){for(let i=0;i<200;i++){if(await run(expression))return;await pause(45)}throw Error('Timeout '+expression+' '+await run('document.body.innerText.slice(-1800)'))}
    async function click(selector){
      const sel=JSON.stringify(selector)
      await wait('document.querySelector('+sel+')?.getClientRects().length && !document.querySelector('+sel+').disabled')
      await run('document.querySelector('+sel+').scrollIntoView({block:"nearest"})')
      const {x,y,hit}=await run('(()=>{let e=document.querySelector('+sel+'),r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return {x,y,hit:e.contains(document.elementFromPoint(x,y))}})()')
      assert.ok(hit,'covered '+selector)
      for(const type of ['mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,x,y,button:'left',clickCount:1})
    }
    async function button(scope,text){
      const sel=JSON.stringify(scope+' button')
      const ok=await run('(()=>{const e=[...document.querySelectorAll('+sel+')].find(e=>e.offsetWidth && !e.disabled && e.innerText.includes('+JSON.stringify(text)+'));if(!e)return false;e.dataset.endlessQa="hit";return true})()')
      assert.ok(ok,scope+' '+text);await click('[data-endless-qa=hit]');await run('document.querySelector("[data-endless-qa=hit]")?.removeAttribute("data-endless-qa")')
    }
    const lens=expr=>'(()=>{const raw=document.querySelector(".scene-shell").__vueParentComponent.setupState.game;const g=raw?.__v_isRef?raw.value:raw;return '+expr+'})()'
    const state=expr=>run(lens('JSON.parse(JSON.stringify(('+expr+') ?? null))'))
    async function shot(name){const r=await send('Page.captureScreenshot',{format:'png'});await writeFile(new URL(name+'.png',folder),Buffer.from(r.data,'base64'))}
    await inspect({send,run,wait,click,button,lens,state,shot,errors,pause})
  } finally {ws?.close();browser.kill();await new Promise(r=>browser.exitCode===null?browser.once('exit',r):r());await rm(profile,{recursive:true,force:true,maxRetries:4})}
}
