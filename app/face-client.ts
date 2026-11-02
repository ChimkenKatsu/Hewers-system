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
export async function captureDescriptor(video:HTMLVideoElement){
 if(!video.videoWidth||video.readyState<2)throw Error('Camera is not ready');
 const api=await loadFaceEngine();const frame=document.createElement('canvas');frame.width=video.videoWidth;frame.height=video.videoHeight;const context=frame.getContext('2d');if(!context)throw Error('Unable to capture the camera. Try another browser.');context.drawImage(video,0,0);const found=await api.detectAllFaces(frame,new api.SsdMobilenetv1Options({minConfidence:0.9,maxResults:3})).withFaceLandmarks().withFaceDescriptors();
 if(found.length!==1)throw Error(found.length?'Only one person should be visible in the camera':'No clear face detected. Face the camera in even lighting.');
 const face=found[0];if(face.detection.box.width<90||face.detection.box.height<90)throw Error('Move a little closer to the camera');if(face.detection.box.width/Math.max(frame.width,frame.height)<0.2)throw Error('Move closer so your face fills the guide');const box=face.detection.box;
 const left=Math.max(0,Math.floor(box.x)),top=Math.max(0,Math.floor(box.y)),width=Math.min(Math.floor(box.width),frame.width-left),height=Math.min(Math.floor(box.height),frame.height-top);
 if(box.x<0||box.y<0||box.x+box.width>frame.width||box.y+box.height>frame.height)throw Error('Keep your whole face inside the camera view');
 const eyes=face.landmarks.getLeftEye(),right=face.landmarks.getRightEye(),nose=face.landmarks.getNose();
 const center=(points:{x:number;y:number}[])=>({x:points.reduce((n,p)=>n+p.x,0)/points.length,y:points.reduce((n,p)=>n+p.y,0)/points.length});
 const l=center(eyes),r=center(right),tip=nose[3],span=Math.abs(r.x-l.x);
 if(span<20||Math.abs(r.y-l.y)/span>.18||Math.abs(tip.x-(l.x+r.x)/2)/span>.22)throw Error('Look straight at the camera and keep your head level');
 checkFaceQuality(context.getImageData(left,top,width,height).data,width,height);
 return Array.from(face.descriptor) as number[];
}

