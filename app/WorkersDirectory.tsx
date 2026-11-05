'use client';
import {useRef,useState} from 'react';
import type {State,Worker} from './model';
import type {Access} from './permissions';
import {can} from './permissions';
import {readApiJson} from './api-client';
import ResponsiveTable from './ResponsiveTable';

export default function WorkersDirectory({data,access,query,workspaceId,revision,onUpdated}:{data:State;access:Access;query:string;workspaceId:string;revision:number;onUpdated:(state:State,revision:number)=>void}){
 const [filter,setFilter]=useState('active'),[confirm,setConfirm]=useState<Worker|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const inFlight=useRef(false);
 const rows=data.workers.filter(w=>(filter==='all'||(filter==='archived')===Boolean(w.archivedAt))&&[w.name,w.trade,data.sites.find(s=>s.id===w.siteId)?.name||''].join(' ').toLowerCase().includes(query.trim().toLowerCase()));
 async function update(worker:Worker){
  if(inFlight.current)return;inFlight.current=true;setBusy(true);setError('');setMessage('');
  try{
   const response=await fetch('/api/workspace',{method:'POST',headers:{'Content-Type':'application/json','x-workspace-id':workspaceId},body:JSON.stringify({action:worker.archivedAt?'worker-restore':'worker-archive',payload:{workerId:worker.id},revision})});
   const result=await readApiJson<{state:State;revision:number;error?:string}>(response);
   if(!response.ok)throw Error(result.error||'Could not update worker');
   onUpdated(result.state,result.revision);setConfirm(null);setMessage(worker.name+(worker.archivedAt?' restored to active workers.':' archived. Attendance and audit history were kept.'));
  }catch(e){setError((e instanceof Error?e.message:'Could not update worker')+' Refresh and check the worker’s status before retrying.');}finally{inFlight.current=false;setBusy(false)}
 }
 return <div className="workers-directory">
  <div className="panel-head"><div><h2>All workers</h2><p>View active workers and archived records for your permitted sites.</p></div><label>Worker status<select value={filter} disabled={busy} onChange={e=>{setFilter(e.target.value);setConfirm(null);setError('')}}><option value="active">Active workers ({data.workers.filter(w=>!w.archivedAt).length})</option><option value="archived">Archived workers ({data.workers.filter(w=>w.archivedAt).length})</option><option value="all">All workers ({data.workers.length})</option></select></label></div>
  {message&&<p className="notice" role="status">{message}</p>}
  {error&&<p className="error" role="alert">{error}</p>}
  {confirm&&<section className="worker-archive-confirm" aria-label="Confirm worker status change"><h3>{confirm.archivedAt?'Restore':'Archive'} {confirm.name}?</h3><p>{confirm.archivedAt?'This worker will be available for attendance and face scans again.':'This saves the worker as archived in the database and removes them from active lists and new attendance. Past attendance, face enrollment and audit records are retained.'}</p><div><button className="btn" disabled={busy} onClick={()=>void update(confirm)}>{busy?'Saving…':confirm.archivedAt?'Confirm restore':'Confirm archive'}</button><button className="btn secondary" disabled={busy} onClick={()=>setConfirm(null)}>Cancel</button></div></section>}
  <div className="table-scroll"><ResponsiveTable labels={['Worker','Trade / role','Assigned site','Status','Actions']}><thead><tr><th>WORKER</th><th>TRADE / ROLE</th><th>ASSIGNED SITE</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>{rows.map(w=>{
   const checkedIn=data.attendance.some(a=>a.workerId===w.id&&!a.timeOut);
   return <tr key={w.id}><td><strong>{w.name}</strong>{w.archivedAt&&<small>Archived {new Date(w.archivedAt).toLocaleDateString('en-PH',{timeZone:'Asia/Manila'})}</small>}</td><td>{w.trade}</td><td>{data.sites.find(s=>s.id===w.siteId)?.name||w.siteId}</td><td><span className={'badge '+(w.archivedAt?'gray':'green')}>{w.archivedAt?'Archived':'Active'}</span>{checkedIn&&<small>Currently checked in</small>}</td><td>{can(access,w.archivedAt?'worker-restore':'worker-archive')?<><button className="text-btn" disabled={busy||checkedIn} onClick={()=>{setConfirm(w);setError('');setMessage('')}} aria-label={(w.archivedAt?'Restore ':'Archive ')+w.name}>{w.archivedAt?'Restore worker':'Archive worker'}</button>{checkedIn&&<small>Check out before archiving.</small>}</>:<small>Administrator managed</small>}</td></tr>;
  })}</tbody></ResponsiveTable>{!rows.length&&<p className="approval-empty">No workers match this status and search.</p>}</div>
  <p className="fineprint">Archiving updates the saved database record; it does not permanently delete the worker or their historical records.</p>
 </div>;
}
