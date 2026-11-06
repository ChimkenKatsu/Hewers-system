import {env} from 'cloudflare:workers';
import {auth,localSession} from '../../../auth-server';
import {originCheck,fail,json} from '../../../server-access';
import {teamSyncWarning} from '../../../supabase-server';

export async function POST(req:Request){try{
 originCheck(req);
 const session=await localSession(req);
 if(!session)throw Error('AUTH');
 if(session.user.role!=='administrator'||session.user.mustChangePassword)throw Error('FORBIDDEN: An administrator with a personal password is required');
 const body=await req.json() as {username?:unknown;currentPassword?:unknown};
 const username=typeof body.username==='string'?body.username.trim().toLowerCase():'';
 if(!/^[a-z0-9_]{3,30}$/.test(username))throw Error('Use 3–30 letters, numbers or underscores');
 if(typeof body.currentPassword!=='string'||!body.currentPassword||body.currentPassword.length>128)throw Error('Enter your current password');
 const db=env.DB!,key='username-change:'+session.user.id+':'+Math.floor(Date.now()/60000);
 await db.prepare('INSERT INTO auth_rate_limit(id,key,count,last_request) VALUES(?,?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1,last_request=excluded.last_request').bind(key,key,Date.now()).run();
 const attempts=await db.prepare('SELECT count FROM auth_rate_limit WHERE key=?').bind(key).first<{count:number}>();
 if((attempts?.count||0)>6)throw Error('RATE: Too many attempts. Wait one minute.');
 const verified=await auth().api.verifyPassword({headers:req.headers,body:{password:body.currentPassword},asResponse:true});
 if(!verified.ok)throw Error('Current password is incorrect. Sign in again if your session has expired.');
 if(username===session.user.username)throw Error('Choose a different username');
 try{
  await db.prepare('UPDATE auth_user SET username=?,display_username=?,name=CASE WHEN name=username THEN ? ELSE name END,updated_at=? WHERE id=?').bind(username,username,username,Date.now(),session.user.id).run();
 }catch(e){if(String(e).includes('UNIQUE'))throw Error('CONFLICT: This username is already taken');throw e;}
 const warning=await teamSyncWarning(session.user.workspaceId);
 return json({ok:true,username,warning,message:'Username updated. Use '+username+' the next time you sign in.'});
}catch(e){return fail(e)}}
