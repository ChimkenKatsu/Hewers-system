'use client';
import {useEffect,useId,useRef,useState,type ReactNode} from 'react';
import {ArrowLeft,CheckCircle2,ChevronRight,Clock,LogOut,Package} from 'lucide-react';
import type {Attendance,Movement,State} from './model';
import {attendanceHours} from './shift-policy';

const time=(value:string)=>new Date(value).toLocaleTimeString('en-PH',{timeZone:'Asia/Manila',hour:'numeric',minute:'2-digit'});
const date=(value:string)=>new Date(value).toLocaleDateString('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',year:'numeric'});
const initials=(name:string)=>name.split(' ').map(part=>part[0]).slice(0,2).join('');
function duration(record:Attendance){const minutes=attendanceHours(record).workedMinutes;return minutes==null?'Pending checkout':Math.floor(minutes/60)+'h '+minutes%60+'m';}

function RecordDetails({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}){
 const ref=useRef<HTMLDialogElement>(null),id=useId();
 useEffect(()=>{const dialog=ref.current;if(!dialog)return;const previous=document.activeElement as HTMLElement|null;dialog.showModal();const overflow=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{dialog.close();document.body.style.overflow=overflow;previous?.focus()}},[]);
 return <dialog ref={ref} className="mobile-record-detail" aria-labelledby={id} onCancel={e=>{e.preventDefault();onClose()}}><header><button className="text-btn" onClick={onClose}><ArrowLeft size={20}/>Back</button><h2 id={id}>{title}</h2></header>{children}</dialog>;
}

export function MobileAttendanceCards({data,records,query}:{data:State;records:Attendance[];query:string}){
 const [selected,setSelected]=useState<string|null>(null);
 const rows=records.filter(record=>(data.workers.find(w=>w.id===record.workerId)?.name||'Unknown worker').toLowerCase().includes(query.toLowerCase())).slice().sort((a,b)=>b.timeIn.localeCompare(a.timeIn));
 const record=rows.find(row=>row.id===selected),worker=data.workers.find(w=>w.id===record?.workerId);
 return <div className="mobile-record-list" aria-label="Attendance records">
  {rows.map(row=>{const name=data.workers.find(w=>w.id===row.workerId)?.name||'Unknown worker';return <button key={row.id} className="mobile-attendance-card" onClick={()=>setSelected(row.id)}><span className="mobile-worker-avatar">{initials(name)}</span><span><strong>{name}</strong><small>IN {time(row.timeIn)} | {row.timeOut?'HOURS '+duration(row):row.lunchOut&&!row.lunchIn?'At lunch':'On site'}</small></span><ChevronRight size={24}/></button>})}
  {!rows.length&&<p className="mobile-record-empty">No attendance records match this date and search.</p>}
  {record&&<RecordDetails title="Worker profile" onClose={()=>setSelected(null)}><div className="mobile-person-detail"><span className="mobile-worker-avatar">{initials(worker?.name||'Worker')}</span><h3>{worker?.name||'Unknown worker'}</h3><p>{worker?.trade} · {data.sites.find(s=>s.id===record.siteId)?.name}</p></div><div className="mobile-detail-fact"><CheckCircle2 className="detail-success"/><div><strong>CHECKED IN | {time(record.timeIn)}</strong><small>{date(record.timeIn)}</small></div></div><div className="mobile-detail-fact"><Clock className="detail-gold"/><div><strong>{duration(record)}</strong><small>Total work hours · unpaid break excluded</small></div></div><div className="mobile-detail-fact"><LogOut/><div><strong>{record.timeOut?'CHECKED OUT | '+time(record.timeOut):record.lunchOut&&!record.lunchIn?'At lunch':'Currently on site'}</strong><small>{record.timeOut?date(record.timeOut):'Checkout has not been recorded'}</small></div></div>{record.lunchOut&&<div className="mobile-detail-fact"><Clock/><div><strong>Lunch out · {time(record.lunchOut)}</strong><small>{record.lunchIn?'Returned · '+time(record.lunchIn):'Return from lunch pending'}</small></div></div>}<div className="mobile-detail-notes"><h4>Notes</h4><p>{record.note||'No notes recorded.'}</p></div></RecordDetails>}
 </div>;
}

