import type {MotionAction,MotionFrame} from './face-motion';
import {validatePair} from './face-math';
import {scanReason} from './scan-reasons';
import {checkFaceQuality} from './face-quality';
// Camera frames stay in the browser. Only numerical descriptors go to this site's protected API.
let ready:Promise<any>|null=null;
export function loadFaceEngine():Promise<any>{
 if(ready)return ready;
 ready=(async()=>{
  if(!(window as any).faceapi)await new Promise<void>((resolve,reject)=>{const script=document.createElement('script');script.src='/vendor/face-api-1.7.15.js';script.onload=()=>resolve();script.onerror=()=>{script.remove();reject(Error('Face engine could not load. Check your connection and try again.'))};document.head.appendChild(script)});
  const api=(window as any).faceapi;try{if(!await api.tf.setBackend('webgl'))throw Error('WebGL unavailable')}catch{if(!await api.tf.setBackend('cpu'))throw Error('This device cannot start the face engine. Try another browser.')}await api.tf.ready();
  await Promise.all([api.nets.ssdMobilenetv1.loadFromUri('/face-models'),api.nets.faceLandmark68Net.loadFromUri('/face-models'),api.nets.faceRecognitionNet.loadFromUri('/face-models')]);
  // Compile the three inference paths before the operator's first capture.
  // This blank local canvas contains no worker image and creates no enrollment.
  const warmup=document.createElement('canvas');warmup.width=640;warmup.height=480;
  await api.detectAllFaces(warmup,new api.SsdMobilenetv1Options({minConfidence:0.9,maxResults:3}));
  warmup.width=150;warmup.height=150;
  await api.nets.faceLandmark68Net.detectLandmarks(warmup);
  await api.computeFaceDescriptor(warmup);
  return api;
 })().catch(e=>{ready=null;throw e});return ready;
}
const captureCanvases=new WeakMap<HTMLVideoElement,HTMLCanvasElement>();
async function observe(video:HTMLVideoElement,frontal=true){
 if(!video.videoWidth||video.readyState<2)throw Error('Camera is not ready');
 const api=await loadFaceEngine();let frame=captureCanvases.get(video);if(!frame){frame=document.createElement('canvas');captureCanvases.set(video,frame);}const scale=Math.min(1,640/Math.max(video.videoWidth,video.videoHeight));const w=Math.round(video.videoWidth*scale),h=Math.round(video.videoHeight*scale);if(frame.width!==w)frame.width=w;if(frame.height!==h)frame.height=h;const context=frame.getContext('2d');if(!context)throw Error('Unable to capture the camera. Try another browser.');context.drawImage(video,0,0,frame.width,frame.height);const found=await api.detectAllFaces(frame,new api.SsdMobilenetv1Options({minConfidence:0.9,maxResults:3})).withFaceLandmarks();
 if(found.length!==1)throw Error(found.length?'Only one person should be visible in the camera':'No clear face detected. Face the camera in even lighting.');
 const face=found[0];if(face.detection.box.width<90||face.detection.box.height<90)throw Error('Move a little closer to the camera');if(face.detection.box.width/Math.max(frame.width,frame.height)<0.2)throw Error('Move closer so your face fills the guide');const box=face.detection.box;
 const left=Math.max(0,Math.floor(box.x)),top=Math.max(0,Math.floor(box.y)),width=Math.min(Math.floor(box.width),frame.width-left),height=Math.min(Math.floor(box.height),frame.height-top);
 if(box.x<0||box.y<0||box.x+box.width>frame.width||box.y+box.height>frame.height)throw Error('Keep your whole face inside the camera view');
 const eyes=face.landmarks.getLeftEye(),right=face.landmarks.getRightEye(),nose=face.landmarks.getNose();
 const center=(points:{x:number;y:number}[])=>({x:points.reduce((n,p)=>n+p.x,0)/points.length,y:points.reduce((n,p)=>n+p.y,0)/points.length});
 const l=center(eyes),r=center(right),tip=nose[3],span=Math.abs(r.x-l.x);
 if(span<20||Math.abs(r.y-l.y)/span>.18||(frontal&&Math.abs(tip.x-(l.x+r.x)/2)/span>.22))throw Error('Look straight at the camera and keep your head level');
 checkFaceQuality(context.getImageData(left,top,width,height).data,width,height);
 const dist=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);
 const ear=(e:{x:number;y:number}[])=>(dist(e[1],e[5])+dist(e[2],e[4]))/(2*dist(e[0],e[3]));
 return {eyeRatio:(ear(eyes)+ear(right))/2,yaw:(tip.x-(l.x+r.x)/2)/span,
  // Match the library's existing Dlib-aligned crop exactly. Only accepted frames
  // run the recognition network; polling frames still detect every visible face.
  describe:async()=>{const [aligned]=await api.extractFaces(frame,[face.landmarks.align(null,{useDlibAlignment:true})]);return Array.from(await api.computeFaceDescriptor(aligned)) as number[];}};
}


