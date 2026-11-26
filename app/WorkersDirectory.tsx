'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {ChevronRight,X} from 'lucide-react';
import type {State,Worker} from './model';
import type {Access} from './permissions';
import {can} from './permissions';
import {readApiJson} from './api-client';
import ConfirmDialog from './ConfirmDialog';

export default function WorkersDirectory({data,access,query,workspaceId,revision,onUpdated}:{data:State;access:Access;query:string;workspaceId:string;revision:number;onUpdated:(state:State,revision:number)=>void}){
 const [filter,setFilter]=useState('active'),[confirm,setConfirm]=useState<Worker|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [selectedId,setSelectedId]=useState<string|null>(null);
 const dialog=useRef<HTMLDialogElement>(null);
 const headingId=useId();
 const selected=data.workers.find(worker=>worker.id===selectedId);
 const profileOpen=!!selected;
 const checkedIn=!!selected&&data.attendance.some(entry=>entry.workerId===selected.id&&!entry.timeOut);
 const canManage=!!selected&&can(access,selected.archivedAt?'worker-restore':'worker-archive');
 useEffect(()=>{
  const element=dialog.current;
  if(!profileOpen||!element)return;
  element.showModal();
  return()=>element.close();
 },[profileOpen]);
 function closeProfile(){
  if(busy)return;
  setSelectedId(null);
  setError('');
 }
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
  <div className="panel-head"><div><h2>All workers</h2></div><label>Worker status<select value={filter} disabled={busy} onChange={e=>{setFilter(e.target.value);setConfirm(null);setError('')}}><option value="active">Active workers ({data.workers.filter(w=>!w.archivedAt).length})</option><option value="archived">Archived workers ({data.workers.filter(w=>w.archivedAt).length})</option><option value="all">All workers ({data.workers.length})</option></select></label></div>
  {message&&<p className="notice" role="status">{message}</p>}
  <ConfirmDialog open={!!confirm} title={(confirm?.archivedAt?'Restore ':'Archive ')+(confirm?.name||'worker')+'?'} description={confirm?.archivedAt?'This worker will be available for attendance and face scans again.':'The worker will be removed from active lists. Their attendance history, face enrollment and audit records will stay in the database. You can restore them later.'} confirmLabel={confirm?.archivedAt?'Yes, restore worker':'Yes, archive worker'} kind={confirm?.archivedAt?'restore':'archive'} busy={busy} error={error} onConfirm={()=>{if(confirm)void update(confirm)}} onCancel={()=>setConfirm(null)}/>
  {rows.length>0?<ul className="worker-name-list">
   {rows.map(worker=><li key={worker.id}>
    <button type="button" onClick={()=>{setSelectedId(worker.id);setError('')}}>
     <span>{worker.name}</span><ChevronRight size={16} aria-hidden="true"/>
    </button>
   </li>)}
  </ul>:<p className="approval-empty">No workers match this status and search.</p>}
  <dialog ref={dialog} className="worker-profile-dialog" aria-labelledby={headingId} onCancel={event=>{event.preventDefault();closeProfile()}}>
   {selected&&<>
    <header>
     <h2 id={headingId}>{selected.name}</h2>
     <button type="button" className="icon-btn" aria-label="Close worker profile" disabled={busy} onClick={closeProfile}><X size={20}/></button>
    </header>
    <dl>
     <div><dt>Trade / role</dt><dd>{selected.trade}</dd></div>
     <div><dt>Assigned site</dt><dd>{data.sites.find(site=>site.id===selected.siteId)?.name||selected.siteId}</dd></div>
     <div><dt>Status</dt><dd><span className={'badge '+(selected.archivedAt?'gray':'green')}>{selected.archivedAt?'Archived':checkedIn?'Checked in':'Active'}</span></dd></div>
     {selected.archivedAt&&<div><dt>Archived on</dt><dd>{new Date(selected.archivedAt).toLocaleDateString('en-PH',{timeZone:'Asia/Manila'})}</dd></div>}
    </dl>
    {canManage&&<div className="worker-profile-actions">
     {checkedIn&&<p className="fineprint">Check out before archiving.</p>}
     <button className="btn secondary" type="button" disabled={busy||checkedIn} onClick={()=>{setConfirm(selected);setError('');setMessage('')}}>{selected.archivedAt?'Restore worker':'Archive worker'}</button>
    </div>}
   </>}
  </dialog>
 </div>;
}
