import type {State,WorkerRequest} from './model';
export type PushEvent={id:string;kind:'submitted'|'accepted'|'declined';request:WorkerRequest};
export function pushEvents(before:State,after:State):PushEvent[]{
 const previous=new Map((before.workerRequests||[]).map(r=>[r.id,r]));
 return (after.workerRequests||[]).flatMap<PushEvent>(request=>{
  const old=previous.get(request.id);
  if(!old&&request.status==='pending')return [{id:request.id+':submitted',kind:'submitted',request}];
  if(old?.status==='pending'&&(request.status==='accepted'||request.status==='declined'))return [{id:request.id+':'+request.status,kind:request.status,request}];
  return [];
 });
}
export function mayReceivePush(event:PushEvent,user:{role:string;email:string;site_ids:string}){
 if(event.kind==='submitted')return user.role==='administrator';
 if(user.role!=='auditor'||user.email!==event.request.createdBy)return false;
 try{return (JSON.parse(user.site_ids) as string[]).includes(event.request.siteId)}catch{return false}
}
