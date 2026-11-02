import {env} from 'cloudflare:workers';
import {emptyState,State} from './model';
const config=()=>env as unknown as {SUPABASE_URL?:string;SUPABASE_SECRET_KEY?:string};
export const usesSupabase=()=>!!config().SUPABASE_SECRET_KEY;
export const eq=(v:string)=>'eq.'+encodeURIComponent(v);
export async function sb(path:string,method='GET',body?:unknown,prefer?:string):Promise<any>{
 const c=config();if(!c.SUPABASE_URL||!c.SUPABASE_SECRET_KEY)throw Error('Supabase server configuration is missing');
 const headers:Record<string,string>={apikey:c.SUPABASE_SECRET_KEY,'Content-Type':'application/json'};if(prefer)headers.Prefer=prefer;
 const r=await fetch(c.SUPABASE_URL+'/rest/v1/'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(25000)});
 if(!r.ok){const b:any=await r.json().catch(()=>({}));throw Error(b.code==='23505'?'CONFLICT: This record already exists. Refresh and try again.':'Supabase request failed ('+r.status+'). Please retry or contact your administrator.');}
 return r.status===204?null:await r.json().catch(()=>null);
}
export const rpc=(name:string,body:unknown)=>sb('rpc/'+name,'POST',body);
export async function storedPhoto(key:string,method='GET',body?:ArrayBuffer,type?:string){
 const c=config();const r=await fetch(c.SUPABASE_URL+'/storage/v1/object/hewers-site-photos/'+key.split('/').map(encodeURIComponent).join('/'),{method,headers:{apikey:c.SUPABASE_SECRET_KEY!,'Content-Type':type||'application/octet-stream',...(method==='POST'?{'x-upsert':'true'}:{})},body,signal:AbortSignal.timeout(25000)});
 if(!r.ok)throw Error('Photo storage request failed ('+r.status+'). Please try again.');return r;
}
export async function registerUpload(owner:string,siteId:string,key:string){await sb('hewers_photo_uploads','POST',{workspace_id:owner,site_id:siteId,storage_path:key},'resolution=merge-duplicates');}
export async function members(owner?:string):Promise<any[]>{
 const rows=await sb('hewers_staff?select=*&'+(owner?'workspace_id='+eq(owner):'active=eq.true'));
 return Promise.all(rows.map(async(m:any)=>({...m,owner:m.workspace_id,name:m.full_name,created:m.created_at,active:m.active?1:0,site_ids:JSON.stringify((await sb('hewers_staff_sites?workspace_id='+eq(m.workspace_id)+'&staff_id='+eq(m.id)+'&select=site_id')).map((x:any)=>x.site_id))})));
}
export async function ensureWorkspace(owner:string,email:string){
 let row=(await sb('hewers_workspaces?id='+eq(owner)+'&select=*'))[0];if(row?.migrated_at)return;
 // Copy only the signed-in owner's legacy workspace. Never overwrite a new Supabase state.
 const legacy=await env.DB!.prepare('SELECT state,revision FROM workspaces WHERE owner=?').bind(owner).first<any>();
 if(!row){await sb('hewers_workspaces','POST',{id:owner,owner_email:email,state:legacy?JSON.parse(legacy.state):emptyState(),revision:legacy?.revision||0},'resolution=ignore-duplicates');row=(await sb('hewers_workspaces?id='+eq(owner)+'&select=*'))[0];}
 const staff=await env.DB!.prepare('SELECT * FROM memberships WHERE owner=?').bind(owner).all<any>();
 for(const m of staff.results)await rpc('hewers_save_staff',{p_owner:owner,p_staff:{...m,active:!!m.active,siteIds:JSON.parse(m.site_ids)}});
 const faces=await env.DB!.prepare('SELECT * FROM face_templates WHERE owner=?').bind(owner).all<any>();
 for(const f of faces.results)await sb('hewers_face_enrollments','POST',{workspace_id:owner,worker_id:f.worker_id,model:'face-api-1.7.15-ssd68-resnet128',descriptors:JSON.parse(f.descriptor),consent_record:f.consent,enrolled_by:f.actor,enrolled_at:f.created},'resolution=ignore-duplicates');
 for(const p of (row.state as State).photos){const key=new URL(p.url,'https://local').searchParams.get('key');if(!key||!key.startsWith(owner+'/'))throw Error('Legacy photo has an invalid workspace path');const old=await env.BUCKET!.get(key);if(!old)throw Error('An existing photo is missing. Migration stopped to protect your records.');await storedPhoto(key,'POST',await old.arrayBuffer(),old.httpMetadata?.contentType);await registerUpload(owner,p.siteId,key);}
 await sb('hewers_workspaces?id='+eq(owner),'PATCH',{migrated_at:new Date().toISOString()});
}
