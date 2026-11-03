import {admin,config,exchange,seal,unseal,db,connection,scope} from '../../../google-server';
import {originCheck} from '../../../server-access';
type ReturnState={owner:string;user:string;nonce:string;expires:number};
function cookie(req:Request,name:string){return (req.headers.get('cookie')||'').split(';').map(c=>c.trim()).find(c=>c.startsWith(name+'='))?.slice(name.length+1)||'';}
function validateReturn(req:Request,state:ReturnState){if(state.expires<Date.now()||cookie(req,'hewers_google_nonce')!==state.nonce)throw Error('Google authorization expired. Start again.');}
function failed(stage:string){return new Response(null,{status:303,headers:{Location:'/?google=failed&googleReason='+stage,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});}
export async function GET(req:Request){let stage='consent';try{
 const url=new URL(req.url);if(url.searchParams.has('error'))throw Error('Google authorization was cancelled');
 stage='state-decrypt';const state=await unseal<ReturnState>(url.searchParams.get('state')||'','google-oauth');stage=state.expires<Date.now()?'expired':'nonce';validateReturn(req,state);
 stage='code';const code=url.searchParams.get('code');if(!code||code.length>4096)throw Error('Google authorization code unavailable');
 // Commit a same-origin document before reading the login session. Some browser
 // contexts omit the app session cookie on a cross-site OAuth navigation.
 const pending=await seal({state,code,expires:Date.now()+180000},'google-return');
 const scriptNonce=crypto.randomUUID();
 return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Connecting Google | Hewers</title></head><body><main><h1>Finishing your Google connection…</h1><p>Keep this tab open while Hewers verifies your administrator account.</p><form id="finish" method="post" action="/api/google/callback"><button type="submit">Finish Google connection</button></form></main><script nonce="${scriptNonce}">history.replaceState(null,'','/api/google/callback');document.getElementById('finish').requestSubmit();</script></body></html>`,{headers:{'Content-Type':'text/html;charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'same-origin','X-Content-Type-Options':'nosniff','Content-Security-Policy':`default-src 'none'; script-src 'nonce-${scriptNonce}'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`,'Set-Cookie':'hewers_google_return='+pending+'; Path=/api/google/callback; HttpOnly; SameSite=Strict; Max-Age=180'+(url.protocol==='https:'?'; Secure':'')}});
}catch{return failed(stage)}}
export async function POST(req:Request){let stage='state';try{
 stage='origin';originCheck(req);
 stage='pending-cookie';if(!cookie(req,'hewers_google_return'))throw Error('Missing pending return');stage='pending-decrypt';const pending=await unseal<{state:ReturnState;code:string;expires:number}>(cookie(req,'hewers_google_return'),'google-return');
 stage='pending-expired';if(pending.expires<Date.now())throw Error('Google return expired');const {state,code}=pending;stage=state.expires<Date.now()?'expired':'nonce';validateReturn(req,state);
 stage='account';const headers=new Headers(req.headers);headers.set('x-workspace-id',state.owner);const ctx=await admin(new Request(req.url,{headers}));if(ctx.access.userId!==state.user)throw Error('Sign in with the administrator that started this connection');
 const old=await connection(state.owner);if(old?.lease&&old.lease>Date.now())throw Error('A sync is running. Wait before reconnecting.');
 stage='exchange';const result=await exchange({grant_type:'authorization_code',code,redirect_uri:config().GOOGLE_REDIRECT_URI!});stage='permissions';if(!result.refresh_token||!result.scope?.split(' ').includes(scope))throw Error('Google file access was not granted. Connect again and allow access.');
 const token=await seal({...result,expires_at:Date.now()+result.expires_in*1000},state.owner);
 // New consent may select a different Google account: never reuse its previous destinations.
 stage='save';await (await db()).prepare('INSERT INTO google_connections(owner,token) VALUES (?,?) ON CONFLICT(owner) DO UPDATE SET token=excluded.token,folder_id=NULL,sheet_id=NULL,last_sync=NULL').bind(state.owner,token).run();
 const responseHeaders=new Headers({Location:'/?google=connected','Cache-Control':'no-store','Referrer-Policy':'no-referrer'});
 responseHeaders.append('Set-Cookie','hewers_google_nonce=; Path=/api/google; HttpOnly; SameSite=Lax; Max-Age=0');responseHeaders.append('Set-Cookie','hewers_google_return=; Path=/api/google/callback; HttpOnly; SameSite=Strict; Max-Age=0');
 return new Response(null,{status:303,headers:responseHeaders});
}catch{return failed(stage)}}
