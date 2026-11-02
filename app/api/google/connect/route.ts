import {admin,config,requireConfig,seal,scope} from '../../../google-server';
import {originCheck,fail} from '../../../server-access';
export async function POST(req:Request){try{
 originCheck(req);const form=await req.formData();const owner=String(form.get('workspaceId')||'');const headers=new Headers(req.headers);if(owner)headers.set('x-workspace-id',owner);const ctx=await admin(new Request(req.url,{headers}));requireConfig();
 const nonce=crypto.randomUUID();const state=await seal({owner:ctx.access.owner,user:ctx.access.userId,nonce,expires:Date.now()+600000},'google-oauth');
 const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');url.search=new URLSearchParams({client_id:config().GOOGLE_CLIENT_ID!,redirect_uri:config().GOOGLE_REDIRECT_URI!,response_type:'code',scope,access_type:'offline',prompt:'consent',state}).toString();
 return new Response(null,{status:303,headers:{Location:url.toString(),'Set-Cookie':'hewers_google_nonce='+nonce+'; Path=/api/google; HttpOnly; SameSite=Lax; Max-Age=600'+(new URL(req.url).protocol==='https:'?'; Secure':''),'Cache-Control':'no-store'}});
}catch(e){return fail(e)}}
