import {env} from 'cloudflare:workers';
import type {State} from './model';
import {pushEvents,mayReceivePush} from './push-policy';
type Credentials={project_id:string;client_email:string;private_key:string};
let cached:{identity:string;token:string;until:number}|undefined;
const encode=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
const encodedJson=(value:unknown)=>encode(new TextEncoder().encode(JSON.stringify(value)));
async function accessToken(c:Credentials,signal:AbortSignal){
 const identity=c.client_email+c.private_key;
 if(cached?.identity===identity&&cached.until>Date.now())return cached.token;
 const now=Math.floor(Date.now()/1000);
 const unsigned=encodedJson({alg:'RS256',typ:'JWT'})+'.'+encodedJson({iss:c.client_email,scope:'https://www.googleapis.com/auth/firebase.messaging',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600});
 const pem=c.private_key.replace(/-----[^-]+-----|\s/g,'');
 const key=await crypto.subtle.importKey('pkcs8',Uint8Array.from(atob(pem),ch=>ch.charCodeAt(0)),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
 const signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(unsigned));
 const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',signal,body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:unsigned+'.'+encode(new Uint8Array(signature))})});
 if(!response.ok)throw Error('Push authentication failed');
 const result=await response.json() as {access_token:string;expires_in:number};
 if(!result.access_token)throw Error('Push authentication failed');
 cached={identity,token:result.access_token,until:Date.now()+(Math.min(result.expires_in||3600,3600)-120)*1000};
 return result.access_token;
}
export async function sendAttendanceReminder(deviceToken:string,eventId:string){
 const raw=(env as unknown as {FCM_SERVICE_ACCOUNT_JSON?:string}).FCM_SERVICE_ACCOUNT_JSON;if(!raw)throw Error('Push configuration unavailable');
 const c=JSON.parse(raw) as Credentials;if(c.project_id!=='hewers-system')throw Error('Invalid push project');
 const signal=AbortSignal.timeout(10000),token=await accessToken(c,signal);
 const r=await fetch('https://fcm.googleapis.com/v1/projects/hewers-system/messages:send',{method:'POST',signal,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({message:{token:deviceToken,data:{kind:'missing-timeout',eventId},android:{priority:'high',ttl:'3600s'}}})});
 if(r.ok)return;
 const result=await r.json() as {error?:{details?:{errorCode?:string}[]}};
 if(result.error?.details?.some(d=>d.errorCode==='UNREGISTERED')){await env.DB!.prepare('DELETE FROM push_device WHERE token=?').bind(deviceToken).run();return;}
 throw Error('Reminder push delivery failed');
}
/** Best effort after a successful commit. Failures must never make a saved request look unsaved. */
export async function sendWorkerPush(owner:string,before:State,after:State){
 const events=pushEvents(before,after);if(!events.length)return;
 const raw=(env as unknown as {FCM_SERVICE_ACCOUNT_JSON?:string}).FCM_SERVICE_ACCOUNT_JSON;
 if(!raw)return; // Disabled until the server-only secret is provisioned.
 try{
  const credentials=JSON.parse(raw) as Credentials;
  if(credentials.project_id!=='hewers-system'||!credentials.client_email||!credentials.private_key)throw Error('Invalid push configuration');
  const signal=AbortSignal.timeout(10000),token=await accessToken(credentials,signal);
  const devices=await env.DB!.prepare(`SELECT d.token,u.role,COALESCE(NULLIF(u.username,''),u.email) AS email,u.site_ids FROM push_device d
   JOIN auth_user u ON u.id=d.user_id JOIN auth_session s ON s.id=d.session_id AND s.user_id=u.id
   WHERE u.workspace_id=? AND u.active=1 AND u.must_change_password=0 AND s.expires_at>? AND d.updated_at>?`).bind(owner,Date.now(),Date.now()-30*86400000).all<{token:string;role:string;email:string;site_ids:string}>();
  // Bounded batches avoid unbounded outgoing connections. No worker names or reasons leave in push payloads.
  for(const event of events){
   const recipients=devices.results.filter(user=>mayReceivePush(event,user));
   for(let offset=0;offset<recipients.length;offset+=5){
    await Promise.all(recipients.slice(offset,offset+5).map(async device=>{
     const response=await fetch('https://fcm.googleapis.com/v1/projects/hewers-system/messages:send',{method:'POST',signal,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({message:{token:device.token,data:{kind:event.kind,eventId:event.id},android:{priority:'high',ttl:'3600s'}}})});
     if(!response.ok){
      const result=await response.json() as {error?:{details?:{errorCode?:string}[]}};
      if(result.error?.details?.some(detail=>detail.errorCode==='UNREGISTERED'))await env.DB!.prepare('DELETE FROM push_device WHERE token=?').bind(device.token).run();
      else console.warn('Hewers push delivery failed',response.status);
     }
    }));
   }
  }
 }catch{console.warn('Hewers push unavailable; request remains saved in notification history');}
}
