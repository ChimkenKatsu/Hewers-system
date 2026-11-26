'use client';

import {useEffect, useRef, useState} from 'react';
import {ArrowLeft,CheckCircle2,CloudOff,ScanFace,TriangleAlert} from 'lucide-react';
import {readApiJson} from './api-client';
import {autoEnrollmentGate} from './auto-enrollment';
import {captureSequence, inspectCapture, loadFaceEngine} from './face-client';
import {FACE_MODEL} from './face-math';
import type {MotionAction} from './face-motion';
import {scannerActions, type ScannerAction} from './lunch-attendance';
import {saveOfflineFace,useOfflineFaceSummary} from './offline-face-queue';
import OfflineFaceReview from './OfflineFaceReview';

type Challenge = {challenge:string; motion:{token:string;actions:MotionAction[]}};
type ScanResult = {workerName:string;timeIn?:string;alreadyCheckedIn?:boolean;recordedAt?:string;alreadyRecorded?:boolean};
type ScannerFeedback={kind:'matched'|'saved'|'retry'|'unrecognized';text:string;worker?:string};
const time = new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',hour:'numeric',minute:'2-digit'});
const readyMessage = 'Look straight at the camera and hold still.';

class ScanConnectionError extends Error {}
class UnrecognizedWorkerError extends Error {}

