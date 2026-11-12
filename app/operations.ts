import {checkShiftEntry,shiftTime,REGULAR_END,overtimeApprovalStatus} from './shift-policy';
import {day} from './model';
import type {State} from './model';
import {applyReviewOperation,reviewActions} from './review-operations';
const uid=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
export function applyOperation(original:State,action:string,p:any,actor:string,now=new Date().toISOString(),actorId?:string):State{
 if(reviewActions.includes(action))return applyReviewOperation(original,action,p,actor,now,actorId);
 const s:State=structuredClone(original),id=uid();
 const text=(v:any,label:string,max=240)=>{if(typeof v!=='string'||!v.trim()||v.length>max)throw Error('Enter a valid '+label);return v.trim()};
 const num=(v:any,label:string,allowZero=false)=>{const n=Number(v);if(!Number.isFinite(n)||(allowZero?n<0:n<=0)||n>1e9)throw Error('Enter a valid '+label);const rounded=Math.round(n*1000)/1000;if(!allowZero&&rounded===0)throw Error('Enter a valid '+label+' of at least 0.001');return rounded};
 const site=()=>{if(!s.sites.some(x=>x.id===p.siteId))throw Error('Select a valid site');return p.siteId};
 let message='';
 if(action==='site'){const name=text(p.name,'site name');s.sites.push({id,name,location:text(p.location,'location'),shiftEnd:REGULAR_END});message='Created site: '+name;}
 else if(action==='site-shift-settings'){
  const selected=s.sites.find(x=>x.id===p.siteId);if(!selected)throw Error('Site not found');
  if(typeof p.shiftEnd!=='string'||(p.shiftEnd!==''&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(p.shiftEnd)))throw Error('Choose a valid end-of-shift time');
  selected.remindersDisabled=!p.shiftEnd;if(p.shiftEnd)selected.shiftEnd=p.shiftEnd;else delete selected.shiftEnd;
  message=(p.shiftEnd?'Set missing time-out reminders to '+p.shiftEnd+' PHT at ':'Disabled missing time-out reminders at ')+selected.name;
 }
 else if(action==='worker'){const name=text(p.name,'worker name');s.workers.push({id,name,trade:text(p.trade,'trade'),siteId:site()});message='Registered worker: '+name;}
 else if(action==='worker-archive'||action==='worker-restore'){
  const worker=s.workers.find(w=>w.id===p.workerId);if(!worker)throw Error('Worker not found');
  if(action==='worker-archive'){
   if(worker.archivedAt)throw Error('This worker is already archived');
   if(s.attendance.some(a=>a.workerId===worker.id&&!a.timeOut))throw Error('Check this worker out before archiving them');
   worker.archivedAt=now;worker.archivedBy=actor;message='Archived worker: '+worker.name;
  }else{
   if(!worker.archivedAt)throw Error('This worker is already active');
   delete worker.archivedAt;delete worker.archivedBy;message='Restored worker: '+worker.name;
  }
 }
 else if(action==='worker-request'){
  const name=text(p.name,'worker name'),trade=text(p.trade,'trade'),siteId=site();
  s.workerRequests??=[];
  if(s.workerRequests.some(r=>r.status==='pending'&&r.siteId===siteId&&r.name.toLowerCase()===name.toLowerCase()))throw Error('A worker with this name is already waiting for approval at this site');
  s.workerRequests.push({id,name,trade,siteId,status:'pending',created:now,createdBy:actor});message='Worker approval requested: '+name;
 }
 else if(action==='worker-review'){
  const request=s.workerRequests?.find(r=>r.id===p.requestId);if(!request||request.status!=='pending')throw Error('This request has already been reviewed or is unavailable');
  if(!['accepted','declined'].includes(p.decision))throw Error('Choose Accept or Decline');
  if(p.decision==='declined')text(p.reason,'decline reason',500);
  request.status=p.decision;request.reviewedAt=now;request.reviewedBy=actor;request.reason=typeof p.reason==='string'?p.reason.trim().slice(0,500):'';
  if(p.decision==='accepted'){s.workers.push({id,name:request.name,trade:request.trade,siteId:request.siteId});request.workerId=id;}
  message=(p.decision==='accepted'?'Accepted':'Declined')+' worker request: '+request.name;
 }
 else if(action==='overtime-approve'){
  const worker=s.workers.find(w=>w.id===p.workerId);if(!worker||worker.archivedAt)throw Error('Select an active worker');
  const date=day(now);if(p.date!==date)throw Error('Approve overtime for today in Philippine Time');
  if(typeof p.endTime!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(p.endTime)||shiftTime(date,p.endTime)<=Math.max(Date.parse(now),shiftTime(date,REGULAR_END)))throw Error('Overtime end must be after 5:00 PM and the current time, on the same day');
  if(!s.attendance.some(a=>a.workerId===worker.id&&day(a.timeIn)===date&&a.shiftKind!=='overtime'&&a.timeOut))throw Error('Complete the regular attendance record before approving a separate overtime session');
  s.overtimeApprovals??=[];if(s.overtimeApprovals.some(a=>a.workerId===worker.id&&a.date===date&&overtimeApprovalStatus(a,Date.parse(now))==='Available'))throw Error('This worker already has an unused overtime approval');
  s.overtimeApprovals.push({id,workerId:worker.id,siteId:worker.siteId,date,endTime:p.endTime,reason:text(p.reason,'overtime reason',500),approvedBy:actor,approvedAt:now});message='Approved overtime for '+worker.name+' until '+p.endTime+' PHT';
 }
 else if(action==='overtime-revoke'){
  const approval=s.overtimeApprovals?.find(a=>a.id===p.approvalId);if(!approval||approval.usedAttendanceId||approval.revokedAt)throw Error('Only unused overtime approvals can be cancelled');approval.revokedAt=now;message='Cancelled overtime approval '+approval.id;
 }
 else if(action==='attendance'){

  const w=s.workers.find(x=>x.id===p.workerId);if(!w)throw Error('Select a valid worker');
  if(w.archivedAt)throw Error('This worker is archived. Restore them before recording attendance');
  const open=s.attendance.find(x=>x.workerId===w.id&&!x.timeOut);
  if(p.type==='in'){if(open)throw Error('This worker already has an open attendance record');const entry=checkShiftEntry(s,w.id,now);if(entry.approval)entry.approval.usedAttendanceId=id;s.attendance.push({shiftKind:entry.kind,overtimeApprovalId:entry.approval?.id,shiftEndAt:new Date(shiftTime(day(now),entry.approval?.endTime||REGULAR_END)).toISOString(),id,workerId:w.id,siteId:w.siteId,timeIn:now,timeOut:null,method:'Manual',note:text(p.note,'manual attendance reason',500)});message=w.name+' checked in (manual)';}
  else if(p.type==='out'){if(!open)throw Error('This worker has no open attendance record');open.timeOut=now;open.timeOutMethod='Manual';message=w.name+' checked out (manual)';}
  else throw Error('Invalid attendance action');
 }
 else if(action==='material'){const name=text(p.name,'material name');const balance=num(p.balance,'opening balance',true);const siteId=site();s.materials.push({id,name,unit:text(p.unit,'unit',30),siteId,balance,minimum:num(p.minimum,'minimum stock',true)});s.movements.push({id:uid(),materialId:id,siteId,type:'Opening',quantity:balance,note:'Opening balance',created:now,actor});message='Added material: '+name;}
 else if(action==='movement'){
  const m=s.materials.find(x=>x.id===p.materialId);if(!m)throw Error('Select a valid material');
  if(!['Delivery','Issue','Return','Damage','Loss'].includes(p.type))throw Error('Invalid transaction type');
  const quantity=num(p.quantity,'quantity'),note=text(p.note,'reference or reason',500),delta=['Issue','Damage','Loss'].includes(p.type)?-quantity:quantity;
  if(m.balance+delta<0)throw Error('Insufficient stock. Available: '+m.balance+' '+m.unit);
  m.balance=Math.round((m.balance+delta)*1000)/1000;
  s.movements.push({id,materialId:m.id,siteId:m.siteId,type:p.type,quantity,note,created:now,actor});message=p.type+': '+quantity+' '+m.unit+' of '+m.name;
 }
 else if(action==='photo'){
  const siteId=site();if(typeof p.url!=='string'||!p.url.startsWith('/api/photos?key='))throw Error('Invalid photo upload');
  if(p.transactionId&&!s.movements.some(x=>x.id===p.transactionId&&x.siteId===siteId))throw Error('Transaction must belong to the selected site');
  s.photos.push({id,siteId,caption:text(p.caption,'caption',500),category:text(p.category,'category',60),url:p.url,created:now,actor,transactionId:p.transactionId||''});message='Uploaded site evidence: '+p.caption;
 }
 else throw Error('Unknown operation');
 const auditSite=s.overtimeApprovals?.find(a=>a.id===p.approvalId)?.siteId||s.workerRequests?.find(r=>r.id===p.requestId)?.siteId||p.siteId||s.workers.find(w=>w.id===p.workerId)?.siteId||s.materials.find(m=>m.id===p.materialId)?.siteId;
 s.audit.unshift({id:uid(),action:message,created:now,actor,siteId:auditSite,kind:action});return s;
}
