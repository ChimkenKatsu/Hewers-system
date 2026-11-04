import {env} from 'cloudflare:workers';
import {context,json,fail,originCheck} from '../../server-access';
import {workerNotifications} from '../../worker-notifications';
async function account(req:Request){const ctx=await context(req);if(!['administrator','auditor'].includes(ctx.access.role))throw Error('FORBIDDEN: Notifications unavailable');const row=await env.DB!.prepare('SELECT notification_reads FROM auth_user WHERE id=? AND workspace_id=? AND active=1').bind(ctx.access.userId,ctx.access.owner).first<{notification_reads:string}>();if(!row)throw Error('AUTH');return {ctx,row};}
export async function GET(req:Request){try{const {row}=await account(req);return json({readIds:JSON.parse(row.notification_reads)})}catch(e){return fail(e)}}
export async function POST(req:Request){try{originCheck(req);if(Number(req.headers.get('content-length'))>32768)throw Error('Request too large');const {ctx}=await account(req),p=await req.json() as {ids?:unknown};if(!Array.isArray(p.ids)||p.ids.length>500||p.ids.some(id=>typeof id!=='string'||id.length>180))throw Error('Invalid notification IDs');const allowed=new Set(workerNotifications(ctx.state.workerRequests||[],ctx.access).map(n=>n.id));if(p.ids.some(id=>!allowed.has(id)))throw Error('FORBIDDEN: Notification unavailable for this account');
 // Merge in one SQLite statement so simultaneous devices cannot overwrite reads.
 await env.DB!.prepare(`UPDATE auth_user SET notification_reads=(SELECT json_group_array(value) FROM (SELECT value FROM json_each(auth_user.notification_reads) UNION SELECT value FROM json_each(?))) WHERE id=? AND workspace_id=?`).bind(JSON.stringify(p.ids),ctx.access.userId,ctx.access.owner).run();
 const row=await env.DB!.prepare('SELECT notification_reads FROM auth_user WHERE id=? AND workspace_id=?').bind(ctx.access.userId,ctx.access.owner).first<{notification_reads:string}>();return json({readIds:JSON.parse(row!.notification_reads)});
}catch(e){return fail(e)}}
