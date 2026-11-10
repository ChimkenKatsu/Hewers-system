import assert from 'node:assert/strict';import{createRequire}from'node:module';import{readFile,readdir}from'node:fs/promises';
const require=createRequire(import.meta.url),wranglerRequire=createRequire(require.resolve('wrangler/package.json')),{Miniflare}=wranglerRequire('miniflare');
for(const mockSupabase of [false,true]){
 let state={sites:[],workers:[],attendance:[],materials:[],movements:[],photos:[],audit:[]},revision=0;const objects=new Map(),metadata=new Map();
 const mf=new Miniflare({modules:true,scriptPath:'.sites-runtime/photo-upload-worker.mjs',compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{TRUST_SITES_IDENTITY:'true',...(mockSupabase?{SUPABASE_URL:'https://supabase-fixture.test',SUPABASE_SECRET_KEY:'mock-only-secret'}:{})},...(mockSupabase?{outboundService:async req=>{
  const u=new URL(req.url);assert.equal(u.hostname,'supabase-fixture.test');const path=u.pathname;
  if(path==='/rest/v1/hewers_workspaces')return Response.json([{id:'photo-owner',state,revision,migrated_at:'2026-11-01T00:00:00Z'}]);
  if(path==='/rest/v1/rpc/hewers_commit'){const b=await req.json();if(b.p_revision!==revision)return Response.json(false);state=b.p_state;revision++;return Response.json(true)}
  if(path==='/rest/v1/hewers_photo_uploads'){if(req.method==='POST'){const b=await req.json();metadata.set(b.storage_path,b);return Response.json([b])}const key=u.searchParams.get('storage_path')?.slice(3);if(req.method==='DELETE'){metadata.delete(key);return new Response(null,{status:204})}return Response.json(metadata.has(key)?[metadata.get(key)]:[])}
  const prefix='/storage/v1/object/hewers-site-photos';if(path===prefix&&req.method==='DELETE'){const b=await req.json();for(const key of b.prefixes)objects.delete(key);return Response.json([])}
  if(path.startsWith(prefix+'/')){const key=decodeURIComponent(path.slice(prefix.length+1));if(req.method==='POST'){objects.set(key,await req.arrayBuffer());return Response.json({})}return objects.has(key)?new Response(objects.get(key),{headers:{'Content-Type':'image/png'}}):new Response(null,{status:404})}
  throw Error('Unexpected fixture request '+path);
 }}:{})});
 try{
  const db=await mf.getD1Database('DB');for(const f of(await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())for(const part of(await readFile('drizzle/'+f,'utf8')).split(';').map(s=>s.replaceAll('--> statement-breakpoint','').trim()).filter(Boolean))await db.prepare(part).run();const bucket=await mf.getR2Bucket('BUCKET');
  const headers={Origin:'http://test.local','oai-authenticated-user-id':'photo-owner','oai-authenticated-user-email':'sample@example.test'};
  async function call(path='/api/workspace',body){const r=await mf.dispatchFetch('http://test.local'+path,{method:body?'POST':'GET',headers:{...headers,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:r.status,b:await r.json()};}
  const count=async()=>mockSupabase?objects.size:(await bucket.list()).objects.length;
  const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
  let r=await call();r=await call('/api/workspace',{action:'site',payload:{name:'Sample site',location:'Test'},revision:r.b.revision});const siteId=r.b.state.sites[0].id;
  async function upload(id=crypto.randomUUID(),fileBytes=bytes,site=siteId){const fd=new FormData();fd.append('uploadId',id);fd.append('siteId',site);fd.append('file',new File([fileBytes],'sample.png',{type:'image/png'}));const encoded=new Request('http://test.local/api/photos',{method:'POST',body:fd});const response=await mf.dispatchFetch(encoded.url,{method:'POST',headers:{...headers,'Content-Type':encoded.headers.get('content-type')},body:await encoded.arrayBuffer()});return {status:response.status,b:await response.json()};}
  const id=crypto.randomUUID(),first=await upload(id);assert.equal(first.status,200,JSON.stringify(first.b));assert.equal((await upload(id)).b.url,first.b.url,'A lost upload response must reuse the same object');assert.equal(await count(),1);
  assert.equal((await upload(id,Buffer.concat([bytes,Buffer.from('different')]))).status,409,'Do not reuse an upload ID for different file bytes');
  if(!mockSupabase){
   await db.prepare('INSERT INTO memberships(id,owner,user_id,email,name,role,site_ids,created,active) VALUES(?,?,?,?,?,?,?,?,1)').bind('other-operator','photo-owner','other-user','other@example.test','Other operator','auditor',JSON.stringify([siteId]),new Date().toISOString()).run();
   const foreign=await mf.dispatchFetch('http://test.local/api/workspace',{method:'POST',headers:{Origin:'http://test.local','Content-Type':'application/json','oai-authenticated-user-id':'other-user','oai-authenticated-user-email':'other@example.test','x-workspace-id':'photo-owner'},body:JSON.stringify({action:'photo',payload:{siteId,url:first.b.url,caption:'Foreign claim',category:'Delivery'},revision:r.b.revision})});assert.equal(foreign.status,403,'An operator cannot attach another account pending upload');
  }
  const originalRevision=r.b.revision;const other=await call('/api/workspace',{action:'site',payload:{name:'Concurrent update',location:'Test'},revision:originalRevision});
  const payload={siteId,url:first.b.url,caption:'Test evidence',category:'Delivery'};r=await call('/api/workspace',{action:'photo',payload,revision:originalRevision});assert.equal(r.status,409);
  const retry=await upload(id);assert.equal(retry.b.url,first.b.url);assert.equal(await count(),1);r=await call('/api/workspace',{action:'photo',payload,revision:other.b.revision});assert.equal(r.status,200,JSON.stringify(r.b));assert.equal(r.b.state.photos.length,1);
  const replay=await call('/api/workspace',{action:'photo',payload,revision:originalRevision});assert.equal(replay.status,200);assert.equal(replay.b.replayed,true);assert.equal(replay.b.state.photos.length,1,'A lost record-save response must not create a second photo');
  const now=Date.now(),old=now-8*86400000,key=new URL(first.b.url,'https://local').searchParams.get('key');await db.prepare("UPDATE photo_upload_attempts SET status='ready',updated_at=? WHERE storage_key=?").bind(old,key).run();
  const abandonedId=crypto.randomUUID(),abandoned=await upload(abandonedId),abandonedKey=new URL(abandoned.b.url,'https://local').searchParams.get('key');await db.prepare('UPDATE photo_upload_attempts SET updated_at=? WHERE storage_key=?').bind(old,abandonedKey).run();
  const active=await upload(),activeKey=new URL(active.b.url,'https://local').searchParams.get('key');await db.prepare("UPDATE photo_upload_attempts SET status='committing',updated_at=? WHERE storage_key=?").bind(old,activeKey).run();assert.equal(await count(),3);
  assert.equal((await call('/__test/photo-cleanup',{now,dryRun:true})).b.removed,0);assert.equal(await count(),3);
  assert.equal((await call('/__test/photo-cleanup',{now})).b.removed,1);assert.equal(await count(),2,'Saved references and in-progress commits must remain');
  assert.equal((await mf.dispatchFetch('http://test.local'+first.b.url,{headers})).status,200);
  const expired=await call('/api/workspace',{action:'photo',payload:{...payload,url:abandoned.b.url,caption:'Abandoned draft'},revision:r.b.revision});assert.equal(expired.status,400);assert.match(expired.b.error,/PHOTO_UPLOAD_EXPIRED/);
  const renewed=await upload(abandonedId);assert.equal(renewed.status,200);assert.equal(renewed.b.url,abandoned.b.url);assert.equal(await count(),3,'Expired drafts reupload to the same storage key');
  const latest=await call();const completed=await call('/api/workspace',{action:'photo',payload:{...payload,url:renewed.b.url,caption:'Recovered draft'},revision:latest.b.revision});assert.equal(completed.status,200,JSON.stringify(completed.b));
  const race=await upload(),raceKey=new URL(race.b.url,'https://local').searchParams.get('key');await db.prepare('UPDATE photo_upload_attempts SET updated_at=? WHERE storage_key=?').bind(old,raceKey).run();
  const snapshot=await call();await Promise.all([call('/__test/photo-cleanup',{now}),call('/api/workspace',{action:'photo',payload:{...payload,url:race.b.url,caption:'Racing save'},revision:snapshot.b.revision})]);
  const afterRace=await call();if(afterRace.b.state.photos.some(p=>p.url===race.b.url)){assert.equal((await mf.dispatchFetch('http://test.local'+race.b.url,{headers})).status,200,'Cleanup must never delete a photo committed concurrently');}
  console.log('PASS: '+(mockSupabase?'mock Supabase storage/RPC':'isolated D1/R2')+' — upload retry deduplication, byte binding, save conflict retry, duplicate save replay, seven-day cleanup, referenced/in-progress protection and expired draft recovery');
 }finally{await mf.dispose();}
}
