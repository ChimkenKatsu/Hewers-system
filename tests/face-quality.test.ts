import assert from 'node:assert/strict';
import {checkFaceQuality} from '../app/face-quality.ts';
const image=(value:(x:number,y:number)=>number)=>{const p=new Uint8ClampedArray(100*100*4);for(let y=0;y<100;y++)for(let x=0;x<100;x++){const i=(y*100+x)*4;p[i]=p[i+1]=p[i+2]=value(x,y);p[i+3]=255}return p};
assert.throws(()=>checkFaceQuality(image(()=>15),100,100),/lighting/);
assert.throws(()=>checkFaceQuality(image(()=>245),100,100),/lighting/);
assert.throws(()=>checkFaceQuality(image(()=>130),100,100),/blurry/);
assert.doesNotThrow(()=>checkFaceQuality(image((x,y)=>(x+y)%2?110:150),100,100));
console.log('PASS: dark, overexposed, blurred capture rejection and clear texture acceptance.');
