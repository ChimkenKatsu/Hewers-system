export type Site={id:string;name:string;location:string;shiftEnd?:string;remindersDisabled?:boolean};
export type Worker={id:string;name:string;trade:string;siteId:string;archivedAt?:string;archivedBy?:string};
export type Attendance={id:string;workerId:string;siteId:string;timeIn:string;timeOut:string|null;method:string;timeOutMethod?:string;note:string;correctionId?:string;shiftKind?:'regular'|'overtime';overtimeApprovalId?:string;shiftEndAt?:string};
export type Material={id:string;name:string;unit:string;siteId:string;balance:number;minimum:number};
export type Movement={id:string;materialId:string;siteId:string;type:string;quantity:number;note:string;created:string;actor:string;adjustmentDelta?:number;reconciliationId?:string};
export type Evidence={id:string;siteId:string;caption:string;category:string;url:string;created:string;actor:string;transactionId:string};
export type Audit={id:string;action:string;created:string;actor:string;siteId?:string;kind?:string};
export type WorkerRequest={id:string;name:string;trade:string;siteId:string;status:"pending"|"accepted"|"declined";created:string;createdBy:string;reviewedAt?:string;reviewedBy?:string;workerId?:string;reason?:string};
export type ReviewStatus='pending'|'accepted'|'declined';
export type ReviewRecord={id:string;siteId:string;status:ReviewStatus;reason:string;created:string;createdBy:string;createdById?:string;reviewedAt?:string;reviewedBy?:string;reviewedById?:string;reviewNote?:string};
export type AttendanceCorrection=ReviewRecord&{attendanceId:string;workerId:string;originalIn:string;originalOut:string|null;proposedIn:string;proposedOut:string|null};
export type StockReconciliation=ReviewRecord&{materialId:string;systemBalance:number;countedBalance:number;movementId?:string};
export type OvertimeApproval={id:string;workerId:string;siteId:string;date:string;endTime:string;reason:string;approvedBy:string;approvedAt:string;usedAttendanceId?:string;revokedAt?:string};
export type State={overtimeApprovals?:OvertimeApproval[];attendanceCorrections?:AttendanceCorrection[];stockReconciliations?:StockReconciliation[];workerRequests?:WorkerRequest[];sites:Site[];workers:Worker[];attendance:Attendance[];materials:Material[];movements:Movement[];photos:Evidence[];audit:Audit[]};
export const emptyState=():State=>({sites:[],workers:[],attendance:[],materials:[],movements:[],photos:[],audit:[]});
export const day=(value:string)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
export function demoState():State{
 const now=new Date(), t=(hour:number,minute=0)=>new Date(day(now.toISOString())+'T'+String(hour).padStart(2,'0')+':'+String(minute).padStart(2,'0')+':00+08:00').toISOString();
 const sites=[{id:'s1',name:'Iligan Residential',location:'Iligan City'},{id:'s2',name:'CDO Commercial',location:'Cagayan de Oro'}];
 const workers=[['Marco Santos','Site foreman','s1'],['Jose Reyes','Mason','s1'],['Rafael Cruz','Carpenter','s1'],['Daniel Garcia','Steel worker','s2'],['Miguel Ramos','Electrician','s2'],['Paolo Flores','Laborer','s1']].map((w,i)=>({id:'w'+i,name:w[0],trade:w[1],siteId:w[2]}));
 const materials=[{id:'m1',name:'Portland cement',unit:'bags',siteId:'s1',balance:68,minimum:100},{id:'m2',name:'Deformed steel bar · 12mm',unit:'pcs',siteId:'s1',balance:240,minimum:80},{id:'m3',name:'Washed sand',unit:'m³',siteId:'s1',balance:18,minimum:5},{id:'m4',name:'Concrete hollow blocks',unit:'pcs',siteId:'s2',balance:420,minimum:500}];
 return {sites,workers,materials,attendance:workers.slice(0,5).map((w,i)=>({id:'a'+i,workerId:w.id,siteId:w.siteId,timeIn:t(7,i*4),timeOut:i===2?t(15,30):null,method:'Manual',note:'Sample record'})),movements:[{id:'v1',materialId:'m1',siteId:'s1',type:'Issue',quantity:32,note:'Ground floor concrete works',created:t(9,20),actor:'Sample administrator'},{id:'v2',materialId:'m2',siteId:'s1',type:'Delivery',quantity:120,note:'Delivery receipt DR-0082',created:t(8,45),actor:'Sample administrator'}],photos:[],audit:[{id:'log1',action:'32 bags of Portland cement issued',created:t(9,20),actor:'Sample administrator'},{id:'log2',action:'120 steel bars received at Iligan Residential',created:t(8,45),actor:'Sample administrator'},{id:'log3',action:'Marco Santos checked in',created:t(7),actor:'Sample administrator'}]};
}
