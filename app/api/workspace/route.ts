import {usesSupabase,sb,eq} from '../../supabase-server';
import {env} from 'cloudflare:workers';
import {applyOperation} from '../../operations';
import {authorize} from '../../permissions';
import {identity,context,payload,json,originCheck,commit,fail} from '../../server-access';
export async function GET(req:Request){try{
 const user=await identity(req);
 const ctx=await context(req);
 if(user.local)return json({...await payload(ctx),workspaces:[{id:user.local.workspaceId,label:'Hewers team workspace'}]});
 if(usesSupabase())return json({...await payload(ctx),workspaces:[{id:user.userId,label:'My workspace'}]});
 const rows=await env.DB!.prepare('SELECT owner,name,role FROM memberships WHERE active=1 AND (user_id=? OR (user_id IS NULL AND email=?))').bind(user.userId,user.email).all<any>();
 return json({...await payload(ctx),workspaces:[{id:user.userId,label:'My workspace'},...rows.results.map(m=>({id:m.owner,label:'Team workspace · '+m.role}))]});
}catch(e){return fail(e)}}
export async function POST(req:Request){try{
 originCheck(req);if(Number(req.headers.get('content-length'))>16384)throw Error('Request too large');
 const body=await req.json() as any,ctx=await context(req);
 if(ctx.revision!==body.revision)throw Error('CONFLICT: Workspace changed. Refresh and try again.');
 authorize(ctx.access,ctx.state,body.action,body.payload);
 if(body.action==='photo'){
  const key=new URL(body.payload.url,'https://local').searchParams.get('key');
  if(!key||!key.startsWith(ctx.access.owner+'/'))throw Error('FORBIDDEN: Photo belongs to another workspace');
  const photo=usesSupabase()?(await sb('hewers_photo_uploads?workspace_id='+eq(ctx.access.owner)+'&storage_path='+eq(key)+'&select=site_id')).map((p:any)=>({customMetadata:{siteId:p.site_id}}))[0]:await env.BUCKET!.head(key);if(!photo||photo.customMetadata?.siteId!==body.payload.siteId)throw Error('Photo does not belong to this site');
 }
 const state=applyOperation(ctx.state,body.action==='worker'&&ctx.access.role==='auditor'?'worker-request':body.action,body.payload,ctx.access.email);
 return json(await commit(ctx,state));
}catch(e){return fail(e)}}
