import {env} from 'cloudflare:workers';
import {json} from '../../../server-access';
import {runAttendanceReminders} from '../../../attendance-reminders-server';
export async function POST(req:Request){
 const secret=(env as unknown as {REMINDER_CRON_SECRET?:string}).REMINDER_CRON_SECRET;
 if(!secret||req.headers.get('authorization')!=='Bearer '+secret)return json({error:'Unauthorized'},401);
 try{const text=await req.text();if(text.length>1024)return json({error:'Request too large'},413);const body=text?JSON.parse(text):{};return json(await runAttendanceReminders(body.dryRun===true));}catch{console.warn('Hewers attendance reminder job failed');return json({error:'Reminder job unavailable'},503);}
}
