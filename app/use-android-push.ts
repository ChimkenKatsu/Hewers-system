'use client';
import {useEffect} from 'react';
type PushBridge={postMessage:(message:string)=>void;onmessage:((event:{data:string})=>void)|null};
export function useAndroidPush(connected:boolean,userId:string){
 useEffect(()=>{
  const bridge=(window as unknown as {HewersPush?:PushBridge}).HewersPush;
  if(!connected||!userId||!bridge)return;
  let active=true;
  bridge.onmessage=event=>{
   try{const {token,remindersSupported}=JSON.parse(event.data);if(typeof token!=='string'||!active)return;
    void fetch('/api/push',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,remindersSupported:remindersSupported===true})}).catch(()=>{/* Retry registration on next sync. */});
   }catch{/* Ignore malformed native messages. */}
  };
  const sync=()=>{if(!document.hidden)bridge.postMessage('register')};
  sync();const timer=setInterval(sync,300000);
  window.addEventListener('focus',sync);window.addEventListener('hewers-push-ready',sync);document.addEventListener('visibilitychange',sync);
  return()=>{active=false;bridge.onmessage=null;clearInterval(timer);window.removeEventListener('focus',sync);window.removeEventListener('hewers-push-ready',sync);document.removeEventListener('visibilitychange',sync)};
 },[connected,userId]);
}
