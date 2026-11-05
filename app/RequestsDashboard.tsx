'use client';
import {useState} from 'react';
import type {State} from './model';
import ReviewPanel from './ReviewPanel';
import WorkerApprovals from './WorkerApprovals';

type Props={data:State;workspaceId:string;revision:number;admin:boolean;actor:string;focusRequestId?:string;onUpdated:(state:State,revision:number)=>void};
type Status='all'|'pending'|'accepted'|'declined';
export default function RequestsDashboard({data,admin,focusRequestId,...props}:Props){
 const [status,setStatus]=useState<Status>(admin&&!focusRequestId?'pending':'all');
 const [kind,setKind]=useState('all');
 const all=[...(data.workerRequests||[]),...(data.attendanceCorrections||[]),...(data.stockReconciliations||[])];
 const matches=(row:{status:string})=>status==='all'||row.status===status;
 const filtered={...data,workerRequests:(data.workerRequests||[]).filter(matches),attendanceCorrections:(data.attendanceCorrections||[]).filter(matches),stockReconciliations:(data.stockReconciliations||[]).filter(matches)};
 const count=(value:Status)=>value==='all'?all.length:all.filter(row=>row.status===value).length;
 return <section className="requests-dashboard" aria-label={admin?'Approval queue':'My requests'}>
  <div className="requests-heading"><div><h2>{admin?'Approval queue':'My requests'}</h2><p>{admin?'Review worker submissions, attendance corrections and physical counts.':'Track your submissions and the administrator’s decisions for your assigned sites.'}</p></div><strong>{count('pending')} pending</strong></div>
  <div className="requests-controls"><div className="requests-status" role="group" aria-label="Filter request status">{(['pending','accepted','declined','all'] as const).map(value=><button type="button" key={value} aria-pressed={status===value} onClick={()=>setStatus(value)}>{({pending:'Pending',accepted:'Approved',declined:'Declined',all:'All requests'})[value]} <span>{count(value)}</span></button>)}</div><label>Request type<select value={kind} onChange={e=>setKind(e.target.value)}><option value="all">All types</option><option value="worker">Workers</option><option value="attendance">Attendance corrections</option><option value="stock">Physical stock counts</option></select></label></div>
  <p className="requests-scope">{admin?'Requests you submit require another administrator’s approval.':'Only an administrator can approve a request. Pending submissions do not change the official records.'}</p>
  {(kind==='all'||kind==='worker')&&<WorkerApprovals {...props} focusRequestId={focusRequestId} admin={admin} data={filtered}/>}
  {(kind==='all'||kind==='attendance')&&<ReviewPanel {...props} admin={admin} data={filtered} kind="attendance" showForm={false}/>}
  {(kind==='all'||kind==='stock')&&<ReviewPanel {...props} admin={admin} data={filtered} kind="stock" showForm={false}/>}
 </section>;
}
