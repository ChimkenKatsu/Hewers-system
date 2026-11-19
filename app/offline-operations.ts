import type {State} from './model';
import {day} from './model';
import {checkShiftEntry,shiftTime,validateSchedule} from './shift-policy';
import {recordLunch} from './lunch-attendance';
export function applyOfflineOperation(original:State,action:string,p:any,actor:string,now:string,actorId?:string,faceVerified=false):State{
 if(!actorId)throw Error('A verified account is required');
 const s=structuredClone(original);s.offlineAttendance??=[];
 if(action==='offline-attendance-request'){
  if(typeof p.id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(p.id))throw Error('Invalid offline entry ID');
  const schedule=validateSchedule(p.schedule);
  const existing=s.offlineAttendance.find(r=>r.id===p.id);
  if(existing){if(existing.createdById!==actorId||existing.workerId!==p.workerId||existing.type!==p.type||existing.occurredAt!==p.occurredAt||existing.source!==(faceVerified?'face':undefined)||existing.reason!==(typeof p.reason==='string'?p.reason.trim():p.reason)||JSON.stringify(existing.schedule)!==JSON.stringify(schedule))throw Error('CONFLICT: Offline entry ID was reused');return s;}
  const worker=s.workers.find(w=>w.id===p.workerId);if(!worker||worker.archivedAt)throw Error('Worker unavailable. Ask an administrator to review this saved device entry.');
  if(!(faceVerified?['in','lunch-out','lunch-in']:['in','out']).includes(p.type)||typeof p.occurredAt!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?Z$/.test(p.occurredAt)||!Number.isFinite(Date.parse(p.occurredAt)))throw Error('Invalid offline attendance time');
  if(typeof p.reason!=='string'||p.reason.trim().length<10||p.reason.length>500)throw Error('Explain the offline entry using 10–500 characters');
  s.offlineAttendance.push({id:p.id,workerId:worker.id,siteId:worker.siteId,type:p.type,...(faceVerified?{source:'face' as const}:{}),occurredAt:p.occurredAt,schedule,status:'pending',created:now,createdBy:actor,createdById:actorId,reason:p.reason.trim()});
 }else{
  const r=s.offlineAttendance.find(r=>r.id===p.requestId);if(!r)throw Error('Offline attendance not found');
  if(r.status!=='pending')throw Error('This entry has already been reviewed');
  if(!['accepted','declined'].includes(p.decision))throw Error('Choose Accept or Decline');
  if(p.decision==='accepted'){
   if(r.createdById===actorId)throw Error('Another administrator must approve your offline entry');
   const worker=s.workers.find(w=>w.id===r.workerId);if(!worker||worker.archivedAt||worker.siteId!==r.siteId)throw Error('Restore the worker and verify their site before approval');
   const time=Date.parse(r.occurredAt);if(time>Date.parse(now))throw Error('Device time is in the future. Decline this entry and request a corrected time.');
   if(r.type==='in'){
    const temporary=structuredClone(s);temporary.sites.find(site=>site.id===r.siteId)!.schedule=r.schedule;
    const entry=checkShiftEntry(temporary,r.workerId,r.occurredAt);
    if(s.attendance.some(a=>a.workerId===r.workerId&&(Date.parse(a.timeIn)>=time||!a.timeOut||Date.parse(a.timeOut)>time)))throw Error('A later attendance record already exists. Use a correction to resolve this offline entry.');
    const id=crypto.randomUUID();if(entry.approval)s.overtimeApprovals!.find(a=>a.id===entry.approval!.id)!.usedAttendanceId=id;
    s.attendance.push({id,workerId:r.workerId,siteId:r.siteId,timeIn:r.occurredAt,timeOut:null,method:r.source==='face'?'Offline face-assisted · admin-approved':'Offline manual · admin-approved',note:r.reason,schedule:entry.schedule,shiftKind:entry.kind,overtimeApprovalId:entry.approval?.id,shiftEndAt:new Date(shiftTime(day(r.occurredAt),entry.approval?.endTime||entry.schedule.end)).toISOString()});r.attendanceId=id;
   }else if(r.type==='lunch-out'||r.type==='lunch-in'){
    const lunch=recordLunch(s,r.workerId,r.type,r.occurredAt,actor,true);
    if(lunch.alreadyRecorded)throw Error('This lunch action is already recorded. Review the duplicate offline entry.');
    s.attendance=lunch.state.attendance;
    r.attendanceId=lunch.attendanceId;
   }else{
    const open=s.attendance.find(a=>a.workerId===r.workerId&&!a.timeOut);
    if(!open||time<=Date.parse(open.timeIn))throw Error('Approve the matching offline time-in first, or review the existing attendance record.');
    if(s.attendance.some(a=>a.id!==open.id&&a.workerId===r.workerId&&Date.parse(a.timeIn)<time&&(a.timeOut?Date.parse(a.timeOut):Infinity)>Date.parse(open.timeIn)))throw Error('Offline time-out overlaps another record');
    open.timeOut=r.occurredAt;open.timeOutMethod='Offline manual · admin-approved';r.attendanceId=open.id;
   }
  }
  r.status=p.decision;r.reviewedAt=now;r.reviewedBy=actor;r.reviewedById=actorId;r.reviewNote=typeof p.reviewNote==='string'?p.reviewNote.slice(0,500):'';
 }
 const event=action==='offline-attendance-request'?s.offlineAttendance.at(-1)!:s.offlineAttendance.find(r=>r.id===p.requestId)!;
 s.audit.unshift({id:crypto.randomUUID(),siteId:event.siteId,kind:action,action:action==='offline-attendance-request'?'Offline attendance submitted for review':p.decision+' offline attendance',created:now,actor});return s;
}
