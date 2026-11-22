'use client';

import {useEffect,useState} from 'react';
import {readApiJson} from './api-client';
import {FACE_MODEL} from './face-math';
import type {MotionFrame} from './face-motion';
import type {ScannerAction} from './lunch-attendance';

type Capture={owner:string;userId:string;siteId:string;mode:ScannerAction;occurredAt:string;frames:MotionFrame[]};
type StoredCapture={
 id:string;owner:string;userId:string;siteId:string;occurredAt:string;
 encrypted?:{key:CryptoKey;iv:Uint8Array<ArrayBuffer>;bytes:ArrayBuffer};
 error?:string;
};
const changed='hewers-offline-face-queue-changed';
let database:Promise<IDBDatabase>|undefined;
const syncs=new Map<string,Promise<void>>();

function open() {
 return database??=new Promise<IDBDatabase>((resolve,reject)=>{
  const request=indexedDB.open('hewers-offline-face',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('scans',{keyPath:'id'}).createIndex('account',['owner','userId']);
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error);
  request.onblocked=()=>reject(Error('Offline scan storage is busy.'));
 }).catch(error=>{database=undefined;throw error;});
}

async function run<T>(mode:IDBTransactionMode,operation:(store:IDBObjectStore)=>IDBRequest<T>){
 const db=await open();
 return new Promise<T>((resolve,reject)=>{
  const transaction=db.transaction('scans',mode);
  const request=operation(transaction.objectStore('scans'));
  transaction.oncomplete=()=>resolve(request.result);
  transaction.onabort=()=>reject(transaction.error||Error('Could not save the offline scan.'));
  transaction.onerror=()=>reject(transaction.error);
 });
}

const list=(owner:string,userId:string)=>run<StoredCapture[]>('readonly',store=>store.index('account').getAll([owner,userId]));
const notify=()=>window.dispatchEvent(new Event(changed));

export async function saveOfflineFace(capture:Capture){
 const {frames,mode,...metadata}=capture;
 const encoder=new TextEncoder();
 const key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const bytes=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,encoder.encode(JSON.stringify({frames,mode})));
 await run('readwrite',store=>store.add({id:crypto.randomUUID(),...metadata,encrypted:{key,iv,bytes}}));
 notify();
}

async function flush(owner:string,userId:string,signal:AbortSignal){
 const scans=(await list(owner,userId)).sort((a,b)=>a.occurredAt.localeCompare(b.occurredAt));
 for(const scan of scans){
  if(signal.aborted||!navigator.onLine)return;
  if(!scan.encrypted)continue;
  const {key,iv,bytes}=scan.encrypted;
  const decoded=await crypto.subtle.decrypt({name:'AES-GCM',iv},key,bytes);
  const {frames,mode}=JSON.parse(new TextDecoder().decode(decoded)) as Pick<Capture,'frames'|'mode'>;
  if(signal.aborted)return;
  const response=await fetch('/api/face',{
   method:'POST',headers:{'Content-Type':'application/json','x-workspace-id':owner},
   body:JSON.stringify({action:'kiosk-offline',id:scan.id,owner,userId,siteId:scan.siteId,occurredAt:scan.occurredAt,mode,model:FACE_MODEL,
    samples:frames.map(frame=>frame.descriptor),motion:{frames}}),
   signal:AbortSignal.any([signal,AbortSignal.timeout(15000)]),
  });
  const body=await readApiJson<{queued?:boolean;code?:string;error?:string}>(response).catch(()=>null);
  if(response.ok&&body?.queued===true){
   await run('readwrite',store=>store.delete(scan.id));
  }else if(
   (response.status===403&&body?.code==='offline-site-unavailable')||
   (response.status===422&&(body?.code==='ambiguous'||body?.code==='mismatch'))
  ){
   const {encrypted:_,...metadata}=scan;
   await run('readwrite',store=>store.put({...metadata,error:body.error||'The face could not be matched.'}));
  }else{
   return;
  }
  notify();
 }
}

export function useOfflineFaceSync(owner:string,userId:string,enabled:boolean){
 useEffect(()=>{
  if(!owner||!userId||!enabled)return;
  const controller=new AbortController(),scope=JSON.stringify([owner,userId]);
  const sync=()=>{
   if(!navigator.onLine||syncs.has(scope)||controller.signal.aborted)return;
   const pending=flush(owner,userId,controller.signal).catch(()=>{}).finally(()=>syncs.delete(scope));
   syncs.set(scope,pending);
  };
  window.addEventListener('online',sync);
  window.addEventListener('focus',sync);
  window.addEventListener(changed,sync);
  const interval=setInterval(sync,15000);
  sync();
  return()=>{
   controller.abort();
   clearInterval(interval);
   window.removeEventListener('online',sync);
   window.removeEventListener('focus',sync);
   window.removeEventListener(changed,sync);
  };
 },[owner,userId,enabled]);
}

export function useOfflineFaceSummary(owner:string,userId:string){
 const [summary,setSummary]=useState({queued:0,review:[] as {id:string;occurredAt:string;error:string}[]});
 useEffect(()=>{
  let active=true;
  const refresh=()=>void list(owner,userId).then(scans=>{
   if(active)setSummary({
    queued:scans.filter(scan=>scan.encrypted).length,
    review:scans.flatMap(({id,occurredAt,error})=>error?[{id,occurredAt,error}]:[]).sort((a,b)=>a.occurredAt.localeCompare(b.occurredAt)),
   });
  }).catch(()=>{});
  refresh();
  window.addEventListener(changed,refresh);
  return()=>{active=false;window.removeEventListener(changed,refresh);};
 },[owner,userId]);
 return summary;
}
