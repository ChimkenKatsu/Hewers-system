import {env} from 'cloudflare:workers';
import {context,json,fail,originCheck} from '../../server-access';
import {hasSite} from '../../permissions';
import {diagnosticId,recordDiagnostic} from '../../scan-diagnostics-server';
import {scanReasons} from '../../scan-reasons';
import type {ScanReason} from '../../scan-reasons';
export async function GET(req:Request){try{
 const ctx=await context(req);if(!['administrator','auditor'].includes(ctx.access.role))throw Error('FORBIDDEN: Scan diagnostics are unavailable for this role');
 const from=new Date(Date.now()-7*86400000).toISOString();
 const rows=await env.DB!.prepare('SELECT id,operator_id,actor,worker_id,site_id,purpose,outcome,reason,source,duration_ms,capture_ms,server_ms,model_ms,device,browser,connection_type,created FROM scan_diagnostics WHERE owner=? AND created>=?'+(ctx.access.role==='administrator'?'':' AND operator_id=?')+' ORDER BY created DESC LIMIT 200').bind(ctx.access.owner,from,...(ctx.access.role==='administrator'?[]:[ctx.access.userId])).all();
 return json({rows:rows.results.filter(r=>hasSite(ctx.access,String(r.site_id))),days:7,limit:200});
}catch(e){return fail(e)}}
export async function POST(req:Request){try{
 originCheck(req);const raw=await req.text();if(raw.length>4096)throw Error('Request too large');const p=JSON.parse(raw) as Record<string,unknown>,ctx=await context(req);
 if(!['administrator','auditor'].includes(ctx.access.role))throw Error('FORBIDDEN: Scan diagnostics are unavailable for this role');
 const worker=ctx.state.workers.find(w=>w.id===p.workerId);if(!worker||!hasSite(ctx.access,worker.siteId))throw Error('FORBIDDEN: Worker is unavailable');
 if(!['enroll','in','out'].includes(String(p.purpose))||typeof p.reason!=='string'||!Object.hasOwn(scanReasons,p.reason)||!['matched','rejected','error'].includes(String(p.outcome)))throw Error('Invalid scan report');
 const key='scan-report:'+ctx.access.userId+':'+Math.floor(Date.now()/60000);await env.DB!.prepare('INSERT INTO auth_rate_limit(id,key,count,last_request) VALUES(?,?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1,last_request=excluded.last_request').bind(key,key,Date.now()).run();const count=await env.DB!.prepare('SELECT count FROM auth_rate_limit WHERE key=?').bind(key).first<{count:number}>();if((count?.count||0)>20)throw Error('RATE: Too many scan reports');
 await recordDiagnostic(ctx.access,{...p,id:diagnosticId(p.id),workerId:worker.id,siteId:worker.siteId,purpose:String(p.purpose),reason:p.reason as ScanReason,outcome:p.outcome as 'matched'|'rejected'|'error',source:'device'});
 return json({ok:true});
}catch(e){return fail(e)}}
