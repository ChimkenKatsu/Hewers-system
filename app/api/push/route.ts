import {env} from 'cloudflare:workers';
import {localSession} from '../../auth-server';
import {json,fail,originCheck} from '../../server-access';
export async function POST(req:Request){try{
 originCheck(req);
 if(Number(req.headers.get('content-length'))>4096)throw Error('Request too large');
 const session=await localSession(req);
 if(!session)throw Error('AUTH');
 if(session.user.mustChangePassword||!['administrator','auditor'].includes(session.user.role))throw Error('FORBIDDEN: Notifications unavailable');
 const raw=await req.text();if(raw.length>4096)throw Error('Request too large');
 const {token,remindersSupported}=JSON.parse(raw);
 if(typeof token!=='string'||token.length<20||token.length>2048||!/^[A-Za-z0-9_:\-]+$/.test(token))throw Error('Invalid device token');
 // A phone belongs to its latest signed-in session. Signing out/revoking a session stops delivery.
 await env.DB!.prepare('INSERT INTO push_device(token,user_id,session_id,updated_at,reminders_supported) VALUES(?,?,?,?,?) ON CONFLICT(token) DO UPDATE SET user_id=excluded.user_id,session_id=excluded.session_id,updated_at=excluded.updated_at,reminders_supported=excluded.reminders_supported').bind(token,session.user.id,session.session.id,Date.now(),remindersSupported===true?1:0).run();
 return json({registered:true});
}catch(e){return fail(e)}}
