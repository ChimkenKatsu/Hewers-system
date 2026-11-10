import type {State} from './model';
export type MovementSubmission={id:string;userId:string;fingerprint:string};
export async function movementSubmission(id:unknown,userId:string,p:Record<string,unknown>):Promise<MovementSubmission>{
 if(typeof id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))throw Error('Refresh Hewers before submitting this stock movement. A submission ID is required.');
 const text=JSON.stringify([p.materialId,p.type,Number(p.quantity),typeof p.note==='string'?p.note.trim():p.note]);
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
 return {id:id.toLowerCase(),userId,fingerprint:Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('')};
}
export function savedMovementSubmission(state:State,submission:MovementSubmission){
 const saved=state.movementReceipts?.find(r=>r.id===submission.id);if(!saved)return;
 if(saved.userId!==submission.userId||saved.fingerprint!==submission.fingerprint)throw Error('CONFLICT: This submission ID was already used for different details. Check movement history before opening a new stock movement.');
 return saved;
}
