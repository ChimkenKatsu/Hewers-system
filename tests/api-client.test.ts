import assert from 'node:assert/strict';import {readApiJson,loadFaceEnrollments,ApiResponseError} from '../app/api-client';
assert.deepEqual(await readApiJson(Response.json({ok:true})),{ok:true});
await assert.rejects(()=>readApiJson(new Response('<!DOCTYPE html>Cloudflare 1102',{status:500,headers:{'content-type':'text/html'}})),e=>e instanceof ApiResponseError&&e.retryable&&e.message.includes('HTTP 500')&&!e.message.includes('DOCTYPE'));
const original=globalThis.fetch;let calls=0;
try{globalThis.fetch=async()=>{calls++;return calls===1?new Response('<!DOCTYPE html>',{status:500,headers:{'content-type':'text/html'}}):Response.json({enrollments:[]})};assert.deepEqual(await loadFaceEnrollments('test'),{enrollments:[]});assert.equal(calls,2);
 calls=0;globalThis.fetch=async()=>{calls++;return Response.json({error:'Sign in to access your workspace'},{status:401})};await assert.rejects(()=>loadFaceEnrollments('test'),/Sign in/);assert.equal(calls,1,'Never retry an authentication rejection');
 calls=0;globalThis.fetch=async()=>{calls++;return new Response('<!DOCTYPE html>',{status:500,headers:{'content-type':'text/html'}})};await assert.rejects(()=>loadFaceEnrollments('test'),/temporarily unavailable/);assert.equal(calls,2,'Bound retries during a persistent service outage');
}finally{globalThis.fetch=original}
console.log('PASS: JSON response handling, safe HTML errors, bounded GET retries and no retry of authentication rejection');
