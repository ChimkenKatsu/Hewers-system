import assert from 'node:assert/strict';
import {validateMotion} from '../app/face-motion';
import {validatePair} from '../app/face-math';
import {captureDescriptor,captureMotion,captureSequence,inspectCapture} from '../app/face-client';
// Exercise capture scheduling with a fake engine. This is not a camera accuracy benchmark.
let detections=0,descriptions=0,aligned=0,canvases=0,frameVersion=0;
const descriptor=Array(128).fill(.1);
const eye=(x:number,ratio:number)=>[{x:x-10,y:100},{x:x-5,y:100-ratio*10},{x:x+5,y:100-ratio*10},{x:x+10,y:100},{x:x+5,y:100+ratio*10},{x:x-5,y:100+ratio*10}];
let prompt='',mode='normal';
const api={tf:{setBackend:async()=>true,ready:async()=>{}},nets:Object.fromEntries(['ssdMobilenetv1','faceLandmark68Net','faceRecognitionNet'].map(n=>[n,{loadFromUri:async()=>{}}])),SsdMobilenetv1Options:class{},
 detectAllFaces(){detections++;return {withFaceLandmarks:async()=>{if(mode==='gpu-error')throw Error('Tensor backend failed');
  // Every other poll deliberately fails the eye/head action; descriptors must
  // only run after the landmark gate accepts a frame.
  const active=detections%2===0,ratio=mode==='eyes-closed'?.1:active&&prompt.includes('Close BOTH')?.1:.28;
  const yaw=active&&prompt.includes('LEFT edge')?.3:0;
  return [{detection:{box:{x:40,y:40,width:220,height:220}},landmarks:{getLeftEye:()=>eye(100,ratio),getRightEye:()=>eye(160,ratio),getNose:()=>[{}, {}, {}, {x:130+yaw*60,y:130}],align:(_n:unknown,options:{useDlibAlignment:boolean})=>{assert.equal(options.useDlibAlignment,true);aligned++;return {}}}}];
 }};},
 extractFaces:async()=>{const version=frameVersion;await new Promise(r=>setTimeout(r,1));assert.equal(frameVersion,version,'Guidance and capture must not overwrite a frame during recognition');return [{}]},computeFaceDescriptor:async()=>{descriptions++;return descriptor;},
};
const pixels=new Uint8ClampedArray(220*220*4);for(let i=0;i<pixels.length;i+=4){const v=((i/4)%2)*100+80;pixels[i]=pixels[i+1]=pixels[i+2]=v;pixels[i+3]=255;}
Object.defineProperty(globalThis,'window',{value:{faceapi:api}});
Object.defineProperty(globalThis,'document',{value:{createElement:()=>{canvases++;return {width:0,height:0,getContext:()=>({drawImage(){frameVersion++},getImageData:()=>({data:pixels})})}}}});
const video={videoWidth:640,videoHeight:480,readyState:2} as HTMLVideoElement;
const now=Date.now;let clock=100000;Date.now=()=>clock+=200;
try{
 assert.deepEqual(await captureDescriptor(video),descriptor);
 const frames=await captureMotion(video,['eyes','right'],clock,s=>prompt=s,()=>true);
 assert.equal(frames.length,6);assert.equal(descriptions,7);assert.equal(aligned,7);
 assert.ok(detections>descriptions,'Polling must skip unnecessary recognition work');
 assert.equal(canvases,1,'A single video should reuse its capture canvas');
 const before=descriptions;const guidance=await inspectCapture(video);assert.equal(guidance.ready,true);assert.equal(descriptions,before,'Guidance must not run recognition');
 const captures=await Promise.all([captureDescriptor(video),inspectCapture(video),captureDescriptor(video)]);assert.deepEqual(captures[0],descriptor);assert.deepEqual(captures[2],descriptor);assert.equal(canvases,1);
 const beforeSequence=descriptions;const sequence=await captureSequence(video,['eyes','right'],clock,s=>prompt=s,()=>true);assert.equal(descriptions-beforeSequence,6,'Use six motion descriptors, not eight separate captures');assert.equal(sequence.samples[0],sequence.frames[0].descriptor);assert.equal(sequence.samples[1],sequence.frames[5].descriptor);validatePair(sequence.samples);assert.equal(validateMotion(['eyes','right'],sequence.frames,sequence.samples,70000),true);
 mode='eyes-closed';assert.equal((await inspectCapture(video)).ready,false,'Readiness must check the same open-eye requirement as motion capture');
 mode='gpu-error';const beforeFailure=detections;await assert.rejects(()=>captureMotion(video,['eyes','right'],clock,s=>prompt=s,()=>true),/Tensor backend failed/);assert.equal(detections-beforeFailure,1,'Inference errors must fail immediately');
 mode='normal';await assert.rejects(()=>captureMotion(video,['eyes','right'],clock,()=>{},()=>false),/cancelled/);
 console.log(`PASS: ${detections} landmark polls use only ${descriptions} recognition calls; same Dlib alignment and reusable canvas`);
}finally{Date.now=now;}
