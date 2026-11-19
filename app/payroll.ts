import {day,type State} from './model';
import {attendanceHours} from './shift-policy';
import {LONG_SESSION_HOURS} from './attendance-exceptions';

export type PayrollIssue = {date:string;text:string};
export type PayrollRow = {
  idnum:string;
  name:string;
  rate:number|null;
  hr_rate:number|null;
  week_start:string;
  hours_to_pay:number;
  weekly_pay:number|null;
  issues:PayrollIssue[];
};
export type SavedRate = {idnum:string;rate:number|null;hr_rate:number;week_start:string};
export const payrollColumns = ['IDnum','Name','Rate','Hr. Rate','Week Start','Hours to Pay','Weekly Gross Pay'];

export function grossPay(hourlyRate:number,hours:number){
  // Both factors have four decimal places. Round their exact product to cents.
  return Number((BigInt(Math.round(hourlyRate*10000))*BigInt(Math.round(hours*10000))+BigInt(500000))/BigInt(1000000))/100;
}

export function payrollReview(state:State,week:string,rates:ReadonlyMap<string,SavedRate>,selectedRates:ReadonlyMap<string,number>=new Map()):PayrollRow[]{
  const last=new Date(week+'T00:00:00Z');
  last.setUTCDate(last.getUTCDate()+6);
  const end=last.toISOString().slice(0,10);
  const within=(date:string)=>date>=week&&date<=end;
  const totals=new Map<string,{minutes:number;issues:PayrollIssue[]}>();
  const workerTotals=(id:string)=>{
    let total=totals.get(id);
    if(!total){total={minutes:0,issues:[]};totals.set(id,total);}
    return total;
  };
  const issue=(id:string,date:string,text:string)=>{
    const {issues}=workerTotals(id);
    if(!issues.some(item=>item.date===date&&item.text===text))issues.push({date,text});
  };
  const dates=new Map(state.attendance.map(record=>[record.id,day(record.timeIn)]));
  for(const record of state.attendance){
    const date=dates.get(record.id)!;
    if(!within(date))continue;
    const total=workerTotals(record.workerId);
    if(!record.timeOut)issue(record.workerId,date,'Missing Time Out');
    if(Boolean(record.lunchOut)!==Boolean(record.lunchIn))issue(record.workerId,date,'Incomplete lunch scans');
    const span=record.timeOut?(Date.parse(record.timeOut)-Date.parse(record.timeIn))/3600000:null;
    if(span!==null&&(!Number.isFinite(span)||span<=0||span>LONG_SESSION_HOURS))issue(record.workerId,date,'Shift length needs review');
    if(span!==null&&span>0&&span<=LONG_SESSION_HOURS&&Boolean(record.lunchOut)===Boolean(record.lunchIn))total.minutes+=attendanceHours(record).workedMinutes??0;
  }
  for(const request of state.offlineAttendance??[]){
    if(request.status==='pending'&&within(day(request.occurredAt)))issue(request.workerId,day(request.occurredAt),'Offline attendance awaiting approval');
  }
  for(const request of state.attendanceCorrections??[]){
    if(request.status!=='pending')continue;
    const relevantDates=new Set([dates.get(request.attendanceId)??day(request.originalIn),day(request.proposedIn)]);
    for(const date of relevantDates)if(within(date))issue(request.workerId,date,'Attendance correction awaiting approval');
  }
  const workers=new Map(state.workers.map(worker=>[worker.id,worker]));
  return [...totals].map(([idnum,{minutes,issues}])=>{
    const saved=rates.get(idnum);
    const worker=workers.get(idnum);
    const hr_rate=selectedRates.get(idnum)??saved?.hr_rate??null;
    if(!worker)issues.push({date:week,text:'Worker record is unavailable'});
    if(hr_rate===null)issues.push({date:week,text:'Hourly rate needed'});
    if(minutes>168*60)issues.push({date:week,text:'Weekly hours exceed 168'});
    const hours_to_pay=Math.round(minutes*10000/60)/10000;
    const weekly_pay=hr_rate===null||issues.length?null:grossPay(hr_rate,hours_to_pay);
    return {idnum,name:worker?.name??idnum,rate:saved?.rate??null,hr_rate,week_start:week,hours_to_pay,weekly_pay,issues};
  }).sort((a,b)=>a.name.localeCompare(b.name)||a.idnum.localeCompare(b.idnum));
}

export function parsePayrollRate(value:unknown){
  if(typeof value!=='string'||!/^\d{1,8}(?:\.\d{1,4})?$/.test(value.trim()))throw Error('Enter a nonnegative hourly rate with up to four decimal places.');
  return Number(value);
}
