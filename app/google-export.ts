import {attendanceShift} from './shift-policy';
import type {State} from './model';
// Explicit allowlist: no face descriptors, staff permissions, or authentication data.
export function googleRows(state:State,{includeNotes=false}: {includeNotes?:boolean}={}){
 const site=(id:string)=>state.sites.find(s=>s.id===id)?.name||id;
 const worker=(id:string)=>state.workers.find(w=>w.id===id)?.name||id;
 const pht=(value:string|null)=>value?new Date(new Date(value).getTime()+8*60*60*1000).toISOString().slice(0,19).replace('T',' '):'';
 const hours=(start:string,end:string|null)=>end?Math.round((new Date(end).getTime()-new Date(start).getTime())/3600000*100)/100:'';
 const delta=(type:string,quantity:number,adjustment?:number)=>adjustment??(['Issue','Damage','Loss'].includes(type)?-quantity:quantity);
 return {
  Attendance:[['Record ID','Worker','Site','Time in (UTC)','Time out (UTC)','Method','Worker ID','Trade / role','Attendance date (PHT)','Time in (PHT)','Time out (PHT)','Status','Elapsed hours (no break deduction)','Time-out method','Correction request ID','Shift','Arrival','Late minutes','Overtime approval ID',...(includeNotes?['Note']:[])],...state.attendance.map(a=>[a.id,worker(a.workerId),site(a.siteId),a.timeIn,a.timeOut||'',a.method+(a.correctionId?' / admin-corrected':''),a.workerId,state.workers.find(w=>w.id===a.workerId)?.trade||'',pht(a.timeIn).slice(0,10),pht(a.timeIn),pht(a.timeOut),a.timeOut?'Completed':'Checked in',hours(a.timeIn,a.timeOut),a.timeOutMethod||'',a.correctionId||'',a.shiftKind==='overtime'?'Overtime':'Regular',attendanceShift(a).label,attendanceShift(a).lateMinutes,a.overtimeApprovalId||'',...(includeNotes?[a.note]:[])])],
  Inventory:[['Material ID','Material','Site','Quantity','Unit','Minimum','Site location','Stock status','Quantity below minimum'],...state.materials.map(m=>[m.id,m.name,site(m.siteId),m.balance,m.unit,m.minimum,state.sites.find(s=>s.id===m.siteId)?.location||'',m.balance<=m.minimum?'Low stock':'In stock',Math.max(0,Math.round((m.minimum-m.balance)*1000)/1000)])],
  Movements:[['Record ID','Material','Site','Type','Quantity','Recorded (UTC)','Material ID','Unit','Stock change (+/-)','Recorded date (PHT)','Recorded time (PHT)','Reconciliation request ID',...(includeNotes?['Reference / reason','Recorded by']:[])],...state.movements.map(m=>[m.id,state.materials.find(x=>x.id===m.materialId)?.name||m.materialId,site(m.siteId),m.type,m.adjustmentDelta??m.quantity,m.created,m.materialId,state.materials.find(x=>x.id===m.materialId)?.unit||'',delta(m.type,m.quantity,m.adjustmentDelta),pht(m.created).slice(0,10),pht(m.created),m.reconciliationId||'',...(includeNotes?[m.note,m.actor]:[])])],
 };
}
