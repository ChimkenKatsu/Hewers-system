import type {WorkerRequest} from './model';
export function newWorkerRequests(requests:WorkerRequest[],seen:ReadonlySet<string>){
 return requests.filter(r=>r.status==='pending'&&!seen.has(r.id)).sort((a,b)=>b.created.localeCompare(a.created));
}
