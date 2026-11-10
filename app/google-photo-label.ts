import type {Evidence,Site} from './model';

const clean=(value:string)=>value.replace(/[\x00-\x1f\x7f/\\:*?"<>|]/g,' ').replace(/\s+/g,' ').trim().slice(0,65);
export function googlePhotoLabel(photo:Evidence,sites:Site[],mimeType:string){
 const site=sites.find(site=>site.id===photo.siteId)?.name||'Unknown site';
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(photo.created));
 const extension=mimeType==='image/png'?'png':mimeType==='image/webp'?'webp':'jpg';
 return {
  name:[clean(site),clean(photo.category)||'Site photo',date,clean(photo.caption)||'Photo'].join(' — ')+'.'+extension,
  description:['Site: '+site,'Category: '+photo.category,'Caption: '+photo.caption,'Uploaded: '+new Date(photo.created).toLocaleString('en-PH',{timeZone:'Asia/Manila'})+' PHT','Uploaded by: '+photo.actor,'Hewers photo ID: '+photo.id].join('\n'),
 };
}
