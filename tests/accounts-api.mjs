import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,readdir} from 'node:fs/promises';
const require=createRequire(import.meta.url),wranglerRequire=createRequire(require.resolve('wrangler/package.json')),{Miniflare}=wranglerRequire('miniflare');
const mf=new Miniflare({modules:true,scriptPath:'.sites-runtime/api-test-worker.mjs',compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{TRUST_SITES_IDENTITY:"true",AUTH_SECRET:'isolated-test-secret-with-at-least-32-characters',AUTH_BASE_URL:'http://test.local'}});
try{
 const db=await mf.getD1Database('DB');for(const f of (await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())for(const part of (await readFile('drizzle/'+f,'utf8')).split(';').map(s=>s.replaceAll('--> statement-breakpoint','').trim()).filter(Boolean))await db.prepare(part).run();
 const owner='team-owner',root={'oai-authenticated-user-id':owner,'oai-authenticated-user-email':'owner@example.test'};
 async function req(path,method='GET',body,headers={}){const r=await mf.dispatchFetch('http://test.local'+path,{method,redirect:'manual',headers:{Origin:'http://test.local','Content-Type':'application/json',...headers},body:body?JSON.stringify(body):undefined});return {r,b:await r.json()}}
 let {b}=await req('/api/workspace','GET',null,root),rev=b.revision;
 async function op(action,payload,headers=root){const {r,b}=await req('/api/workspace','POST',{action,payload,revision:rev},headers);assert.equal(r.status,200,JSON.stringify(b));rev=b.revision;return b.state}
 let state=await op('site',{name:'Assigned site',location:'Test'});const siteA=state.sites[0].id;state=await op('site',{name:'Other site',location:'Test'});const siteB=state.sites[1].id;
 let result=await req('/api/accounts','POST',{action:'provision',siteIds:[siteA]},root);assert.equal(result.r.status,200,JSON.stringify(result.b));const credentials=result.b.credentials;assert.equal(credentials.length,5);assert.equal(result.b.accounts.length,5);
 assert.equal((await req('/api/workspace','GET',null,root)).r.status,401,'Gateway setup identity must no longer bypass team sign-in');
 assert.equal((await req('/api/auth/sign-up/email','POST',{name:'Forged',email:'fake@example.test',password:'invalid-password',username:'fake'})).r.status,403);
 async function login(username){const c=credentials.find(x=>x.username===username);const res=await req('/api/auth/sign-in/username','POST',{username,password:c.password});assert.equal(res.r.status,200,JSON.stringify(res.b));return {Cookie:res.r.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ')};}
 let admin=await login('admin1'),auditor=await login('auditor1');
 assert.match((await req('/api/workspace','GET',null,admin)).b.error,/PASSWORD_REQUIRED/);
 async function change(username,headers){const c=credentials.find(x=>x.username===username);const res=await req('/api/account/password','POST',{currentPassword:c.password,newPassword:'New-personal-password-'+username},headers);assert.equal(res.r.status,200,JSON.stringify(res.b));return res.r.headers.getSetCookie().length?{Cookie:res.r.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ')}:headers;}
 admin=await change('admin1',admin);auditor=await change('auditor1',auditor);
 result=await req('/api/workspace','GET',null,auditor);assert.equal(result.r.status,200,JSON.stringify(result.b));assert.equal(result.b.access.role,'auditor');assert.deepEqual(result.b.state.sites.map(s=>s.id),[siteA]);rev=result.b.revision;
 assert.equal((await req('/api/accounts','GET',null,auditor)).r.status,403);
 assert.equal((await req('/api/google','GET',null,auditor)).r.status,403);
 assert.equal((await req('/api/workspace','GET',null,{...auditor,'x-workspace-id':'another-team'})).r.status,403);
 state=await op('worker',{name:'Awaiting Approval',trade:'Mason',siteId:siteA},auditor);assert.equal(state.workers.length,0);const pending=state.workerRequests[0];assert.equal(pending.status,'pending');
 assert.equal((await req('/api/face','POST',{action:'challenge',purpose:'enroll',workerId:pending.id},auditor)).r.status,400);
 assert.equal((await req('/api/workspace','POST',{action:'worker',payload:{name:'Forged',trade:'Mason',siteId:siteB},revision:rev},auditor)).r.status,403);
 assert.equal((await req('/api/workspace','POST',{action:'worker-review',payload:{requestId:pending.id,decision:'accepted'},revision:rev},auditor)).r.status,403);
 result=await req('/api/workspace','GET',null,admin);assert.equal(result.b.state.workerRequests[0].status,'pending');rev=result.b.revision;
 state=await op('worker-review',{requestId:pending.id,decision:'accepted'},admin);assert.equal(state.workers.length,1);assert.equal(state.workerRequests[0].reviewedBy,'admin1');
 assert.equal((await req('/api/workspace','POST',{action:'worker-review',payload:{requestId:pending.id,decision:'declined'},revision:rev},admin)).r.status,400);
 state=await op('material',{name:'Cement',unit:'bags',balance:10,minimum:2,siteId:siteA},admin);const material=state.materials[0];
 state=await op('movement',{materialId:material.id,type:'Delivery',quantity:5,note:'Auditor delivery'},auditor);assert.equal(state.materials[0].balance,15);
 state=await op('movement',{materialId:material.id,type:'Issue',quantity:3,note:'Auditor issue'},auditor);assert.equal(state.materials[0].balance,12);
 const accounts=(await req('/api/accounts','GET',null,admin)).b.accounts;const auditorId=accounts.find(a=>a.username==='auditor1').id;
 assert.equal((await req('/api/accounts','POST',{action:'disable',id:auditorId},admin)).r.status,200);assert.equal((await req('/api/workspace','GET',null,auditor)).r.status,401);
 const hashes=await db.prepare('SELECT password FROM auth_account').all();assert.ok(hashes.results.every(a=>credentials.every(c=>a.password!==c.password)));
 console.log('PASS: five distinct accounts, blocked signup, password hashing/first-login change, real sessions, setup bypass blocked, auditor site scope, pending notifications, admin review, double-review denial, and immediate account revocation.');
}finally{await mf.dispose()}
