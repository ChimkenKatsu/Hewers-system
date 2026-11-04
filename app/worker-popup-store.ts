import type {WorkerNotification} from './worker-notifications';
type Store={ids:string[];listeners:Set<()=>void>;seen?:Set<string>};
const stores=new Map<string,Store>();export const emptyPopupIds:string[]=[];
function get(scope:string){let s=stores.get(scope);if(!s){s={ids:[],listeners:new Set()};stores.set(scope,s)}return s}
function update(s:Store,ids:string[]){if(s.ids.length===ids.length&&s.ids.every((id,i)=>id===ids[i]))return;s.ids=ids;for(const listener of s.listeners)listener()}
export const popupSnapshot=(scope:string)=>get(scope).ids;
export function subscribePopups(scope:string,listener:()=>void){const s=get(scope);s.listeners.add(listener);return()=>{s.listeners.delete(listener)}}
export function receiveWorkerPopups(scope:string,events:WorkerNotification[],reads:string[]){const s=get(scope),key='hewers.notification-popups:'+scope;if(!s.seen){s.seen=new Set();try{const ids=JSON.parse(localStorage.getItem(key)||'[]');if(Array.isArray(ids))for(const id of ids)if(typeof id==='string')s.seen.add(id)}catch{}}
 const available=events.filter(n=>!reads.includes(n.id)&&(n.kind==='decision'||n.status==='pending')),incoming=available.filter(n=>!s.seen!.has(n.id));for(const n of incoming)s.seen.add(n.id);if(incoming.length)try{localStorage.setItem(key,JSON.stringify([...s.seen]))}catch{}
 const allowed=new Set(available.map(n=>n.id));update(s,[...new Set([...incoming.map(n=>n.id),...s.ids])].filter(id=>allowed.has(id)));
}
export function dismissWorkerPopup(scope:string,id:string){const s=get(scope);update(s,s.ids.filter(x=>x!==id))}
