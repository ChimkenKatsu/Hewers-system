import assert from 'node:assert/strict';import{createRequire}from'node:module';import{readFile,readdir}from'node:fs/promises';import{generateKeyPairSync}from'node:crypto';
const require=createRequire(import.meta.url),wranglerRequire=createRequire(require.resolve('wrangler/package.json')),{Miniflare}=wranglerRequire('miniflare');
const{privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});let sends=[];
const mf=new Miniflare({modules:true,scriptPath:'.sites-runtime/api-test-worker.mjs',compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{REMINDER_CRON_SECRET:'mock-reminder-secret',FCM_SERVICE_ACCOUNT_JSON:JSON.stringify({project_id:'hewers-system',client_email:'mock@example.test',private_key:privateKey.export({format:'pem',type:'pkcs8'})})},outboundService:async req=>{if(new URL(req.url).hostname==='oauth2.googleapis.com')return Response.json({access_token:'fake',expires_in:3600});const {message}=await req.json();assert.equal(message.data.kind,'missing-timeout');assert.equal(message.notification,undefined);assert.ok(!JSON.stringify(message).includes('Private Worker'));sends.push(message);return Response.json({name:'fixture-message'});}});
try{
 const db=await mf.getD1Database('DB');for(const f of(await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())for(const part of(await readFile('drizzle/'+f,'utf8')).split(';').map(s=>s.replaceAll('--> statement-breakpoint','').trim()).filter(Boolean))await db.prepare(part).run();
 const now=Date.now(),state={sites:[{id:'s',name:'Site',location:'Test',shiftEnd:'00:00'},{id:'other',name:'Other',location:'Test'}],workers:[{id:'w',name:'Private Worker',trade:'Mason',siteId:'s'}],attendance:[{id:'a',workerId:'w',siteId:'s',timeIn:new Date(now-48*3600000).toISOString(),timeOut:null,method:'Manual',note:''}],materials:[],movements:[],photos:[],audit:[]};
 await db.prepare('INSERT INTO workspaces(owner,state,revision) VALUES(?,?,0)').bind('owner',JSON.stringify(state)).run();
 for(const[id,role,sites,expiry]of[['auditor','auditor','["s"]',now+3600000],['other','auditor','["other"]',now+3600000],['admin','administrator','[]',now+3600000],['expired','auditor','["s"]',now-1]]){
  await db.prepare('INSERT INTO auth_user(id,name,email,created_at,updated_at,username,workspace_id,role,site_ids,must_change_password) VALUES(?,?,?,?,?,?,?,?,?,0)').bind(id,id,id+'@example.test',now,now,id,'owner',role,sites).run();
  await db.prepare('INSERT INTO auth_session(id,expires_at,token,created_at,updated_at,user_id) VALUES(?,?,?,?,?,?)').bind(id,expiry,id+'-session',now,now,id).run();
  await db.prepare('INSERT INTO push_device(token,user_id,session_id,updated_at) VALUES(?,?,?,?)').bind(id+'-device',id,id,now).run();
 }
 const call=(body={},authorized=true)=>mf.dispatchFetch('https://test.local/api/internal/attendance-reminders',{method:'POST',headers:{'Content-Type':'application/json',...(authorized?{Authorization:'Bearer mock-reminder-secret'}:{})},body:JSON.stringify(body)});
 assert.equal((await call({},false)).status,401);let r=await call({dryRun:true});assert.equal(r.status,200);assert.equal((await r.json()).due,1);assert.equal(sends.length,0);
 const results=await Promise.all([call(),call()]);for(const response of results)assert.equal(response.status,200,await response.clone().text());assert.equal(sends.length,1);assert.equal(sends[0].token,'auditor-device');
 await call();assert.equal(sends.length,1,'Repeated cron does not resend');
 state.attendance[0].timeOut=new Date().toISOString();await db.prepare('UPDATE workspaces SET state=? WHERE owner=?').bind(JSON.stringify(state),'owner').run();r=await call({dryRun:true});assert.equal((await r.json()).due,0);
 console.log('PASS: private scheduler authorization, dry run, active assigned auditor delivery, expired-session/admin exclusion, concurrent deduplication and resolved attendance. Mock Firebase/database only.');
}finally{await mf.dispose()}