export default function FaceCheckIn({workspaceId, userId, siteId, siteName, onBack, onRegister}: {workspaceId:string;userId:string;siteId:string;siteName:string;onBack?:()=>void;onRegister?:()=>void}){
 const offline=useOfflineFaceSummary(workspaceId,userId);
 const video=useRef<HTMLVideoElement>(null);
 const recognitionDialog=useRef<HTMLDialogElement>(null);
 const activeMode=useRef<ScannerAction>('in');
 const [mode,setMode]=useState<ScannerAction>('in');
 const [scanning,setScanning]=useState(false);
 const [paused,setPaused]=useState(false);
 const [visible,setVisible]=useState(false);
 const [preview,setPreview]=useState(false);
 const [message,setMessage]=useState('Starting camera…');
 const [result,setResult]=useState<ScannerFeedback|null>(null);
 const [cameraError,setCameraError]=useState('');
 const [retry,setRetry]=useState(0);

 useEffect(()=>{
  const dialog=recognitionDialog.current;
  if(!dialog)return;
  if(result?.kind==='unrecognized'&&!paused&&visible&&!dialog.open)dialog.showModal();
  else if((result?.kind!=='unrecognized'||paused||!visible)&&dialog.open)dialog.close();
 },[result,paused,visible]);

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
  let gate=autoEnrollmentGate(550);
  let gateMode=activeMode.current;
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
   if(!navigator.onLine)throw new ScanConnectionError();
   const response=await fetch('/api/face',{
    method:'POST',headers:{'Content-Type':'application/json','x-workspace-id':workspaceId},
    body:JSON.stringify({...body,siteId}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(6000)]),
   }).catch(error=>{
    if(controller.signal.aborted)throw error;
    throw new ScanConnectionError('Attendance server unavailable.');
   });
   if(response.status>=502&&response.status<=504)throw new ScanConnectionError('Attendance server unavailable.');
   const data=await readApiJson<T & {error?:string;code?:string}>(response);
   if(response.status===422&&data.code==='mismatch')throw new UnrecognizedWorkerError(data.error);
   if(!response.ok)throw Error(data.error||'Unable to record check-in. Ask the site operator for help.');
   return data;
  }

  async function scan(action:ScannerAction){
   const started=Date.now();
   const challengeRequest=post<Challenge>({action:'kiosk-challenge',mode:action}).then(value=>({value}),error=>({error}));
   const {frames,samples}=await captureSequence(player!,[],started,setMessage,alive);
   if(!alive())return;
   const occurredAt=new Date(started+frames[0].elapsed).toISOString();
   const pairedFrames=frames.map(frame=>({...frame,elapsed:frame.elapsed-frames[0].elapsed}));
   try{
    const response=await challengeRequest;
    if('error' in response)throw response.error;
    const {challenge,motion}=response.value;
    if(motion.actions.length)throw Error('The scanner requires an updated capture mode.');
    if(!alive())return;
    setMessage('Matching face · '+scannerActions[action]+'…');
    const entry=await post<ScanResult>({action:'kiosk-submit',mode:action,challenge,model:FACE_MODEL,samples,motion:{token:motion.token,frames:pairedFrames}});
    const recordedAt=entry.recordedAt??entry.timeIn;
    if(alive()&&recordedAt)setResult({kind:'matched',worker:entry.workerName,text:scannerActions[action]+(entry.alreadyRecorded||entry.alreadyCheckedIn?' already recorded':' recorded')+' · '+time.format(new Date(recordedAt))+' PHT'});
   }catch(error){
    if(!(error instanceof ScanConnectionError)||!alive())throw error;
    await saveOfflineFace({owner:workspaceId,userId,siteId,mode:action,occurredAt,frames:pairedFrames});
    if(alive())setResult({kind:'saved',text:'Face matching and approval follow when the connection returns.'});
   }
  }

  async function inspect(){
   if(!alive())return;
   if(recognitionDialog.current?.open){timer=setTimeout(()=>void inspect(),250);return;}
   const hint=await inspectCapture(player!);
   if(!alive())return;
   if(waitingForExit){
    const now=performance.now();
    emptySince=hint.reason==='no-face'?emptySince??now:undefined;
    if(emptySince!==undefined&&now-emptySince>=900){
     waitingForExit=false;
     emptySince=undefined;
     gate=autoEnrollmentGate(550);
     setMessage(readyMessage);
    }
   }else{
    if(gateMode!==activeMode.current){
     gateMode=activeMode.current;
     gate=autoEnrollmentGate(550);
    }
    const next=gate.check(true,hint.ready,performance.now());
    setMessage(next.seconds?'Hold still · '+scannerActions[gateMode]+' will record automatically…':hint.ready?readyMessage:hint.message);
    if(next.capture){
     waitingForExit=true;
     setResult(null);
     setScanning(true);
     try{await scan(gateMode)}catch(error){
      if(alive())setResult({kind:error instanceof UnrecognizedWorkerError?'unrecognized':'retry',text:error instanceof Error?error.message:'Unable to record attendance.'});
     }finally{
      if(!controller.signal.aborted)setScanning(false);
     }
     if(alive())setMessage('Step away from the camera before the next scan.');
    }
   }
   if(alive())timer=setTimeout(()=>void inspect(),150);
  }

  async function start(){
   setPreview(false);
   setScanning(false);
   setCameraError('');
   setResult(null);
   setMessage('Starting camera…');
   try{
    if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia)throw Error('Open Hewers over HTTPS to use the camera.');
    const engine=loadFaceEngine();
    // Camera permission can take longer than model loading. Observe a rejection
    // immediately, then surface it through the existing camera error handler.
    void engine.catch(()=>{});
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
    await engine;
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
 },[workspaceId,userId,siteId,visible,paused,retry]);

 const active=!!siteId&&visible&&!paused;
 const status=!siteId?'The site operator needs to choose a construction site above.'
  :paused?'Camera paused.':!visible?'Camera waits for the check-in screen to be visible.'
  :cameraError?'Camera unavailable.':message;
 return <section className="panel face-camera kiosk-scan">
  <dialog ref={recognitionDialog} className="face-alert" aria-labelledby="scan-unrecognized-title" aria-describedby="scan-unrecognized-message" onClose={()=>setResult(current=>current?.kind==='unrecognized'?null:current)}>
   <TriangleAlert className="scan-warning-icon" size={44} aria-hidden="true"/>
   <h2 id="scan-unrecognized-title">Worker not recognized</h2>
   <p id="scan-unrecognized-message">{result?.kind==='unrecognized'?result.text:''}</p>
   {onRegister&&<button className="btn" onClick={onRegister}>Register New Worker</button>}
   <button className={onRegister?'text-btn':'btn'} onClick={()=>recognitionDialog.current?.close()}>Return to scanner</button>
  </dialog>
  <div className="camera-stage">
   <video ref={video} muted playsInline aria-label="Live check-in camera"/>
   {active&&preview&&<div className="face-guide" aria-hidden="true"/>}
   {(!active||!preview)&&<div className="camera-placeholder" aria-hidden="true"><ScanFace size={42}/></div>}
   <div className="kiosk-top-overlay">
    {onBack&&<button className="text-btn kiosk-back" onClick={onBack}><ArrowLeft size={16}/>Attendance</button>}
    <h2 id="hands-free-check-in-heading" tabIndex={-1}>Hands-free attendance</h2>
    {active&&result?.kind==='matched'
     ?<p className="kiosk-success-title" role="status">Face Scanned Successfully</p>
     :<p>{siteName?siteName+' · ':''}One person at a time. Face the camera and hold still.</p>}
    <label className="select-wrap">Attendance action
     <select value={mode} disabled={active&&scanning} onChange={event=>{
      const action=event.target.value as ScannerAction;
      activeMode.current=action;
      setMode(action);
      setResult(null);
     }}>
      {Object.entries(scannerActions).map(([action,label])=><option key={action} value={action}>{label}</option>)}
     </select>
    </label>
   </div>
   <div className="kiosk-feedback" role="status">
    {active&&result&&result.kind!=='unrecognized'&&<div className={'kiosk-result '+result.kind}>
     {result.kind==='matched'?<CheckCircle2 aria-hidden="true"/>:result.kind==='saved'?<CloudOff aria-hidden="true"/>:<TriangleAlert aria-hidden="true"/>}
     <div><strong>{result.kind==='matched'?result.worker:result.kind==='saved'?'Saved offline':'Scan needs attention'}</strong><span>{result.text}</span></div>
    </div>}
    <p className="kiosk-status">{status}</p>
   </div>
  </div>
  {offline.queued>0&&<p className="kiosk-queue">{offline.queued} {offline.queued===1?'scan':'scans'} waiting to sync</p>}
  <OfflineFaceReview scans={offline.review}/>
  {active&&cameraError&&<div className="error" role="alert">{cameraError}</div>}
  {!!siteId&&<div className="camera-actions">
   {cameraError&&!paused
    ?<button className="btn secondary" onClick={()=>setRetry(value=>value+1)}>Retry camera</button>
    :<button className="btn secondary" onClick={()=>setPaused(value=>!value)}>{paused?'Resume camera':'Pause camera'}</button>}
  </div>}
  <p className="fineprint">Workers need a one-time enrollment. The device may ask for camera permission. A site operator must supervise the scanner.</p>
 </section>;
}
