import {context,fail,json,originCheck} from '../../server-access';
import {sb,usesSupabase} from '../../supabase-server';
import {validDate} from '../../workspace-navigation';
import {parsePayrollRate,payrollReview,type PayrollRow,type SavedRate} from '../../payroll';

async function load(req:Request){
  const ctx=await context(req);
  if(ctx.access.role!=='administrator')throw Error('FORBIDDEN: Only administrators can access payroll.');
  const week=new URL(req.url).searchParams.get('week')??'';
  if(!validDate(week)||week.slice(0,4)==='0000')throw Error('Choose a valid week start date.');
  if(!usesSupabase())throw Error('Payroll requires a Supabase connection.');
  const workerIds=new Set(payrollReview(ctx.state,week,new Map()).map(row=>row.idnum));
  const rates=new Map<string,SavedRate>();
  const query=new URLSearchParams({workspace_id:'eq.'+ctx.access.owner,week_start:'lte.'+week,
    select:'idnum,rate,hr_rate,week_start',order:'week_start.desc,idnum.asc',limit:'100'});
  for(let offset=0;rates.size<workerIds.size;){
    query.set('offset',String(offset));
    const batch=await sb('hewers_weekly_payroll?'+query) as SavedRate[];
    if(!batch.length)break;
    for(const row of batch)if(workerIds.has(row.idnum)&&!rates.has(row.idnum))rates.set(row.idnum,row);
    offset+=batch.length;
  }
  return {ctx,week,rates,workerIds};
}

export async function GET(req:Request){
  try{
    const {ctx,week,rates}=await load(req);
    return json({rows:payrollReview(ctx.state,week,rates),revision:ctx.revision});
  }catch(error){return fail(error);}
}

export async function POST(req:Request){
  try{
    originCheck(req);
    const {ctx,week,rates,workerIds}=await load(req);
    const body=await req.json() as {revision?:unknown;rates?:unknown};
    if(body.revision!==ctx.revision)throw Error('CONFLICT: Attendance changed. Refresh payroll and review the latest hours.');
    if(!Array.isArray(body.rates)||body.rates.length>workerIds.size)throw Error('Invalid payroll rates.');
    const selected=new Map<string,number>();
    for(const row of body.rates){
      if(typeof row?.idnum!=='string'||!workerIds.has(row.idnum)||selected.has(row.idnum))throw Error('Invalid payroll worker.');
      selected.set(row.idnum,parsePayrollRate(row.rate));
    }

    const rows=payrollReview(ctx.state,week,rates,selected);
    if(!rows.length||rows.some(row=>row.issues.length))return json({error:'Resolve all payroll issues before saving the week.'},409);
    const records=rows.map(({issues:_,weekly_pay:__,...row})=>({...row,workspace_id:ctx.access.owner}));
    const saved=await sb('hewers_weekly_payroll?on_conflict=workspace_id,idnum,week_start','POST',records,'resolution=merge-duplicates,return=representation') as PayrollRow[];
    const byId=new Map(saved.map(row=>[row.idnum,row]));
    return json({rows:rows.map(row=>({...row,weekly_pay:byId.get(row.idnum)?.weekly_pay??row.weekly_pay})),revision:ctx.revision});
  }catch(error){return fail(error);}
}
