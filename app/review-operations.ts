import type {State,ReviewRecord} from './model';
import {validateOvertimeCorrection} from './shift-policy';
const uid=()=>crypto.randomUUID();
const reason=(v:unknown)=>{if(typeof v!=='string'||v.trim().length<10||v.length>500)throw Error('Explain the reason using 10 to 500 characters');return v.trim();};
function timestamp(v:unknown,now:string){if(typeof v!=='string'||!/^\d{4}-\d\d-\d\dT/.test(v)||!Number.isFinite(Date.parse(v))||Date.parse(v)>Date.parse(now))throw Error('Enter a valid time that is not in the future');return new Date(v).toISOString();}
function validAttendance(s:State,workerId:string,exclude:string,timeIn:string,timeOut:string|null){
 if(timeOut===null&&s.workers.some(w=>w.id===workerId&&w.archivedAt))throw Error('Restore this archived worker before reopening attendance. Completed attendance can still be corrected.');
 const start=Date.parse(timeIn),end=timeOut?Date.parse(timeOut):Infinity;
 if(end<=start)throw Error('Time out must be later than time in');
 if(s.attendance.some(a=>a.workerId===workerId&&a.id!==exclude&&start<(a.timeOut?Date.parse(a.timeOut):Infinity)&&end>Date.parse(a.timeIn)))throw Error('These times overlap another attendance record');
}
function decide(record:ReviewRecord,p:Record<string,unknown>,actor:string,now:string,actorId?:string){
 if(record.status!=='pending')throw Error('This request has already been reviewed');
 if(p.decision!=='accepted'&&p.decision!=='declined')throw Error('Choose Accept or Decline');
 if(p.decision==='accepted'){
  if(!record.createdById)throw Error('This older request has no verified account ID. Decline it and submit a new request before approval.');
  if(!actorId)throw Error('A verified reviewer account is required');
  if(record.createdById===actorId)throw Error('Another administrator must approve your request');
 }
 record.status=p.decision;record.reviewedAt=now;record.reviewedBy=actor;record.reviewedById=actorId;record.reviewNote=typeof p.reviewNote==='string'?p.reviewNote.trim().slice(0,500):'';
}
export const reviewActions=['attendance-correction-request','attendance-correction-review','stock-count-request','stock-count-review'];
export function applyReviewOperation(original:State,action:string,p:Record<string,unknown>,actor:string,now:string,actorId?:string):State{
 if(action.endsWith('-request')&&!actorId)throw Error('A verified submitting account is required');
 const s=structuredClone(original),id=uid();let message='',siteId='';
 if(action==='attendance-correction-request'){
  const a=s.attendance.find(a=>a.id===p.attendanceId);if(!a)throw Error('Attendance record not found');siteId=a.siteId;
  if(p.expectedIn!==a.timeIn||p.expectedOut!==a.timeOut)throw Error('CONFLICT: Attendance changed while entering the correction. Select the record again.');
  s.attendanceCorrections??=[];if(s.attendanceCorrections.some(r=>r.attendanceId===a.id&&r.status==='pending'))throw Error('A correction for this attendance record is already pending');
  const proposedIn=timestamp(p.proposedIn,now),proposedOut=p.proposedOut===null?null:timestamp(p.proposedOut,now);
  if(proposedIn===a.timeIn&&proposedOut===a.timeOut)throw Error('Change at least one attendance time');validAttendance(s,a.workerId,a.id,proposedIn,proposedOut);validateOvertimeCorrection(s,a,proposedIn);
  s.attendanceCorrections.push({id,attendanceId:a.id,workerId:a.workerId,siteId,status:'pending',reason:reason(p.reason),created:now,createdBy:actor,createdById:actorId,originalIn:a.timeIn,originalOut:a.timeOut,proposedIn,proposedOut});message='Attendance correction requested';
 }else if(action==='attendance-correction-review'){
  const r=s.attendanceCorrections?.find(r=>r.id===p.requestId);if(!r)throw Error('Correction request not found');siteId=r.siteId;
  decide(r,p,actor,now,actorId);
  if(r.status==='accepted'){
   const a=s.attendance.find(a=>a.id===r.attendanceId);if(!a||a.timeIn!==r.originalIn||a.timeOut!==r.originalOut)throw Error('CONFLICT: Attendance changed after this request. Decline it and submit a fresh correction.');
   validAttendance(s,r.workerId,r.attendanceId,r.proposedIn,r.proposedOut);const approvedEnd=validateOvertimeCorrection(s,a,r.proposedIn);a.timeIn=r.proposedIn;a.timeOut=r.proposedOut;a.correctionId=r.id;if(approvedEnd)a.shiftEndAt=approvedEnd;
   a.note=(a.note+' | Admin-approved correction '+r.id+': '+r.reason).slice(-2000);
  }
  message=(r.status==='accepted'?'Accepted':'Declined')+' attendance correction';
 }else if(action==='stock-count-request'){
  const m=s.materials.find(m=>m.id===p.materialId);if(!m)throw Error('Material not found');siteId=m.siteId;
  const count=Number(p.countedBalance);if(!['string','number'].includes(typeof p.countedBalance)||String(p.countedBalance).trim()===''||!Number.isFinite(count)||count<0||count>1e9)throw Error('Enter a valid physical stock count');
  if(typeof p.expectedBalance!=='number'||m.balance!==p.expectedBalance)throw Error('CONFLICT: Stock changed while entering the count. Refresh and count again.');
  s.stockReconciliations??=[];if(s.stockReconciliations.some(r=>r.materialId===m.id&&r.status==='pending'))throw Error('A stock count for this material is already pending');
  s.stockReconciliations.push({id,siteId,materialId:m.id,systemBalance:m.balance,countedBalance:Math.round(count*1000)/1000,status:'pending',reason:reason(p.reason),created:now,createdBy:actor,createdById:actorId});message='Physical stock count submitted';
 }else if(action==='stock-count-review'){
  const r=s.stockReconciliations?.find(r=>r.id===p.requestId);if(!r)throw Error('Stock count not found');siteId=r.siteId;decide(r,p,actor,now,actorId);
  if(r.status==='accepted'){
   const m=s.materials.find(m=>m.id===r.materialId);if(!m||m.balance!==r.systemBalance)throw Error('CONFLICT: Stock changed after this count. Decline it and submit a fresh count.');
   const delta=Math.round((r.countedBalance-r.systemBalance)*1000)/1000;
   if(delta!==0){r.movementId=uid();s.movements.push({id:r.movementId,materialId:m.id,siteId:m.siteId,type:'Adjustment',quantity:Math.abs(delta),adjustmentDelta:delta,reconciliationId:r.id,note:'Approved physical count: '+r.reason,created:now,actor});}
   m.balance=r.countedBalance;
  }
  message=(r.status==='accepted'?'Accepted':'Declined')+' physical stock count';
 }else throw Error('Unknown review operation');
 s.audit.unshift({id:uid(),siteId,action:message+' · '+(typeof p.requestId==='string'?p.requestId:id),actor,created:now,kind:action});return s;
}