export function MobileMaterialCards({data,site,query,movementsOnly,onMove,canMove}:{data:State;site:string;query:string;movementsOnly:boolean;onMove:(id:string)=>void;canMove:boolean}){
 const [materialId,setMaterialId]=useState<string|null>(null),[movementId,setMovementId]=useState<string|null>(null);
 const materials=data.materials.filter(m=>(site==='all'||m.siteId===site)&&m.name.toLowerCase().includes(query.toLowerCase()));
 const movements=data.movements.filter(m=>(site==='all'||m.siteId===site)&&materials.some(material=>material.id===m.materialId)).slice().sort((a,b)=>b.created.localeCompare(a.created));
 const material=data.materials.find(m=>m.id===materialId),movement=data.movements.find(m=>m.id===movementId);
 const materialMovements=movements.filter(m=>m.materialId===materialId);
 const showMovement=(row:Movement)=>{setMaterialId(row.materialId);setMovementId(row.id)};
 const movementLine=(row:Movement)=>{const item=data.materials.find(m=>m.id===row.materialId);const subtract=['Issue','Damage','Loss'].includes(row.type);const delta=row.adjustmentDelta??(subtract?-row.quantity:row.quantity);return <><span className={delta<0?'detail-gold':'detail-success'}>{row.type.toUpperCase()} {delta>0?'+':''}{delta} {item?.unit}</span><small>{date(row.created)} | {time(row.created)}</small></>};
 return <div className="mobile-record-list mobile-inventory-list" aria-label={movementsOnly?'Material movements':'Materials'}><h2>{movementsOnly?'Recent movements':'Materials in stock'}</h2>
  {movementsOnly?movements.map(row=><button key={row.id} className="mobile-material-card" onClick={()=>showMovement(row)}><span><strong>{data.materials.find(m=>m.id===row.materialId)?.name||'Unknown material'}</strong><span className="mobile-movement-line">{movementLine(row)}</span></span><ChevronRight size={22}/></button>):materials.map(item=>{const latest=movements.find(m=>m.materialId===item.id);return <button key={item.id} className="mobile-material-card" onClick={()=>{setMaterialId(item.id);setMovementId(null)}}><span><strong>{item.name} | {item.balance} {item.unit}</strong><small className={item.balance<=item.minimum?'detail-gold':''}>{item.balance<=item.minimum?'Low stock':'In stock'}</small>{latest&&<span className="mobile-movement-line">{movementLine(latest)}</span>}</span><ChevronRight size={22}/></button>})}
  {!(movementsOnly?movements:materials).length&&<p className="mobile-record-empty">No records match this site and search.</p>}
  {material&&<RecordDetails title={movement?'Movement details':'Material profile'} onClose={()=>{setMaterialId(null);setMovementId(null)}}><div className="mobile-material-detail"><Package size={48}/><h3>{material.name}</h3><p>{data.sites.find(s=>s.id===material.siteId)?.name}</p><small>Current stock</small><strong>{material.balance} {material.unit}</strong></div>{movement?<><div className="mobile-detail-fact"><div className="mobile-movement-line">{movementLine(movement)}</div></div><div className="mobile-detail-notes"><h4>Notes</h4><p>{movement.note||'No notes recorded.'}</p></div>{data.photos.filter(photo=>photo.transactionId===movement.id).map(photo=><figure className="mobile-movement-photo" key={photo.id}><img src={photo.url} alt={photo.caption}/><figcaption>{photo.caption} · {time(photo.created)}</figcaption></figure>)}</>:<><h4 className="mobile-detail-section-title">Recent movements</h4>{materialMovements.map(row=><button className="mobile-material-card" key={row.id} onClick={()=>setMovementId(row.id)}><span className="mobile-movement-line">{movementLine(row)}</span><ChevronRight size={20}/></button>)}{!materialMovements.length&&<p className="mobile-record-empty">No movements recorded yet.</p>}{canMove&&<button className="btn" onClick={()=>{setMaterialId(null);onMove(material.id)}}>Update Material Inventory</button>}</>}</RecordDetails>}
 </div>;
}
