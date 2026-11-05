'use client';
import {Bell,X} from 'lucide-react';
import type {State} from './model';
import type {WorkerNotificationFeed} from './use-worker-notifications';
export default function RequestNotifications({data,feed,onReview}:{data:State;feed:WorkerNotificationFeed;onReview:(id:string)=>void}){
 const notifications=feed.events.filter(n=>feed.popups.includes(n.id)&&!feed.reads.includes(n.id)&&(n.kind==='decision'||n.status==='pending'));
 if(!notifications.length)return null;
 return <aside className="request-popups" aria-label="New worker notifications"><div className="request-popup-announcement" role="status" aria-live="polite">{notifications.length} new worker notifications.</div>{notifications.slice(0,3).map(n=><section className="request-popup" key={n.id}><span className="request-popup-icon"><Bell size={20}/></span><div className="request-popup-body"><strong>{n.kind==='missing-timeout'?'Worker has not timed out':n.kind==='submitted'?'New worker awaiting approval':n.status==='accepted'?'Worker approved':'Worker declined'}</strong><p><b>{n.name}</b> · {n.actor}</p><small>{data.sites.find(s=>s.id===n.siteId)?.name||'Assigned site'} · {n.trade}</small>{n.reason&&<p>Reason: {n.reason}</p>}<button className="request-popup-review" onClick={()=>{feed.dismiss(n.id);void feed.markRead([n.id]);onReview(n.requestId)}}>{n.kind==='missing-timeout'?'Review attendance':n.kind==='submitted'?'Review request':'View decision'} →</button></div><button className="icon-btn request-popup-close" aria-label={'Dismiss notification for '+n.name} onClick={()=>feed.dismiss(n.id)}><X size={17}/></button></section>)}{notifications.length>3&&<button className="request-popup-more" onClick={()=>onReview(notifications[0].requestId)}>View all notifications</button>}</aside>;
}
