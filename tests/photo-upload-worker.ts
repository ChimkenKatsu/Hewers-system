import api from './api-worker';
import {cleanupPhotoUploads} from '../app/photo-uploads-server';
export default {async fetch(request:Request){
 if(new URL(request.url).pathname==='/__test/photo-cleanup'){const p=await request.json() as {now:number;dryRun?:boolean};return Response.json({removed:await cleanupPhotoUploads(!!p.dryRun,p.now)})}
 return api.fetch(request);
}};
