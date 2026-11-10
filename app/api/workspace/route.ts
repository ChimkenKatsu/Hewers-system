import {recordedPhoto,claimPhoto,finishPhotoClaim} from '../../photo-uploads-server';
import {usesSupabase,sb,eq} from '../../supabase-server';
import {env} from 'cloudflare:workers';
import {movementSubmission,savedMovementSubmission} from '../../movement-submissions';
import {applyOperation} from '../../operations';
import {authorize} from '../../permissions';
import {identity,context,payload,json,originCheck,commit,fail} from '../../server-access';
import {sendWorkerPush} from '../../push-server';
export async function GET(req:Request){try{
 const user=await identity(req);
 const ctx=await context(req);
 if(user.local)return json({...await payload(ctx),workspaces:[{id:user.local.workspaceId,label:'Hewers team workspace'}]});
 if(usesSupabase())return json({...await payload(ctx),workspaces:[{id:user.userId,label:'My workspace'}]});
 const rows=await env.DB!.prepare('SELECT owner,name,role FROM memberships WHERE active=1 AND (user_id=? OR (user_id IS NULL AND email=?))').bind(user.userId,user.email).all<any>();
 return json({...await payload(ctx),workspaces:[{id:user.userId,label:'My workspace'},...rows.results.map(m=>({id:m.owner,label:'Team workspace · '+m.role}))]});
}catch(e){return fail(e)}}
export async function POST(req:Request){let photoClaim:string|undefined,claimedPhotoKey='';try{
 originCheck(req);if(Number(req.headers.get('content-length'))>16384)throw Error('Request too large');
 const body=await req.json() as any,ctx=await context(req);
 authorize(ctx.access,ctx.state,body.action,body.payload);
 const submission=body.action==='movement'?await movementSubmission(body.submissionId,ctx.access.userId,body.payload):undefined;
 if(submission){const saved=savedMovementSubmission(ctx.state,submission);if(saved)return json({...await payload(ctx),replayed:true,movementId:saved.movementId});}
 if(body.action==='photo'){const saved=recordedPhoto(ctx.state,body.payload);if(saved)return json({...await payload(ctx),replayed:true,photoId:saved.id});}
 if(ctx.revision!==body.revision)throw Error('CONFLICT: Workspace changed. Refresh and try again.');
 if(body.action==='photo'){
  const key=new URL(body.payload.url,'https://local').searchParams.get('key');
  if(!key||!key.startsWith(ctx.access.owner+'/'))throw Error('FORBIDDEN: Photo belongs to another workspace');
  claimedPhotoKey=key;photoClaim=await claimPhoto(key,ctx.access,body.payload.siteId);
  const photo=usesSupabase()?(await sb('hewers_photo_uploads?workspace_id='+eq(ctx.access.owner)+'&storage_path='+eq(key)+'&select=site_id')).map((p:any)=>({customMetadata:{siteId:p.site_id}}))[0]:await env.BUCKET!.head(key);if(!photo||photo.customMetadata?.siteId!==body.payload.siteId)throw Error('Photo does not belong to this site');
 }
 const state=applyOperation(ctx.state,body.action==='worker'&&ctx.access.role==='auditor'?'worker-request':body.action,body.payload,ctx.access.email,new Date().toISOString(),ctx.access.userId);
 if(submission){state.movementReceipts??=[];state.movementReceipts.push({...submission,movementId:state.movements.at(-1)!.id});}
 let result;
 try{result=await commit(ctx,state)}catch(e){
  // The receipt and balance share the same revision-checked atomic commit.
  // A concurrent retry can safely recover the first committed result.
  if(submission&&e instanceof Error&&e.message.startsWith('CONFLICT')){const latest=await context(req);authorize(latest.access,latest.state,body.action,body.payload);const saved=savedMovementSubmission(latest.state,submission);if(saved)return json({...await payload(latest),replayed:true,movementId:saved.movementId});}
  if(body.action==='photo'&&e instanceof Error&&e.message.startsWith('CONFLICT')){const latest=await context(req);authorize(latest.access,latest.state,body.action,body.payload);const saved=recordedPhoto(latest.state,body.payload);if(saved){await finishPhotoClaim(claimedPhotoKey,photoClaim,true);photoClaim=undefined;return json({...await payload(latest),replayed:true,photoId:saved.id});}}
  throw e;
 }
 await finishPhotoClaim(claimedPhotoKey,photoClaim,true);photoClaim=undefined;
 await sendWorkerPush(ctx.access.owner,ctx.state,state);
 return json(result);
}catch(e){await finishPhotoClaim(claimedPhotoKey,photoClaim,false);return fail(e)}}
