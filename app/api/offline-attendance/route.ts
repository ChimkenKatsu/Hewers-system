import {context,originCheck,json,commit,fail} from '../../server-access';
import {authorize} from '../../permissions';
import {applyOperation} from '../../operations';
export async function POST(req:Request){try{
 originCheck(req);const p=await req.json() as any;if(JSON.stringify(p).length>4000)throw Error('Entry too large');
 for(let attempt=0;attempt<3;attempt++){
  const ctx=await context(req);if(p.owner!==ctx.access.owner||p.userId!==ctx.access.userId)throw Error('FORBIDDEN: Sign in to the account that recorded this offline entry');
  authorize(ctx.access,ctx.state,'offline-attendance-request',p);
  const state=applyOperation(ctx.state,'offline-attendance-request',p,ctx.access.email,new Date().toISOString(),ctx.access.userId);
  if(ctx.state.offlineAttendance?.some(r=>r.id===p.id))return json({ok:true,id:p.id,status:state.offlineAttendance!.find(r=>r.id===p.id)!.status});
  try{await commit(ctx,state);return json({ok:true,id:p.id,status:state.offlineAttendance!.find(r=>r.id===p.id)!.status})}catch(e){if(!(e instanceof Error)||!e.message.startsWith('CONFLICT')||attempt===2)throw e;}
 }
}catch(e){return fail(e)}}
