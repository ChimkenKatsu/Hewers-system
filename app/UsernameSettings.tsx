'use client';
import {useState} from 'react';
import {readApiJson} from './api-client';

export default function UsernameSettings({current,onUpdated}:{current:string;onUpdated:(username:string)=>void}){
 const [username,setUsername]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 async function submit(e:React.FormEvent){e.preventDefault();if(busy)return;setBusy(true);setError('');setMessage('');try{
  const r=await fetch('/api/account/username',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,currentPassword:password})});
  const b=await readApiJson<{username:string;message:string;error?:string;warning?:string}>(r);
  if(!r.ok)throw Error(b.error||'Unable to update username');
  setPassword('');setUsername('');setMessage(b.message+(b.warning?' '+b.warning:''));onUpdated(b.username);
 }catch(e){setError(e instanceof Error?e.message:'Unable to update username')}finally{setBusy(false)}}
 return <section className="panel staff-form username-settings"><h2>Your administrator username</h2><p>Currently signed in as <strong>{current}</strong>. Your records and permissions stay with your account.</p><form onSubmit={submit}><fieldset disabled={busy}><label>New username<input required minLength={3} maxLength={30} pattern="[A-Za-z0-9_]{3,30}" autoCapitalize="none" autoComplete="off" spellCheck={false} value={username} onChange={e=>setUsername(e.target.value)}/><small>3–30 letters, numbers or underscores. Saved in lowercase.</small></label><label>Current password<input required maxLength={128} type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="btn" disabled={busy}>{busy?'Updating…':'Change username'}</button></fieldset></form>{error&&<p className="error" role="alert">{error}</p>}{message&&<p role="status">{message}</p>}</section>;
}
