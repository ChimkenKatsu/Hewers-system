import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler/package.json')),{Miniflare}=wr('miniflare');
const mf=new Miniflare({modules:true,scriptPath:'.sites-runtime/api-test-worker.mjs',compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET']});
try{
 for(const path of ['/api/workspace','/api/accounts','/api/face','/api/staff']){
  const r=await mf.dispatchFetch('https://hewers.example'+path,{headers:{'oai-authenticated-user-id':'forged-owner','oai-authenticated-user-email':'forged@example.test'}});
  assert.equal(r.status,401,path+' must reject forged setup headers on a public host');
 }
 console.log('PASS: hosted APIs reject forged identity headers without a named account session');
}finally{await mf.dispose();}
