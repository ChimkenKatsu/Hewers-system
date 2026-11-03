'use client';
import {useCallback,useEffect,useSyncExternalStore} from 'react';
import {Bell,X} from 'lucide-react';
import type {State} from './model';
import {notificationSnapshot,subscribeNotifications,receiveNotifications,dismissNotification,emptyNotifications} from './request-notification-store';
export default function RequestNotifications({data,workspaceId,userId,admin,onReview}:{data:State;workspaceId:string;userId:string;admin:boolean;onReview:(id:string)=>void}){
 const scope=workspaceId+':'+userId;
 const ids=useSyncExternalStore(useCallback(listener=>subscribeNotifications(scope,listener),[scope]),useCallback(()=>notificationSnapshot(scope),[scope]),()=>emptyNotifications);
 useEffect(()=>{
  if(!admin||!workspaceId||!userId)return;
  receiveNotifications(scope,data.workerRequests||[]);
 },[data.workerRequests,workspaceId,userId,admin,scope]);
 if(!admin||!ids.length)return null;
 const requests=ids.map(id=>(data.workerRequests||[]).find(r=>r.id===id&&r.status==='pending')).filter(r=>!!r);
 if(!requests.length)return null;
 const dismiss=(id:string)=>dismissNotification(scope,id);
 return <aside className="request-popups" aria-label="New worker notifications"><div className="request-popup-announcement" role="status" aria-live="polite" aria-atomic="true">{requests.length} new worker {requests.length===1?'request needs':'requests need'} review.</div>{requests.slice(0,3).map(r=><section className="request-popup" key={r.id} aria-label={'Worker request: '+r.name}><span className="request-popup-icon"><Bell size={20}/></span><div className="request-popup-body"><strong>New worker awaiting approval</strong><p><b>{r.name}</b> was submitted by {r.createdBy}.</p><small>{data.sites.find(s=>s.id===r.siteId)?.name||'Assigned site'} · {r.trade}</small><button className="request-popup-review" onClick={()=>{dismiss(r.id);onReview(r.id)}}>Review request →</button></div><button className="icon-btn request-popup-close" aria-label={'Dismiss notification for '+r.name} onClick={()=>dismiss(r.id)}><X size={17}/></button></section>)}{requests.length>3&&<button className="request-popup-more" onClick={()=>{dismissNotification(scope);onReview(requests[0].id)}}>View all {requests.length} new requests</button>}</aside>;
}
