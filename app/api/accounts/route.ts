import {env} from 'cloudflare:workers';
import {hashPassword} from 'better-auth/crypto';
import {context,json,fail,originCheck} from '../../server-access';
import {authConfigured} from '../../auth-server';
type TeamAccount={id:string;username:string;name:string;role:string;site_ids:string;active:number;must_change_password:number};
async function admin(req:Request){const ctx=await context(req);if(ctx.access.role!=='administrator')throw Error('FORBIDDEN: Admin access required');if(!authConfigured())throw Error('Set AUTH_SECRET and AUTH_BASE_URL on the server first');return ctx;}
const password=()=>Array.from(crypto.getRandomValues(new Uint8Array(20)),x=>x.toString(16).padStart(2,'0')).join('');
export async function GET(req:Request){try{const ctx=await admin(req);const rows=await env.DB!.prepare('SELECT id,username,name,role,site_ids,active,must_change_password FROM auth_user WHERE workspace_id=? ORDER BY username').bind(ctx.access.owner).all<TeamAccount>();return json({accounts:rows.results.map(r=>({...r,siteIds:JSON.parse(r.site_ids)}))});}catch(e){return fail(e)}}
export async function POST(req:Request){try{
 originCheck(req);if(Number(req.headers.get('content-length'))>16384)throw Error('Request too large');const ctx=await admin(req);const p=await req.json() as {action:string;id?:string;siteIds?:string[]};const db=env.DB!;
 if(p.action==='provision'){
  if(!p.siteIds?.length||p.siteIds.some(id=>!ctx.state.sites.some(s=>s.id===id)))throw Error('Select the auditor’s assigned construction sites');
  const credentials:{username:string;password:string;role:string}[]=[],statements:D1PreparedStatement[]=[];
  for(const name of ['admin1','admin2','admin3','admin4','auditor1']){
   const old=await db.prepare('SELECT workspace_id FROM auth_user WHERE username=?').bind(name).first<{workspace_id:string}>();if(old){if(old.workspace_id!==ctx.access.owner)throw Error('A username is already used by another workspace. Contact the system administrator.');continue;}
   const id=crypto.randomUUID(),secret=password(),hash=await hashPassword(secret),now=Date.now(),role=name==='auditor1'?'auditor':'administrator';
   statements.push(db.prepare('INSERT INTO auth_user(id,name,email,created_at,updated_at,username,display_username,workspace_id,role,site_ids) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id,name,name+'@hewers.invalid',now,now,name,name,ctx.access.owner,role,JSON.stringify(role==='auditor'?p.siteIds:[])));
   statements.push(db.prepare('INSERT INTO auth_account(id,account_id,provider_id,user_id,password,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),id,'credential',id,hash,now,now));credentials.push({username:name,password:secret,role});
  }
  if(statements.length)await db.batch(statements);const created=await db.prepare('SELECT id,username,name,role,site_ids,active,must_change_password FROM auth_user WHERE workspace_id=? ORDER BY username').bind(ctx.access.owner).all<TeamAccount>();return json({credentials,accounts:created.results.map(r=>({...r,siteIds:JSON.parse(r.site_ids)})),message:credentials.length?'Team accounts created. Save these temporary passwords now; they are shown only once.':'All five accounts already exist. Existing passwords were not changed.'});
 }
 const account=await db.prepare('SELECT * FROM auth_user WHERE id=? AND workspace_id=?').bind(p.id||'',ctx.access.owner).first<TeamAccount>();if(!account)throw Error('Account not found');if(account.id===ctx.access.userId)throw Error('Use your profile to change your own password. Another admin must manage your access.');
 if(p.action==='sites'){if(account.role!=='auditor'||!p.siteIds?.length||p.siteIds.some(id=>!ctx.state.sites.some(s=>s.id===id)))throw Error('Assign at least one valid site to the auditor');await db.prepare('UPDATE auth_user SET site_ids=?,updated_at=? WHERE id=?').bind(JSON.stringify([...new Set(p.siteIds)]),Date.now(),account.id).run();return json({ok:true});}
 if(p.action==='reset'){const secret=password(),hash=await hashPassword(secret);await db.batch([db.prepare('UPDATE auth_account SET password=?,updated_at=? WHERE user_id=? AND provider_id=?').bind(hash,Date.now(),account.id,'credential'),db.prepare('UPDATE auth_user SET must_change_password=1,updated_at=? WHERE id=?').bind(Date.now(),account.id),db.prepare('DELETE FROM auth_session WHERE user_id=?').bind(account.id)]);return json({credentials:[{username:account.username,password:secret,role:account.role}],message:'Temporary password reset. Existing sessions were revoked.'});}
 if(p.action==='disable'||p.action==='enable'){
  const active=p.action==='enable'?1:0;const result=await db.prepare('UPDATE auth_user SET active=?,updated_at=? WHERE id=? AND (role<>? OR ?=1 OR (SELECT count(*) FROM auth_user WHERE workspace_id=? AND role=? AND active=1)>1)').bind(active,Date.now(),account.id,'administrator',active,ctx.access.owner,'administrator').run();if(!result.meta.changes)throw Error('Keep at least one administrator active');await db.prepare('DELETE FROM auth_session WHERE user_id=?').bind(account.id).run();return json({ok:true});
 }
 throw Error('Invalid account action');
}catch(e){return fail(e)}}
