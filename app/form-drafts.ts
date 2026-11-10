export type PhotoUploadDraft={id:string;stamp:string;url?:string;uploadedAt?:number};
export type FormDraft={id:string;form:Record<string,string|number>;file?:File;photoUpload?:PhotoUploadDraft;updated:number};
let connection:Promise<IDBDatabase>|undefined;
function database(){return connection??=(new Promise<IDBDatabase>((resolve,reject)=>{const open=indexedDB.open('hewers-form-drafts',1);open.onupgradeneeded=()=>open.result.createObjectStore('drafts',{keyPath:'id'});open.onsuccess=()=>resolve(open.result);open.onerror=()=>reject(open.error);open.onblocked=()=>reject(Error('Draft storage is busy in another tab'))})).catch(e=>{connection=undefined;throw e})}
const writes=new Map<string,Promise<unknown>>();
async function transaction<T>(mode:IDBTransactionMode,action:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T>{const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('drafts',mode),r=action(tx.objectStore('drafts'));tx.oncomplete=()=>resolve(r.result);tx.onabort=()=>reject(tx.error||Error('Draft could not be saved'));tx.onerror=()=>reject(tx.error)})}
function ordered<T>(id:string,action:()=>Promise<T>){const previous=writes.get(id)||Promise.resolve();const next=previous.catch(()=>{}).then(action);writes.set(id,next);void next.finally(()=>{if(writes.get(id)===next)writes.delete(id)}).catch(()=>{});return next}
export async function loadDraft(id:string){await writes.get(id)?.catch(()=>{});return transaction('readonly',s=>s.get(id)) as Promise<FormDraft|undefined>}
export function saveDraft(draft:FormDraft){return ordered(draft.id,()=>transaction('readwrite',s=>s.put(draft)))}
export function removeDraft(id:string){return ordered(id,()=>transaction('readwrite',s=>s.delete(id)))}
