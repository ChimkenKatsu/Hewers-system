import {localSession} from './auth-server';
import {usesSupabase,sb,eq,rpc,members,ensureWorkspace} from './supabase-server';
import {env} from 'cloudflare:workers';
import {emptyState,State} from './model';
import {Access,Role,visibleState} from './permissions';
export const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function identity(req:Request){const session=await localSession(req);if(session){if(session.user.mustChangePassword)throw Error('PASSWORD_REQUIRED: Change your temporary password before opening the workspace');return {userId:session.user.id,email:session.user.username||session.user.email,local:session.user};}const userId=req.headers.get('oai-authenticated-user-id'),email=req.headers.get('oai-authenticated-user-email')?.toLowerCase().trim();if(!userId||!email)throw Error('AUTH');const provisioned=await env.DB!.prepare('SELECT count(*) AS n FROM auth_user WHERE workspace_id=?').bind(userId).first<{n:number}>();if(provisioned?.n)throw Error('AUTH');return {userId,email,local:null};}
export function originCheck(req:Request){if(req.headers.get('origin')!==new URL(req.url).origin)throw Error('FORBIDDEN: Invalid request origin')}
export function fail(e:any){const m=e.message||'Request failed';return json({error:m==='AUTH'?'Sign in to access your workspace':m},m==='AUTH'?401:m.startsWith('FORBIDDEN')||m.startsWith('PASSWORD_REQUIRED')?403:m.startsWith('CONFLICT')?409:m.startsWith('RATE')?429:400)}
export async function context(req:Request,requested?:string){
 const user=await identity(req);const owner=requested||req.headers.get('x-workspace-id')||user.local?.workspaceId||user.userId;
 if(user.local&&owner!==user.local.workspaceId)throw Error('FORBIDDEN: This account belongs to another workspace');
 if(usesSupabase()&&owner===user.userId)await ensureWorkspace(owner,user.email);
 let access:Access={owner,...user,role:'administrator',siteIds:[]};
 if(user.local){access={owner,userId:user.userId,email:user.email,role:user.local.role as Role,siteIds:JSON.parse(user.local.siteIds)};}else if(owner!==user.userId){
  const member=usesSupabase()?(await members(owner)).find(m=>m.active&&(m.user_id===user.userId||(!m.user_id&&m.email===user.email))):await env.DB!.prepare("SELECT * FROM memberships WHERE owner=? AND active=1 AND (user_id=? OR (user_id IS NULL AND email=?))").bind(owner,user.userId,user.email).first<any>();
  if(!member)throw Error('FORBIDDEN: You do not have access to this workspace');
  if(!member.user_id){const r=usesSupabase()?{meta:{changes:(await sb('hewers_staff?workspace_id='+eq(owner)+'&id='+eq(member.id)+'&user_id=is.null&active=eq.true','PATCH',{user_id:user.userId},'return=representation')).length}}:await env.DB!.prepare('UPDATE memberships SET user_id=? WHERE id=? AND user_id IS NULL AND active=1').bind(user.userId,member.id).run();if(!r.meta.changes)throw Error('CONFLICT: Membership changed. Reload.');}
  access={...access,role:member.role as Role,siteIds:JSON.parse(member.site_ids)};
 }
 const row=usesSupabase()?(await sb('hewers_workspaces?id='+eq(owner)+'&select=state,revision,migrated_at')).map((r:any)=>{if(!r.migrated_at)throw Error('The workspace owner must finish migration first');return {...r,state:JSON.stringify(r.state)}})[0]:await env.DB!.prepare('SELECT state,revision FROM workspaces WHERE owner=?').bind(owner).first<any>();
 if(!row){if(owner!==user.userId)throw Error('Workspace unavailable');await env.DB!.prepare('INSERT OR IGNORE INTO workspaces (owner,state,revision) VALUES (?,?,0)').bind(owner,JSON.stringify(emptyState())).run();const newRow=await env.DB!.prepare('SELECT state,revision FROM workspaces WHERE owner=?').bind(owner).first<any>();return {access,state:JSON.parse(newRow.state) as State,revision:newRow.revision as number};}
 return {access,state:JSON.parse(row.state) as State,revision:row.revision as number};
}
export async function commit(ctx:Awaited<ReturnType<typeof context>>,state:State){const result=usesSupabase()?{meta:{changes:await rpc('hewers_commit',{p_owner:ctx.access.owner,p_revision:ctx.revision,p_state:state})?1:0}}:await env.DB!.prepare('UPDATE workspaces SET state=?,revision=revision+1 WHERE owner=? AND revision=?').bind(JSON.stringify(state),ctx.access.owner,ctx.revision).run();if(!result.meta.changes)throw Error('CONFLICT: Workspace changed. Refresh and try again.');return {state:visibleState(state,ctx.access),revision:ctx.revision+1,actor:ctx.access.email,access:ctx.access};}
export async function payload(ctx:Awaited<ReturnType<typeof context>>){return {storageBackend:usesSupabase()?'Supabase':'Built-in storage',state:visibleState(ctx.state,ctx.access),revision:ctx.revision,actor:ctx.access.email,access:ctx.access};}
