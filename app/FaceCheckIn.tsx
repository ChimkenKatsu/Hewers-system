'use client';

import {useEffect, useRef, useState} from 'react';
import {ScanFace} from 'lucide-react';
import {readApiJson} from './api-client';
import {autoEnrollmentGate} from './auto-enrollment';
import {captureSequence, inspectCapture, loadFaceEngine} from './face-client';
import {FACE_MODEL} from './face-math';
import type {MotionAction} from './face-motion';

type Challenge = {challenge:string; motion:{token:string;actions:MotionAction[]}};
type CheckIn = {workerName:string;timeIn:string;alreadyCheckedIn:boolean};
const time = new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',hour:'numeric',minute:'2-digit'});
const readyMessage = 'Look straight at the camera and hold still.';

export default function FaceCheckIn({workspaceId, siteId, siteName}: {workspaceId:string;siteId:string;siteName:string}){
 const video=useRef<HTMLVideoElement>(null);
 const [paused,setPaused]=useState(false);
 const [visible,setVisible]=useState(false);
 const [preview,setPreview]=useState(false);
 const [message,setMessage]=useState('Starting camera…');
 const [result,setResult]=useState('');
 const [cameraError,setCameraError]=useState('');
 const [retry,setRetry]=useState(0);

 useEffect(()=>{
  const update=()=>setVisible(!document.hidden);
  update();
  document.addEventListener('visibilitychange',update);
  return()=>document.removeEventListener('visibilitychange',update);
 },[]);

 useEffect(()=>{
  const player=video.current;
  if(!siteId||!visible||paused||!player)return;
  const controller=new AbortController();
  let stream:MediaStream|undefined;
  let timer:ReturnType<typeof setTimeout>;
  let gate=autoEnrollmentGate();
  let waitingForExit=false;
  let emptySince:number|undefined;
  const alive=()=>!controller.signal.aborted&&!document.hidden&&stream?.active===true;
  const stop=()=>{
   controller.abort();
   clearTimeout(timer);
   stream?.getTracks().forEach(track=>track.stop());
   if(player.srcObject===stream)player.srcObject=null;
  };

  async function post<T>(body:Record<string,unknown>){
   const response=await fetch('/api/face',{
    method:'POST',headers:{'Content-Type':'application/json','x-workspace-id':workspaceId},
    body:JSON.stringify({...body,siteId}),signal:controller.signal,
   });
   const data=await readApiJson<T & {error?:string}>(response);
   if(!response.ok)throw Error(data.error||'Unable to record check-in. Ask the site operator for help.');
   return data;
  }

  async function scan(){
   const {challenge,motion}=await post<Challenge>({action:'kiosk-challenge'});
   const {frames,samples}=await captureSequence(player!,motion.actions,Date.now(),setMessage,alive);
   if(!alive())return;
   setMessage('Matching face and recording Time In…');
   const entry=await post<CheckIn>({action:'kiosk-submit',challenge,model:FACE_MODEL,samples,motion:{token:motion.token,frames}});
   if(alive())setResult(entry.workerName+' · '+(entry.alreadyCheckedIn?'Already checked in':'Time In recorded')+' at '+time.format(new Date(entry.timeIn))+' PHT');
  }

  async function inspect(){
   if(!alive())return;
   const hint=await inspectCapture(player!);
   if(!alive())return;
   if(waitingForExit){
    const now=performance.now();
    emptySince=hint.reason==='no-face'?emptySince??now:undefined;
    if(emptySince!==undefined&&now-emptySince>=900){
     waitingForExit=false;
     emptySince=undefined;
     gate=autoEnrollmentGate();
     setResult('');
     setMessage(readyMessage);
    }
   }else{
    const next=gate.check(true,hint.ready,performance.now());
    setMessage(next.seconds?'Hold still · checking in automatically…':hint.ready?readyMessage:hint.message);
    if(next.capture){
     waitingForExit=true;
     try{await scan()}catch(error){
      if(alive())setResult(error instanceof Error?error.message:'Unable to record check-in.');
     }
     if(alive())setMessage('Step away to clear the camera for the next worker.');
    }
   }
   if(alive())timer=setTimeout(()=>void inspect(),450);
  }

  async function start(){
   setPreview(false);
   setCameraError('');
   setResult('');
   setMessage('Starting camera…');
   try{
    if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia)throw Error('Open Hewers over HTTPS to use the camera.');
    stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:640},height:{ideal:480}},audio:false});
    if(!alive()){stream.getTracks().forEach(track=>track.stop());return;}
    stream.getVideoTracks()[0]?.addEventListener('ended',()=>{
     if(!controller.signal.aborted){setPreview(false);setCameraError('Camera disconnected. Reconnect it, then retry.');stop();}
    },{once:true});
    player!.srcObject=stream;
    await player!.play();
    if(!alive())return;
    setPreview(true);
    setMessage('Loading face recognition…');
    await loadFaceEngine();
    if(alive())void inspect();
   }catch(error){
    if(controller.signal.aborted)return;
    setPreview(false);
    setCameraError(error instanceof DOMException&&error.name==='NotAllowedError'
     ?'Allow camera access in your browser or device settings, then retry.'
     :error instanceof Error?error.message:'Unable to start the camera.');
    stop();
   }
  }
  void start();
  return stop;
 },[workspaceId,siteId,visible,paused,retry]);

 const active=!!siteId&&visible&&!paused;
 const status=!siteId?'The site operator needs to choose a construction site above.'
  :paused?'Camera paused.':!visible?'Camera waits for the check-in screen to be visible.'
  :cameraError?'Camera unavailable.':message;
 return <section className="panel face-camera">
  <div className="panel-head"><div><h2 id="hands-free-check-in-heading" tabIndex={-1}><ScanFace size={20}/>Hands-free Time In</h2>
   <p>{siteName?siteName+' · ':''}One person at a time. Look at the camera to check in.</p></div>
   <span className="badge amber">Supervised use</span>
  </div>
  <div className="scan-prompt" role="status">{active&&result&&<strong>{result}<br/></strong>}{status}</div>
  <div className="camera-stage">
   <video ref={video} muted playsInline aria-label="Live check-in camera"/>
   {active&&preview&&<div className="face-guide"/>}
   {(!active||!preview)&&<div className="camera-placeholder"><ScanFace size={42}/><p>{status}</p></div>}
  </div>
  {active&&cameraError&&<div className="error" role="alert">{cameraError}</div>}
  {!!siteId&&<div className="camera-actions">
   {cameraError&&!paused
    ?<button className="btn secondary" onClick={()=>setRetry(value=>value+1)}>Retry camera</button>
    :<button className="btn secondary" onClick={()=>setPaused(value=>!value)}>{paused?'Resume camera':'Pause camera'}</button>}
  </div>}
  <p className="fineprint">Workers need a one-time enrollment. The device may ask for camera permission. A site operator must supervise the scanner.</p>
 </section>;
}
