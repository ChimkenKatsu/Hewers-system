import type {State} from './model';
export type Role='administrator'|'manager'|'supervisor'|'custodian'|'viewer';
export type Access={owner:string;userId:string;email:string;role:Role;siteIds:string[]};
export const roleLabels:Record<Role,string>={administrator:'Administrator',manager:'Manager',supervisor:'Site supervisor',custodian:'Inventory custodian',viewer:'Viewer'};
export const writes:Record<Role,string[]>={administrator:['site','worker','attendance','material','movement','photo','face-enroll','face-check','face-delete','staff'],manager:[],supervisor:['worker','attendance','photo','face-enroll','face-check','face-delete'],custodian:['material','movement','photo'],viewer:[]};
export function can(a:Pick<Access,'role'>,action:string){return writes[a.role]?.includes(action)??false}
export function hasSite(a:Access,siteId:string){return a.role==='administrator'||a.siteIds.includes(siteId)}
export function requireSite(a:Access,siteId:string){if(!hasSite(a,siteId))throw new Error('FORBIDDEN: This site is not assigned to your account')}
export function authorize(a:Access,s:State,action:string,p:any){
 if(!can(a,action))throw new Error('FORBIDDEN: Your role cannot perform this action');
 if(['site','staff'].includes(action))return;
 let siteId=p.siteId;
 if(['attendance','face-enroll','face-check','face-delete'].includes(action)){const w=s.workers.find(w=>w.id===p.workerId);if(!w)throw new Error('Worker not found');siteId=w.siteId;}
 if(action==='movement'){const m=s.materials.find(m=>m.id===p.materialId);if(!m)throw new Error('Material not found');siteId=m.siteId;}
 if(!s.sites.some(site=>site.id===siteId))throw new Error('Site not found');requireSite(a,siteId);
}
export function visibleState(s:State,a:Access):State{
 if(a.role==='administrator')return s;
 const scope=(x:{siteId:string})=>hasSite(a,x.siteId);
 const canSeeWorkers=a.role!=='custodian';
 return {sites:s.sites.filter(x=>hasSite(a,x.id)),workers:canSeeWorkers?s.workers.filter(scope):[],attendance:canSeeWorkers?s.attendance.filter(scope):[],materials:s.materials.filter(scope),movements:s.movements.filter(scope),photos:s.photos.filter(scope),audit:s.audit.filter(x=>!!x.siteId&&hasSite(a,x.siteId)&&!(a.role==='custodian'&&['attendance','worker','face-enroll','face-check','face-delete'].includes(x.kind||'')))};
}
