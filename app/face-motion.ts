import {distance,validateDescriptor} from './face-math';
export type MotionAction='eyes'|'left'|'right';
export type MotionFrame={elapsed:number;eyeRatio:number;yaw:number;descriptor:number[]};
export function validateMotion(actions:MotionAction[],frames:MotionFrame[],samples:number[][],availableMs:number){
 if(!Array.isArray(frames)||frames.length!==actions.length*3)throw Error('Complete every camera movement before submitting');
 let previous=-1;
 for(const f of frames){
  if(!Number.isFinite(f.elapsed)||f.elapsed<=previous||f.elapsed<0||f.elapsed>70000||f.elapsed>availableMs+1500||!Number.isFinite(f.eyeRatio)||f.eyeRatio<0||f.eyeRatio>1||!Number.isFinite(f.yaw)||Math.abs(f.yaw)>1)throw Error('Invalid motion capture timing or landmarks');
  previous=f.elapsed;validateDescriptor(f.descriptor);
  if(samples.some(s=>distance(s,f.descriptor)>.4))throw Error('Keep the same person in view throughout the camera check');
 }
 if(frames.at(-1)!.elapsed-frames[0].elapsed<600)throw Error('Camera movements were too quick. Try again.');
 actions.forEach((action,i)=>{
  const [a,b,c]=frames.slice(i*3,i*3+3);
  if(Math.abs(a.yaw)>.14||Math.abs(c.yaw)>.14||a.eyeRatio<.19||c.eyeRatio<a.eyeRatio*.8||b.elapsed-a.elapsed<100||c.elapsed-b.elapsed<100)throw Error('Start and finish each movement looking straight ahead with eyes open');
  if(action==='eyes'?(Math.abs(b.yaw)>.14||b.eyeRatio>Math.min(.16,a.eyeRatio*.65)):(action==='left'?b.yaw>-.24:b.yaw<.24))throw Error('The requested camera movement was not completed');
 });
 return true;
}

// A stationary pair checks capture consistency, not liveness or presentation attacks.
export function validateStationary(frames:MotionFrame[],samples:number[][],availableMs:number){
 if(!Array.isArray(frames)||frames.length!==2)throw Error('Two clear face captures are required');
 let previous=-1;
 for(const [i,f] of frames.entries()){
  if(!Number.isFinite(f.elapsed)||f.elapsed<=previous||f.elapsed<0||f.elapsed>20000||f.elapsed>availableMs+1500||!Number.isFinite(f.yaw)||Math.abs(f.yaw)>.22||!Number.isFinite(f.eyeRatio)||f.eyeRatio<0||f.eyeRatio>1)throw Error('Look directly at the camera and hold still');
  validateDescriptor(f.descriptor);if(distance(f.descriptor,samples[i])>0.000001)throw Error('Face capture evidence does not match the submitted samples');previous=f.elapsed;
 }
 if(frames[1].elapsed-frames[0].elapsed<300)throw Error('Hold still for the second face capture');
 return true;
}
