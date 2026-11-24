import {ArrowRight,Users} from 'lucide-react';
import {attendanceHours} from './shift-policy';
import type {State} from './model';

type Props={data:State;actor:string;role:string;site:string;date:string;canScan:boolean;canMove:boolean;onSite:(site:string)=>void;onScan:()=>void;onMove:()=>void;onAttendance:()=>void};
const time=(value:string)=>new Date(value).toLocaleTimeString('en-PH',{timeZone:'Asia/Manila',hour:'2-digit',minute:'2-digit'});
export default function MobileHome({data,actor,role,site,date,canScan,canMove,onSite,onScan,onMove,onAttendance}:Props){
 const recent=data.attendance.filter(a=>site==='all'||a.siteId===site).slice().sort((a,b)=>b.timeIn.localeCompare(a.timeIn)).slice(0,3);
 return <section className="mobile-home" aria-label="Mobile home">
  <header className="mobile-home-header">
   <img src="/hewers-logo-white.svg" alt="Hewers Manpower Services"/>
   <div className="mobile-home-profile"><span className="mobile-profile-avatar">{actor.split(' ').map(s=>s[0]).slice(0,2).join('').toUpperCase()}</span><div><p>Good day!</p><h1>{actor}</h1><span>({role})</span></div></div>
  </header>
  <div className="mobile-home-body">
   <label className="mobile-site-label">Site<span className="mobile-site"><select aria-label="Mobile site filter" value={site} onChange={e=>onSite(e.target.value)}><option value="all">All construction sites</option>{data.sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></span></label>
   <div className="mobile-home-actions">{canScan&&<button className="mobile-main-action" onClick={onScan}>Check In / Out</button>}{canMove&&<button className="mobile-main-action inventory" onClick={onMove}>Update Inventory</button>}</div>
   {canScan&&<section className="mobile-recent"><div className="mobile-recent-heading"><h2>Recent Attendance</h2><button aria-label="View all attendance records" onClick={onAttendance}>View All <ArrowRight size={14}/></button></div>{recent.length?recent.map(a=>{const worker=data.workers.find(w=>w.id===a.workerId);const minutes=attendanceHours(a).workedMinutes;return <button className="mobile-worker-row" key={a.id} onClick={onAttendance}><span className="mobile-worker-avatar">{(worker?.name||'Worker').split(' ').map(s=>s[0]).slice(0,2).join('')}</span><span className="mobile-worker-info"><strong>{worker?.name||'Worker'}</strong><small><b>IN</b> {time(a.timeIn)} | {minutes===null?'On site':<><b>HOURS</b> {Math.floor(minutes/60)}h {minutes%60}m</>}</small></span><ArrowRight size={20}/></button>}):<div className="mobile-home-empty"><Users size={26}/><p>No attendance yet</p><small>Worker check-ins will appear here.</small></div>}</section>}
   <p className="mobile-home-date">{date} · Your site workspace</p>
  </div>
 </section>;
}
