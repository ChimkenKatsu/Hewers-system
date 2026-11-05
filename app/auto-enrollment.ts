export type AutoEnrollmentState={demo:boolean;ready:boolean;camera:boolean;engine:boolean;busy:boolean;alert:boolean;workerId:string;purpose:string;consent:boolean;enabled:boolean;paused:boolean;enrolled:boolean;allowed:boolean};
export function autoEnrollmentAllowed(s:AutoEnrollmentState){return !s.demo&&s.ready&&s.camera&&s.engine&&!s.busy&&!s.alert&&!!s.workerId&&s.purpose==='enroll'&&s.consent&&s.enabled&&!s.paused&&!s.enrolled&&s.allowed;}
/** Trigger once only after consecutive clear-face checks span the hold period. */
export function autoEnrollmentGate(holdMs=1400){
 let readySince:number|null=null,triggered=false;
 return {check(eligible:boolean,faceReady:boolean,now:number){
  if(triggered)return {capture:false,seconds:0};
  if(!eligible||!faceReady){readySince=null;return {capture:false,seconds:0};}
  if(readySince===null)readySince=now;
  const remaining=Math.max(0,holdMs-(now-readySince));
  if(remaining===0)triggered=true;
  return {capture:remaining===0,seconds:Math.ceil(remaining/1000)};
 }};
}
