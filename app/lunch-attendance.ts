import {day, type State} from './model';
import {recordSchedule, shiftTime} from './shift-policy';

export const scannerActions = {in:'Time In', 'lunch-out':'Lunch Out', 'lunch-in':'Return from Lunch'} as const;
export type ScannerAction = keyof typeof scannerActions;

export function recordLunch(state:State, workerId:string, action:Exclude<ScannerAction,'in'>, now:string, actor:string, allowClosed=false){
 const worker=state.workers.find(item=>item.id===workerId);
 const record=state.attendance.find(item=>item.workerId===workerId&&(allowClosed||!item.timeOut)&&item.shiftKind!=='overtime'&&day(item.timeIn)===day(now));
 if(!worker||!record)throw Error('Record today’s Time In before using the lunch scanner.');
 const existing=action==='lunch-out'?record.lunchOut:record.lunchIn;
 if(existing)return {state,recordedAt:existing,alreadyRecorded:true,attendanceId:record.id};
 if(record.timeOut&&Date.parse(now)>=Date.parse(record.timeOut))throw Error('The lunch scan must occur before the end-of-day Time Out.');
 if(Date.parse(now)>=shiftTime(day(now),recordSchedule(record).end))throw Error('Lunch scans close at the scheduled shift end.');
 if(action==='lunch-in'&&!record.lunchOut)throw Error('Record Lunch Out before returning from lunch.');
 const previous=action==='lunch-in'?record.lunchOut!:record.timeIn;
 if(Date.parse(now)<=Date.parse(previous))throw Error('The lunch scan must occur after the previous attendance event.');
 const next=structuredClone(state);
 const updated=next.attendance.find(item=>item.id===record.id)!;
 if(action==='lunch-out')updated.lunchOut=now;
 else updated.lunchIn=now;
 next.audit.unshift({id:crypto.randomUUID(),action:worker.name+' · '+scannerActions[action],created:now,actor,siteId:record.siteId,kind:'face-check'});
 return {state:next,recordedAt:now,alreadyRecorded:false,attendanceId:record.id};
}
