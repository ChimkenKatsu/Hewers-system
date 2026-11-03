import assert from 'node:assert/strict';
import {validateMotion,validateStationary} from '../app/face-motion.ts';
const descriptor=Array(128).fill(.1),samples=[descriptor,descriptor];
const frames=[0,1,2,3,4,5].map((n)=>({elapsed:n*200,eyeRatio:n===1?.1:.28,yaw:n===4?.3:0,descriptor}));
assert.equal(validateMotion(['eyes','right'],frames,samples,2000),true);
assert.throws(()=>validateMotion(['eyes','left'],frames,samples,2000));
assert.throws(()=>validateMotion(['eyes','right'],frames.map(f=>({...f,eyeRatio:.28})),samples,2000));
assert.throws(()=>validateMotion(['eyes','right'],frames.map(f=>({...f,yaw:0})),samples,2000));
assert.throws(()=>validateMotion(['eyes','right'],frames.map((f,n)=>({...f,descriptor:n===3?Array(128).fill(-.1):descriptor})),samples,2000));
assert.throws(()=>validateMotion(['eyes','right'],frames.slice(0,3),samples,2000));
assert.throws(()=>validateMotion(['eyes','right'],frames.map(f=>({...f,elapsed:0})),samples,2000));
console.log('PASS: ordered eye/head motions, static-photo landmarks, wrong direction, face substitution, missing and replayed frames');

const pair=[{elapsed:0,eyeRatio:.13,yaw:.12,descriptor},{elapsed:400,eyeRatio:.13,yaw:.13,descriptor}];
assert.equal(validateStationary(pair,samples,1000),true);
assert.throws(()=>validateStationary(pair.map(f=>({...f,elapsed:0})),samples,1000));
assert.throws(()=>validateStationary(pair.map((f,i)=>({...f,descriptor:i?Array(128).fill(-.1):descriptor})),samples,1000));
assert.throws(()=>validateStationary(pair.map(f=>({...f,yaw:.4})),samples,1000));
console.log('PASS: stationary pair, capture timing, forward pose and sample/evidence binding');
