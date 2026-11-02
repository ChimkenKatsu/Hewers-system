import assert from 'node:assert/strict';
import {demoState} from '../app/model.ts';
import {authorize,visibleState,can} from '../app/permissions.ts';
import type {Access,Role} from '../app/permissions.ts';
import {validateDescriptor,validatePair,matches,distance} from '../app/face-math.ts';
const s=demoState();
const a=(role:Role):Access=>({owner:'owner',userId:'staff',email:'staff@example.test',role,siteIds:['s1']});
for(const role of ['manager','supervisor','custodian','viewer'] as Role[]){
 const view=visibleState(s,a(role));assert.deepEqual(view.sites.map(x=>x.id),['s1']);
 for(const list of [view.workers,view.attendance,view.materials,view.movements,view.photos])assert.ok(list.every(x=>x.siteId==='s1'));
 assert.throws(()=>authorize(a(role),s,'site',{}),/FORBIDDEN/);
 assert.throws(()=>authorize(a(role),s,'staff',{}),/FORBIDDEN/);
}
assert.throws(()=>authorize(a('supervisor'),s,'attendance',{workerId:'w3'}),/FORBIDDEN/);
authorize(a('supervisor'),s,'attendance',{workerId:'w0'});
assert.throws(()=>authorize(a('supervisor'),s,'movement',{materialId:'m1'}),/FORBIDDEN/);
authorize(a('custodian'),s,'movement',{materialId:'m1'});
assert.throws(()=>authorize(a('custodian'),s,'movement',{materialId:'m4'}),/FORBIDDEN/);
assert.equal(visibleState(s,a('custodian')).workers.length,0);
assert.equal(visibleState(s,a('custodian')).attendance.length,0);
assert.throws(()=>authorize(a('viewer'),s,'photo',{siteId:'s1'}),/FORBIDDEN/);
const descriptor=Array(128).fill(0.1),near=Array(128).fill(0.101),different=Array(128).fill(-0.1);
validateDescriptor(descriptor);validatePair([descriptor,near]);assert.ok(matches([descriptor,near],[descriptor,near]));assert.ok(!matches([different,different],[descriptor,near]));
assert.throws(()=>validateDescriptor(Array(128).fill(0)),/magnitude/);
assert.throws(()=>validateDescriptor(Array(127).fill(.1)),/Invalid/);
assert.throws(()=>validateDescriptor(Array(128).fill(NaN)),/Invalid/);
assert.throws(()=>validatePair([descriptor,different]),/inconsistent/);
console.log('PASS: role matrix, forged site access denial, filtered reads, custodian privacy, descriptor validation, match/non-match thresholds.');
