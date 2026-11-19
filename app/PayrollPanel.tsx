'use client';

import {useEffect,useState} from 'react';
import {readApiJson} from './api-client';
import {downloadText} from './download-text';
import {grossPay,parsePayrollRate,payrollColumns,type PayrollRow} from './payroll';
import ResponsiveTable from './ResponsiveTable';

type PayrollResult={rows:PayrollRow[];revision:number};
const columns=[...payrollColumns,'Review'];
const decimal=new Intl.NumberFormat('en-PH',{minimumFractionDigits:2,maximumFractionDigits:4});
const money=new Intl.NumberFormat('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2});

function currentPayrollWeek(){
  const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Manila'}).format(new Date());
  const date=new Date(today+'T00:00:00Z');
  date.setUTCDate(date.getUTCDate()-(date.getUTCDay()+6)%7);
  return date.toISOString().slice(0,10);
}

function exportPayroll(week:string,rows:PayrollRow[]){
  const csv=[payrollColumns,...rows.map(row=>[row.idnum,row.name,row.rate,row.hr_rate,row.week_start,row.hours_to_pay,row.weekly_pay])];
  const quote=(value:string|number|null)=>{
    let text=String(value??'');
    if(typeof value==='string'&&/^(?:\s*[=+\-@]|[\t\r\n])/.test(text))text="'"+text;
    return '"'+text.replaceAll('"','""')+'"';
  };
  downloadText('\uFEFF'+csv.map(row=>row.map(quote).join(',')).join('\r\n'),'Hewers-Weekly-Payroll-'+week+'.csv','text/csv;charset=utf-8');
}

export default function PayrollPanel({workspaceId}:{workspaceId:string}){
  const [week,setWeek]=useState(currentPayrollWeek);
  const [result,setResult]=useState<PayrollResult|null>(null);
  const [draft,setDraft]=useState<Record<string,string>>({});
  const [error,setError]=useState('');
  const [status,setStatus]=useState('');
  const [refresh,setRefresh]=useState(0);
  const [saving,setSaving]=useState(false);
  const url='/api/payroll?'+new URLSearchParams({week});

  useEffect(()=>{
    if(!week)return;
    const controller=new AbortController();
    async function load(){
      try{
        const response=await fetch(url,{headers:{'x-workspace-id':workspaceId},signal:controller.signal,cache:'no-store'});
        const data=await readApiJson<PayrollResult|{error:string}>(response);
        if(!response.ok||!('rows' in data))throw Error('error' in data?data.error:'Unable to load payroll.');
        if(!controller.signal.aborted)setResult(data);
      }catch(cause){
        if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:'Unable to load payroll.');
      }
    }
    void load();
    return()=>controller.abort();
  },[url,week,workspaceId,refresh]);

  const rows=result?.rows.map(row=>{
    const text=Object.hasOwn(draft,row.idnum)?draft[row.idnum]:String(row.hr_rate??'');
    let rate:number|null=null;
    try{rate=parsePayrollRate(text);}catch{/* The inline review message explains invalid input. */}
    const issues=row.issues.filter(issue=>issue.text!=='Hourly rate needed');
    if(rate===null)issues.push({date:week,text:text?'Enter a valid hourly rate':'Hourly rate needed'});
    return {...row,text,issues,gross:rate===null||issues.length?null:grossPay(rate,row.hours_to_pay)};
  })??[];
  const blocked=rows.filter(row=>row.issues.length).length;

  function clear(){
    setResult(null);
    setError('');
    setStatus('');
  }

  async function saveAndExport(){
    if(!result||!rows.length||blocked||saving)return;
    setSaving(true);
    setError('');
    setStatus('');
    try{
      const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','x-workspace-id':workspaceId},
        body:JSON.stringify({revision:result.revision,rates:rows.map(row=>({idnum:row.idnum,rate:row.text}))})});
      const data=await readApiJson<PayrollResult|{error:string}>(response);
      if(!response.ok||!('rows' in data))throw Error('error' in data?data.error:'Unable to save payroll.');
      setResult(data);
      setDraft({});
      exportPayroll(week,data.rows);
      setStatus('Reviewed payroll saved to Supabase. The CSV is ready to save or import.');
    }catch(cause){
      setError(cause instanceof Error?cause.message:'Unable to save payroll.');
    }finally{setSaving(false);}
  }

  return <section className="panel">
    <div className="panel-head">
      <div>
        <h2>Weekly payroll</h2>
        <p>Review seven days of attendance in Philippine Time. Gross pay uses payable hours × the entered hourly rate.</p>
      </div>
      <button className="btn secondary" disabled={!week||saving} onClick={()=>{clear();setRefresh(value=>value+1);}}>Refresh payroll</button>
    </div>
    <div className="filterbar">
      <label className="filter-group">Week start
        <input className="date-filter" type="date" value={week} disabled={saving} onChange={event=>{
          clear();setDraft({});setWeek(event.target.value);
        }}/>
      </label>
      <button className="btn" disabled={!rows.length||!!blocked||saving} onClick={()=>void saveAndExport()}>
        {saving?'Saving payroll…':'Save and export CSV'}
      </button>
    </div>
    {!week&&<p role="status">Choose a week start date.</p>}
    {week&&!result&&!error&&<p role="status">Loading payroll…</p>}
    {error&&<p className="error" role="alert">{error}</p>}
    {status&&<p role="status">{status}</p>}
    {!!blocked&&<p role="status">{blocked} {blocked===1?'worker needs':'workers need'} review before export. Resolve attendance issues in Attendance, then refresh payroll.</p>}
    {result&&!rows.length&&<p role="status">No attendance or pending review for this week.</p>}
    {!!rows.length&&<div className="table-scroll">
      <ResponsiveTable labels={columns}>
        <thead><tr>{columns.map(column=><th key={column} scope="col">{column}</th>)}</tr></thead>
        <tbody>{rows.map(row=><tr key={row.idnum}>
          <td>{row.idnum}</td>
          <td><strong>{row.name}</strong></td>
          <td>{row.rate===null?'—':decimal.format(row.rate)}</td>
          <td><input aria-label={'Hourly rate for '+row.name} inputMode="decimal" size={10} value={row.text} disabled={saving}
            onChange={event=>{setDraft({...draft,[row.idnum]:event.target.value});setStatus('');}}/></td>
          <td>{row.week_start}</td>
          <td>{decimal.format(row.hours_to_pay)}</td>
          <td><strong>{row.gross===null?'—':money.format(row.gross)}</strong></td>
          <td>{row.issues.length?<ul>{row.issues.map(issue=><li key={issue.date+issue.text}>{issue.date} · {issue.text}</li>)}</ul>:'Ready'}</td>
        </tr>)}</tbody>
      </ResponsiveTable>
    </div>}
  </section>;
}
