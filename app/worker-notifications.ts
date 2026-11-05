import type {WorkerRequest} from './model';
import type {Access} from './permissions';
import type {State} from './model';
import {missingTimeouts} from './attendance-reminders';
export type WorkerNotification={id:string;requestId:string;name:string;siteId:string;trade:string;actor:string;created:string;status:WorkerRequest['status'];reason?:string;kind:'submitted'|'decision'|'missing-timeout'};
export function workspaceNotifications(state:State,access:Access,now=Date.now()):WorkerNotification[]{return [...workerNotifications(state.workerRequests||[],access),...missingTimeouts(state,access,now).map(r=>({id:r.id,requestId:r.attendanceId,name:r.name,siteId:r.siteId,trade:r.trade,actor:'Attendance reminder',created:r.dueAt,status:'pending' as const,kind:'missing-timeout' as const,reason:'No time-out recorded. Time in: '+new Date(r.timeIn).toLocaleString('en-PH',{timeZone:'Asia/Manila'})+' PHT.'}))].sort((a,b)=>b.created.localeCompare(a.created));}
export function workerNotifications(requests:WorkerRequest[],access:Pick<Access,'role'|'email'>):WorkerNotification[]{
 return requests.flatMap<WorkerNotification>(r=>access.role==='administrator'?[{id:r.id+':submitted',requestId:r.id,name:r.name,siteId:r.siteId,trade:r.trade,actor:r.createdBy,created:r.created,status:r.status,kind:'submitted' as const}]:access.role==='auditor'&&r.createdBy===access.email&&r.status!=='pending'?[{id:r.id+':'+r.status,requestId:r.id,name:r.name,siteId:r.siteId,trade:r.trade,actor:r.reviewedBy||'Administrator',created:r.reviewedAt||r.created,status:r.status,reason:r.reason,kind:'decision' as const}]:[]).sort((a,b)=>b.created.localeCompare(a.created));
}
