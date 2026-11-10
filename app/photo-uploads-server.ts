import {env} from 'cloudflare:workers';
import {usesSupabase,sb,eq,storedPhoto,registerUpload,removeStoredPhoto} from './supabase-server';
import type {State} from './model';
type Scope={owner:string;userId:string};
type Upload={storage_key:string;owner:string;user_id:string;site_id:string;fingerprint:string;content_type:string;status:string;claim:string;updated_at:number};
export const UPLOAD_RETENTION_MS=7*86400000;
const initialized=new WeakSet<object>();
export async function uploadDb(){
 const db=env.DB!;if(initialized.has(db))return db;await db.prepare('CREATE TABLE IF NOT EXISTS photo_upload_attempts (storage_key TEXT PRIMARY KEY,owner TEXT NOT NULL,user_id TEXT NOT NULL,site_id TEXT NOT NULL,fingerprint TEXT NOT NULL,content_type TEXT NOT NULL,status TEXT NOT NULL,claim TEXT NOT NULL,updated_at INTEGER NOT NULL)').run();await db.prepare('CREATE INDEX IF NOT EXISTS photo_upload_attempts_cleanup ON photo_upload_attempts(status,updated_at)').run();initialized.add(db);return db;
}
export const photoKey=(url:string)=>new URL(url,'https://local').searchParams.get('key');
export function recordedPhoto(state:State,p:{url:string;siteId:string;caption:string;category:string;transactionId?:string}){
 const found=state.photos.find(photo=>photoKey(photo.url)===photoKey(p.url));if(!found)return;
 if(found.siteId!==p.siteId||found.caption!==p.caption?.trim()||found.category!==p.category?.trim()||found.transactionId!==(p.transactionId||''))throw Error('CONFLICT: This photo was already saved with different details. Check site photos before creating another record.');
 return found;
}
export async function stagePhoto(scope:Scope,siteId:string,bytes:ArrayBuffer,type:string,rawId:unknown){
 const id=rawId||crypto.randomUUID();if(typeof id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))throw Error('Invalid photo upload ID');
 const key=scope.owner+'/upload-'+id.toLowerCase(),db=await uploadDb(),now=Date.now(),claim=crypto.randomUUID();
 const fingerprint=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
 await db.prepare("INSERT OR IGNORE INTO photo_upload_attempts VALUES(?,?,?,?,?,?,'new','',?)").bind(key,scope.owner,scope.userId,siteId,fingerprint,type,now).run();
 const row=await db.prepare('SELECT * FROM photo_upload_attempts WHERE storage_key=?').bind(key).first<Upload>();
 if(!row||row.user_id!==scope.userId||row.site_id!==siteId||row.fingerprint!==fingerprint||row.content_type!==type)throw Error('CONFLICT: This upload ID belongs to a different photo. Select the photo again.');
 if(['ready','saved'].includes(row.status))return key;
 const lock=await db.prepare("UPDATE photo_upload_attempts SET status='uploading',claim=?,updated_at=? WHERE storage_key=? AND (status IN ('new','failed','expired') OR (status='uploading' AND updated_at<?))").bind(claim,now,key,now-120000).run();if(!lock.meta.changes)throw Error('CONFLICT: This photo upload is still processing. Retry shortly.');
 try{
  if(usesSupabase()){await storedPhoto(key,'POST',bytes,type);await registerUpload(scope.owner,siteId,key)}else await env.BUCKET!.put(key,bytes,{httpMetadata:{contentType:type},customMetadata:{siteId}});
  await db.prepare("UPDATE photo_upload_attempts SET status='ready',updated_at=? WHERE storage_key=? AND claim=?").bind(Date.now(),key,claim).run();return key;
 }catch(e){await db.prepare("UPDATE photo_upload_attempts SET status='failed' WHERE storage_key=? AND claim=?").bind(key,claim).run();throw e;}
}
export async function claimPhoto(key:string,scope:Scope,siteId:string){
 const db=await uploadDb(),row=await db.prepare('SELECT * FROM photo_upload_attempts WHERE storage_key=?').bind(key).first<Upload>();if(!row)return; // Previously uploaded files remain compatible.
 if(row.owner!==scope.owner||row.user_id!==scope.userId||row.site_id!==siteId)throw Error('FORBIDDEN: This pending upload belongs to another account or site');
 if(row.status==='expired')throw Error('PHOTO_UPLOAD_EXPIRED: This unsaved upload expired. Retry to upload the draft again.');
 const claim=crypto.randomUUID(),now=Date.now();const lock=await db.prepare("UPDATE photo_upload_attempts SET status='committing',claim=?,updated_at=? WHERE storage_key=? AND (status='ready' OR (status='committing' AND updated_at<?))").bind(claim,now,key,now-120000).run();if(!lock.meta.changes)throw Error('CONFLICT: This photo is still processing. Refresh and retry shortly.');return claim;
}
export async function finishPhotoClaim(key:string,claim:string|undefined,saved:boolean){
 if(!claim)return;try{const db=await uploadDb();await db.prepare('UPDATE photo_upload_attempts SET status=?,updated_at=? WHERE storage_key=? AND claim=? AND status=?').bind(saved?'saved':'ready',Date.now(),key,claim,'committing').run()}catch{console.warn('Photo upload status update deferred');}
}
export async function cleanupPhotoUploads(dryRun=false,now=Date.now()){
 const db=await uploadDb(),rows=await db.prepare("SELECT * FROM photo_upload_attempts WHERE status IN ('ready','failed','deleting') AND updated_at<? ORDER BY updated_at LIMIT 10").bind(now-UPLOAD_RETENTION_MS).all<Upload>();let removed=0;
 for(const row of rows.results){if(!row.storage_key.startsWith(row.owner+'/'))continue;if(dryRun)continue;const claim=crypto.randomUUID();
  const lock=await db.prepare("UPDATE photo_upload_attempts SET status='deleting',claim=?,updated_at=? WHERE storage_key=? AND status IN ('ready','failed','deleting') AND updated_at<?").bind(claim,now,row.storage_key,now-UPLOAD_RETENTION_MS).run();if(!lock.meta.changes)continue;
  try{
   const workspace=usesSupabase()?(await sb('hewers_workspaces?id='+eq(row.owner)+'&select=state,migrated_at'))[0]:await db.prepare('SELECT state FROM workspaces WHERE owner=?').bind(row.owner).first<{state:string}>();
   if(!workspace||usesSupabase()&&!workspace.migrated_at)throw Error('Cannot verify photo references');
   const state=(typeof workspace.state==='string'?JSON.parse(workspace.state):workspace.state) as State;
   if(state.photos.some(photo=>photoKey(photo.url)===row.storage_key)){await db.prepare("UPDATE photo_upload_attempts SET status='saved' WHERE storage_key=? AND claim=?").bind(row.storage_key,claim).run();continue;}
   if(usesSupabase()){await removeStoredPhoto(row.storage_key);await sb('hewers_photo_uploads?workspace_id='+eq(row.owner)+'&storage_path='+eq(row.storage_key),'DELETE')}else await env.BUCKET!.delete(row.storage_key);
   await db.prepare("UPDATE photo_upload_attempts SET status='expired',updated_at=? WHERE storage_key=? AND claim=?").bind(now,row.storage_key,claim).run();removed++;
  }catch{await db.prepare('UPDATE photo_upload_attempts SET status=?,updated_at=? WHERE storage_key=? AND claim=?').bind(row.status,row.updated_at,row.storage_key,claim).run();console.warn('Abandoned photo cleanup deferred');}
 }
 return removed;
}
