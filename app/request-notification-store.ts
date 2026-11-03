import type {WorkerRequest} from './model';
import {newWorkerRequests} from './request-notifications';
type Store={loaded:boolean;seen:Set<string>;ids:string[];listeners:Set<()=>void>};
// Browser memory and persisted history contain request IDs only, scoped per account.
const stores=new Map<string,Store>();
export const emptyNotifications:string[]=[];
function store(key:string){let value=stores.get(key);if(!value){value={loaded:false,seen:new Set(),ids:[],listeners:new Set()};stores.set(key,value)}return value;}
function update(value:Store,ids:string[]){if(value.ids.length===ids.length&&value.ids.every((id,i)=>id===ids[i]))return;value.ids=ids;for(const listener of value.listeners)listener();}
export function notificationSnapshot(key:string){return store(key).ids;}
export function subscribeNotifications(key:string,listener:()=>void){const value=store(key);value.listeners.add(listener);return()=>{value.listeners.delete(listener)};}
export function receiveNotifications(key:string,requests:WorkerRequest[]){
 const value=store(key),storageKey='hewers.worker-notifications:'+key;
 if(!value.loaded){value.loaded=true;try{const parsed:unknown=JSON.parse(localStorage.getItem(storageKey)||'[]');if(Array.isArray(parsed))for(const id of parsed)if(typeof id==='string')value.seen.add(id);}catch{}}
 const incoming=newWorkerRequests(requests,value.seen);
 for(const request of incoming)value.seen.add(request.id);
 if(incoming.length)try{localStorage.setItem(storageKey,JSON.stringify([...value.seen]));}catch{}
 const pending=new Set(requests.filter(r=>r.status==='pending').map(r=>r.id));
 update(value,[...new Set([...incoming.map(r=>r.id),...value.ids])].filter(id=>pending.has(id)));
}
export function dismissNotification(key:string,id?:string){const value=store(key);update(value,id?value.ids.filter(existing=>existing!==id):[]);}
