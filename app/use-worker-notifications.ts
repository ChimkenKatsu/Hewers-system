'use client';
import {useCallback,useEffect,useMemo,useState,useSyncExternalStore} from 'react';
import type {State} from './model';
import type {Access} from './permissions';
import {workspaceNotifications} from './worker-notifications';
import {readApiJson} from './api-client';
import {popupSnapshot,subscribePopups,receiveWorkerPopups,dismissWorkerPopup,emptyPopupIds} from './worker-popup-store';
export function useWorkerNotifications(state:State,access:Access,workspaceId:string,enabled:boolean){
 const scope=workspaceId+':'+access.userId,events=useMemo(()=>workspaceNotifications(state,access),[state,access]);
 const [readState,setReadState]=useState<{scope:string;ids:string[]}>({scope:'',ids:[]}),[error,setError]=useState('');
 const reads=readState.scope===scope?readState.ids:[];
 const popups=useSyncExternalStore(useCallback(listener=>subscribePopups(scope,listener),[scope]),useCallback(()=>popupSnapshot(scope),[scope]),()=>emptyPopupIds);
 useEffect(()=>{if(!enabled||!workspaceId||!access.userId||!['administrator','auditor'].includes(access.role))return;let active=true;const abort=new AbortController();const sync=async()=>{try{const r=await fetch('/api/notifications',{headers:{'x-workspace-id':workspaceId},signal:abort.signal,cache:'no-store'}),b=await readApiJson<{readIds:string[];error?:string}>(r);if(!r.ok||!Array.isArray(b.readIds))throw Error(b.error||'Notification history unavailable');if(active){setReadState(old=>({scope,ids:[...new Set([...(old.scope===scope?old.ids:[]),...b.readIds])]}));setError('')}}catch{if(active)setError('Read status could not sync. Notifications are still shown.')}};void sync();const timer=setInterval(()=>{if(!document.hidden)void sync()},15000);window.addEventListener('focus',sync);return()=>{active=false;abort.abort();clearInterval(timer);window.removeEventListener('focus',sync)}},[scope,workspaceId,enabled,access.userId,access.role]);
 useEffect(()=>{if(enabled&&(readState.scope===scope||error))receiveWorkerPopups(scope,events,readState.scope===scope?readState.ids:[])},[events,enabled,scope,readState,error]);
 function dismiss(id:string){dismissWorkerPopup(scope,id)}
 async function markRead(ids:string[]){if(!ids.length)return;try{const r=await fetch('/api/notifications',{method:'POST',headers:{'Content-Type':'application/json','x-workspace-id':workspaceId},body:JSON.stringify({ids})}),b=await readApiJson<{readIds:string[];error?:string}>(r);if(!r.ok)throw Error(b.error);setReadState(old=>({scope,ids:[...new Set([...(old.scope===scope?old.ids:[]),...b.readIds])]}));setError('');ids.forEach(id=>dismissWorkerPopup(scope,id))}catch(e){setError(e instanceof Error?e.message:'Could not mark notification as read')}}
 return {events,reads,popups,error,dismiss,markRead,unread:events.filter(n=>!reads.includes(n.id)).length};
}
export type WorkerNotificationFeed=ReturnType<typeof useWorkerNotifications>;
