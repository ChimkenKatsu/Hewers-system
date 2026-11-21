import type {Access} from './permissions';
import {can} from './permissions';
import type {State} from './model';
import {vercelFrontend} from './hosting';

const key='hewers-offline-workspace-v1';
const maxAge=7*24*60*60*1000;
export type OfflineWorkspace={owner:string;userId:string;savedAt:number;sites:{id:string;name:string}[];face:boolean;manual:boolean};

export function saveOfflineWorkspace(access:Access,state:State){
  if(!vercelFrontend||typeof navigator==='undefined'||!('serviceWorker' in navigator)||!access.owner||!access.userId)return;
  const snapshot:OfflineWorkspace={
    owner:access.owner,userId:access.userId,savedAt:Date.now(),
    sites:state.sites.map(({id,name})=>({id,name})),
    face:can(access,'face-check'),manual:can(access,'offline-attendance-request'),
  };
  try{localStorage.setItem(key,JSON.stringify(snapshot));}catch{/* Offline startup remains optional on restricted devices. */}
}

export function clearOfflineWorkspace(){
  try{localStorage.removeItem(key);}catch{/* Storage may be disabled. */}
}

export function readOfflineWorkspace():OfflineWorkspace|null{
  try{
    const snapshot=JSON.parse(localStorage.getItem(key)??'null') as OfflineWorkspace|null;
    if(!snapshot?.owner||!snapshot.userId||!Array.isArray(snapshot.sites)||!Number.isFinite(snapshot.savedAt))return null;
    const age=Date.now()-snapshot.savedAt;
    if(age<0||age>maxAge){clearOfflineWorkspace();return null;}
    return snapshot;
  }catch{return null;}
}
