import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,readdir} from 'node:fs/promises';
import {generateKeyPairSync,verify} from 'node:crypto';
const require=createRequire(import.meta.url),wranglerRequire=createRequire(require.resolve('wrangler/package.json'));
const {Miniflare}=wranglerRequire('miniflare');
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const sends=[];let authCalls=0,unregistered=false;
const mf=new Miniflare({modules:true,scriptPath:'.sites-runtime/api-test-worker.mjs',compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{AUTH_SECRET:'push-test-secret-longer-than-32-characters',AUTH_BASE_URL:'http://test.local',TRUST_SITES_IDENTITY:'true',FCM_SERVICE_ACCOUNT_JSON:JSON.stringify({project_id:'hewers-system',client_email:'test@example.invalid',private_key:privateKey.export({type:'pkcs8',format:'pem'})})},outboundService:async req=>{
 const url=new URL(req.url);
 if(url.hostname==='oauth2.googleapis.com'){
  authCalls++;const form=new URLSearchParams(await req.text()),jwt=form.get('assertion'),[head,body,signature]=jwt.split('.');
  assert.ok(verify('RSA-SHA256',Buffer.from(head+'.'+body),publicKey,Buffer.from(signature,'base64url')));
  const claims=JSON.parse(Buffer.from(body,'base64url'));assert.equal(claims.scope,'https://www.googleapis.com/auth/firebase.messaging');
  return Response.json({access_token:'mock-fcm-access',expires_in:3600});
 }
 assert.equal(url.href,'https://fcm.googleapis.com/v1/projects/hewers-system/messages:send');
 assert.equal(req.headers.get('Authorization'),'Bearer mock-fcm-access');
 const {message}=await req.json();sends.push(message);
 assert.deepEqual(Object.keys(message.data).sort(),['eventId','kind']);
 assert.equal(message.android.priority,'high');
 if(unregistered)return Response.json({error:{details:[{errorCode:'UNREGISTERED'}]}},{status:404});
 return Response.json({name:'mock-message'});
}});
try{
 const db=await mf.getD1Database('DB');
 for(const file of (await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())for(const part of (await readFile('drizzle/'+file,'utf8')).split(';').map(s=>s.replaceAll('--> statement-breakpoint','').trim()).filter(Boolean))await db.prepare(part).run();
 const origin='http://test.local',owner='push-owner';
 const setupHeaders={Origin:origin,'oai-authenticated-user-id':owner,'oai-authenticated-user-email':'owner@example.test','Content-Type':'application/json'};
 const call=(path,body,cookie)=>mf.dispatchFetch(origin+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)});
 const seed={sites:[{id:'s',name:'Site',location:'Manila'}],workers:[],attendance:[],materials:[],movements:[],photos:[],audit:[],workerRequests:[]};
 await db.prepare('INSERT INTO workspaces(owner,state,revision) VALUES(?,?,0)').bind(owner,JSON.stringify(seed)).run();
 const provision=await mf.dispatchFetch(origin+'/api/accounts',{method:'POST',headers:setupHeaders,body:JSON.stringify({action:'provision',siteIds:['s']})});
 assert.equal(provision.status,200,await provision.clone().text());const {credentials}=await provision.json();
 async function login(username){
  const password=credentials.find(c=>c.username===username).password;
  const response=await call('/api/auth/sign-in/username',{username,password});assert.equal(response.status,200,await response.clone().text());
  let cookie=response.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
  const denied=await call('/api/push',{token:'test-device-token-before-password'},cookie);assert.equal(denied.status,403);
  const change=await call('/api/account/password',{currentPassword:password,newPassword:'Push-test-password-1234'},cookie);assert.equal(change.status,200,await change.clone().text());
  if(change.headers.getSetCookie().length)cookie=change.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
  return cookie;
 }
 const admin=await login('admin1'),auditor=await login('auditor1');
 assert.equal((await call('/api/push',{token:'test-device-token-11111'})).status,401);
 const forged=await mf.dispatchFetch(origin+'/api/push',{method:'POST',headers:{Origin:'https://evil.test',Cookie:admin,'Content-Type':'application/json'},body:JSON.stringify({token:'test-device-token-11111'})});assert.equal(forged.status,403);
 assert.equal((await call('/api/push',{token:'bad'},admin)).status,400);
 for(const [cookie,token] of [[admin,'admin-device-token-11111'],[auditor,'auditor-device-token-11111']])assert.equal((await call('/api/push',{token},cookie)).status,200);
 let r=await call('/api/workspace',{revision:0,action:'worker',payload:{name:'Private Worker Name',trade:'Mason',siteId:'s'}},auditor);
 assert.equal(r.status,200,await r.clone().text());let result=await r.json();const id=result.state.workerRequests[0].id;
 assert.deepEqual(sends.map(m=>m.token),['admin-device-token-11111']);assert.equal(sends[0].data.kind,'submitted');
 assert.ok(!JSON.stringify(sends).includes('Private Worker Name'));
 r=await call('/api/workspace',{revision:1,action:'worker-review',payload:{requestId:id,decision:'accepted'}},admin);assert.equal(r.status,200,await r.clone().text());
 assert.deepEqual(sends.map(m=>m.token),['admin-device-token-11111','auditor-device-token-11111']);assert.equal(sends[1].data.kind,'accepted');assert.equal(authCalls,1);
 // A stale duplicate write must not send a second decision.
 r=await call('/api/workspace',{revision:1,action:'worker-review',payload:{requestId:id,decision:'accepted'}},admin);assert.equal(r.status,409);assert.equal(sends.length,2);
 // Logout removes eligibility even if the token registration still exists.
 assert.equal((await call('/api/auth/sign-out',{},admin)).status,200);
 r=await call('/api/workspace',{revision:2,action:'worker',payload:{name:'Second Worker',trade:'Mason',siteId:'s'}},auditor);assert.equal(r.status,200,await r.clone().text());assert.equal(sends.length,2);
 // Switching account on this phone replaces its old binding, never duplicates it.
 assert.equal((await call('/api/push',{token:'admin-device-token-11111'},auditor)).status,200);
 const rebound=await db.prepare('SELECT u.username FROM push_device d JOIN auth_user u ON u.id=d.user_id WHERE d.token=?').bind('admin-device-token-11111').first();assert.equal(rebound.username,'auditor1');
 const loginAgain=await call('/api/auth/sign-in/username',{username:'admin1',password:'Push-test-password-1234'});assert.equal(loginAgain.status,200);
 const adminAgain=loginAgain.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
 assert.equal((await call('/api/push',{token:'replacement-admin-token-111'},adminAgain)).status,200);
 let revision=3;
 const requestAnother=()=>call('/api/workspace',{revision:revision++,action:'worker',payload:{name:'Fixture '+revision,trade:'Mason',siteId:'s'}},auditor);
 await db.prepare("UPDATE auth_user SET active=0 WHERE username='admin1'").run();
 assert.equal((await requestAnother()).status,200);assert.equal(sends.length,2,'Deactivated account receives nothing');
 await db.prepare("UPDATE auth_user SET active=1 WHERE username='admin1'").run();
 await db.prepare("UPDATE auth_session SET expires_at=1 WHERE user_id=(SELECT id FROM auth_user WHERE username='admin1')").run();
 assert.equal((await requestAnother()).status,200);assert.equal(sends.length,2,'Expired session receives nothing');
 await db.prepare("UPDATE auth_session SET expires_at=? WHERE user_id=(SELECT id FROM auth_user WHERE username='admin1')").bind(Date.now()+60000).run();
 unregistered=true;
 assert.equal((await requestAnother()).status,200,'Firebase failure must not change save success');assert.equal(sends.length,3);
 assert.equal(await db.prepare("SELECT token FROM push_device WHERE token='replacement-admin-token-111'").first(),null,'Permanent invalid token removed');
 console.log('PASS: signed OAuth, session-only registration, password/CSRF rejection, private role-scoped pushes, cached OAuth, commit conflict, logout and account switching. Mock Firebase only.');
}finally{await mf.dispose()}
