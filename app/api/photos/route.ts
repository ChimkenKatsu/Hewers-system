import {usesSupabase,storedPhoto,registerUpload} from '../../supabase-server';
import {env} from 'cloudflare:workers';
import {context,originCheck,json,fail} from '../../server-access';
import {authorize,requireSite} from '../../permissions';
export async function POST(req:Request){try{
 originCheck(req);const ctx=await context(req);
 if(Number(req.headers.get('content-length'))>9*1024*1024)return json({error:'Maximum upload is 8 MB'},413);
 const data=await req.formData(),file=data.get('file'),siteId=String(data.get('siteId')||'');authorize(ctx.access,ctx.state,'photo',{siteId});
 if(!(file instanceof File)||file.size>8*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Choose a JPG, PNG or WebP photo under 8 MB');
 const bytes=await file.arrayBuffer(),a=new Uint8Array(bytes);const valid=(file.type==='image/jpeg'&&a[0]===255&&a[1]===216&&a[2]===255)||(file.type==='image/png'&&a[0]===137&&a[1]===80&&a[2]===78&&a[3]===71)||(file.type==='image/webp'&&String.fromCharCode(...a.slice(0,4))==='RIFF'&&String.fromCharCode(...a.slice(8,12))==='WEBP');if(!valid)throw Error('Invalid image file');
 const key=ctx.access.owner+'/'+crypto.randomUUID();if(usesSupabase()){await storedPhoto(key,'POST',bytes,file.type);await registerUpload(ctx.access.owner,siteId,key)}else await env.BUCKET!.put(key,bytes,{httpMetadata:{contentType:file.type},customMetadata:{siteId}});
 return json({url:'/api/photos?key='+encodeURIComponent(key)});
}catch(e){return fail(e)}}
export async function GET(req:Request){try{
 const key=new URL(req.url).searchParams.get('key');if(!key||!key.includes('/'))throw Error('Photo not found');
 const owner=key.split('/')[0],ctx=await context(req,owner);
 const record=ctx.state.photos.find(p=>new URL(p.url,'https://local').searchParams.get('key')===key);if(!record)throw Error('Photo not found');requireSite(ctx.access,record.siteId);
 if(usesSupabase()){const r=await storedPhoto(key);return new Response(r.body,{headers:{'Content-Type':r.headers.get('Content-Type')||'application/octet-stream','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}})}
 const obj=await env.BUCKET!.get(key);if(!obj)return new Response('Not found',{status:404});return new Response(obj.body,{headers:{'Content-Type':obj.httpMetadata?.contentType||'application/octet-stream','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}catch(e){return fail(e)}}
