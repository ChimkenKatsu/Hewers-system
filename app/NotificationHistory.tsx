'use client';

import {useState} from 'react';
import type {WorkerNotificationFeed} from './use-worker-notifications';

export default function NotificationHistory({feed,onReview}:{feed:WorkerNotificationFeed;onReview:(id:string)=>void}){
 const [unreadOnly,setUnreadOnly]=useState(false);
 const [markingAll,setMarkingAll]=useState(false);
 const reads=new Set(feed.reads);
 const events=unreadOnly?feed.events.filter(event=>!reads.has(event.id)):feed.events;

 async function markAll(){
  const ids=feed.events.filter(event=>!reads.has(event.id)).map(event=>event.id);
  setMarkingAll(true);
  try{
   for(let offset=0;offset<ids.length;offset+=500){
    if(!await feed.markRead(ids.slice(offset,offset+500)))break;
   }
  }finally{setMarkingAll(false)}
 }

 return <section className="panel approval-panel notification-history" aria-labelledby="notification-history-title">
  <div className="panel-head">
   <div><h2 id="notification-history-title">Notification history</h2><p>{feed.unread} unread</p></div>
   <button className="btn secondary" disabled={!feed.unread||markingAll} onClick={()=>void markAll()}>{markingAll?'Marking as read…':'Mark all as read'}</button>
  </div>
  <label className="check-label notification-filter"><input type="checkbox" checked={unreadOnly} onChange={event=>setUnreadOnly(event.target.checked)}/>Unread only</label>
  {feed.error&&<p className="error" role="alert">{feed.error}</p>}
  {!events.length?<p className="approval-empty">{unreadOnly?'You’re all caught up.':'No notifications yet.'}</p>:
   <div className="notification-history-list" role="region" aria-label="Notification list" tabIndex={0}>
    {events.map(event=>{
     const unread=!reads.has(event.id);
     const kind=event.kind==='missing-timeout'?'Missing time-out':event.kind==='submitted'?'Worker request':event.status==='accepted'?'Approved':'Declined';
     return <article className={'approval-row notification-history-row '+(unread?'unread':'')} key={event.id}>
      <div className="notification-item-copy">
       <strong>{event.name} · {kind}</strong>
       <small>{event.actor} · {new Date(event.created).toLocaleString('en-PH',{timeZone:'Asia/Manila'})} PHT</small>
       {event.reason&&<p className="decision-reason">{event.reason}</p>}
      </div>
      <div className="notification-item-actions">
       {unread&&<span className="badge blue">Unread</span>}
       <button className="btn secondary" onClick={()=>{void feed.markRead([event.id]);onReview(event.requestId)}}>View</button>
       {unread&&<button className="text-btn" onClick={()=>void feed.markRead([event.id])}>Mark as read</button>}
      </div>
     </article>;
    })}
   </div>}
 </section>;
}
