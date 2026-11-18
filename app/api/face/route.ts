import {checkShiftEntry} from '../../shift-policy';
import {recordDiagnostic,diagnosticId} from '../../scan-diagnostics-server';
import {scanReason} from '../../scan-reasons';
import {motionChallenge,checkMotion} from '../../face-motion-server';
import type {MotionFrame} from '../../face-motion';
import {usesSupabase,sb,eq} from '../../supabase-server';
import {env} from 'cloudflare:workers';
import {context,json,fail,originCheck,commit} from '../../server-access';
import {authorize,can,hasSite,requireSite} from '../../permissions';
import {validatePair,matches,distance,FACE_MODEL} from '../../face-math';
import {applyOperation} from '../../operations';

type FaceTemplate = {worker_id: string; descriptor: string};

async function* faceTemplates(owner: string): AsyncGenerator<FaceTemplate> {
 if(!usesSupabase()){
  const {results}=await env.DB!.prepare('SELECT worker_id,descriptor FROM face_templates WHERE owner=?').bind(owner).all<FaceTemplate>();
  yield* results;
  return;
 }
 const query=new URLSearchParams({workspace_id:'eq.'+owner,select:'worker_id,descriptors',order:'worker_id.asc',limit:'100'});
 for(;;){
  const rows=await sb('hewers_face_enrollments?'+query) as {worker_id:string;descriptors:number[][]}[];
  if(!rows.length)return;
  for(const row of rows)yield {worker_id:row.worker_id,descriptor:JSON.stringify(row.descriptors)};
  query.set('worker_id','gt.'+rows[rows.length-1].worker_id);
 }
}

function faceAttendance(ctx: Awaited<ReturnType<typeof context>>, workerId:string, purpose:'in'|'out'){
 const state=applyOperation(ctx.state,'attendance',{workerId,type:purpose,note:'Face-assisted pilot · two stationary face captures; no liveness check'},ctx.access.email);
 const attendance=purpose==='in'?state.attendance.at(-1):state.attendance.find(x=>x.workerId===workerId&&!ctx.state.attendance.find(y=>y.id===x.id)?.timeOut);
 if(!attendance)throw Error('Attendance record unavailable');
 if(purpose==='in')attendance.method='Face-assisted pilot';else attendance.timeOutMethod='Face-assisted pilot';
 state.audit[0].action=state.audit[0].action.replace('(manual)','(face-assisted pilot)');
 state.audit[0].kind='face-check';
 return {state,attendance};
}

