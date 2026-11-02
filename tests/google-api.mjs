import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,readdir} from 'node:fs/promises';
const require=createRequire(import.meta.url),wranglerRequire=createRequire(require.resolve('wrangler/package.json'));
const {Miniflare}=wranglerRequire('miniflare');
const writes=[],uploads=[];let photoSaved=false,refreshes=0;
const json=(b,status=200)=>Response.json(b,{status});
const mf=new Miniflare({modules:true,scriptPath:'.sites-runtime/api-test-worker.mjs',compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{GOOGLE_CLIENT_ID:'test-client',GOOGLE_CLIENT_SECRET:'test-secret',GOOGLE_REDIRECT_URI:'https://test.local/api/google/callback',GOOGLE_TOKEN_KEY:Buffer.alloc(32,9).toString('base64')},outboundService:async req=>{
 const u=new URL(req.url);if(u.hostname==='oauth2.googleapis.com'){refreshes++;return json({access_token:'test-access',refresh_token:'test-refresh',expires_in:3600,scope:'https://www.googleapis.com/auth/drive.file'})}
 assert.ok(['www.googleapis.com','sheets.googleapis.com'].includes(u.hostname),'Unexpected outbound request');assert.equal(req.headers.get('Authorization'),'Bearer test-access');
 if(u.pathname==='/drive/v3/files'&&req.method==='GET')return json({files:u.searchParams.get('q')?.includes('hewersPhoto')&&photoSaved?[{id:'photo-1'}]:[]});
 if(u.pathname==='/drive/v3/files'&&req.method==='POST'){const b=await req.json();return json({id:b.mimeType==='application/vnd.google-apps.folder'?'folder-1':'sheet-1'})}
 if(u.pathname==='/v4/spreadsheets/sheet-1'&&req.method==='GET')return json({sheets:[]});
 if(u.pathname==='/v4/spreadsheets/sheet-1/values:batchUpdate'){writes.push(await req.json());return json({})}
 if(u.pathname==='/upload/drive/v3/files'){return new Response(null,{status:200,headers:{Location:'https://www.googleapis.com/upload/session-1'}})}
 if(u.pathname==='/upload/session-1'){uploads.push(new Uint8Array(await req.arrayBuffer()));photoSaved=true;return json({id:'photo-1'})}
 if(req.method==='POST'&&u.hostname==='sheets.googleapis.com')return json({});
 throw Error('Unexpected Google route '+u.pathname);
}});
try{
 const db=await mf.getD1Database('DB');for(const f of (await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())for(const part of (await readFile('drizzle/'+f,'utf8')).split(';').map(s=>s.replaceAll('--> statement-breakpoint','').trim()).filter(Boolean))await db.prepare(part).run();
 const owner='google-owner',headers={'oai-authenticated-user-id':owner,'oai-authenticated-user-email':'owner@example.test',Origin:'http://test.local'};
 async function req(path,method='GET',body,extra={}){return mf.dispatchFetch('http://test.local'+path,{method,redirect:'manual',headers:{...headers,...(body?{'Content-Type':'application/json'}:{}),...extra},body:body?JSON.stringify(body):undefined})}
 assert.equal((await req('/api/workspace')).status,200);
 let r=await req('/api/google');assert.equal(r.status,200);assert.equal((await r.json()).connected,false);
 assert.equal((await req('/api/google/connect','POST',null,{Origin:'https://evil.test'})).status,403);
 const connect=await mf.dispatchFetch('http://test.local/api/google/connect',{method:'POST',redirect:'manual',headers:{...headers,'Content-Type':'application/x-www-form-urlencoded'},body:''});assert.equal(connect.status,303,(await connect.clone().text()).slice(0,500));
 const consent=new URL(connect.headers.get('Location'));assert.equal(consent.hostname,'accounts.google.com');assert.equal(consent.searchParams.get('scope'),'https://www.googleapis.com/auth/drive.file');
 const state=consent.searchParams.get('state'),cookie=connect.headers.get('Set-Cookie').split(';')[0];
 r=await req('/api/google/callback?code=mock-code&state='+encodeURIComponent(state));assert.equal(r.headers.get('Location'),'/?google=failed');assert.equal(refreshes,0);
 r=await req('/api/google/callback?code=mock-code&state='+encodeURIComponent(state),'GET',null,{Cookie:cookie});assert.equal(r.headers.get('Location'),'/?google=connected');
 const saved=await db.prepare('SELECT token FROM google_connections WHERE owner=?').bind(owner).first();assert.ok(!saved.token.includes('test-refresh'));assert.ok(!saved.token.includes('test-access'));
 const snapshot={sites:[{id:'s',name:'Site A',location:'Test'}],workers:[{id:'w',name:'Worker A',trade:'Mason',siteId:'s'}],attendance:[{id:'a',workerId:'w',siteId:'s',timeIn:'2026-11-02T00:00:00Z',timeOut:null,method:'Manual',note:'private'}],materials:[{id:'m',name:'Cement',siteId:'s',unit:'bags',balance:3,minimum:5}],movements:[],photos:[{id:'p',siteId:'s',caption:'Site photo',category:'Delivery',url:'/api/photos?key=google-owner%2Fp',created:'2026-11-02T00:00:00Z',actor:'owner',transactionId:''}],audit:[]};
 await db.prepare('UPDATE workspaces SET state=? WHERE owner=?').bind(JSON.stringify(snapshot),owner).run();const bucket=await mf.getR2Bucket('BUCKET');await bucket.put('google-owner/p',new Uint8Array([1,2,3]),{httpMetadata:{contentType:'image/png'}});
 r=await req('/api/google','POST',{action:'sync'});let result=await r.json();assert.equal(r.status,200,JSON.stringify(result));assert.equal(uploads.length,1);assert.equal(writes[0].valueInputOption,'RAW');assert.equal(writes[0].data[0].values[1][1],'Worker A');assert.ok(!JSON.stringify(writes).includes('private'));
 r=await req('/api/google','POST',{action:'sync'});assert.equal(r.status,200,JSON.stringify(await r.json()));assert.equal(uploads.length,1,'Repeated sync must skip copied photos');
 r=await req('/api/google');result=await r.json();assert.equal(result.connected,true);assert.ok(result.lastSync);assert.equal(result.sheetUrl,'https://docs.google.com/spreadsheets/d/sheet-1');
 await db.prepare('INSERT INTO memberships(id,owner,email,user_id,name,role,site_ids,active,created) VALUES(?,?,?,?,?,?,?,?,?)').bind('staff',owner,'staff@example.test','staff','Supervisor','supervisor','["s"]',1,new Date().toISOString()).run();
 assert.equal((await req('/api/google','GET',null,{'oai-authenticated-user-id':'staff','oai-authenticated-user-email':'staff@example.test','x-workspace-id':owner})).status,403);
 assert.equal((await req('/api/google','POST',{action:'disconnect'})).status,200);assert.equal((await (await req('/api/google')).json()).connected,false);
 console.log('PASS: mocked Google OAuth, nonce rejection, encrypted token storage, owner-only access, RAW report export, photo copy/deduplication, completion status and disconnect. No live Google connection was used.');
}finally{await mf.dispose()}

