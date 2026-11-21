'use client';
/* Native navigation supports both the static frontend and the Worker-hosted app. */
/* eslint-disable @next/next/no-html-link-for-pages */
import {useEffect,useRef,useState} from 'react';
import {ArrowRight,Eye,EyeOff,LockKeyhole,ShieldCheck,Users,Package} from 'lucide-react';
import {readApiJson} from '../api-client';
import {clearOfflineWorkspace,readOfflineWorkspace,saveOfflineWorkspace} from '../offline-workspace';
import type {State} from '../model';
import type {Access} from '../permissions';
export default function Login(){
 const [username,setUsername]=useState(''),[password,setPassword]=useState(''),[next,setNext]=useState(''),[confirm,setConfirm]=useState(''),[change,setChange]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [visible,setVisible]=useState(false),[stage,setStage]=useState('');
 const submitting=useRef(false);
 const [offline,setOffline]=useState(false),[prepared,setPrepared]=useState(false);
 useEffect(()=>{
  const update=()=>{setOffline(!navigator.onLine);setPrepared(!!readOfflineWorkspace());};
  update();
  window.addEventListener('online',update);
  window.addEventListener('offline',update);
  return()=>{window.removeEventListener('online',update);window.removeEventListener('offline',update);};
 },[]);
 const connectionMessage=prepared&&!change?'No connection. Open offline attendance below.':'Connect to the internet to sign in and set up offline attendance on this phone.';
 async function submit(e:React.FormEvent){
  e.preventDefault();
  if(submitting.current)return;
  if(!navigator.onLine){setError(connectionMessage);return;}
  submitting.current=true;
  let navigating=false;
  setBusy(true);setVisible(false);setStage(change?'Saving your password…':'Checking your sign-in…');setError('');
  try{
   if(change&&next!==confirm)throw Error('New passwords do not match');
   const r=await fetch(change?'/api/account/password':'/api/auth/sign-in/username',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify(change?{currentPassword:password,newPassword:next}:{username:username.trim(),password,rememberMe:false})});
   const b=await readApiJson<{message?:string;error?:string}>(r);
   if(!r.ok)throw Error(b.message||b.error||'Sign-in failed');
   clearOfflineWorkspace();
   setPrepared(false);
   setStage('Opening your workspace…');
   if(!change){
    const check=await fetch('/api/workspace',{cache:'no-store'});
    const result=await readApiJson<{error?:string;state?:State;access?:Access}>(check);
    if(result.error?.startsWith('PASSWORD_REQUIRED')){setChange(true);return;}
    if(!check.ok)throw Error(result.error||'Unable to open workspace');
    if(result.state&&result.access)saveOfflineWorkspace(result.access,result.state);
   }
   navigating=true;window.location.assign('/');
  }catch(error){
   setError(error instanceof TypeError
    ?(!change&&readOfflineWorkspace()?'No connection. Open offline attendance below.':'Hewers could not reach the server. Check your connection and try again.')
    :error instanceof Error?error.message:'Unable to sign in');
  }finally{if(!navigating){submitting.current=false;setBusy(false);}}
 }
 return <div className="workspace-gate branded-login"><img src="/hewers-logo.svg" alt="Hewers Manpower Services" width={250} height={100} style={{height:"auto"}}/><aside className="login-story"><p className="hero-kicker">HEWERS MANPOWER SERVICES</p><h2>Manage your team.<br/><span>Anytime,<br/> anywhere.</span></h2><p>Track attendance, manage inventory, and keep your workforce connected.</p><div className="login-features"><span><Users size={18}/>People and attendance</span><span><Package size={18}/>Materials and site records</span><span><ShieldCheck size={18}/>Access for your assigned role</span></div><div className="login-brandline">SITE OPERATIONS, CONNECTED</div></aside><section className="panel login-card"><div className="login-lock" aria-hidden="true"><LockKeyhole size={25}/></div><span className="login-eyebrow">YOUR HEWERS WORKSPACE</span><h1>{change?'Set your personal password':'Sign in to Hewers'}</h1><p>{change?'Your temporary password must be changed before you can access site records.':'Use the username and password provided by your administrator.'}</p>{offline&&<p role="status">{connectionMessage}</p>}<form onSubmit={submit} aria-busy={busy}><fieldset disabled={busy||offline} className="login-fields">{!change&&<label>Username<input required autoCapitalize="none" spellCheck={false} autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)}/></label>}<label>{change?'Temporary password':'Password'}<span className="password-control"><input type={visible?'text':'password'} autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/><button type="button" className="password-toggle" aria-label={visible?'Hide password':'Show password'} aria-pressed={visible} onClick={()=>setVisible(!visible)}>{visible?<EyeOff size={19}/>:<Eye size={19}/>}</button></span></label>{change&&<><label>New password<input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={next} onChange={e=>setNext(e.target.value)}/></label><label>Confirm new password<input type="password" autoComplete="new-password" required value={confirm} onChange={e=>setConfirm(e.target.value)}/></label><small>Use at least 12 characters. Choose a password you do not use elsewhere.</small></>}</fieldset>{error&&<div className="error" role="alert">{error}</div>}<button className="btn login-submit" disabled={busy||offline}>{busy?<><span className="loading-spinner" aria-hidden="true"/>{stage}</>:<>{change?'Save password and continue':'Sign in to workspace'}<ArrowRight size={18}/></>}</button><span className="login-progress" role="status">{busy?stage:''}</span></form><p className="fineprint">Forgot your password? Ask an administrator for a temporary reset.</p>{prepared&&!change&&!busy?<a className="btn secondary" href="/?offline=attendance">Open offline attendance</a>:<a href="/">Return to workspace</a>}</section></div>;
}
