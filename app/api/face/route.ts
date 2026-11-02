import {usesSupabase,sb,eq} from '../../supabase-server';
import {env} from 'cloudflare:workers';
import {context,json,fail,originCheck,commit} from '../../server-access';
import {authorize,hasSite} from '../../permissions';
import {validatePair,matches,FACE_MODEL} from '../../face-math';
import {applyOperation} from '../../operations';
export async function GET(req:Request){try{
 const ctx=await context(req);if(ctx.access.role==='custodian')throw Error('FORBIDDEN: Attendance access is unavailable for this role');
 const rows=usesSupabase()?{results:(await sb('hewers_face_enrollments?workspace_id='+eq(ctx.access.owner)+'&select=worker_id,enrolled_at,enrolled_by')).map((r:any)=>({...r,created:r.enrolled_at,actor:r.enrolled_by}))}:await env.DB!.prepare('SELECT worker_id,created,actor FROM face_templates WHERE owner=?').bind(ctx.access.owner).all<any>();
 return json({enrollments:rows.results.filter((row:any)=>ctx.state.workers.some(w=>w.id===row.worker_id&&hasSite(ctx.access,w.siteId))).map((row:any)=>({workerId:row.worker_id,created:row.created,actor:row.actor})),model:FACE_MODEL,pilot:true});
}catch(e){return fail(e)}}
export async function POST(req:Request){try{
 originCheck(req);if(Number(req.headers.get('content-length'))>18000)throw Error('Request too large');
 const p=await req.json() as any,ctx=await context(req);
 const purpose=p.purpose;if(!['enroll','in','out','remove'].includes(purpose))throw Error('Invalid face operation');
 authorize(ctx.access,ctx.state,purpose==='enroll'?'face-enroll':purpose==='remove'?'face-delete':'face-check',{workerId:p.workerId});
 if(purpose==='remove'){if(usesSupabase())await sb('hewers_face_enrollments?workspace_id='+eq(ctx.access.owner)+'&worker_id='+eq(p.workerId),'DELETE');else await env.DB!.prepare('DELETE FROM face_templates WHERE owner=? AND worker_id=?').bind(ctx.access.owner,p.workerId).run();return json({ok:true,message:'Enrollment removed'})}
 if(p.action==='challenge'){
  const now=Date.now();const recent=usesSupabase()?{n:(await sb('hewers_face_challenges?workspace_id='+eq(ctx.access.owner)+'&operator_id='+eq(ctx.access.userId)+'&created_at=gt.'+encodeURIComponent(new Date(now-60000).toISOString())+'&select=id')).length}:await env.DB!.prepare('SELECT count(*) AS n FROM face_challenges WHERE owner=? AND user_id=? AND created>?').bind(ctx.access.owner,ctx.access.userId,now-60000).first<any>();if(recent.n>=6)throw Error('RATE: Too many face attempts. Wait one minute.');
  const id=crypto.randomUUID();if(usesSupabase())await sb('hewers_face_challenges','POST',{id,workspace_id:ctx.access.owner,operator_id:ctx.access.userId,worker_id:p.workerId,purpose,created_at:new Date(now).toISOString(),expires_at:new Date(now+90000).toISOString()});else await env.DB!.prepare('INSERT INTO face_challenges (id,owner,user_id,worker_id,purpose,created,expires,used) VALUES (?,?,?,?,?,?,?,0)').bind(id,ctx.access.owner,ctx.access.userId,p.workerId,purpose,now,now+90000).run();return json({challenge:id,expires:now+90000});
 }
 if(p.action!=='submit'||p.model!==FACE_MODEL)throw Error('Invalid face submission');
 const used=usesSupabase()?{meta:{changes:(await sb('hewers_face_challenges?id='+eq(String(p.challenge))+'&workspace_id='+eq(ctx.access.owner)+'&operator_id='+eq(ctx.access.userId)+'&worker_id='+eq(p.workerId)+'&purpose='+eq(purpose)+'&used=eq.false&expires_at=gt.'+encodeURIComponent(new Date().toISOString()),'PATCH',{used:true},'return=representation')).length}}:await env.DB!.prepare('UPDATE face_challenges SET used=1 WHERE id=? AND owner=? AND user_id=? AND worker_id=? AND purpose=? AND used=0 AND expires>?').bind(String(p.challenge),ctx.access.owner,ctx.access.userId,p.workerId,purpose,Date.now()).run();if(!used.meta.changes)throw Error('Capture expired or was already used. Start a new capture.');
 const samples=validatePair(p.samples);
 const template=usesSupabase()?(await sb('hewers_face_enrollments?workspace_id='+eq(ctx.access.owner)+'&worker_id='+eq(p.workerId)+'&select=descriptors')).map((r:any)=>({descriptor:JSON.stringify(r.descriptors)}))[0]:await env.DB!.prepare('SELECT descriptor FROM face_templates WHERE owner=? AND worker_id=?').bind(ctx.access.owner,p.workerId).first<any>();
 if(purpose==='enroll'){
  if(template&&!matches(samples,JSON.parse(template.descriptor)))return json({error:'This face does not match the existing enrollment. No changes were saved. Ask an authorized operator to remove the enrollment after verifying the worker’s identity.'},422);
  if(p.consent!==true)throw Error('Confirm the worker has agreed to pilot enrollment');
  if(usesSupabase())await sb('hewers_face_enrollments?on_conflict=workspace_id,worker_id','POST',{workspace_id:ctx.access.owner,worker_id:p.workerId,model:FACE_MODEL,descriptors:samples,consent_record:'Pilot enrollment confirmed by operator',enrolled_by:ctx.access.email,enrolled_at:new Date().toISOString()},'resolution=merge-duplicates');else await env.DB!.prepare('INSERT INTO face_templates (id,owner,worker_id,descriptor,created,actor,consent) VALUES (?,?,?,?,?,?,?) ON CONFLICT(owner,worker_id) DO UPDATE SET descriptor=excluded.descriptor,created=excluded.created,actor=excluded.actor,consent=excluded.consent').bind(crypto.randomUUID(),ctx.access.owner,p.workerId,JSON.stringify(samples),new Date().toISOString(),ctx.access.email,'Pilot enrollment confirmed by operator').run();
  return json({ok:true,message:'Face enrolled for pilot matching'});
 }

 if(!template)throw Error('This worker has not been enrolled');
 if(!matches(samples,JSON.parse(template.descriptor)))return json({error:'Face did not match the selected worker. No attendance was recorded.'},422);
 const state=applyOperation(ctx.state,'attendance',{workerId:p.workerId,type:purpose,note:'Face-assisted pilot · browser descriptor match; liveness not verified'},ctx.access.email);
 const attendance=purpose==='in'?state.attendance[state.attendance.length-1]:state.attendance.find(x=>x.workerId===p.workerId&&!ctx.state.attendance.find(y=>y.id===x.id)?.timeOut);
 if(!attendance)throw Error('Attendance record unavailable');
 if(purpose==='in')attendance.method='Face-assisted pilot';else attendance.timeOutMethod='Face-assisted pilot';
 state.audit[0].action=state.audit[0].action.replace('(manual)','(face-assisted pilot)');state.audit[0].kind='face-check';
 return json({...await commit(ctx,state),ok:true,message:'Face matched · attendance recorded as a pilot entry'});
}catch(e){return fail(e)}}

