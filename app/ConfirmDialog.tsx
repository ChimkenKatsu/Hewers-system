'use client';
import {useEffect,useId,useRef} from 'react';
import {Archive,LogOut,RotateCcw} from 'lucide-react';

export default function ConfirmDialog({open,title,description,confirmLabel,onConfirm,onCancel,busy=false,error='',kind='archive'}:{open:boolean;title:string;description:string;confirmLabel:string;onConfirm:()=>void;onCancel:()=>void;busy?:boolean;error?:string;kind?:'archive'|'restore'|'logout'}){
 const dialog=useRef<HTMLDialogElement>(null),cancel=useRef<HTMLButtonElement>(null),id=useId();
 useEffect(()=>{
  const element=dialog.current;if(!element)return;
  if(!open){if(element.open)element.close();return;}
  if(!element.open)element.showModal();cancel.current?.focus();
  const previous=document.body.style.overflow;document.body.style.overflow='hidden';
  return()=>{if(element.open)element.close();document.body.style.overflow=previous;};
 },[open]);
 const Icon=kind==='logout'?LogOut:kind==='restore'?RotateCcw:Archive;
 return <dialog ref={dialog} className="confirm-dialog" role="alertdialog" aria-labelledby={id+'-title'} aria-describedby={id+'-description'} aria-busy={busy} onCancel={event=>{event.preventDefault();if(!busy)onCancel();}} onClick={event=>{if(event.target===event.currentTarget&&!busy){const rect=event.currentTarget.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)onCancel();}}}>
  <div className={'confirm-dialog-icon '+kind}><Icon size={34} aria-hidden="true"/></div>
  <span className="confirm-dialog-eyebrow">HEWERS WORKSPACE</span>
  <h2 id={id+'-title'}>{title}</h2><p id={id+'-description'}>{description}</p>
  {error&&<div className="error" role="alert">{error}</div>}
  <div className="confirm-dialog-actions"><button ref={cancel} type="button" className="btn secondary" disabled={busy} onClick={onCancel}>Cancel</button><button type="button" className="btn" disabled={busy} onClick={onConfirm}>{busy?<><span className="loading-spinner" aria-hidden="true"/>Please wait…</>:confirmLabel}</button></div>
 </dialog>;
}
