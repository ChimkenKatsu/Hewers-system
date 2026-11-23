'use client';

import {useState} from 'react';
import FaceCheckIn from './FaceCheckIn';
import type {OfflineWorkspace as Snapshot} from './offline-workspace';
import {useOfflineFaceSummary} from './offline-face-queue';
import OfflineFaceReview from './OfflineFaceReview';

export default function OfflineWorkspace({snapshot,busy,onReconnect}:{
  snapshot:Snapshot;busy:boolean;onReconnect:()=>void;
}){
  const [siteId,setSiteId]=useState(snapshot.sites.length===1?snapshot.sites[0].id:'');
  const [scan,setScan]=useState(false);
  const summary=useOfflineFaceSummary(snapshot.owner,snapshot.userId);
  const manual=(window as Window&{HewersOffline?:{postMessage:(value:string)=>void}}).HewersOffline;
  const site=snapshot.sites.find(item=>item.id===siteId);
  if(scan&&site)return <main className="offline-kiosk-screen">
    <header><img src="/hewers-logo-white.svg" alt="Hewers Manpower Services"/><span>Offline attendance</span></header>
    <FaceCheckIn key={site.id} workspaceId={snapshot.owner} userId={snapshot.userId} siteId={site.id} siteName={site.name} onBack={()=>setScan(false)}/>
  </main>;
  return <main className="workspace-gate">
    <img src="/hewers-logo.png" alt="Hewers Manpower Services"/>
    <section className="panel">
      <h1>Hewers offline</h1>
      <p>Attendance can be captured on this device. Reconnect to open live workspace records and Payroll.</p>
      <p role="status">{summary.queued} {summary.queued===1?'scan':'scans'} waiting to upload.</p>
      <OfflineFaceReview scans={summary.review}/>
      {snapshot.face&&!!snapshot.sites.length&&<label className="select-wrap">Construction site
        <select value={siteId} onChange={event=>{setSiteId(event.target.value);setScan(false);}}>
          <option value="">Choose a site</option>
          {snapshot.sites.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>}
      {snapshot.face&&site&&<button className="btn" onClick={()=>setScan(true)}>Open face scanner</button>}
      {snapshot.manual&&manual&&<button className="btn secondary" onClick={()=>manual.postMessage(JSON.stringify({action:'open'}))}>Open offline attendance log</button>}
      <button className="btn secondary" disabled={busy} onClick={onReconnect}>{busy?'Connecting…':'Open live workspace'}</button>
    </section>
  </main>;
}
