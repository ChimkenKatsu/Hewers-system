import {day,type Attendance,type State} from './model';
import {missingTimeouts} from './attendance-reminders';
import {hasSite,type Access} from './permissions';

export type ExceptionKind='missing'|'long'|'pending';
export type AttendanceException={record:Attendance;workerName:string;siteName:string;hours:number;issues:ExceptionKind[];pendingCount:number;dueAt?:string};
export const LONG_SESSION_HOURS=16;
export function attendanceExceptions(state:State,access:Access,now=Date.now()):AttendanceException[]{
 if(!['administrator','auditor'].includes(access.role)||!Number.isFinite(now))return [];
 const due=new Map(missingTimeouts(state,access,now).map(r=>[r.attendanceId,r.dueAt]));
 const today=day(new Date(now).toISOString());
 return state.attendance.flatMap(record=>{
  if(!hasSite(access,record.siteId))return [];
  const start=Date.parse(record.timeIn),end=record.timeOut?Date.parse(record.timeOut):now;
  if(!Number.isFinite(start)||!Number.isFinite(end)||start>now)return [];
  const site=state.sites.find(s=>s.id===record.siteId);
  const hours=Math.max(0,(end-start)/3600000);
  // With no configured cutoff, an open record from an earlier PHT date needs review.
  // Do not guess a cutoff or change the attendance record.
  const missing=!record.timeOut&&(due.has(record.id)||(!site?.shiftEnd&&day(record.timeIn)<today));
  const pendingCount=(state.attendanceCorrections||[]).filter(r=>r.attendanceId===record.id&&r.status==='pending'&&hasSite(access,r.siteId)).length;
  const issues:ExceptionKind[]=[];
  if(missing)issues.push('missing');
  if(hours>LONG_SESSION_HOURS)issues.push('long');
  if(pendingCount)issues.push('pending');
  return issues.length?[{record,workerName:state.workers.find(w=>w.id===record.workerId)?.name||'Unavailable worker',siteName:site?.name||'Unavailable site',hours,issues,pendingCount,dueAt:due.get(record.id)}]:[];
 }).sort((a,b)=>Number(b.issues.includes('missing'))-Number(a.issues.includes('missing'))||a.record.timeIn.localeCompare(b.record.timeIn)||a.record.id.localeCompare(b.record.id));
}
