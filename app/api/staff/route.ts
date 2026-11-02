import {usesSupabase,members,sb,eq,rpc} from '../../supabase-server';
import {env} from 'cloudflare:workers';
import {context,json,fail,originCheck} from '../../server-access';
function admin(ctx:any){if(ctx.access.role!=='administrator'||ctx.access.owner!==ctx.access.userId)throw Error('FORBIDDEN: Only the workspace owner can manage staff')}
export async function GET(req:Request){try{const ctx=await context(req);admin(ctx);const rows=usesSupabase()?{results:await members(ctx.access.owner)}:await env.DB!.prepare('SELECT id,email,name,role,site_ids,active,created FROM memberships WHERE owner=? ORDER BY created DESC').bind(ctx.access.owner).all<any>();return json({members:rows.results.map(m=>({...m,siteIds:JSON.parse(m.site_ids)}))})}catch(e){return fail(e)}}
export async function POST(req:Request){try{
 originCheck(req);const ctx=await context(req);admin(ctx);const p=await req.json() as any;
 if(p.action==='revoke'){if(usesSupabase())await sb('hewers_staff?workspace_id='+eq(ctx.access.owner)+'&id='+eq(String(p.id)),'PATCH',{active:false});else await env.DB!.prepare('UPDATE memberships SET active=0 WHERE id=? AND owner=?').bind(String(p.id),ctx.access.owner).run();return json({ok:true})}
 const email=String(p.email||'').trim().toLowerCase(),name=String(p.name||'').trim();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||!name||name.length>120)throw Error('Enter a valid staff name and email');
 if(email===ctx.access.email)throw Error('The workspace owner already has administrator access');
 if(!['manager','supervisor','custodian','viewer'].includes(p.role))throw Error('Select a valid role');
 if(!Array.isArray(p.siteIds)||p.siteIds.length===0||p.siteIds.some((id:any)=>!ctx.state.sites.some(s=>s.id===id)))throw Error('Assign at least one valid construction site');
 const sites=JSON.stringify([...new Set(p.siteIds)]),now=new Date().toISOString();
 if(usesSupabase()){await rpc('hewers_save_staff',{p_owner:ctx.access.owner,p_staff:{id:crypto.randomUUID(),email,name,role:p.role,siteIds:JSON.parse(sites),active:true,created:now}});return json({ok:true})}
 await env.DB!.prepare('INSERT INTO memberships (id,owner,email,name,role,site_ids,active,created) VALUES (?,?,?,?,?,?,1,?) ON CONFLICT(owner,email) DO UPDATE SET name=excluded.name,role=excluded.role,site_ids=excluded.site_ids,active=1').bind(crypto.randomUUID(),ctx.access.owner,email,name,p.role,sites,now).run();return json({ok:true});
}catch(e){return fail(e)}}
