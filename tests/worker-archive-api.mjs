import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,readdir} from 'node:fs/promises';
const require=createRequire(import.meta.url),wranglerRequire=createRequire(require.resolve('wrangler/package.json')),{Miniflare}=wranglerRequire('miniflare');
const original={sites:[{id:'s',name:'Site',location:'Test'}],workers:[{id:'w',name:'Fixture Worker',trade:'Mason',siteId:'s'}],attendance:[{id:'a',workerId:'w',siteId:'s',timeIn:'2026-11-05T00:00:00Z',timeOut:'2026-11-05T08:00:00Z',method:'Manual',note:'Keep history'}],materials:[],movements:[],photos:[],audit:[]};
let saved=structuredClone(original),revision=0,commits=0;
const mf=new Miniflare({modules:true,scriptPath:'.sites-runtime/api-test-worker.mjs',compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{TRUST_SITES_IDENTITY:'true',SUPABASE_URL:'https://supabase-fixture.test',SUPABASE_SECRET_KEY:'mock-only-secret'},outboundService:async req=>{
 const url=new URL(req.url);assert.equal(url.hostname,'supabase-fixture.test');
 if(url.pathname==='/rest/v1/hewers_workspaces'&&req.method==='GET')return Response.json([{id:'owner',state:saved,revision,migrated_at:'2026-11-01T00:00:00Z'}]);
 assert.equal(url.pathname,'/rest/v1/rpc/hewers_commit');
 const body=await req.json();assert.equal(body.p_owner,'owner');if(body.p_revision!==revision)return Response.json(false);
 saved=body.p_state;revision++;commits++;return Response.json(true);
}});
try{
 const db=await mf.getD1Database('DB');for(const f of (await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())for(const part of (await readFile('drizzle/'+f,'utf8')).split(';').map(s=>s.replaceAll('--> statement-breakpoint','').trim()).filter(Boolean))await db.prepare(part).run();
 async function call(action,rev=revision){return mf.dispatchFetch('http://test.local/api/workspace',{method:action?'POST':'GET',headers:{Origin:'http://test.local','Content-Type':'application/json','oai-authenticated-user-id':'owner','oai-authenticated-user-email':'admin@example.test'},body:action?JSON.stringify({action,payload:{workerId:'w'},revision:rev}):undefined})}
 let response=await call('worker-archive');assert.equal(response.status,200,await response.clone().text());assert.ok(saved.workers[0].archivedAt);assert.equal(commits,1);assert.deepEqual(saved.attendance,original.attendance);
 response=await call();const reloaded=await response.json();assert.ok(reloaded.state.workers[0].archivedAt,'Reload reads saved archive from database state');assert.equal(reloaded.state.workers[0].name,'Fixture Worker');
 response=await call('worker-restore',0);assert.equal(response.status,409);assert.equal(commits,1);
 response=await call('worker-restore');assert.equal(response.status,200);assert.equal(saved.workers[0].archivedAt,undefined);assert.deepEqual(saved.attendance,original.attendance);assert.equal(saved.audit.length,2);
 console.log('PASS: archive/restore persisted through Supabase commit RPC, fresh reload, preserved attendance, stale revision rejection. Mock database only.');
}finally{await mf.dispose()}
