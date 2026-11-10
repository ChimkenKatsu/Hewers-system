import {cleanupPhotoUploads} from './photo-uploads-server';
import {env} from 'cloudflare:workers';
import {usesSupabase,sb,eq} from './supabase-server';
import {missingTimeouts} from './attendance-reminders';
import {sendAttendanceReminder} from './push-server';
import type {State} from './model';
/** Runs server-side every five minutes, even when no browser or phone is open. */
export async function runAttendanceReminders(dryRun=false,now=Date.now()){
 try{await cleanupPhotoUploads(dryRun,now)}catch{console.warn('Photo upload cleanup unavailable')}
 const workspaces=await env.DB!.prepare("SELECT DISTINCT workspace_id FROM auth_user WHERE active=1 AND role='auditor' AND must_change_password=0").all<{workspace_id:string}>();
 const result={due:0,delivered:0,failed:0};let attempts=0;
 for(const {workspace_id:owner} of workspaces.results){
  const row=usesSupabase()?(await sb('hewers_workspaces?id='+eq(owner)+'&select=state,migrated_at'))[0]:await env.DB!.prepare('SELECT state FROM workspaces WHERE owner=?').bind(owner).first<{state:string}>();
  if(!row||usesSupabase()&&!row.migrated_at)continue;
  const state=(typeof row.state==='string'?JSON.parse(row.state):row.state) as State;
  const devices=await env.DB!.prepare(`SELECT d.token,d.user_id,u.site_ids FROM push_device d JOIN auth_user u ON u.id=d.user_id JOIN auth_session s ON s.id=d.session_id AND s.user_id=u.id WHERE d.reminders_supported=1 AND u.workspace_id=? AND u.role='auditor' AND u.active=1 AND u.must_change_password=0 AND s.expires_at>? AND d.updated_at>?`).bind(owner,now,now-30*86400000).all<{token:string;user_id:string;site_ids:string}>();
  for(const device of devices.results){
   let sites:string[];try{sites=JSON.parse(device.site_ids);if(!Array.isArray(sites))continue;}catch{continue;}
   for(const reminder of missingTimeouts(state,{role:'auditor',siteIds:sites},now)){
    result.due++;if(dryRun)continue;if(attempts>=10)return result;
    const claim=await env.DB!.prepare(`INSERT INTO attendance_reminder_delivery(event_id,user_id,device_token,status,claimed_at,attempts) VALUES(?,?,?,'pending',?,1) ON CONFLICT(event_id,user_id,device_token) DO UPDATE SET claimed_at=excluded.claimed_at,attempts=attendance_reminder_delivery.attempts+1 WHERE attendance_reminder_delivery.status='pending' AND attendance_reminder_delivery.claimed_at<? AND attendance_reminder_delivery.attempts<6`).bind(reminder.id,device.user_id,device.token,now,now-300000).run();
    if(!claim.meta.changes)continue;attempts++;
    try{await sendAttendanceReminder(device.token,reminder.id);await env.DB!.prepare("UPDATE attendance_reminder_delivery SET status='sent',sent_at=? WHERE event_id=? AND user_id=? AND device_token=?").bind(now,reminder.id,device.user_id,device.token).run();result.delivered++;}
    catch{result.failed++;console.warn('Hewers attendance reminder delivery failed');}
   }
  }
 }
 return result;
}
