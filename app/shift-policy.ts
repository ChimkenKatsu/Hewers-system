import {day,type State,type Attendance} from './model';
export const REGULAR_START='08:00',REGULAR_END='17:00';
export const shiftTime=(date:string,time:string)=>Date.parse(date+'T'+time+':00+08:00');
export function attendanceShift(record:Attendance){
 if(record.shiftKind==='overtime')return {label:'Approved overtime',lateMinutes:0};
 const minutes=Math.max(0,Math.ceil((Date.parse(record.timeIn)-shiftTime(day(record.timeIn),REGULAR_START))/60000));
 return {label:minutes?'Late · '+minutes+' min':'On time',lateMinutes:minutes};
}
export function checkShiftEntry(state:State,workerId:string,now:string){
 const date=day(now),time=Date.parse(now);
 if(state.attendance.some(a=>a.workerId===workerId&&!a.timeOut))throw Error('This worker already has an open attendance record');
 const records=state.attendance.filter(a=>a.workerId===workerId&&day(a.timeIn)===date);
 if(!records.length&&time<shiftTime(date,REGULAR_END))return {kind:'regular' as const};
 const approval=state.overtimeApprovals?.find(a=>a.workerId===workerId&&a.date===date&&!a.usedAttendanceId&&!a.revokedAt&&time>=shiftTime(date,REGULAR_END)&&time<shiftTime(date,a.endTime));
 if(!approval)throw Error(records.length?'Regular attendance is already recorded today. Use a correction for an accidental checkout, or ask an administrator to approve overtime after 5:00 PM.':'Regular check-in closes at 5:00 PM. Ask an administrator to review attendance.');
 return {kind:'overtime' as const,approval};
}
