export default {
 async scheduled(_event,env,ctx){ctx.waitUntil((async()=>{
  if(!env.REMINDER_CRON_SECRET){console.warn('Reminder scheduler is not configured');return;}
  const response=await env.HEWERS_BACKEND.fetch('https://hewers-workforce.tristandominicparajes-202200583.workers.dev/api/internal/attendance-reminders',{method:'POST',headers:{Authorization:'Bearer '+env.REMINDER_CRON_SECRET,'Content-Type':'application/json'},body:'{}'});
  if(!response.ok)throw Error('Hewers reminder check failed: '+response.status);
 })());},
 fetch(){return new Response('Not found',{status:404});}
};
