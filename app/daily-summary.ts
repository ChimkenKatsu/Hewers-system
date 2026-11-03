import {day} from './model';
import type {State} from './model';
export function dailySummary(state:State,date:string,siteId='all'){
 return state.sites.filter(s=>siteId==='all'||s.id===siteId).map(site=>{
  const attendance=state.attendance.filter(a=>a.siteId===site.id&&day(a.timeIn)===date);
  return {site,workers:state.workers.filter(w=>w.siteId===site.id).length,attended:new Set(attendance.map(a=>a.workerId)).size,
   onSite:new Set(state.attendance.filter(a=>a.siteId===site.id&&!a.timeOut).map(a=>a.workerId)).size,
   movements:state.movements.filter(m=>m.siteId===site.id&&day(m.created)===date).length,
   photos:state.photos.filter(p=>p.siteId===site.id&&day(p.created)===date).length,
   lowStock:state.materials.filter(m=>m.siteId===site.id&&m.balance<=m.minimum).length,
   pending:[...(state.workerRequests||[]),...(state.attendanceCorrections||[]),...(state.stockReconciliations||[])].filter(r=>r.siteId===site.id&&r.status==='pending').length};
 });
}
export function toPhtInput(value:string|null){if(!value)return '';const d=new Date(Date.parse(value)+8*3600000);return d.toISOString().slice(0,16);}
export function fromPhtInput(value:string){if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(value))throw Error('Enter a valid Philippine date and time');const d=new Date(value+':00+08:00');if(!Number.isFinite(d.getTime())||toPhtInput(d.toISOString())!==value)throw Error('Enter a valid Philippine date and time');return d.toISOString();}
