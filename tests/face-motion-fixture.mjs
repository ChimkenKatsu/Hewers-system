// Synthetic landmarks exercise validation only; they do not measure camera/PAD accuracy.
export function motionProof(challenge,descriptor){
 if(challenge.motion.captureMode==='pair')return {token:challenge.motion.token,frames:[0,400].map(elapsed=>({elapsed,eyeRatio:.14,yaw:0,descriptor}))};
 return {token:challenge.motion.token,frames:challenge.motion.actions.flatMap((action,i)=>[0,1,2].map((phase,j)=>({elapsed:i*600+j*200,eyeRatio:action==='eyes'&&phase===1?.1:.28,yaw:phase===1&&action!=='eyes'?(action==='left'?-.3:.3):0,descriptor}))) };
}