async function kioskCheckIn(ctx: Awaited<ReturnType<typeof context>>, p: Record<string,unknown>){
 const {access,state}=ctx;
 if(!can(access,'face-check'))throw Error('FORBIDDEN: Your role cannot record face attendance');
 const siteId=p.siteId;
 if(typeof siteId!=='string'||!state.sites.some(site=>site.id===siteId))throw Error('Choose a site for hands-free check-in');
 requireSite(access,siteId);
 const db=env.DB!;
 const purpose='kiosk-in';
 const now=Date.now();
 if(p.action==='kiosk-challenge'){
  const id=crypto.randomUUID();
  // Reserve a one-use challenge before a worker is known. This D1 table is
  // available with both storage backends and binds the capture to its site.
  const result=await db.prepare(
   'INSERT INTO face_challenges (id,owner,user_id,worker_id,purpose,created,expires,used) SELECT ?,?,?,?,?,?,?,0 WHERE (SELECT count(*) FROM face_challenges WHERE owner=? AND user_id=? AND purpose=? AND created>?)<30'
  ).bind(id,access.owner,access.userId,siteId,purpose,now,now+90000,access.owner,access.userId,purpose,now-60000).run();
  if(!result.meta.changes)throw Error('RATE: Wait one minute before trying another face scan.');
  return json({challenge:id,motion:await motionChallenge({id,owner:access.owner,operator:access.userId,worker:siteId,purpose,issued:now})});
 }
 if(p.model!==FACE_MODEL||typeof p.challenge!=='string')throw Error('Invalid face submission');
 const used=await db.prepare(
  'UPDATE face_challenges SET used=1 WHERE id=? AND owner=? AND user_id=? AND worker_id=? AND purpose=? AND used=0 AND expires>?'
 ).bind(p.challenge,access.owner,access.userId,siteId,purpose,now).run();
 if(!used.meta.changes)throw Error('Capture expired or was already used. Start a new capture.');
 const samples=validatePair(p.samples);
 const motion=p.motion as {token?:unknown;frames?:MotionFrame[]}|undefined;
 await checkMotion(motion?.token,motion?.frames??[],{id:p.challenge,owner:access.owner,operator:access.userId,worker:siteId,purpose},samples);

 let nearby=false;
 let matched:string|undefined;
 for await(const row of faceTemplates(access.owner)){
  let references:number[][];
  try{references=validatePair(JSON.parse(row.descriptor))}catch{throw Error('A stored face enrollment needs review. Ask your administrator to re-enroll it.')}
  if(!samples.some(sample=>references.some(reference=>distance(sample,reference)<=0.45)))continue;
  if(nearby)return json({code:'ambiguous',error:'Could not identify one worker reliably. Ask the site operator for help.'},422);
  nearby=true;
  if(matches(samples,references))matched=row.worker_id;
 }
 const worker=state.workers.find(w=>w.id===matched&&w.siteId===siteId&&!w.archivedAt);
 if(!worker)return json({code:'mismatch',error:'No enrolled worker at this site matched. Ask the site operator for help.'},422);
 authorize(access,state,'face-check',{workerId:worker.id});

 const open=state.attendance.find(record=>record.workerId===worker.id&&!record.timeOut);
 if(open)return json({workerName:worker.name,timeIn:open.timeIn,alreadyCheckedIn:true});
 const recorded=faceAttendance(ctx,worker.id,'in');
 await commit(ctx,recorded.state);
 return json({workerName:worker.name,timeIn:recorded.attendance.timeIn,alreadyCheckedIn:false});
}
export async function GET(req:Request){try{
 const ctx=await context(req);if(ctx.access.role==='custodian')throw Error('FORBIDDEN: Attendance access is unavailable for this role');
 const rows=usesSupabase()?{results:(await sb('hewers_face_enrollments?workspace_id='+eq(ctx.access.owner)+'&select=worker_id,enrolled_at,enrolled_by')).map((r:any)=>({...r,created:r.enrolled_at,actor:r.enrolled_by}))}:await env.DB!.prepare('SELECT worker_id,created,actor FROM face_templates WHERE owner=?').bind(ctx.access.owner).all<any>();
 return json({enrollments:rows.results.filter((row:any)=>ctx.state.workers.some(w=>w.id===row.worker_id&&hasSite(ctx.access,w.siteId))).map((row:any)=>({workerId:row.worker_id,created:row.created,actor:row.actor})),model:FACE_MODEL,pilot:true,motionCheck:false,captureMode:'pair'});
}catch(e){return fail(e)}}
export async function POST(req:Request){
 let report:Parameters<typeof recordDiagnostic>[1]|undefined,access:Parameters<typeof recordDiagnostic>[0]|undefined;const serverStarted=Date.now();
 async function finish(response:Response,outcome:'matched'|'rejected'|'error',reason:Parameters<typeof recordDiagnostic>[1]['reason']){if(report&&access)await recordDiagnostic(access,{...report,outcome,reason,serverMs:Date.now()-serverStarted});return response}
 try{
 originCheck(req);if(Number(req.headers.get('content-length'))>120000)throw Error('Request too large');
 const p=await req.json() as any,ctx=await context(req);
 if(p.action==='kiosk-challenge'||p.action==='kiosk-submit')return await kioskCheckIn(ctx,p);
 const purpose=p.purpose;if(!['enroll','in','out','remove'].includes(purpose))throw Error('Invalid face operation');
 authorize(ctx.access,ctx.state,purpose==='enroll'?'face-enroll':purpose==='remove'?'face-delete':'face-check',{workerId:p.workerId});
 if(purpose==='remove'){if(usesSupabase())await sb('hewers_face_enrollments?workspace_id='+eq(ctx.access.owner)+'&worker_id='+eq(p.workerId),'DELETE');else await env.DB!.prepare('DELETE FROM face_templates WHERE owner=? AND worker_id=?').bind(ctx.access.owner,p.workerId).run();return json({ok:true,message:'Enrollment removed'})}
 if(p.action==='challenge'||p.action==='submit'){
  access=ctx.access;const worker=ctx.state.workers.find(w=>w.id===p.workerId)!;report={id:diagnosticId(p.attemptId),workerId:p.workerId,siteId:worker.siteId,purpose,outcome:'error',reason:'server',source:'server'};
  const open=ctx.state.attendance.some(a=>a.workerId===p.workerId&&!a.timeOut);
  if((purpose==='in'&&open)||(purpose==='out'&&!open))return finish(json({error:open?'This worker is already checked in. Choose Time out.':'This worker has no open check-in. Choose Time in.',code:'duplicate'},409),'rejected','duplicate');
 }
 if(p.action==='challenge'){
  const now=Date.now();if(purpose==='in')checkShiftEntry(ctx.state,p.workerId,new Date(now).toISOString());
  const recent=usesSupabase()?await sb('hewers_face_challenges?workspace_id='+eq(ctx.access.owner)+'&operator_id='+eq(ctx.access.userId)+'&created_at=gt.'+encodeURIComponent(new Date(now-60000).toISOString())+'&select=worker_id'):(await env.DB!.prepare('SELECT worker_id FROM face_challenges WHERE owner=? AND user_id=? AND created>?').bind(ctx.access.owner,ctx.access.userId,now-60000).all<{worker_id:string}>()).results;
  if(recent.filter((r:{worker_id:string})=>r.worker_id===p.workerId).length>=6)throw Error('RATE: Too many attempts for this worker. Wait one minute before retrying their scan.');
  if(recent.length>=30)throw Error('RATE: This operator reached the scan limit. Wait one minute.');
  const id=crypto.randomUUID();if(usesSupabase())await sb('hewers_face_challenges','POST',{id,workspace_id:ctx.access.owner,operator_id:ctx.access.userId,worker_id:p.workerId,purpose,created_at:new Date(now).toISOString(),expires_at:new Date(now+90000).toISOString()});else await env.DB!.prepare('INSERT INTO face_challenges (id,owner,user_id,worker_id,purpose,created,expires,used) VALUES (?,?,?,?,?,?,?,0)').bind(id,ctx.access.owner,ctx.access.userId,p.workerId,purpose,now,now+90000).run();return json({challenge:id,expires:now+90000,motion:await motionChallenge({id,owner:ctx.access.owner,operator:ctx.access.userId,worker:p.workerId,purpose,issued:now})});
 }
 if(p.action!=='submit'||p.model!==FACE_MODEL)throw Error('Invalid face submission');
 const used=usesSupabase()?{meta:{changes:(await sb('hewers_face_challenges?id='+eq(String(p.challenge))+'&workspace_id='+eq(ctx.access.owner)+'&operator_id='+eq(ctx.access.userId)+'&worker_id='+eq(p.workerId)+'&purpose='+eq(purpose)+'&used=eq.false&expires_at=gt.'+encodeURIComponent(new Date().toISOString()),'PATCH',{used:true},'return=representation')).length}}:await env.DB!.prepare('UPDATE face_challenges SET used=1 WHERE id=? AND owner=? AND user_id=? AND worker_id=? AND purpose=? AND used=0 AND expires>?').bind(String(p.challenge),ctx.access.owner,ctx.access.userId,p.workerId,purpose,Date.now()).run();if(!used.meta.changes)throw Error('Capture expired or was already used. Start a new capture.');
 const samples=validatePair(p.samples);
 await checkMotion(p.motion?.token,p.motion?.frames,{id:String(p.challenge),owner:ctx.access.owner,operator:ctx.access.userId,worker:p.workerId,purpose},samples);
 // Compare within the workspace, including workers outside the operator's assigned site.
 // Templates remain on the server; ambiguous identities never create attendance.
 const allTemplates:FaceTemplate[]=[];
 for await(const row of faceTemplates(ctx.access.owner))allTemplates.push(row);
 const template=allTemplates.find((row:{worker_id:string})=>row.worker_id===p.workerId);
 for(const other of allTemplates){if(other.worker_id===p.workerId)continue;let references:number[][];try{references=validatePair(JSON.parse(other.descriptor))}catch{throw Error('A stored face enrollment needs review. Ask your administrator to re-enroll it.')}if(samples.some(sample=>references.some(reference=>distance(sample,reference)<=0.45)))return finish(json({code:'ambiguous',error:'This capture is too similar to another enrollment. No record was saved. Ask your administrator to review the enrollments.'},422),'rejected','ambiguous');}
 if(purpose==='enroll'){
  if(template&&!matches(samples,JSON.parse(template.descriptor)))return finish(json({code:'mismatch',error:'This face does not match the existing enrollment. No changes were saved. Ask an authorized operator to remove the enrollment after verifying the worker’s identity.'},422),'rejected','mismatch');
  if(p.consent!==true)throw Error('Confirm the worker has agreed to pilot enrollment');
  if(usesSupabase())await sb('hewers_face_enrollments?on_conflict=workspace_id,worker_id','POST',{workspace_id:ctx.access.owner,worker_id:p.workerId,model:FACE_MODEL,descriptors:samples,consent_record:'Pilot enrollment confirmed by operator',enrolled_by:ctx.access.email,enrolled_at:new Date().toISOString()},'resolution=merge-duplicates');else await env.DB!.prepare('INSERT INTO face_templates (id,owner,worker_id,descriptor,created,actor,consent) VALUES (?,?,?,?,?,?,?) ON CONFLICT(owner,worker_id) DO UPDATE SET descriptor=excluded.descriptor,created=excluded.created,actor=excluded.actor,consent=excluded.consent').bind(crypto.randomUUID(),ctx.access.owner,p.workerId,JSON.stringify(samples),new Date().toISOString(),ctx.access.email,'Pilot enrollment confirmed by operator').run();
  return finish(json({ok:true,message:'Face enrolled for pilot matching'}),'matched','none');
 }

 if(!template)throw Error('This worker has not been enrolled');
 if(!matches(samples,JSON.parse(template.descriptor)))return finish(json({code:'mismatch',error:'Face did not match the selected worker. No attendance was recorded.'},422),'rejected','mismatch');
 const {state}=faceAttendance(ctx,p.workerId,purpose);
 return finish(json({...await commit(ctx,state),ok:true,message:'Face matched · attendance recorded as a pilot entry'}),'matched','none');
}catch(e){return finish(fail(e),'error',scanReason(e))}}