const queues=new WeakMap<HTMLVideoElement,Promise<void>>();
async function exclusive<T>(video:HTMLVideoElement,fn:()=>Promise<T>):Promise<T>{const previous=queues.get(video)||Promise.resolve();let release!:()=>void;const current=new Promise<void>(r=>{release=r});queues.set(video,current);await previous;try{return await fn()}finally{release();if(queues.get(video)===current)queues.delete(video)}}
export async function inspectCapture(video:HTMLVideoElement){return exclusive(video,async()=>{try{const face=await observe(video);return {ready:true,message:'Face ready. Hold still, then scan.',reason:'none' as const}}catch(e){return {ready:false,message:e instanceof Error?e.message:'Check your camera',reason:scanReason(e)}}})}
export async function captureDescriptor(video:HTMLVideoElement){return exclusive(video,async()=>(await observe(video)).describe());}
export async function captureMotion(video:HTMLVideoElement,actions:MotionAction[],started:number,onPrompt:(s:string)=>void,alive:()=>boolean){
 const evidence:MotionFrame[]=[];
 for(const [index,action] of actions.entries()){
  let phase=0,baseline=0,lastHint='';const deadline=Date.now()+25000;
  const prompt=()=>phase===0?'Look straight ahead with both eyes open':phase===2?'Return to the center and open both eyes':action==='eyes'?'Close BOTH eyes. Keep them closed until this prompt changes':action==='left'?'Turn toward the RIGHT edge of the preview and hold':'Turn toward the LEFT edge of the preview and hold';
  while(phase<3){
   if(!alive())throw Error('Camera check cancelled');
   if(Date.now()>deadline)throw Error('Movement check timed out at step '+(index+1)+'/'+actions.length+'. '+prompt()+'. '+lastHint);
   const label='Step '+(index+1)+'/'+actions.length+' · ';
   onPrompt(label+prompt());
   try{
    await exclusive(video,async()=>{const f={...await observe(video,false),elapsed:Date.now()-started};
     const centered=Math.abs(f.yaw)<=.14;
     const elapsed=phase===0||f.elapsed-evidence.at(-1)!.elapsed>=180;
     const valid=phase===0?centered&&f.eyeRatio>=.19:phase===2?centered&&f.eyeRatio>=baseline*.85:action==='eyes'?centered&&f.eyeRatio<=Math.min(.16,baseline*.65):action==='left'?f.yaw<=-.24:f.yaw>=.24;
     if(valid&&elapsed){const descriptor=await f.describe();if(!alive())throw Error('Camera check cancelled');if(phase===0)baseline=f.eyeRatio;evidence.push({elapsed:f.elapsed,eyeRatio:f.eyeRatio,yaw:f.yaw,descriptor});phase++;lastHint='';onPrompt(phase===3?label+'Movement captured':label+prompt());}
    });
   }catch(e){
    if(!alive())throw e;
    // Only recoverable camera-quality problems may retry. Model/inference errors
    // must fail immediately instead of silently looping until the timeout.
    if(!['no-face','multiple-faces','too-small','out-of-frame','not-centered','lighting','blur','camera'].includes(scanReason(e)))throw e;
    lastHint=e instanceof Error?e.message:'Check camera position';onPrompt(label+prompt()+' · '+lastHint);
   }
   if(phase<3)await new Promise(resolve=>setTimeout(resolve,80));
  }
 }
 return evidence;
}
export async function captureSequence(video:HTMLVideoElement,actions:MotionAction[],started:number,onPrompt:(s:string)=>void,alive:()=>boolean){
 const frames=actions.length===0?await captureStationary(video,started,onPrompt,alive):await captureMotion(video,actions,started,onPrompt,alive);
 // The first and last motion frames already face forward.
 // Reuse these independent captures instead of running recognition twice more.
 const samples=[frames[0].descriptor,frames[frames.length-1].descriptor];
 return {frames,samples};
}

async function captureStationary(video:HTMLVideoElement,started:number,onPrompt:(message:string)=>void,alive:()=>boolean){
 const frames:MotionFrame[]=[];const deadline=Date.now()+10000;let hint='';
 while(frames.length<2){
  if(!alive())throw Error('Camera check cancelled');
  if(Date.now()>deadline)throw Error('Could not capture a clear face. '+(hint||'Use even lighting, face the camera and hold still.'));
  if(frames.length){const remaining=350-(Date.now()-started-frames[0].elapsed);if(remaining>0)await new Promise(resolve=>setTimeout(resolve,remaining));if(!alive())throw Error('Camera check cancelled');}
  onPrompt(frames.length?'Verifying face · checking the second capture':'Verifying face · checking the first capture');
  try{await exclusive(video,async()=>{const f=await observe(video);const elapsed=Date.now()-started,descriptor=await f.describe();if(!alive())throw Error('Camera check cancelled');if(frames.length)validatePair([frames[0].descriptor,descriptor]);frames.push({elapsed,eyeRatio:f.eyeRatio,yaw:f.yaw,descriptor})});}
  catch(e){if(!alive())throw e;const reason=scanReason(e);if(!['no-face','multiple-faces','too-small','out-of-frame','not-centered','lighting','blur','camera','inconsistent'].includes(reason))throw e;hint=e instanceof Error?e.message:'Face the camera';if(reason==='inconsistent')frames.length=0;onPrompt(hint);}
  if(!frames.length)await new Promise(resolve=>setTimeout(resolve,180));
 }
 return frames;
}
