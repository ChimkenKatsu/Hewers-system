const backend='https://hewers-workforce.tristandominicparajes-202200583.workers.dev';
const routes=/^\/api\/(workspace|notifications|push|face|scan-diagnostics|accounts|account\/password|staff|photos|google(?:\/connect|\/callback)?|auth\/(?:sign-in\/username|sign-in\/email|sign-out|get-session|sign-up\/email))$/;
const json=(error:string,status:number)=>Response.json({error},{status,headers:{'Cache-Control':'private, no-store'}});
// Authenticate at the existing backend. This gateway stores no credentials or sessions.
export async function proxyHewersApi(req:Request,send:typeof fetch=fetch):Promise<Response>{
 const url=new URL(req.url),route=url.searchParams.get('__hewers_path');
 const path=route===null?url.pathname:'/api/'+route;
 if(!routes.test(path))return json('API route unavailable',404);
 if(!['GET','HEAD','POST'].includes(req.method))return json('Method not allowed',405);
 if(req.method==='POST'&&(req.headers.get('origin')!==url.origin||req.headers.get('sec-fetch-site')==='cross-site'))return json('FORBIDDEN: Invalid request origin',403);
 // Google keeps its existing approved callback and its same-host browser cookies.
 // Its connection UI opens on the canonical service; sync remains available here.
 if(path==='/api/google/connect')return new Response(null,{status:303,headers:{Location:backend+'/?google=setup','Cache-Control':'no-store'}});
 const target=new URL(path,backend);for(const [name,value] of url.searchParams)if(name!=='__hewers_path')target.searchParams.append(name,value);
 const headers=new Headers();for(const name of ['cookie','content-type','accept','x-workspace-id']){const value=req.headers.get(name);if(value)headers.set(name,value)}
 // Validate the original browser origin above before translating it for the upstream.
 if(req.method==='POST')headers.set('origin',backend);
 try{
  if(Number(req.headers.get('content-length'))>4400000)return json('Choose a photo of 4 MB or less',413);
  const body=req.method==='POST'?await req.arrayBuffer():undefined;
  if(body&&body.byteLength>4400000)return json('Choose a photo of 4 MB or less',413);
  const response=await send(target,{method:req.method,headers,body,redirect:'manual',signal:AbortSignal.timeout(270000)});
  const result=new Headers({'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});
  for(const name of ['content-type','content-disposition','retry-after']){const value=response.headers.get(name);if(value)result.set(name,value)}
  for(const cookie of response.headers.getSetCookie())result.append('set-cookie',cookie);
  const location=response.headers.get('location');if(location){const next=new URL(location,target);result.set('location',next.origin===backend?url.origin+next.pathname+next.search+next.hash:next.href)}
  return new Response(req.method==='HEAD'||[204,205,304].includes(response.status)?null:response.body,{status:response.status,headers:result});
 }catch{console.error('Hewers backend request unavailable');return json('Hewers is temporarily unavailable. If you were saving attendance, check the attendance log before retrying.',502)}
}
