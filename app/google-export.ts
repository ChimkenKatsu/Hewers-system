import type {State} from './model';
// Explicit allowlist: no face descriptors, staff permissions, or authentication data.
export function googleRows(state:State){
 const site=(id:string)=>state.sites.find(s=>s.id===id)?.name||id;
 const worker=(id:string)=>state.workers.find(w=>w.id===id)?.name||id;
 return {
  Attendance:[['Record ID','Worker','Site','Time in (UTC)','Time out (UTC)','Method'],...state.attendance.map(a=>[a.id,worker(a.workerId),site(a.siteId),a.timeIn,a.timeOut||'',a.method+(a.correctionId?' / admin-corrected':'')])],
  Inventory:[['Material ID','Material','Site','Quantity','Unit','Minimum'],...state.materials.map(m=>[m.id,m.name,site(m.siteId),m.balance,m.unit,m.minimum])],
  Movements:[['Record ID','Material','Site','Type','Quantity','Recorded (UTC)'],...state.movements.map(m=>[m.id,state.materials.find(x=>x.id===m.materialId)?.name||m.materialId,site(m.siteId),m.type,m.adjustmentDelta??m.quantity,m.created])],
 };
}
