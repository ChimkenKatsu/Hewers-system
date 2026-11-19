import {day,type State,type Attendance,type OvertimeApproval,type ShiftSchedule} from './model';
export const REGULAR_START='08:00',REGULAR_END='17:00';
export const shiftTime=(date:string,time:string)=>Date.parse(date+'T'+time+':00+08:00');
export function validateSchedule(value:unknown):ShiftSchedule{
 const v=value as ShiftSchedule,clock=(x:unknown)=>typeof x==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(x);
 if(!v||!clock(v.start)||!clock(v.end)||v.end<=v.start)throw Error('Choose a same-day shift with end later than start');
 if(v.breakStart||v.breakEnd){if(!clock(v.breakStart)||!clock(v.breakEnd)||v.breakStart!<v.start||v.breakEnd!>v.end||v.breakEnd!<=v.breakStart!)throw Error('Choose an unpaid break window within the shift');}
 return {start:v.start,end:v.end,...(v.breakStart&&v.breakEnd?{breakStart:v.breakStart,breakEnd:v.breakEnd}:{})};
}
export const siteSchedule=(state:State,siteId:string):ShiftSchedule=>state.sites.find(s=>s.id===siteId)?.schedule||{start:REGULAR_START,end:REGULAR_END};
export const recordSchedule=(record:Attendance):ShiftSchedule=>record.schedule||{start:REGULAR_START,end:REGULAR_END};
export function attendanceHours(record:Attendance){
 const schedule=recordSchedule(record),date=day(record.timeIn),start=Date.parse(record.timeIn),end=record.timeOut?Date.parse(record.timeOut):null;
 const shiftStart=shiftTime(date,schedule.start),shiftEnd=shiftTime(date,schedule.end);
 const overlap=(a:number,b:number,c:number,d:number)=>Math.max(0,Math.min(b,d)-Math.max(a,c));
 const scheduledBreakMs=(a:number,b:number)=>schedule.breakStart&&schedule.breakEnd?overlap(a,b,shiftTime(date,schedule.breakStart),shiftTime(date,schedule.breakEnd)):0;
 const breakMs=(a:number,b:number)=>record.lunchOut?overlap(a,b,Date.parse(record.lunchOut),record.lunchIn?Date.parse(record.lunchIn):b):scheduledBreakMs(a,b);
 const lateMinutes=record.shiftKind==='overtime'?0:Math.max(0,Math.ceil((start-shiftStart)/60000));
 if(end===null)return {workedMinutes:null,regularMinutes:null,undertimeMinutes:null,earlyDepartureMinutes:null,lateMinutes};
 const worked=Math.max(0,end-start-(record.shiftKind==='overtime'?0:breakMs(start,end)));
 const regular=Math.max(0,overlap(start,end,shiftStart,shiftEnd)-breakMs(Math.max(start,shiftStart),Math.min(end,shiftEnd)));
 const expected=shiftEnd-shiftStart-scheduledBreakMs(shiftStart,shiftEnd);
 return {workedMinutes:Math.round(worked/60000),regularMinutes:record.shiftKind==='overtime'?0:Math.round(regular/60000),undertimeMinutes:record.shiftKind==='overtime'?0:Math.max(0,Math.round((expected-regular)/60000)),earlyDepartureMinutes:record.shiftKind==='overtime'?0:Math.max(0,Math.ceil((shiftEnd-end)/60000)),lateMinutes};
}
export function overtimeApprovalStatus(approval:OvertimeApproval,now=Date.now()){
 if(approval.revokedAt)return 'Cancelled';if(approval.usedAttendanceId)return 'Used';
 const expires=shiftTime(approval.date,approval.endTime);return Number.isFinite(expires)&&now<expires?'Available':'Expired';
}
export function attendanceShift(record:Attendance){
 if(record.shiftKind==='overtime')return {label:'Approved overtime',lateMinutes:0};
 const {lateMinutes}=attendanceHours(record);return {label:lateMinutes?'Late · '+lateMinutes+' min':'On time',lateMinutes};
}
export function validateAttendanceCorrection(state:State,record:Attendance,timeIn:string,timeOut:string|null=record.timeOut){
 const schedule=recordSchedule(record);
 if(record.lunchOut&&(day(timeIn)!==day(record.lunchOut)||Date.parse(timeIn)>=Date.parse(record.lunchOut)||(timeOut&&Date.parse(timeOut)<Date.parse(record.lunchIn||record.lunchOut))))throw Error('Keep the corrected shift times around the recorded lunch break.');
 if(record.shiftKind!=='overtime'){
  const date=day(timeIn);
  if(Date.parse(timeIn)>=shiftTime(date,schedule.end))throw Error('Corrected regular attendance must start before the scheduled shift end ('+schedule.end+'). Evening work requires a separate approved overtime record.');
  if(state.attendance.some(a=>a.id!==record.id&&a.workerId===record.workerId&&a.shiftKind!=='overtime'&&day(a.timeIn)===date))throw Error('Regular attendance is already recorded on the corrected date. Use the existing record instead.');
  if(day(record.timeIn)!==date&&state.overtimeApprovals?.some(a=>a.workerId===record.workerId&&a.date===day(record.timeIn)&&!a.revokedAt))throw Error('Review this day’s overtime approvals before moving its regular attendance to another date.');
  return new Date(shiftTime(date,schedule.end)).toISOString();
 }
 const approval=state.overtimeApprovals?.find(a=>a.id===record.overtimeApprovalId),start=Date.parse(timeIn);
 if(!approval||approval.workerId!==record.workerId||approval.siteId!==record.siteId||approval.usedAttendanceId!==record.id||approval.revokedAt||day(timeIn)!==approval.date||start<shiftTime(approval.date,schedule.end)||start<Date.parse(approval.approvedAt)||start>=shiftTime(approval.date,approval.endTime))throw Error('Corrected overtime must start after its approval, at or after the scheduled shift end, and before the approved end on the approved date.');
 return new Date(shiftTime(approval.date,approval.endTime)).toISOString();
}
export function checkShiftEntry(state:State,workerId:string,now:string){
 const date=day(now),time=Date.parse(now),worker=state.workers.find(w=>w.id===workerId);
 const records=state.attendance.filter(a=>a.workerId===workerId&&day(a.timeIn)===date);
 const regular=records.find(a=>a.shiftKind!=='overtime');
 const schedule=regular?recordSchedule(regular):siteSchedule(state,worker?.siteId||'');
 if(state.attendance.some(a=>a.workerId===workerId&&!a.timeOut))throw Error('This worker already has an open attendance record');
 if(!records.length&&time<shiftTime(date,schedule.end))return {kind:'regular' as const,schedule};
 const approval=regular?.timeOut&&state.overtimeApprovals?.find(a=>a.workerId===workerId&&a.siteId===worker?.siteId&&a.date===date&&overtimeApprovalStatus(a,time)==='Available'&&time>=Date.parse(a.approvedAt)&&time>=shiftTime(date,schedule.end)&&time<shiftTime(date,a.endTime));
 if(!approval)throw Error(records.length?'Regular attendance is already recorded today. Use a correction for an accidental checkout, or ask an administrator to approve overtime after the scheduled shift.':'Regular check-in closes at '+schedule.end+'. Ask an administrator to review attendance.');
 return {kind:'overtime' as const,approval,schedule};
}
