import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,readdir} from 'node:fs/promises';
const require=createRequire(import.meta.url),wranglerRequire=createRequire(require.resolve('wrangler/package.json')),{Miniflare}=wranglerRequire('miniflare');
for(const mockSupabase of [false,true]){
 let persisted={sites:[],workers:[],attendance:[],materials:[],movements:[],photos:[],audit:[]},version=0;
 const mf=new Miniflare({modules:true,scriptPath:'.sites-runtime/api-test-worker.mjs',compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{TRUST_SITES_IDENTITY:'true',...(mockSupabase?{SUPABASE_URL:'https://supabase-fixture.test',SUPABASE_SECRET_KEY:'mock-only-secret'}:{})},...(mockSupabase?{outboundService:async req=>{
  const u=new URL(req.url);assert.equal(u.hostname,'supabase-fixture.test');
  if(u.pathname==='/rest/v1/hewers_workspaces'&&req.method==='GET')return Response.json([{id:'retry-owner',state:persisted,revision:version,migrated_at:'2026-11-01T00:00:00Z'}]);
  assert.equal(u.pathname,'/rest/v1/rpc/hewers_commit');const b=await req.json();if(b.p_revision!==version)return Response.json(false);persisted=b.p_state;version++;return Response.json(true);
 }}:{})});
 try{
  const db=await mf.getD1Database('DB');for(const f of(await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())for(const part of(await readFile('drizzle/'+f,'utf8')).split(';').map(s=>s.replaceAll('--> statement-breakpoint','').trim()).filter(Boolean))await db.prepare(part).run();
  async function call(body){const r=await mf.dispatchFetch('http://test.local/api/workspace',{method:body?'POST':'GET',headers:{Origin:'http://test.local','Content-Type':'application/json','oai-authenticated-user-id':'retry-owner','oai-authenticated-user-email':'sample@example.test'},body:body?JSON.stringify(body):undefined});return {status:r.status,b:await r.json()};}
  let result=await call();result=await call({action:'site',payload:{name:'Sample site',location:'Test'},revision:result.b.revision});assert.equal(result.status,200);const siteId=result.b.state.sites[0].id;
  result=await call({action:'material',payload:{siteId,name:'Cement',unit:'bags',balance:10,minimum:1},revision:result.b.revision});assert.equal(result.status,200);const materialId=result.b.state.materials[0].id;
  const submissionId=crypto.randomUUID(),payload={materialId,type:'Issue',quantity:2,note:'Same form retry'},request={action:'movement',payload,revision:result.b.revision,submissionId};
  assert.equal((await call({...request,submissionId:undefined})).status,400,'Older clients must refresh rather than submit without retry protection');
  const first=await call(request);assert.equal(first.status,200);assert.equal(first.b.state.materials[0].balance,8);assert.equal(first.b.state.movementReceipts,undefined,'Private receipts are not sent to clients');
  const replay=await call(request);assert.equal(replay.status,200);assert.equal(replay.b.replayed,true);assert.equal(replay.b.revision,first.b.revision);assert.equal(replay.b.state.materials[0].balance,8,'Stale-revision retry must not deduct stock again');
  const fresh=await call(),afterRefresh=await call({...request,revision:fresh.b.revision});assert.equal(afterRefresh.status,200);assert.equal(afterRefresh.b.state.materials[0].balance,8,'Background refresh must not make the retry a second movement');
  assert.equal((await call({...request,payload:{...payload,quantity:3},revision:fresh.b.revision})).status,409,'Reject key reuse with different details');
  const deliberate=await call({...request,submissionId:crypto.randomUUID(),revision:fresh.b.revision});assert.equal(deliberate.status,200);assert.equal(deliberate.b.state.materials[0].balance,6,'A new form can deliberately record the same quantity');
  const concurrentRequest={...request,submissionId:crypto.randomUUID(),revision:deliberate.b.revision,payload:{...payload,type:'Delivery',quantity:4}};
  const concurrent=await Promise.all([call(concurrentRequest),call(concurrentRequest),call(concurrentRequest)]);for(const r of concurrent)assert.equal(r.status,200,JSON.stringify(r.b));
  const final=await call();assert.equal(final.b.state.materials[0].balance,10);assert.equal(final.b.state.movements.filter(m=>m.type==='Delivery').length,1,'Concurrent retries produce one movement');
  const stored=mockSupabase?persisted:JSON.parse((await db.prepare('SELECT state FROM workspaces WHERE owner=?').bind('retry-owner').first()).state);assert.equal(stored.movementReceipts.length,3,'Receipts persist with committed state');
  assert.equal(stored.movementReceipts[0].movementId,first.b.state.movements.at(-1).id);
  if(!mockSupabase){
   await db.prepare('INSERT INTO memberships(id,owner,user_id,email,name,role,site_ids,created,active) VALUES(?,?,?,?,?,?,?,?,1)').bind('scope-test','retry-owner','staff','staff@example.test','Sample auditor','auditor','[]',new Date().toISOString()).run();
   const replayAsStaff=()=>mf.dispatchFetch('http://test.local/api/workspace',{method:'POST',headers:{Origin:'http://test.local','Content-Type':'application/json','oai-authenticated-user-id':'staff','oai-authenticated-user-email':'staff@example.test','x-workspace-id':'retry-owner'},body:JSON.stringify(request)});
   assert.equal((await replayAsStaff()).status,403,'Replays must still check current site permissions');
   await db.prepare('UPDATE memberships SET site_ids=? WHERE id=?').bind(JSON.stringify([siteId]),'scope-test').run();assert.equal((await replayAsStaff()).status,409,'A different account cannot reuse the submitter key');
  }
  console.log('PASS: '+(mockSupabase?'mock Supabase RPC':'isolated D1')+' — lost response, stale/fresh revision replay, changed payload denial, intentional new movement, concurrent retries, durable receipts and client privacy');
 }finally{await mf.dispose();}
}
