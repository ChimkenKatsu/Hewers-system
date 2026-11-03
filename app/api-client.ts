export class ApiResponseError extends Error{constructor(message:string,public status:number,public retryable=false){super(message)}}
export async function readApiJson<T=Record<string,unknown>>(response:Response):Promise<T>{
 const type=response.headers.get('content-type')||'';
 if(!type.includes('application/json'))throw new ApiResponseError('The server is temporarily unavailable (HTTP '+response.status+'). Please retry. If this happened while saving attendance, check the attendance log before retrying.',response.status,response.status>=500||response.ok);
 try{return await response.json() as T}catch{throw new ApiResponseError('The server returned an incomplete response. Please retry loading. If you were saving attendance, check the attendance log first.',response.status,true)}
}
export async function loadFaceEnrollments<T>(workspaceId:string,signal?:AbortSignal):Promise<T>{
 for(let attempt=0;;attempt++){
  try{const r=await fetch('/api/face',{headers:{'x-workspace-id':workspaceId},signal,cache:'no-store'});const b=await readApiJson<T&{error?:string}>(r);if(!r.ok)throw new ApiResponseError(b.error||'Unable to load face enrollments',r.status,r.status>=500);return b}
  catch(e){if(signal?.aborted||attempt>=1||(e instanceof ApiResponseError&&!e.retryable))throw e;await new Promise(resolve=>setTimeout(resolve,350));}
 }
}
