import type {MotionAction,MotionFrame} from './face-motion';
import {checkFaceQuality} from './face-quality';
// Camera frames stay in the browser. Only numerical descriptors go to this site's protected API.
let ready:Promise<any>|null=null;
export function loadFaceEngine():Promise<any>{
 if(ready)return ready;
 ready=(async()=>{
  if(!(window as any).faceapi)await new Promise<void>((resolve,reject)=>{const script=document.createElement('script');script.src='/vendor/face-api-1.7.15.js';script.onload=()=>resolve();script.onerror=()=>{script.remove();reject(Error('Face engine could not load. Check your connection and try again.'))};document.head.appendChild(script)});
  const api=(window as any).faceapi;try{if(!await api.tf.setBackend('webgl'))throw Error('WebGL unavailable')}catch{if(!await api.tf.setBackend('cpu'))throw Error('This device cannot start the face engine. Try another browser.')}await api.tf.ready();
  await Promise.all([api.nets.ssdMobilenetv1.loadFromUri('/face-models'),api.nets.faceLandmark68Net.loadFromUri('/face-models'),api.nets.faceRecognitionNet.loadFromUri('/face-models')]);return api;
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


export async function captureDescriptor(video:HTMLVideoElement){return (await observe(video)).describe();}
export async function captureMotion(video:HTMLVideoElement,actions:MotionAction[],started:number,onPrompt:(s:string)=>void,alive:()=>boolean){
 const evidence:MotionFrame[]=[];
 for(const action of actions){
  let phase=0,baseline=0;const deadline=Date.now()+25000;
  while(phase<3){
   if(!alive())throw Error('Camera check cancelled');
   if(Date.now()>deadline)throw Error('Camera check timed out. Start again and follow the prompts.');
   onPrompt(phase===0?'Look straight ahead with both eyes open':phase===2?'Look straight ahead and open your eyes again':action==='eyes'?'Close both eyes and hold for a moment':action==='left'?'Slowly turn your nose toward the right edge of the camera image':'Slowly turn your nose toward the left edge of the camera image');
   try{
    const f={...await observe(video,false),elapsed:Date.now()-started};
    const centered=Math.abs(f.yaw)<=.14;
    const elapsed=phase===0||f.elapsed-evidence.at(-1)!.elapsed>=180;
    const valid=phase===0?centered&&f.eyeRatio>=.19:phase===2?centered&&f.eyeRatio>=baseline*.85:action==='eyes'?centered&&f.eyeRatio<=Math.min(.16,baseline*.65):action==='left'?f.yaw<=-.24:f.yaw>=.24;
    if(valid&&elapsed){if(phase===0)baseline=f.eyeRatio;evidence.push({elapsed:f.elapsed,eyeRatio:f.eyeRatio,yaw:f.yaw,descriptor:await f.describe()});phase++;}
   }catch(e){if(!alive())throw e;}
   await new Promise(resolve=>setTimeout(resolve,120));
  }
 }
 return evidence;
}
