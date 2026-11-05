import type {State} from './model';
import type {Access} from './permissions';
import {hasSite} from './permissions';
import {day} from './model';
export type MissingTimeout={id:string;attendanceId:string;workerId:string;name:string;siteId:string;trade:string;timeIn:string;dueAt:string};
export function missingTimeouts(state:State,access:Pick<Access,'role'|'siteIds'>,now=Date.now()):MissingTimeout[]{
 if(!['administrator','auditor'].includes(access.role))return [];
 return state.attendance.flatMap(record=>{
  if(record.timeOut||!hasSite(access as Access,record.siteId))return [];
  const site=state.sites.find(s=>s.id===record.siteId),worker=state.workers.find(w=>w.id===record.workerId);
  if(!site?.shiftEnd||!/^([01]\d|2[0-3]):[0-5]\d$/.test(site.shiftEnd)||!worker||worker.archivedAt||!Number.isFinite(Date.parse(record.timeIn)))return [];
  let due=Date.parse(day(record.timeIn)+'T'+site.shiftEnd+':00+08:00');
  if(due<=Date.parse(record.timeIn))due+=86400000;
  if(now<due)return [];
  return [{id:record.id+':missing-timeout',attendanceId:record.id,workerId:worker.id,name:worker.name,siteId:record.siteId,trade:worker.trade,timeIn:record.timeIn,dueAt:new Date(due).toISOString()}];
 }).sort((a,b)=>a.dueAt.localeCompare(b.dueAt));
}
