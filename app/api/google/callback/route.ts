import {admin,config,exchange,seal,unseal,db,connection,scope} from '../../../google-server';
export async function GET(req:Request){try{
 const url=new URL(req.url);if(url.searchParams.has('error'))throw Error('Google authorization was cancelled');
 const state=await unseal<{owner:string;user:string;nonce:string;expires:number}>(url.searchParams.get('state')||'','google-oauth');
 const cookies=(req.headers.get('cookie')||'').split(';').map(c=>c.trim());if(state.expires<Date.now()||!cookies.includes('hewers_google_nonce='+state.nonce))throw Error('Google authorization expired. Start again.');
 const headers=new Headers(req.headers);headers.set('x-workspace-id',state.owner);const ctx=await admin(new Request(req,{headers}));if(ctx.access.userId!==state.user)throw Error('Sign in with the workspace owner');
 const old=await connection(state.owner);if(old?.lease&&old.lease>Date.now())throw Error('A sync is running. Wait before reconnecting.');
 const result=await exchange({grant_type:'authorization_code',code:url.searchParams.get('code')||'',redirect_uri:config().GOOGLE_REDIRECT_URI!});if(!result.refresh_token||!result.scope?.split(' ').includes(scope))throw Error('Google file access was not granted. Connect again and allow access.');
 const token=await seal({...result,expires_at:Date.now()+result.expires_in*1000},state.owner);
 // New consent may select a different Google account: never reuse its previous destinations.
 await (await db()).prepare('INSERT INTO google_connections(owner,token) VALUES (?,?) ON CONFLICT(owner) DO UPDATE SET token=excluded.token,folder_id=NULL,sheet_id=NULL,last_sync=NULL').bind(state.owner,token).run();
 return new Response(null,{status:303,headers:{Location:'/?google=connected','Cache-Control':'no-store','Set-Cookie':'hewers_google_nonce=; Path=/api/google; HttpOnly; SameSite=Lax; Max-Age=0'}});
}catch{return new Response(null,{status:303,headers:{Location:'/?google=failed','Cache-Control':'no-store'}})}}
