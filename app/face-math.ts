export const FACE_MODEL='face-api-1.7.15-ssd68-resnet128';
export const MATCH_THRESHOLD=0.4;
export function validateDescriptor(v:unknown):number[]{
 if(!Array.isArray(v)||v.length!==128||v.some(x=>typeof x!=='number'||!Number.isFinite(x)||Math.abs(x)>2))throw Error('Invalid face descriptor');
 const norm=Math.sqrt(v.reduce((n,x)=>n+x*x,0));if(norm<0.5||norm>3)throw Error('Invalid face descriptor magnitude');return v;
}
export function distance(a:number[],b:number[]){if(a.length!==b.length)throw Error('Incompatible descriptors');return Math.sqrt(a.reduce((sum,x,i)=>sum+(x-b[i])**2,0))}
export function validatePair(samples:unknown):number[][]{if(!Array.isArray(samples)||samples.length!==2)throw Error('Two face captures are required');const pair=samples.map(validateDescriptor);if(distance(pair[0],pair[1])>0.25)throw Error('Face captures are inconsistent. Try again in even lighting.');return pair}
export function matches(samples:number[][],stored:number[][]){try{const captures=validatePair(samples),references=validatePair(stored);return captures.every(sample=>references.every(reference=>distance(sample,reference)<=MATCH_THRESHOLD))}catch{return false}}

