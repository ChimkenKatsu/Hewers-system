import {env} from 'cloudflare:workers';
import type {MotionAction,MotionFrame} from './face-motion';
import {validateMotion,validateStationary} from './face-motion';
type Claims={id:string;owner:string;operator:string;worker:string;purpose:string;issued:number;actions:MotionAction[];captureMode?:string};
const encode=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
const decode=(s:string)=>Uint8Array.from(atob(s.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
async function key(){const secret=(env as unknown as {AUTH_SECRET?:string}).AUTH_SECRET;if(!secret||secret.length<32)throw Error('Face camera checks need AUTH_SECRET configured');return crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
export async function motionChallenge(fields:Omit<Claims,'actions'>){
 const actions:MotionAction[]=[];
 const payload=encode(new TextEncoder().encode(JSON.stringify({...fields,actions,captureMode:'pair'})));
 const signature=encode(new Uint8Array(await crypto.subtle.sign('HMAC',await key(),new TextEncoder().encode(payload))));
 return {token:payload+'.'+signature,actions,captureMode:'pair'};
}
export async function checkMotion(token:unknown,frames:MotionFrame[],expected:Omit<Claims,'actions'|'issued'>,samples:number[][]){
 if(typeof token!=='string'||token.length>3000)throw Error('A fresh camera movement check is required');
 const [payload,signature,extra]=token.split('.');let claims:Claims;
 try{if(extra||!await crypto.subtle.verify('HMAC',await key(),decode(signature),new TextEncoder().encode(payload)))throw Error();claims=JSON.parse(new TextDecoder().decode(decode(payload)));}catch{throw Error('Invalid camera challenge. Start a new capture.');}
 if(Object.entries(expected).some(([k,v])=>claims[k as keyof Claims]!==v)||!Number.isFinite(claims.issued)||Date.now()<claims.issued||Date.now()-claims.issued>90000||!Array.isArray(claims.actions))throw Error('Capture challenge expired or belongs to another capture');
 if(claims.captureMode==='pair'){if(claims.actions.length!==0)throw Error('Invalid capture challenge');return validateStationary(frames,samples,Date.now()-claims.issued)}
 // Allow already-issued movement tokens to finish during deployment (maximum 90 seconds).
 if(!(claims.actions.length===2&&claims.actions.includes('eyes')&&claims.actions.some(a=>a==='left'||a==='right')))throw Error('Invalid capture challenge');
 validateMotion(claims.actions,frames,samples,Date.now()-claims.issued);
}
