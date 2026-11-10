import {env} from 'cloudflare:workers';
import {admin,connection,missingConfig,requireConfig,accessToken,google,db} from '../../google-server';
import {googlePhotoLabel} from '../../google-photo-label';
import {googleRows} from '../../google-export';
import {usesSupabase,storedPhoto} from '../../supabase-server';
import {json,fail,originCheck} from '../../server-access';
export async function GET(req:Request){try{const ctx=await admin(req);const row=await connection(ctx.access.owner);return json({configured:!missingConfig().length,missing:missingConfig(),connected:!!row,lastSync:row?.last_sync||null,sheetUrl:row?.sheet_id?'https://docs.google.com/spreadsheets/d/'+row.sheet_id:null,folderUrl:row?.folder_id?'https://drive.google.com/drive/folders/'+row.folder_id:null});}catch(e){return fail(e)}}
export async function POST(req:Request){let owner='',lease=0;try{
 originCheck(req);const ctx=await admin(req);owner=ctx.access.owner;const {action}=await req.json() as {action:string};if(!['sync','disconnect'].includes(action))throw Error('Invalid Google action');requireConfig();
 const store=await db();lease=Date.now()+900000;const lock=await store.prepare('UPDATE google_connections SET lease=? WHERE owner=? AND lease<?').bind(lease,owner,Date.now()).run();if(!lock.meta.changes)throw Error('Google is not connected or a sync is already running.');
 const row=await connection(owner);if(!row)throw Error('Connect Google first');
 if(action==='disconnect'){await store.prepare('DELETE FROM google_connections WHERE owner=? AND lease=?').bind(owner,lease).run();return json({ok:true,message:'Google disconnected from Hewers. Exported files remain in Google Drive. You can revoke Google access in your Google account settings.'});}
 const token=await accessToken(row);
 // Recover app-created destinations after a partial request; no access to unrelated files.
 async function find(kind:string){const q="trashed = false and appProperties has { key='hewersOwner' and value='"+owner.replace(/['\\]/g,'')+"' } and appProperties has { key='hewersKind' and value='"+kind+"' }";const r=await google(token,'www.googleapis.com/drive/v3/files?fields=files(id)&q='+encodeURIComponent(q));return (r.files as {id:string}[])?.[0]?.id;}
 let folder=row.folder_id||await find('folder');if(!folder){const r=await google(token,'www.googleapis.com/drive/v3/files','POST',{name:'Hewers — site records',mimeType:'application/vnd.google-apps.folder',appProperties:{hewersOwner:owner,hewersKind:'folder'}});folder=r.id as string;}
 await store.prepare('UPDATE google_connections SET folder_id=? WHERE owner=?').bind(folder,owner).run();
 let sheet=row.sheet_id||await find('sheet');if(!sheet){const r=await google(token,'www.googleapis.com/drive/v3/files','POST',{name:'Hewers — attendance and inventory',mimeType:'application/vnd.google-apps.spreadsheet',parents:[folder],appProperties:{hewersOwner:owner,hewersKind:'sheet'}});sheet=r.id as string;}
 await store.prepare('UPDATE google_connections SET sheet_id=? WHERE owner=?').bind(sheet,owner).run();
 const rows=googleRows(ctx.state),metadata=await google(token,'sheets.googleapis.com/v4/spreadsheets/'+sheet+'?fields=sheets(properties)');
 const tabs=(metadata.sheets as {properties:{sheetId:number;title:string;gridProperties?:{rowCount:number;columnCount?:number}}}[]).map(s=>s.properties);
 const requests=Object.entries(rows).map(([title,values],i)=>{const tab=tabs.find(t=>t.title===title),columnCount=values[0].length;return tab?{updateSheetProperties:{properties:{sheetId:tab.sheetId,gridProperties:{rowCount:Math.max(values.length,tab.gridProperties?.rowCount||1000),columnCount:Math.max(columnCount,tab.gridProperties?.columnCount||26)}},fields:'gridProperties.rowCount,gridProperties.columnCount'}}:{addSheet:{properties:{title,sheetId:100+i,gridProperties:{rowCount:Math.max(values.length,1000),columnCount,frozenRowCount:1}}}};});
 await google(token,'sheets.googleapis.com/v4/spreadsheets/'+sheet+':batchUpdate','POST',{requests});
 // Mirror only these three app-managed tabs. RAW prevents formula execution from names.
 await google(token,'sheets.googleapis.com/v4/spreadsheets/'+sheet+'/values:batchClear','POST',{ranges:Object.entries(rows).map(([title,values])=>title+'!A:'+String.fromCharCode(64+values[0].length))});
 await google(token,'sheets.googleapis.com/v4/spreadsheets/'+sheet+'/values:batchUpdate','POST',{valueInputOption:'RAW',data:Object.entries(rows).map(([range,values])=>({range:range+'!A1',values}))});
 let uploaded=0,relabeled=0,pending=0;
 for(const photo of ctx.state.photos){
  const q="trashed = false and '"+folder+"' in parents and appProperties has { key='hewersPhoto' and value='"+photo.id.replace(/['\\]/g,'')+"' }";
  const existing=await google(token,'www.googleapis.com/drive/v3/files?fields=files(id,name,mimeType,description)&q='+encodeURIComponent(q));
  const saved=(existing.files as {id:string;name:string;mimeType:string;description?:string}[])?.[0];
  if(saved){const label=googlePhotoLabel(photo,ctx.state.sites,saved.mimeType);if(saved.name!==label.name||saved.description!==label.description){await google(token,'www.googleapis.com/drive/v3/files/'+encodeURIComponent(saved.id),'PATCH',label);relabeled++;}continue;}
  if(uploaded>=10){pending++;continue;}
  const path=new URL(photo.url,'https://local').searchParams.get('key');if(!path||!path.startsWith(owner+'/'))throw Error('A photo has an invalid workspace path');
  let bytes:ArrayBuffer,type:string;if(usesSupabase()){const r=await storedPhoto(path);bytes=await r.arrayBuffer();type=r.headers.get('Content-Type')||'image/jpeg';}else{const obj=await env.BUCKET!.get(path);if(!obj)throw Error('A source photo is missing. Sync did not finish.');bytes=await obj.arrayBuffer();type=obj.httpMetadata?.contentType||'image/jpeg';}
  const start=await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','X-Upload-Content-Type':type,'X-Upload-Content-Length':String(bytes.byteLength)},body:JSON.stringify({...googlePhotoLabel(photo,ctx.state.sites,type),parents:[folder],appProperties:{hewersPhoto:photo.id}}),signal:AbortSignal.timeout(30000)});
  const location=start.headers.get('Location');if(!start.ok||!location||new URL(location).origin!=='https://www.googleapis.com')throw Error('Google photo upload could not start. Retry sync.');
  const result=await fetch(location,{method:'PUT',headers:{'Content-Type':type,Authorization:'Bearer '+token},body:bytes,signal:AbortSignal.timeout(60000)});if(!result.ok)throw Error('Google photo upload did not finish. Retry sync.');uploaded++;
 }
 if(!pending)await store.prepare('UPDATE google_connections SET last_sync=? WHERE owner=?').bind(new Date().toISOString(),owner).run();
 return json({ok:true,pending,message:pending?'Reports updated; '+uploaded+' photos uploaded. Click Sync now to continue the remaining '+pending+' photos.':'Attendance, inventory, and site photos are synced.'+(relabeled?' '+relabeled+' existing photo labels updated.':'')});
}catch(e){return fail(e)}finally{if(owner&&lease)await (await db()).prepare('UPDATE google_connections SET lease=0 WHERE owner=? AND lease=?').bind(owner,lease).run();}}
