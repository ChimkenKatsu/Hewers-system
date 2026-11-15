import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,readdir} from 'node:fs/promises';
const require=createRequire(import.meta.url),wranglerRequire=createRequire(require.resolve('wrangler/package.json')),{Miniflare}=wranglerRequire('miniflare');
const mf=new Miniflare({modules:true,scriptPath:'.sites-runtime/api-test-worker.mjs',compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{TRUST_SITES_IDENTITY:'true'}});
try{
 const db=await mf.getD1Database('DB');for(const f of(await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())for(const part of(await readFile('drizzle/'+f,'utf8')).split(';').map(s=>s.replaceAll('--> statement-breakpoint','').trim()).filter(Boolean))await db.prepare(part).run();
 const headers={Origin:'http://test.local','Content-Type':'application/json','oai-authenticated-user-id':'offline-owner','oai-authenticated-user-email':'admin@example.test'};
 async function call(path,body,extra={}){const r=await mf.dispatchFetch('http://test.local'+path,{method:body?'POST':'GET',headers:{...headers,...extra},body:body?JSON.stringify(body):undefined});return {status:r.status,b:await r.json()};}
 let result=await call('/api/workspace');result=await call('/api/workspace',{action:'site',payload:{name:'Offline sample site',location:'Test'},revision:result.b.revision});assert.equal(result.status,200);const siteId=result.b.state.sites[0].id;
 result=await call('/api/workspace',{action:'worker',payload:{siteId,name:'Sample worker',trade:'Mason'},revision:result.b.revision});assert.equal(result.status,200);const workerId=result.b.state.workers[0].id;
 const event={id:crypto.randomUUID(),owner:'offline-owner',userId:'offline-owner',workerId,type:'in',occurredAt:'2026-11-14T22:00:00Z',reason:'Offline manual entry test',schedule:{start:'06:00',end:'15:00',breakStart:'12:00',breakEnd:'13:00'}};
 const saved=await call('/api/offline-attendance',event);assert.equal(saved.status,200);assert.equal(saved.b.status,'pending');
 const state=await call('/api/workspace');assert.equal(state.b.state.attendance.length,0);assert.equal(state.b.state.offlineAttendance.length,1);
 const replay=await call('/api/offline-attendance',event);assert.equal(replay.status,200);assert.equal((await call('/api/workspace')).b.revision,state.b.revision,'Replay does not write again');
 const invalid=await call('/api/offline-attendance',{...event,userId:'someone-else'});assert.equal(invalid.status,403);
 assert.equal((await call('/api/offline-attendance',{...event,id:crypto.randomUUID()},{Origin:'https://untrusted.example'})).status,403);
 assert.equal((await call('/api/offline-attendance',{...event,type:'out'})).status,409);
 const self=await call('/api/workspace',{action:'offline-attendance-review',payload:{requestId:event.id,decision:'accepted'},revision:state.b.revision});assert.equal(self.status,400);assert.match(self.b.error,/Another administrator/);
 await db.prepare('INSERT INTO memberships(id,owner,email,user_id,name,role,site_ids,active,created) VALUES(?,?,?,?,?,?,?,1,?)').bind('reviewer-member','offline-owner','reviewer@example.test','reviewer-id','Second admin','administrator','[]',new Date().toISOString()).run();
 const reviewer={'oai-authenticated-user-id':'reviewer-id','oai-authenticated-user-email':'reviewer@example.test','x-workspace-id':'offline-owner'};
 let latest=await call('/api/workspace',undefined,reviewer);
 const accepted=await call('/api/workspace',{action:'offline-attendance-review',payload:{requestId:event.id,decision:'accepted'},revision:latest.b.revision},reviewer);assert.equal(accepted.status,200,JSON.stringify(accepted.b));assert.equal(accepted.b.state.attendance[0].timeIn,event.occurredAt);assert.equal(accepted.b.state.attendance[0].schedule.start,'06:00');
 const out={...event,id:crypto.randomUUID(),type:'out',occurredAt:'2026-11-15T06:00:00Z'};assert.equal((await call('/api/offline-attendance',out)).status,200);
 latest=await call('/api/workspace',undefined,reviewer);
 const closed=await call('/api/workspace',{action:'offline-attendance-review',payload:{requestId:out.id,decision:'accepted'},revision:latest.b.revision},reviewer);assert.equal(closed.status,200,JSON.stringify(closed.b));assert.equal(closed.b.state.attendance[0].timeOut,out.occurredAt);assert.match(closed.b.state.attendance[0].method,/Offline manual/);
 const replayAfterReview=await call('/api/offline-attendance',event);assert.equal(replayAfterReview.status,200);assert.equal(replayAfterReview.b.status,'accepted');
 console.log('PASS: offline HTTP sync through independent admin time-in/out approval, original timestamps and schedules, pending isolation, replay before/after review, account/site/origin checks and self-review denial');
}finally{await mf.dispose();}
