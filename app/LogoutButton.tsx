'use client';
import {useRef,useState} from 'react';
import {LogOut} from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';
export default function LogoutButton(){
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');const inFlight=useRef(false);
 async function logout(){
  if(inFlight.current)return;inFlight.current=true;setBusy(true);setError('');
  try{const response=await fetch('/api/auth/sign-out',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});if(!response.ok)throw Error('Could not log out. Please try again.');window.location.assign('/login');}
  catch{inFlight.current=false;setBusy(false);setError('Could not log out. Check your connection and try again.');}
 }
 return <><button type="button" className="icon-btn" aria-label="Sign out" onClick={()=>{setError('');setOpen(true)}}><LogOut size={18}/></button><ConfirmDialog open={open} title="Log out of Hewers?" description="You’ll return to the sign-in screen. Saved records stay in your workspace, and local drafts remain on this device." confirmLabel="Yes, log out" kind="logout" busy={busy} error={error} onConfirm={()=>void logout()} onCancel={()=>setOpen(false)}/></>;
}
