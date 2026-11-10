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
export async function removeStoredPhoto(key:string){
 const c=config();const r=await fetch(c.SUPABASE_URL+'/storage/v1/object/hewers-site-photos',{method:'DELETE',headers:{apikey:c.SUPABASE_SECRET_KEY!,'Content-Type':'application/json'},body:JSON.stringify({prefixes:[key]}),signal:AbortSignal.timeout(25000)});if(!r.ok)throw Error('Abandoned photo cleanup failed');
}
export async function syncTeamAccounts(owner:string){
 if(!usesSupabase())return;
 const rows=await env.DB!.prepare('SELECT id,username,name,role,site_ids,active,must_change_password FROM auth_user WHERE workspace_id=?').bind(owner).all<{id:string;username:string;name:string;role:string;site_ids:string;active:number;must_change_password:number}>();
 await rpc('hewers_sync_team_accounts',{p_owner:owner,p_accounts:rows.results.map(r=>({id:r.id,username:r.username,name:r.name,role:r.role,siteIds:JSON.parse(r.site_ids),active:!!r.active,mustChangePassword:!!r.must_change_password}))});
}
// A failed metadata projection must never hide a newly generated temporary password.
export async function teamSyncWarning(owner:string){try{await syncTeamAccounts(owner);return undefined}catch{return 'Account saved. Supabase account metadata sync is pending; reopen Staff access to retry.'}}
export async function ensureWorkspace(owner:string,email:string){
 let row=(await sb('hewers_workspaces?id='+eq(owner)+'&select=*'))[0];if(row?.migrated_at)return;
 // Copy only the signed-in owner's legacy workspace. Never overwrite a new Supabase state.
 const legacy=await env.DB!.prepare('SELECT state,revision FROM workspaces WHERE owner=?').bind(owner).first<any>();
 if(!row){await sb('hewers_workspaces','POST',{id:owner,owner_email:email,state:legacy?JSON.parse(legacy.state):emptyState(),revision:legacy?.revision||0},'resolution=ignore-duplicates');row=(await sb('hewers_workspaces?id='+eq(owner)+'&select=*'))[0];}
 const staff=await env.DB!.prepare('SELECT * FROM memberships WHERE owner=?').bind(owner).all<any>();
 if(staff.results.length)throw Error('Legacy staff records must be converted to named accounts before workspace migration. No staff data was discarded.');
 const faces=await env.DB!.prepare('SELECT * FROM face_templates WHERE owner=?').bind(owner).all<any>();
 for(const f of faces.results)await sb('hewers_face_enrollments','POST',{workspace_id:owner,worker_id:f.worker_id,model:'face-api-1.7.15-ssd68-resnet128',descriptors:JSON.parse(f.descriptor),consent_record:f.consent,enrolled_by:f.actor,enrolled_at:f.created},'resolution=ignore-duplicates');
 for(const p of (row.state as State).photos){const key=new URL(p.url,'https://local').searchParams.get('key');if(!key||!key.startsWith(owner+'/'))throw Error('Legacy photo has an invalid workspace path');const old=await env.BUCKET!.get(key);if(!old)throw Error('An existing photo is missing. Migration stopped to protect your records.');await storedPhoto(key,'POST',await old.arrayBuffer(),old.httpMetadata?.contentType);await registerUpload(owner,p.siteId,key);}
 await syncTeamAccounts(owner);
 await sb('hewers_workspaces?id='+eq(owner),'PATCH',{migrated_at:new Date().toISOString()});
}
