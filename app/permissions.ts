import type {State} from './model';
export type Role='administrator'|'manager'|'supervisor'|'custodian'|'viewer'|'auditor';
export type Access={owner:string;userId:string;email:string;role:Role;siteIds:string[]};
export const roleLabels:Record<Role,string>={administrator:'Administrator',manager:'Manager',supervisor:'Site supervisor',custodian:'Inventory custodian',viewer:'Viewer',auditor:'Auditor'};
export const writes:Record<Role,string[]>={administrator:['site-shift-settings','worker-archive','worker-restore','site','worker','attendance','material','movement','photo','face-enroll','face-check','face-delete','staff','worker-review','attendance-correction-request','attendance-correction-review','stock-count-request','stock-count-review'],auditor:['worker','movement','photo','face-enroll','face-check','attendance-correction-request','stock-count-request'],manager:[],supervisor:['worker','attendance','photo','face-enroll','face-check','face-delete'],custodian:['material','movement','photo'],viewer:[]};
export function can(a:Pick<Access,'role'>,action:string){return writes[a.role]?.includes(action)??false}
export function hasSite(a:Access,siteId:string){return a.role==='administrator'||a.siteIds.includes(siteId)}
export function requireSite(a:Access,siteId:string){if(!hasSite(a,siteId))throw new Error('FORBIDDEN: This site is not assigned to your account')}
export function authorize(a:Access,s:State,action:string,p:any){
 if(!can(a,action))throw new Error('FORBIDDEN: Your role cannot perform this action');
 if(['site','staff','worker-review'].includes(action))return;
 let siteId=p.siteId;
 if(action==='attendance-correction-request'){const a=s.attendance.find(a=>a.id===p.attendanceId);if(!a)throw Error('Attendance record not found');siteId=a.siteId;}
 if(action==='attendance-correction-review'){const r=s.attendanceCorrections?.find(r=>r.id===p.requestId);if(!r)throw Error('Correction request not found');siteId=r.siteId;}
 if(action==='stock-count-request'){const m=s.materials.find(m=>m.id===p.materialId);if(!m)throw Error('Material not found');siteId=m.siteId;}
 if(action==='stock-count-review'){const r=s.stockReconciliations?.find(r=>r.id===p.requestId);if(!r)throw Error('Stock count not found');siteId=r.siteId;}
 if(['attendance','face-enroll','face-check','face-delete','worker-archive','worker-restore'].includes(action)){const w=s.workers.find(w=>w.id===p.workerId);if(!w)throw new Error('Worker not found');if(w.archivedAt&&['attendance','face-enroll','face-check'].includes(action))throw Error('FORBIDDEN: This worker is archived. Restore them first');siteId=w.siteId;}
 if(action==='movement'){const m=s.materials.find(m=>m.id===p.materialId);if(!m)throw new Error('Material not found');siteId=m.siteId;}
 if(!s.sites.some(site=>site.id===siteId))throw new Error('Site not found');requireSite(a,siteId);
}
export function visibleState(s:State,a:Access):State{
 if(a.role==='administrator')return s;
 const scope=(x:{siteId:string})=>hasSite(a,x.siteId);
 const canSeeWorkers=a.role!=='custodian';
 return {attendanceCorrections:a.role==='auditor'?(s.attendanceCorrections||[]).filter(r=>r.createdBy===a.email&&hasSite(a,r.siteId)):[],stockReconciliations:a.role==='auditor'?(s.stockReconciliations||[]).filter(r=>r.createdBy===a.email&&hasSite(a,r.siteId)):[],workerRequests:a.role==='auditor'?(s.workerRequests||[]).filter(r=>r.createdBy===a.email&&hasSite(a,r.siteId)):[],sites:s.sites.filter(x=>hasSite(a,x.id)),workers:canSeeWorkers?s.workers.filter(scope):[],attendance:canSeeWorkers?s.attendance.filter(scope):[],materials:s.materials.filter(scope),movements:s.movements.filter(scope),photos:s.photos.filter(scope),audit:s.audit.filter(x=>!!x.siteId&&hasSite(a,x.siteId)&&!(a.role==='custodian'&&['attendance','worker','worker-archive','worker-restore','face-enroll','face-check','face-delete'].includes(x.kind||'')))};
}
