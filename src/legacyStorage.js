import {initialProfile,validProfile} from './legacyRules.js'

// A read/modify/write transaction serializes purchases and settlements across browser tabs.
export const PROFILE_DATABASE='joker-legion-inheritance'
let connection
function openProfile(){
  if(!connection)connection=new Promise((resolve,reject)=>{
    const request=indexedDB.open(PROFILE_DATABASE,1)
    request.onupgradeneeded=()=>request.result.createObjectStore('profiles')
    request.onsuccess=()=>{
      const db=request.result
      db.onversionchange=()=>{db.close();connection=null}
      resolve(db)
    }
    request.onerror=()=>reject(request.error)
  }).catch(error=>{connection=null;throw error})
  return connection
}
export async function updateProfile(change=profile=>({profile})){
  const db=await openProfile()
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('profiles','readwrite')
    const store=tx.objectStore('profiles'),read=store.get('local')
    let result,failure
    read.onsuccess=()=>{
      try{
        const current=read.result===undefined?initialProfile():read.result
        if(!validProfile(current))throw Error('军团传承档案损坏或版本不受支持，已保留原档')
        result=change(current)
        if(read.result===undefined || result.profile!==current){
          if(!validProfile(result.profile))throw Error('军团传承账目无效')
          store.put(result.profile,'local')
        }
      }catch(error){failure=error;tx.abort()}
    }
    tx.oncomplete=()=>resolve(result)
    tx.onabort=()=>reject(failure || tx.error || Error('军团传承未能保存'))
  })
}

