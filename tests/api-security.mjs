import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,readdir} from 'node:fs/promises';
const require=createRequire(import.meta.url),wranglerRequire=createRequire(require.resolve('wrangler/package.json'));
const {Miniflare}=wranglerRequire('miniflare');
const bindings=process.env.HEWERS_SUPABASE_TEST ? JSON.parse(await new Promise(resolve=>{let s='';process.stdin.on('data',d=>{s+=d;if(s.includes('\n')){process.stdin.pause();resolve(s)}});})) : {};
const mf=new Miniflare({bindings,...(process.env.HEWERS_SUPABASE_TEST?{outboundService:async r=>{const res=await fetch(r.url,{method:r.method,headers:Object.fromEntries(r.headers),body:['GET','HEAD'].includes(r.method)?undefined:await r.arrayBuffer()});return new Response([204,205,304].includes(res.status)?null:await res.arrayBuffer(),{status:res.status,headers:Object.fromEntries(res.headers)})}}:{}),modules:true,scriptPath:'.sites-runtime/api-test-worker.mjs',compatibilityDate:'2026-05-15',d1Databases:['DB'],r2Buckets:['BUCKET']});
try{
 const db=await mf.getD1Database('DB');for(const file of (await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort()){const sql=await readFile('drizzle/'+file,'utf8');for(const part of sql.split(';').map(x=>x.replaceAll('--> statement-breakpoint','').trim()).filter(Boolean))await db.prepare(part).run()}
 async function req(path,method='GET',body=null,user='hewers-integration-owner-2',workspace='hewers-integration-owner-2',email=user+'@example.test'){
 const headers={'oai-authenticated-user-id':user,'oai-authenticated-user-email':email,'x-workspace-id':workspace,'Origin':'http://test.local'};
 if(body)headers['Content-Type']='application/json';
 const r=await mf.dispatchFetch('http://test.local'+path,{method,headers,body:body?JSON.stringify(body):undefined});const b=await r.json();return {status:r.status,...b};
 }
 let result=await req('/api/workspace');assert.equal(result.status,200,JSON.stringify(result));let rev=result.revision;
 async function op(action,payload){const r=await req('/api/workspace','POST',{action,payload,revision:rev});assert.equal(r.status,200,JSON.stringify(r));rev=r.revision;return r.state}
 let state=await op('site',{name:'Site A',location:'Test'});const siteA=state.sites[0].id;
 state=await op('site',{name:'Site B',location:'Test'});const siteB=state.sites[1].id;
 state=await op('worker',{siteId:siteA,name:'Worker A',trade:'Mason'});const workerA=state.workers[0].id;
 state=await op('worker',{siteId:siteB,name:'Worker B',trade:'Mason'});const workerB=state.workers[1].id;
 result=await req('/api/staff','POST',{name:'Supervisor',email:'hewers-integration-staff@example.test',role:'supervisor',siteIds:[siteA]});assert.equal(result.status,200,JSON.stringify(result));
 result=await req('/api/workspace','GET',null,'hewers-integration-staff');assert.equal(result.status,200,JSON.stringify(result));assert.equal(result.access.role,'supervisor');assert.equal(result.state.workers.length,1);assert.equal(result.state.workers[0].id,workerA);assert.equal(result.state.sites.length,1);
 result=await req('/api/workspace','POST',{action:'attendance',payload:{workerId:workerB,type:'in',note:'Forged site'},revision:rev},'hewers-integration-staff');assert.equal(result.status,403);
 assert.equal((await req('/api/staff','GET',null,'hewers-integration-staff')).status,403);
 assert.equal((await req('/api/workspace','GET',null,'outsider')).status,403);
 assert.equal((await req('/api/workspace','GET',null,'')).status,401);
 assert.equal((await req('/api/face','POST',{action:'challenge',purpose:'enroll',workerId:workerB},'hewers-integration-staff')).status,403);
 const sample=Array(128).fill(.1),other=Array(128).fill(-.1),model='face-api-1.7.15-ssd68-resnet128';
 let challenge=await req('/api/face','POST',{action:'challenge',purpose:'enroll',workerId:workerA},'hewers-integration-staff');assert.equal(challenge.status,200);
 let submission={action:'submit',purpose:'enroll',workerId:workerA,model,samples:[sample,sample],consent:true,challenge:challenge.challenge};
 result=await req('/api/face','POST',submission,'hewers-integration-staff');assert.equal(result.status,200,JSON.stringify(result));
 assert.equal((await req('/api/face','POST',submission,'hewers-integration-staff')).status,400);
 const replacementChallenge=await req('/api/face','POST',{action:'challenge',purpose:'enroll',workerId:workerA},'hewers-integration-staff');
 assert.equal((await req('/api/face','POST',{...submission,samples:[other,other],challenge:replacementChallenge.challenge},'hewers-integration-staff')).status,422);
 assert.equal((await req('/api/workspace')).state.attendance.length,0);
 result=await req('/api/face','GET',null,'hewers-integration-staff');assert.equal(result.enrollments.length,1);assert.ok(!JSON.stringify(result).includes('descriptor'));
 challenge=await req('/api/face','POST',{action:'challenge',purpose:'in',workerId:workerA},'hewers-integration-staff');
 submission={action:'submit',purpose:'in',workerId:workerA,model,samples:[other,other],challenge:challenge.challenge};assert.equal((await req('/api/face','POST',submission,'hewers-integration-staff')).status,422);
 assert.equal((await req('/api/workspace')).state.attendance.length,0);
 challenge=await req('/api/face','POST',{action:'challenge',purpose:'in',workerId:workerA},'hewers-integration-staff');
 result=await req('/api/face','POST',{...submission,samples:[sample,sample],challenge:challenge.challenge},'hewers-integration-staff');assert.equal(result.status,200,JSON.stringify(result));assert.equal(result.state.attendance[0].method,'Face-assisted pilot');
 challenge=await req('/api/face','POST',{action:'challenge',purpose:'out',workerId:workerA},'hewers-integration-staff');
 result=await req('/api/face','POST',{...submission,purpose:'out',samples:[sample,sample],challenge:challenge.challenge},'hewers-integration-staff');assert.equal(result.status,200,JSON.stringify(result));assert.ok(result.state.attendance[0].timeOut);assert.equal(result.state.attendance[0].timeOutMethod,'Face-assisted pilot');
 // Exercise R2 uploads and site authorization against the actual handlers.
 async function upload(siteId,user='hewers-integration-staff'){
  const form=new FormData();form.append('siteId',siteId);form.append('file',new Blob([new Uint8Array([137,80,78,71,13,10,26,10])],{type:'image/png'}),'test.png');
  const encoded=new Request('http://test.local/api/photos',{method:'POST',body:form});
  const response=await mf.dispatchFetch('http://test.local/api/photos',{method:'POST',headers:{'oai-authenticated-user-id':user,'oai-authenticated-user-email':user+'@example.test','x-workspace-id':'hewers-integration-owner-2','Origin':'http://test.local','Content-Type':encoded.headers.get('content-type')},body:await encoded.arrayBuffer()});return {status:response.status,...await response.json()};
 }
 const restrictedUpload=await upload(siteB);assert.equal(restrictedUpload.status,403,JSON.stringify(restrictedUpload));
 const uploaded=await upload(siteA);assert.equal(uploaded.status,200,JSON.stringify(uploaded));
 const latest=await req('/api/workspace');rev=latest.revision;
 result=await req('/api/workspace','POST',{action:'photo',payload:{siteId:siteA,url:uploaded.url,caption:'Test evidence',category:'Delivery'},revision:rev},'hewers-integration-staff');assert.equal(result.status,200,JSON.stringify(result));
 const image=await mf.dispatchFetch('http://test.local'+uploaded.url,{headers:{'oai-authenticated-user-id':'hewers-integration-staff','oai-authenticated-user-email':'hewers-integration-staff@example.test'}});assert.equal(image.status,200);assert.equal(image.headers.get('Content-Type'),'image/png');
 const ownB=await upload(siteB,'hewers-integration-owner-2');assert.equal(ownB.status,200);rev=(await req('/api/workspace')).revision;
 result=await req('/api/workspace','POST',{action:'photo',payload:{siteId:siteB,url:ownB.url,caption:'Site B evidence',category:'Delivery'},revision:rev});assert.equal(result.status,200,JSON.stringify(result));
 const deniedPhoto=await mf.dispatchFetch('http://test.local'+ownB.url,{headers:{'oai-authenticated-user-id':'hewers-integration-staff','oai-authenticated-user-email':'hewers-integration-staff@example.test'}});assert.equal(deniedPhoto.status,403);
 result=await req('/api/staff');const member=result.members[0];assert.equal((await req('/api/staff','POST',{action:'revoke',id:member.id})).status,200);
 assert.equal((await req('/api/workspace','GET',null,'hewers-integration-staff')).status,403);
 assert.equal((await req('/api/face','GET',null,'hewers-integration-staff')).status,403);
 const badOrigin=await mf.dispatchFetch('http://test.local/api/workspace',{method:'POST',headers:{'oai-authenticated-user-id':'hewers-integration-owner-2','oai-authenticated-user-email':'owner@example.test','Origin':'https://evil.test','Content-Type':'application/json'},body:'{}'});assert.equal(badOrigin.status,403);
 console.log('PASS: '+(process.env.HEWERS_SUPABASE_TEST?'Supabase':'D1')+' API tests — staff assignment, shared read filtering, cross-site denial, outsider denial, admin-only staff API, face challenge replay rejection, failed match leaves no attendance, matched check-in/out, template metadata privacy, immediate revocation, R2 uploads, cross-site photo denial and CSRF denial.');
}finally{await mf.dispose()}

